import type { Game, League, PBEvent, Player, Team } from '../types'
import { clamp, rand, randInt } from './util'

/** 一場比賽的內部狀態 */
interface SideState {
  team: Team
  lineup: Player[]
  batIdx: number
  pitcher: Player
  pitches: number
  pitcherRuns: number
  usedPitchers: Set<number>
  defense: number // 守備修正
}

interface Runner { player: Player; respPitcher: Player }

const MAX_INN = 12 // 中職延長賽至 12 局，平手和局

function teamDefense(lineup: Player[], lineupPos?: string[]): number {
  const fielders = lineup.filter((p, i) => (lineupPos?.[i] ?? p.pos) !== 'DH')
  const f = fielders.reduce((s, p) => s + p.field, 0) / Math.max(1, fielders.length)
  return (f - 50) / 1800 // BABIP 修正
}

function pitcherFatigueMult(p: Player, pitches: number): number {
  const limit = p.pos === 'SP' ? 55 + p.stam * 0.65 : 18 + p.stam * 0.35
  if (pitches <= limit) return 1
  return clamp(1 - (pitches - limit) / 120, 0.7, 1)
}

interface ABOutcome {
  type: 'K' | 'BB' | 'HBP' | '1B' | '2B' | '3B' | 'HR' | 'GO' | 'FO' | 'DP'
}

function simAtBat(b: Player, ps: SideState, moraleMod: number, runnerOn1: boolean, outs: number): ABOutcome {
  const p = ps.pitcher
  const fat = pitcherFatigueMult(p, ps.pitches)
  const stuff = p.stuff * fat
  const veloE = p.velo * fat
  const ctrl = p.ctrl * (fat < 1 ? fat * 0.95 : 1)

  const kP = clamp(0.175 + (stuff * 0.7 + veloE * 0.3 - b.contact * 0.55 - b.eye * 0.45) / 290, 0.07, 0.38)
  const bbP = clamp(0.078 + (b.eye - ctrl) / 430, 0.025, 0.15)
  const hbpP = 0.009

  let r = rand()
  if (r < kP) { ps.pitches += 4.8; return { type: 'K' } }
  r -= kP
  if (r < bbP) { ps.pitches += 5.6; return { type: 'BB' } }
  r -= bbP
  if (r < hbpP) { ps.pitches += 2.5; return { type: 'HBP' } }

  // 形成打擊（球進場內或全壘打）
  ps.pitches += 3.3
  const pq = (stuff + veloE) / 2
  const hrP = clamp(0.0045 + b.power / 3300 + (50 - pq) / 6000, 0.002, 0.05)
  if (rand() < hrP) return { type: 'HR' }

  const babip = clamp(0.298 + (b.contact - 50) / 580 + (b.speed - 50) / 2400 - ps.defense + moraleMod, 0.21, 0.40)
  if (rand() < babip) {
    const tripleP = clamp(0.004 + (b.speed - 50) / 1500, 0.001, 0.05)
    const doubleP = 0.185 + b.power / 900
    const r2 = rand()
    if (r2 < tripleP) return { type: '3B' }
    if (r2 < tripleP + doubleP) return { type: '2B' }
    return { type: '1B' }
  }

  // 出局：滾地 / 飛球
  if (rand() < 0.46) {
    if (runnerOn1 && outs < 2 && rand() < 0.37) return { type: 'DP' }
    return { type: 'GO' }
  }
  return { type: 'FO' }
}

function pickReliever(L: League, ts: SideState, inning: number, leadFor: number): Player | null {
  const team = ts.team
  const cands = team.bullpen
    .map(id => L.players[id])
    .filter(p => p && p.onMain && !ts.usedPitchers.has(p.id))
  const closer = team.closer >= 0 ? L.players[team.closer] : null
  // 9 局以後且領先 3 分內 → 終結者
  if (closer && closer.onMain && !ts.usedPitchers.has(closer.id) && inning >= 9 && leadFor >= 1 && leadFor <= 3) return closer
  if (cands.length === 0) return closer && !ts.usedPitchers.has(closer.id) ? closer : null
  // 後段局數用較好的牛棚
  const sorted = cands.sort((a, b) => (b.stuff + b.ctrl) - (a.stuff + a.ctrl))
  if (inning >= 7) return sorted[0]
  return sorted[Math.min(sorted.length - 1, randInt(Math.floor(sorted.length / 2), sorted.length - 1))]
}

