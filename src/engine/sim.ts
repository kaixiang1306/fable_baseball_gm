import type { BatStats, Game, League, PBEvent, PitStats, Player, Team } from '../types'
import { emptyBat, emptyPit, ovr } from './playerGen'
import { clamp, rand, randInt } from './util'

export const MAX_INN = 12 // 延長賽至 12 局，平手和局
export type StatMode = 'main' | 'farm' | 'none'

/** 一支參賽隊伍的陣容快照（真實球隊、二軍或明星隊） */
export interface Squad {
  name: string
  short: string
  teamId: number          // -1 = 表演隊
  team?: Team             // 真實球隊（用於士氣/輪值等副作用）
  lineup: Player[]
  lineupPos: string[]
  startPitcher: Player
  bullpen: Player[]       // 可用後援（含終結者以外）
  closer: Player | null
}

interface SideRT {
  squad: Squad
  lineup: Player[]        // 比賽中的打線（代打會替換）
  batIdx: number
  pitcher: Player
  pitches: number
  pitcherRuns: number
  usedPitchers: Set<number>
  subbedOut: Set<number>  // 已被換下、不能再上場
  defense: number
}

interface Runner { player: Player; respPitcher: Player }

const FIELD_DIR = ['左外野', '中外野', '右外野', '三壘', '游擊', '二壘', '一壘']

function defenseOf(lineup: Player[], lineupPos: string[]): number {
  const fielders = lineup.filter((p, i) => (lineupPos[i] ?? p.pos) !== 'DH')
  const f = fielders.reduce((s, p) => s + p.field, 0) / Math.max(1, fielders.length)
  return (f - 50) / 1800
}

function pitchLimit(p: Player): number {
  return p.pos === 'SP' ? 55 + p.stam * 0.65 : 18 + p.stam * 0.35
}

function fatigueMult(p: Player, pitches: number): number {
  const limit = pitchLimit(p)
  if (pitches <= limit) return 1
  return clamp(1 - (pitches - limit) / 120, 0.7, 1)
}

/** 由真實球隊建立出賽陣容（自動避開傷兵） */
export function squadFromTeam(L: League, team: Team): Squad {
  const get = (id: number) => L.players[id]
  const healthy = (p: Player | undefined): p is Player => !!p && p.injuryDays === 0
  const roster = Object.values(L.players).filter(p => p.teamId === team.id)

  const lineup: Player[] = []
  const lineupPos: string[] = []
  const usedIds = new Set<number>()
  team.lineup.forEach((id, i) => {
    let p = get(id)
    if (!healthy(p)) {
      // 臨時遞補：最佳健康野手
      p = roster
        .filter(q => !q.isP && q.onMain && healthy(q) && !team.lineup.includes(q.id) && !usedIds.has(q.id))
        .sort((a, b) => ovr(b) - ovr(a))[0]
        ?? roster.filter(q => !q.isP && healthy(q) && !usedIds.has(q.id)).sort((a, b) => ovr(b) - ovr(a))[0]
        ?? get(id) // 真的沒人只好硬上
    }
    if (p) { lineup.push(p); lineupPos.push(team.lineupPos?.[i] ?? p.pos); usedIds.add(p.id) }
  })

  const rotation = team.rotation.map(get).filter(Boolean)
  let sp = rotation[team.nextSP % Math.max(1, rotation.length)]
  if (!healthy(sp)) {
    sp = rotation.filter(healthy)[0]
      ?? roster.filter(q => q.isP && q.onMain && healthy(q)).sort((a, b) => ovr(b) - ovr(a))[0]
      ?? sp
  }
  const bullpen = team.bullpen.map(get).filter(healthy)
  const closerP = team.closer >= 0 ? get(team.closer) : undefined
  return {
    name: team.name, short: team.short, teamId: team.id, team,
    lineup, lineupPos, startPitcher: sp, bullpen,
    closer: healthy(closerP) ? closerP : null,
  }
}

export interface LiveGameOpts {
  game?: Game
  statMode: StatMode
  log: boolean
  userTeamId?: number   // 啟用臨場指揮的球隊（-99 = 停用）
  injuries?: boolean    // 是否進行傷病判定
}

/** 即時逐打席比賽引擎（可互動） */
export class LiveGame {
  L: League
  game?: Game
  statMode: StatMode
  log: boolean
  userTeamId: number
  rollInjuries: boolean

  H: SideRT
  A: SideRT
  inn = 1
  top = true
  outs = 0
  bases: (Runner | null)[] = [null, null, null]
  hs = 0
  as = 0
  done = false
  halfStart = true
  events: PBEvent[] = []
  injuries: { pid: number; days: number }[] = []

  // 戰術指令
  pendingBunt = false
  pendingIBB = false

  private leadTeam: 'H' | 'A' | null = null
  private wP: Player | null = null
  private lP: Player | null = null
  private scratchBat = new Map<number, BatStats>()
  private scratchPit = new Map<number, PitStats>()

  constructor(L: League, home: Squad, away: Squad, opts: LiveGameOpts) {
    this.L = L
    this.game = opts.game
    this.statMode = opts.statMode
    this.log = opts.log
    this.userTeamId = opts.userTeamId ?? -99
    this.rollInjuries = opts.injuries ?? (opts.statMode !== 'none')

    const mk = (squad: Squad): SideRT => ({
      squad,
      lineup: squad.lineup.slice(),
      batIdx: 0,
      pitcher: squad.startPitcher,
      pitches: 0,
      pitcherRuns: 0,
      usedPitchers: new Set([squad.startPitcher.id]),
      subbedOut: new Set(),
      defense: defenseOf(squad.lineup, squad.lineupPos),
    })
    this.H = mk(home)
    this.A = mk(away)
    const hp = this.ps(this.H.pitcher); hp.g++; hp.gs++
    const ap = this.ps(this.A.pitcher); ap.g++; ap.gs++
  }

  /** 數據落點（一軍 / 二軍 / 不計） */
  private bs(p: Player): BatStats {
    if (this.statMode === 'main') return p.bat
    if (this.statMode === 'farm') return p.fbat
    let s = this.scratchBat.get(p.id)
    if (!s) { s = emptyBat(); this.scratchBat.set(p.id, s) }
    return s
  }
  private ps(p: Player): PitStats {
    if (this.statMode === 'main') return p.pit
    if (this.statMode === 'farm') return p.fpit
    let s = this.scratchPit.get(p.id)
    if (!s) { s = emptyPit(); this.scratchPit.set(p.id, s) }
    return s
  }

  private off(): SideRT { return this.top ? this.A : this.H }
  private def(): SideRT { return this.top ? this.H : this.A }

  nextBatter(): Player { return this.off().lineup[this.off().batIdx % this.off().lineup.length] }
  isUserOffense(): boolean { return this.off().squad.teamId === this.userTeamId }
  isUserDefense(): boolean { return this.def().squad.teamId === this.userTeamId }
  canBunt(): boolean {
    return !this.done && this.isUserOffense() && this.outs < 2 && this.bases.some(Boolean)
  }
  canIBB(): boolean {
    return !this.done && this.isUserDefense() && !this.bases[0] && (!!this.bases[1] || !!this.bases[2])
  }
  /** 可代打名單（使用者隊） */
  benchFor(): Player[] {
    const side = this.isUserOffense() ? this.off() : null
    if (!side) return []
    const inGame = new Set(side.lineup.map(p => p.id))
    return Object.values(this.L.players).filter(p =>
      p.teamId === this.userTeamId && !p.isP && p.onMain && p.injuryDays === 0 &&
      !inGame.has(p.id) && !side.subbedOut.has(p.id))
  }

  pinchHit(sub: Player) {
    if (!this.isUserOffense() || this.done) return
    const side = this.off()
    const idx = side.batIdx % side.lineup.length
    const out = side.lineup[idx]
    side.subbedOut.add(out.id)
    side.lineup[idx] = sub
    side.defense = defenseOf(side.lineup, side.squad.lineupPos)
    this.push(`代打！${side.squad.name} 換上 ${sub.name} 代打，換下 ${out.name}。`, false, sub.name)
  }

  private push(text: string, big: boolean, batter = '') {
    if (!this.log) return
    this.events.push({
      text, inn: this.inn, top: this.top, hs: this.hs, as: this.as,
      outs: this.outs, bases: [!!this.bases[0], !!this.bases[1], !!this.bases[2]],
      pitcher: this.def().pitcher.name, batter, big,
    })
  }