function shouldPull(ps: SideState): boolean {
  const p = ps.pitcher
  const limit = p.pos === 'SP' ? 55 + p.stam * 0.65 : 18 + p.stam * 0.35
  return ps.pitches > limit * 1.15 || ps.pitcherRuns >= 7
}

const POS_NAME: Record<string, string> = { GO: '滾地球', FO: '飛球' }
const FIELD_DIR = ['左外野', '中外野', '右外野', '三壘', '游擊', '二壘', '一壘']

export interface SimGameResult { events: PBEvent[] | null }

/**
 * 模擬一場比賽，直接更新 game 結果與球員數據。
 * withLog = true 時回傳逐打席文字事件供觀看模式播放。
 */
export function simulateGame(L: League, game: Game, withLog: boolean): SimGameResult {
  const home = L.teams[game.home]
  const away = L.teams[game.away]
  const events: PBEvent[] | null = withLog ? [] : null

  const mkSide = (team: Team): SideState => {
    const lineup = team.lineup.map(id => L.players[id]).filter(Boolean)
    const sp = L.players[team.rotation[team.nextSP % Math.max(1, team.rotation.length)]]
    return {
      team, lineup, batIdx: 0,
      pitcher: sp, pitches: 0, pitcherRuns: 0,
      usedPitchers: new Set([sp.id]),
      defense: teamDefense(lineup, team.lineupPos),
    }
  }
  const H = mkSide(home)
  const A = mkSide(away)
  H.pitcher.pit.g++; H.pitcher.pit.gs++
  A.pitcher.pit.g++; A.pitcher.pit.gs++

  let hs = 0, as = 0
  // 勝敗投追蹤：每次領先易主時記錄當下投手
  let leadTeam = -1
  let wPitcher: Player | null = null
  let lPitcher: Player | null = null

  const moraleModH = (home.morale - 50) / 4000 + 0.004 // 主場小優勢
  const moraleModA = (away.morale - 50) / 4000

  let inn = 1
  for (; inn <= MAX_INN; inn++) {
    for (const top of [true, false]) {
      // 9 局下若主隊已領先則不需進攻
      if (inn >= 9 && !top && hs > as) break
      const off = top ? A : H        // 進攻方
      const def = top ? H : A        // 守備方
      const score = () => (top ? as : hs)
      const addRun = (n: number) => { if (top) as += n; else hs += n }

      let outs = 0
      let bases: (Runner | null)[] = [null, null, null]

      const ev = (text: string, big: boolean): PBEvent => ({
        text, inn, top, hs, as, outs,
        bases: [!!bases[0], !!bases[1], !!bases[2]],
        pitcher: def.pitcher.name, batter: '', big,
      })

      // 換投判斷（半局開始時）
      if (shouldPull(def) || (inn >= 9 && def.pitcher.pos === 'SP' && def.pitches > 70)) {
        const leadFor = top ? hs - as : as - hs
        const rp = pickReliever(L, def, inn, leadFor)
        if (rp && rp.id !== def.pitcher.id) {
          def.pitcher = rp
          def.pitches = 0
          def.pitcherRuns = 0
          def.usedPitchers.add(rp.id)
          rp.pit.g++
          events?.push(ev(`${def.team.name} 更換投手，由 ${rp.name} 接替投球。`, false))
        }
      }

      const scoreRunner = (runner: Runner, rbiCredit: Player | null) => {
        addRun(1)
        runner.player.bat.r++
        if (rbiCredit) rbiCredit.bat.rbi++
        const rp = runner.respPitcher
        rp.pit.r++; rp.pit.er++
        def.pitcherRuns++
        // 勝敗投：領先易主
        const newLead = hs > as ? game.home : as > hs ? game.away : -1
        if (newLead !== leadTeam && newLead !== -1) {
          leadTeam = newLead
          wPitcher = newLead === game.home ? H.pitcher : A.pitcher
          lPitcher = newLead === game.home ? A.pitcher : H.pitcher
        } else if (hs === as) {
          leadTeam = -1
        }
      }

      while (outs < 3) {
        const batter = off.lineup[off.batIdx % off.lineup.length]
        off.batIdx++
        const pit = def.pitcher

        // 盜壘嘗試（一壘有人、二壘空）
        const r1 = bases[0]
        if (r1 && !bases[1] && r1.player.speed > 54 && rand() < (r1.player.speed - 50) / 160) {
          const success = rand() < clamp(0.58 + (r1.player.speed - 50) / 130, 0.3, 0.9)
          if (success) {
            bases[1] = r1; bases[0] = null
            r1.player.bat.sb++
            events?.push(ev(`${r1.player.name} 盜上二壘成功！`, false))
          } else {
            bases[0] = null; outs++
            r1.player.bat.cs++
            events?.push(ev(`${r1.player.name} 盜壘失敗，遭到阻殺。${outs} 出局。`, false))
            if (outs >= 3) break
          }
        }

        const out = simAtBat(batter, def, top ? moraleModA : moraleModH, !!bases[0], outs)
        batter.bat.pa++
        pit.pit.outs += 0 // 確保物件存在
        const bn = batter.name
        const desc = (t: string, big = false) => { const e = ev(t, big); e.batter = bn; events?.push(e) }

        switch (out.type) {
          case 'K': {
            batter.bat.ab++; batter.bat.so++
            pit.pit.so++; pit.pit.outs++
            outs++
            desc(`${bn} 揮棒落空，遭 ${pit.name} 三振！${outs} 出局。`)
            break
          }
          case 'BB': {
            batter.bat.bb++; pit.pit.bb++
            advanceWalk(bases, batter, pit, scoreRunner)
            desc(`${bn} 選到四壞球保送。`)
            break
          }
          case 'HBP': {
            batter.bat.hbp++
            advanceWalk(bases, batter, pit, scoreRunner)
            desc(`${bn} 遭觸身球擊中，保送上壘。`)
            break
          }
          case 'HR': {
            batter.bat.ab++; batter.bat.h++; batter.bat.hr++
            pit.pit.h++; pit.pit.hr++
            const runners = bases.filter(Boolean).length
            const all = bases.filter(Boolean) as Runner[]
            bases = [null, null, null]
            for (const r of all) scoreRunner(r, batter)
            scoreRunner({ player: batter, respPitcher: pit }, batter)
            desc(`全壘打！！${bn} 轟出${runners > 0 ? ` ${runners + 1} 分` : '陽春'}全壘打！比數 ${as}:${hs}。`, true)
            break
          }
          case '3B': case '2B': case '1B': {
            batter.bat.ab++; batter.bat.h++
            pit.pit.h++
            if (out.type === '2B') batter.bat.d2++
            if (out.type === '3B') batter.bat.d3++
            const scored = advanceHit(bases, out.type, batter, pit, scoreRunner)
            const dir = FIELD_DIR[randInt(0, FIELD_DIR.length - 1)]
            const label = out.type === '1B' ? '安打' : out.type === '2B' ? '二壘安打' : '三壘安打'
            desc(`${bn} 擊出${dir}方向${label}！${scored > 0 ? `跑回 ${scored} 分，比數 ${as}:${hs}。` : ''}`, scored > 0)
            break
          }
          case 'DP': {
            batter.bat.ab++
            pit.pit.outs += 2
            outs += 2
            bases[0] = null
            desc(`${bn} 擊成雙殺打！${Math.min(outs, 3)} 出局。`)
            break
          }
          case 'GO': case 'FO': {
            batter.bat.ab++
            pit.pit.outs++
            outs++
            // 高飛犧牲打
            let sacText = ''
            if (out.type === 'FO' && outs < 3 && bases[2] && rand() < 0.45) {
              const r3 = bases[2]!
              bases[2] = null
              scoreRunner(r3, batter)
              sacText = `三壘跑者回本壘得分！比數 ${as}:${hs}。`
            }
            const dir = FIELD_DIR[randInt(0, FIELD_DIR.length - 1)]
            desc(`${bn} 擊出${dir}方向${POS_NAME[out.type]}出局。${outs} 出局。${sacText}`, sacText !== '')
            break
          }
        }
        if (outs >= 3) break
        // 再見分
        if (inn >= 9 && !top && hs > as) break
      }

      const walkOff = inn >= 9 && !top && hs > as && outs < 3
      if (!walkOff) {
        events?.push({
          text: `${inn} 局${top ? '上' : '下'}結束，${away.name} ${as} : ${hs} ${home.name}。`,
          inn, top, hs, as, outs: 3, bases: [false, false, false],
          pitcher: def.pitcher.name, batter: '', big: false,
        })
      }

      if (inn >= 9 && !top && hs > as) break
    }
    if (inn >= 9 && hs !== as) break
  }

  // 寫入結果
  game.played = true
  game.hs = hs
  game.as = as
  game.inn = Math.min(inn, MAX_INN)

  // 勝敗投／救援
  if (hs !== as) {
    const winSide = hs > as ? H : A
    const loseSide = hs > as ? A : H
    const w = wPitcher ?? winSide.pitcher
    const l = lPitcher ?? loseSide.pitcher
    w.pit.w++
    l.pit.l++
    const last = winSide.pitcher
    if (last.id !== w.id && Math.abs(hs - as) <= 3) last.pit.sv++
  }

  // 輪值前進
  home.nextSP = (home.nextSP + 1) % Math.max(1, home.rotation.length)
  away.nextSP = (away.nextSP + 1) % Math.max(1, away.rotation.length)

  // 士氣
  if (hs > as) { home.morale = clamp(home.morale + 2, 20, 90); away.morale = clamp(away.morale - 2, 20, 90) }
  else if (as > hs) { away.morale = clamp(away.morale + 2, 20, 90); home.morale = clamp(home.morale - 2, 20, 90) }

  if (events) {
    events.push({
      text: hs === as
        ? `比賽結束，雙方 ${MAX_INN} 局戰成 ${as}:${hs} 平手，依聯盟規定和局收場。`
        : `比賽結束！${hs > as ? home.name : away.name} 以 ${Math.max(hs, as)}:${Math.min(hs, as)} 擊敗 ${hs > as ? away.name : home.name}！`,
      inn: game.inn, top: false, hs, as, outs: 3, bases: [false, false, false],
      pitcher: '', batter: '', big: true,
    })
  }
  return { events }
}

/** 保送進壘（強迫進壘鏈） */
function advanceWalk(
  bases: (Runner | null)[], batter: Player, pit: Player,
  scoreRunner: (r: Runner, rbi: Player | null) => void,
) {
  const newRunner: Runner = { player: batter, respPitcher: pit }
  if (bases[0]) {
    if (bases[1]) {
      if (bases[2]) scoreRunner(bases[2]!, batter)
      bases[2] = bases[1]
    }
    bases[1] = bases[0]
  }
  bases[0] = newRunner
}

/** 安打進壘，回傳得分數 */
function advanceHit(
  bases: (Runner | null)[], type: '1B' | '2B' | '3B', batter: Player, pit: Player,
  scoreRunner: (r: Runner, rbi: Player | null) => void,
): number {
  let scored = 0
  const sc = (r: Runner) => { scoreRunner(r, batter); scored++ }
  const newRunner: Runner = { player: batter, respPitcher: pit }

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