  private scoreRunner(r: Runner, rbiTo: Player | null) {
    if (this.top) this.as++; else this.hs++
    this.bs(r.player).r++
    if (rbiTo) this.bs(rbiTo).rbi++
    const rp = this.ps(r.respPitcher)
    rp.r++; rp.er++
    this.def().pitcherRuns++
    const newLead: 'H' | 'A' | null = this.hs > this.as ? 'H' : this.as > this.hs ? 'A' : null
    if (newLead && newLead !== this.leadTeam) {
      this.leadTeam = newLead
      this.wP = newLead === 'H' ? this.H.pitcher : this.A.pitcher
      this.lP = newLead === 'H' ? this.A.pitcher : this.H.pitcher
    } else if (!newLead) {
      this.leadTeam = null
    }
  }

  private maybeChangePitcher() {
    const def = this.def()
    const p = def.pitcher
    const overLimit = def.pitches > pitchLimit(p) * 1.15 || def.pitcherRuns >= 7
    const lateSP = this.inn >= 9 && p.pos === 'SP' && def.pitches > 70
    if (!overLimit && !lateSP) return
    const leadFor = def === this.H ? this.hs - this.as : this.as - this.hs
    const rp = this.pickReliever(def, leadFor)
    if (rp && rp.id !== p.id) {
      def.pitcher = rp
      def.pitches = 0
      def.pitcherRuns = 0
      def.usedPitchers.add(rp.id)
      this.ps(rp).g++
      this.push(`${def.squad.name} 更換投手，由 ${rp.name} 接替投球。`, false)
    }
  }

  private pickReliever(def: SideRT, leadFor: number): Player | null {
    const cands = def.squad.bullpen.filter(p => p.injuryDays === 0 && !def.usedPitchers.has(p.id))
    const closer = def.squad.closer
    if (closer && !def.usedPitchers.has(closer.id) && this.inn >= 9 && leadFor >= 1 && leadFor <= 3) return closer
    if (cands.length === 0) return closer && !def.usedPitchers.has(closer.id) ? closer : null
    const sorted = cands.slice().sort((a, b) => (b.stuff + b.ctrl) - (a.stuff + a.ctrl))
    if (this.inn >= 7) return sorted[0]
    return sorted[Math.min(sorted.length - 1, randInt(Math.floor(sorted.length / 2), sorted.length - 1))]
  }

  /** 推進一個打席（或半局轉換）。回傳本次新增事件的數量。 */
  step(): void {
    if (this.done) return
    const off = this.off()
    const def = this.def()

    if (this.halfStart) {
      this.maybeChangePitcher()
      this.halfStart = false
    }

    // 盜壘嘗試
    const r1 = this.bases[0]
    if (r1 && !this.bases[1] && r1.player.speed > 54 && rand() < (r1.player.speed - 50) / 160) {
      if (rand() < clamp(0.58 + (r1.player.speed - 50) / 130, 0.3, 0.9)) {
        this.bases[1] = r1; this.bases[0] = null
        this.bs(r1.player).sb++
        this.push(`${r1.player.name} 盜上二壘成功！`, false)
      } else {
        this.bases[0] = null
        this.outs++
        this.bs(r1.player).cs++
        this.push(`${r1.player.name} 盜壘失敗，遭到阻殺。${this.outs} 出局。`, false)
        if (this.outs >= 3) { this.endHalf(); return }
      }
    }

    const batter = this.nextBatter()
    off.batIdx++

    if (this.pendingIBB && this.isUserDefense()) {
      this.pendingIBB = false
      this.resolveIBB(batter, def)
    } else if (this.pendingBunt && this.isUserOffense() && this.outs < 2 && this.bases.some(Boolean)) {
      this.pendingBunt = false
      this.resolveBunt(batter, def)
    } else {
      this.pendingBunt = false
      this.pendingIBB = false
      this.resolvePA(batter, def)
    }

    // 再見得分
    if (this.inn >= 9 && !this.top && this.hs > this.as) { this.endGame(true); return }
    if (this.outs >= 3) this.endHalf()
  }

  private resolveIBB(batter: Player, def: SideRT) {
    def.pitches += 4
    this.bs(batter).pa++
    this.bs(batter).bb++
    this.ps(def.pitcher).bb++
    this.advanceWalk(batter, def.pitcher)
    this.push(`${def.squad.name} 比出四指——故意四壞保送 ${batter.name}。`, false, batter.name)
  }

  private resolveBunt(batter: Player, def: SideRT) {
    def.pitches += 2.2
    const b = this.bs(batter)
    b.pa++
    const r = rand()
    const hitP = 0.08 + batter.speed / 1000
    const sacP = clamp(0.60 + batter.contact / 450, 0.6, 0.85)
    if (r < hitP) {
      b.ab++; b.h++
      this.ps(def.pitcher).h++
      const scored = this.advanceHit(batter, '1B', def.pitcher)
      this.push(`${batter.name} 觸擊短打奇襲成功，內野安打！${scored > 0 ? `跑回 ${scored} 分！` : ''}`, scored > 0, batter.name)
    } else if (r < hitP + sacP) {
      // 犧牲觸擊成功：打者出局、跑者各推進一個壘包
      this.outs++
      this.ps(def.pitcher).outs++
      let scoredText = ''
      if (this.bases[2]) { const r3 = this.bases[2]; this.bases[2] = null; this.scoreRunner(r3!, batter); scoredText = `三壘跑者搶回本壘得分！比數 ${this.as}:${this.hs}。` }
      if (this.bases[1]) { this.bases[2] = this.bases[1]; this.bases[1] = null }
      if (this.bases[0]) { this.bases[1] = this.bases[0]; this.bases[0] = null }
      this.push(`${batter.name} 執行犧牲觸擊成功，跑者推進。${this.outs} 出局。${scoredText}`, scoredText !== '', batter.name)
    } else {
      // 觸擊失敗
      b.ab++
      this.ps(def.pitcher).outs++
      this.outs++
      if (rand() < 0.45 && this.bases.some(Boolean)) {
        // 野手選擇：封殺前位跑者，打者上一壘（出局數同樣 +1）
        for (const i of [2, 1, 0]) {
          if (this.bases[i]) { this.bases[i] = null; break }
        }
        this.bases[0] = { player: batter, respPitcher: def.pitcher }
        this.push(`${batter.name} 觸擊點得太正！守方封殺前位跑者。${this.outs} 出局。`, false, batter.name)
      } else {
        this.push(`${batter.name} 觸擊失敗，小飛球被接殺。${this.outs} 出局。`, false, batter.name)
      }
    }
  }

  private resolvePA(batter: Player, def: SideRT) {
    const p = def.pitcher
    const fat = fatigueMult(p, def.pitches)
    const stuff = p.stuff * fat
    const veloE = p.velo * fat
    const ctrl = p.ctrl * (fat < 1 ? fat * 0.95 : 1)
    const bMor = (batter.morale - 55) / 3000
    const pMor = (p.morale - 55) / 4000
    const homeAdv = def === this.A ? 0.004 : 0 // 主隊進攻時微幅加成

    const kP = clamp(0.175 + (stuff * 0.7 + veloE * 0.3 - batter.contact * 0.55 - batter.eye * 0.45) / 290 + pMor, 0.07, 0.38)
    const bbP = clamp(0.078 + (batter.eye - ctrl) / 430, 0.025, 0.15)
    const hbpP = 0.009

    const b = this.bs(batter)
    b.pa++
    let r = rand()
    if (r < kP) {
      def.pitches += 4.8
      b.ab++; b.so++
      const pst = this.ps(p); pst.so++; pst.outs++
      this.outs++
      this.push(`${batter.name} 揮棒落空，遭 ${p.name} 三振！${this.outs} 出局。`, false, batter.name)
      return
    }
    r -= kP
    if (r < bbP) {
      def.pitches += 5.6
      b.bb++; this.ps(p).bb++
      this.advanceWalk(batter, p)
      this.push(`${batter.name} 選到四壞球保送。`, false, batter.name)
      return
    }
    r -= bbP
    if (r < hbpP) {
      def.pitches += 2.5
      b.hbp++
      this.advanceWalk(batter, p)
      this.push(`${batter.name} 遭觸身球擊中，保送上壘。`, false, batter.name)
      return
    }

    def.pitches += 3.3
    const pq = (stuff + veloE) / 2
    const hrP = clamp(0.0045 + batter.power / 3300 + (50 - pq) / 6000, 0.002, 0.05)
    if (rand() < hrP) {
      b.ab++; b.h++; b.hr++
      const pst = this.ps(p); pst.h++; pst.hr++
      const runners = this.bases.filter(Boolean) as Runner[]
      this.bases = [null, null, null]
      for (const run of runners) this.scoreRunner(run, batter)
      this.scoreRunner({ player: batter, respPitcher: p }, batter)
      this.push(`全壘打！！${batter.name} 轟出${runners.length > 0 ? ` ${runners.length + 1} 分` : '陽春'}全壘打！比數 ${this.as}:${this.hs}。`, true, batter.name)
      return
    }

    const babip = clamp(0.298 + (batter.contact - 50) / 580 + (batter.speed - 50) / 2400 - def.defense + bMor + homeAdv, 0.21, 0.40)
    if (rand() < babip) {
      b.ab++; b.h++
      this.ps(p).h++
      const tripleP = clamp(0.004 + (batter.speed - 50) / 1500, 0.001, 0.05)
      const doubleP = 0.185 + batter.power / 900
      const r2 = rand()
      const type = r2 < tripleP ? '3B' : r2 < tripleP + doubleP ? '2B' : '1B'
      if (type === '2B') b.d2++
      if (type === '3B') b.d3++
      const scored = this.advanceHit(batter, type, p)
      const dir = FIELD_DIR[randInt(0, FIELD_DIR.length - 1)]
      const label = type === '1B' ? '安打' : type === '2B' ? '二壘安打' : '三壘安打'
      this.push(`${batter.name} 擊出${dir}方向${label}！${scored > 0 ? `跑回 ${scored} 分，比數 ${this.as}:${this.hs}。` : ''}`, scored > 0, batter.name)
      return
    }

    // 出局
    b.ab++
    if (rand() < 0.46) {
      if (this.bases[0] && this.outs < 2 && rand() < 0.37) {
        const pst = this.ps(p); pst.outs += 2
        this.outs += 2
        this.bases[0] = null
        this.push(`${batter.name} 擊成雙殺打！${Math.min(this.outs, 3)} 出局。`, false, batter.name)
        return
      }
      this.ps(p).outs++
      this.outs++
      const dir = FIELD_DIR[randInt(3, 6)]
      this.push(`${batter.name} 擊出${dir}方向滾地球出局。${this.outs} 出局。`, false, batter.name)
    } else {
      this.ps(p).outs++
      this.outs++
      let sacText = ''
      if (this.outs < 3 && this.bases[2] && rand() < 0.45) {
        const r3 = this.bases[2]!
        this.bases[2] = null
        this.scoreRunner(r3, batter)
        sacText = `三壘跑者回本壘得分！比數 ${this.as}:${this.hs}。`
      }
      const dir = FIELD_DIR[randInt(0, 2)]
      this.push(`${batter.name} 擊出${dir}方向飛球出局。${this.outs} 出局。${sacText}`, sacText !== '', batter.name)
    }
  }

  private advanceWalk(batter: Player, pit: Player) {
    const newRunner: Runner = { player: batter, respPitcher: pit }
    if (this.bases[0]) {
      if (this.bases[1]) {
        if (this.bases[2]) this.scoreRunner(this.bases[2]!, batter)
        this.bases[2] = this.bases[1]
      }
      this.bases[1] = this.bases[0]
    }
    this.bases[0] = newRunner
  }

  private advanceHit(batter: Player, type: '1B' | '2B' | '3B', pit: Player): number {
    let scored = 0
    const sc = (r: Runner) => { this.scoreRunner(r, batter); scored++ }
    const newRunner: Runner = { player: batter, respPitcher: pit }
    const bases = this.bases

    if (type === '3B') {
      for (const i of [2, 1, 0]) if (bases[i]) { sc(bases[i]!); bases[i] = null }
      bases[2] = newRunner
    } else if (type === '2B') {
      if (bases[2]) { sc(bases[2]!); bases[2] = null }
      if (bases[1]) { sc(bases[1]!); bases[1] = null }
      if (bases[0]) {
        const r1 = bases[0]; bases[0] = null
        if (rand() < 0.42 + r1.player.speed / 400) sc(r1)
        else bases[2] = r1
      }
      bases[1] = newRunner
    } else {
      if (bases[2]) { sc(bases[2]!); bases[2] = null }
      if (bases[1]) {
        const r2 = bases[1]; bases[1] = null
        if (rand() < 0.55 + r2.player.speed / 350) sc(r2)
        else bases[2] = r2
      }
      if (bases[0]) {
        const r1 = bases[0]; bases[0] = null
        if (!bases[2] && rand() < 0.22 + r1.player.speed / 450) bases[2] = r1
        else bases[1] = r1
      }
      bases[0] = newRunner
    }
    return scored
  }

  private endHalf() {
    if (this.done) return
    this.push(`${this.inn} 局${this.top ? '上' : '下'}結束，${this.A.squad.name} ${this.as} : ${this.hs} ${this.H.squad.name}。`, false)
    if (this.top) {
      // 9 局下若主隊已領先則比賽結束
      if (this.inn >= 9 && this.hs > this.as) { this.endGame(false); return }
      this.top = false
    } else {
      if (this.inn >= 9 && this.hs !== this.as) { this.endGame(false); return }
      if (this.inn >= MAX_INN) { this.endGame(false); return }
      this.inn++
      this.top = true
    }
    this.outs = 0
    this.bases = [null, null, null]
    this.halfStart = true
  }

  private endGame(walkOff: boolean) {
    if (this.done) return
    this.done = true
    this.finalize(walkOff)
  }

  private finalize(walkOff: boolean) {
    const { hs, as } = this
    if (this.game) {
      this.game.played = true
      this.game.hs = hs
      this.game.as = as
      this.game.inn = Math.min(this.inn, MAX_INN)
    }

    // 勝敗投與救援
    if (hs !== as) {
      const winSide = hs > as ? this.H : this.A
      const loseSide = hs > as ? this.A : this.H
      const w = this.wP ?? winSide.pitcher
      const l = this.lP ?? loseSide.pitcher
      this.ps(w).w++
      this.ps(l).l++
      const last = winSide.pitcher
      if (last.id !== w.id && Math.abs(hs - as) <= 3) this.ps(last).sv++
    }

    // 真實球隊副作用（僅一軍賽事）
    if (this.statMode === 'main') {
      const homeT = this.H.squad.team
      const awayT = this.A.squad.team
      if (homeT) homeT.nextSP = (homeT.nextSP + 1) % Math.max(1, homeT.rotation.length)
      if (awayT) awayT.nextSP = (awayT.nextSP + 1) % Math.max(1, awayT.rotation.length)
      if (homeT && awayT) {
        if (hs > as) { homeT.morale = clamp(homeT.morale + 2, 20, 90); awayT.morale = clamp(awayT.morale - 2, 20, 90) }
        else if (as > hs) { awayT.morale = clamp(awayT.morale + 2, 20, 90); homeT.morale = clamp(homeT.morale - 2, 20, 90) }
      }
    }

    // 傷病判定
    if (this.rollInjuries) {
      const farmMult = this.statMode === 'farm' ? 0.5 : 1
      const roll = (p: Player, base: number) => {
        if (p.injuryDays > 0) return
        if (rand() < base * farmMult) {
          const sev = rand()
          const days = sev < 0.6 ? randInt(5, 14) : sev < 0.9 ? randInt(15, 35) : randInt(36, 80)
          p.injuryDays = days
          this.injuries.push({ pid: p.id, days })
        }
      }
      for (const side of [this.H, this.A]) {
        for (const p of side.lineup) roll(p, 0.0035)
        for (const id of side.usedPitchers) {
          const p = this.L.players[id]
          if (p) roll(p, p.id === side.pitcher.id && side.pitches > pitchLimit(p) * 1.15 ? 0.009 : 0.005)
        }
      }
      if (this.game && this.injuries.length) this.game.injuries = this.injuries.slice()
    }

    if (this.log) {
      this.events.push({
        text: hs === as
          ? `比賽結束，雙方 ${MAX_INN} 局戰成 ${as}:${hs} 平手，依聯盟規定和局收場。`
          : walkOff
            ? `再見分！${this.H.squad.name} 以 ${hs}:${as} 氣走 ${this.A.squad.name}，主場沸騰！`
            : `比賽結束！${hs > as ? this.H.squad.name : this.A.squad.name} 以 ${Math.max(hs, as)}:${Math.min(hs, as)} 擊敗 ${hs > as ? this.A.squad.name : this.H.squad.name}！`,
        inn: Math.min(this.inn, MAX_INN), top: false, hs, as, outs: 3,
        bases: [false, false, false], pitcher: '', batter: '', big: true,
      })
    }
  }
}

/** 快速模擬一場比賽（自動走完 LiveGame） */
export function simulateGame(L: League, game: Game, withLog: boolean): { events: PBEvent[] | null } {
  const home = squadFromTeam(L, L.teams[game.home])
  const away = squadFromTeam(L, L.teams[game.away])
  const lg = new LiveGame(L, home, away, { game, statMode: 'main', log: withLog })
  let guard = 0
  while (!lg.done && guard++ < 2000) lg.step()
  return { events: withLog ? lg.events : null }
}
