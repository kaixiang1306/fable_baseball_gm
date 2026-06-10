import type { BatStats, League, PitStats, Player, Team } from '../types'
import { emptyBat, emptyPit, fairSalary, genProspect, ovr, setNextPlayerId, getNextPlayerId, genBatter, genPitcher } from './playerGen'
import { autoLineup, genSeasonSchedule, setOwnerGoals, teamPayroll } from './league'
import { accrueScoutPoints, pruneScoutLevels } from './scouting'
import { standings } from './season'
import { clamp, randInt, rand, shuffle, avg, era } from './util'
import type { Pos } from '../types'

export const DRAFT_ROUNDS = 3

function addBat(dst: BatStats, src: BatStats) {
  for (const k of Object.keys(src) as (keyof BatStats)[]) dst[k] += src[k]
}
function addPit(dst: PitStats, src: PitStats) {
  for (const k of Object.keys(src) as (keyof PitStats)[]) dst[k] += src[k]
}

/** 名人堂門檻判定（生涯一軍數據） */
function hofCheck(p: Player): string | null {
  const c = p.career
  if (p.isP) {
    const eraOk = c.pit.outs >= 4200 && (c.pit.er * 27) / c.pit.outs <= 3.15
    if (c.pit.w >= 110 || c.pit.sv >= 130 || c.pit.so >= 1450 || eraOk) {
      return `通算 ${c.pit.w} 勝 ${c.pit.l} 敗 ${c.pit.sv} 救援・防禦率 ${era(c.pit.er, c.pit.outs)}・${c.pit.so} 次三振`
    }
    return null
  }
  const avgOk = c.bat.pa >= 3000 && c.bat.h / Math.max(1, c.bat.ab) >= 0.305
  if (c.bat.h >= 900 || c.bat.hr >= 140 || c.bat.sb >= 250 || avgOk) {
    return `通算打擊率 ${avg(c.bat.h, c.bat.ab)}・${c.bat.h} 安・${c.bat.hr} 轟・${c.bat.rbi} 打點・${c.bat.sb} 盜`
  }
  return null
}

/** 進入休賽季：生涯累計 → AI 續約 → 合約到期 → 引退/名人堂 → 選秀名單 */
export function startOffseason(L: League) {
  setNextPlayerId(L.nextPlayerId)
  const retired: string[] = []
  L.faPool = []

  // 本季數據累計入生涯＋逐季封存
  for (const p of Object.values(L.players)) {
    if (p.bat.pa > 0 || p.pit.g > 0) p.career.seasons++
    addBat(p.career.bat, p.bat)
    addPit(p.career.pit, p.pit)
    const line: import('../types').SeasonLine = {
      y: L.year,
      t: p.teamId >= 0 ? L.teams[p.teamId].short : 'FA',
      o: ovr(p),
    }
    if (p.bat.pa > 0) line.bat = { pa: p.bat.pa, ab: p.bat.ab, h: p.bat.h, hr: p.bat.hr, rbi: p.bat.rbi, sb: p.bat.sb }
    if (p.pit.g > 0) line.pit = { outs: p.pit.outs, er: p.pit.er, w: p.pit.w, l: p.pit.l, sv: p.pit.sv, so: p.pit.so }
    p.seasonHistory.push(line)
  }

  for (const p of Object.values(L.players)) {
    const wasFA = p.teamId === -1
    p.years--
    if (p.years <= 0) {
      const lastTeamName = p.teamId >= 0 ? L.teams[p.teamId].name : '自由球員'
      // 引退判定（整年無人問津的自由球員多半淡出聯盟）
      let retireP = p.age >= 38 ? 1 : p.age >= 35 ? 0.35 : p.age >= 33 && ovr(p) < 45 ? 0.4 : 0
      if (wasFA) retireP = Math.max(retireP, ovr(p) < 50 ? 0.8 : 0.4)
      if (rand() < retireP) {
        if (p.teamId >= 0 || ovr(p) >= 55) retired.push(p.name)
        const hofLine = hofCheck(p)
        if (hofLine) {
          L.hallOfFame.unshift({
            name: p.name, pos: p.pos, retiredYear: L.year,
            seasons: p.career.seasons, line: hofLine, lastTeam: lastTeamName,
          })
          L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `傳奇落幕！${p.name}（${lastTeamName}）宣布引退，並以壓倒性的生涯成績入選名人堂！` })
        }
        delete L.players[p.id]
        L.teams.forEach(t => removeFromDepth(t, p.id))
        continue
      }
      // AI 球隊自動續留主力
      if (p.teamId >= 0 && p.teamId !== L.userTeam && ovr(p) >= 55 && rand() < 0.6) {
        const newSalary = Math.round(fairSalary(p) * (1 + rand() * 0.1))
        if (teamPayroll(L, p.teamId) - p.salary * 12 + newSalary * 12 <= L.teams[p.teamId].budget) {
          p.salary = newSalary
          p.years = randInt(2, 3)
          if (ovr(p) >= 64) L.news.unshift({ year: L.year, day: L.day, kind: 'sign', text: `${L.teams[p.teamId].name} 搶先綁約，與 ${p.name} 完成 ${p.years} 年續約。` })
          continue
        }
      }
      if (p.teamId >= 0) L.teams.forEach(t => { if (t.id === p.teamId) removeFromDepth(t, p.id) })
      p.teamId = -1
      p.onMain = false
      p.salary = Math.round(fairSalary(p) * (0.95 + rand() * 0.2))
      p.years = 0
      L.faPool.push(p.id)
    }
  }
  if (retired.length) {
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `多名球員宣布引退，包括 ${retired.slice(0, 5).join('、')}${retired.length > 5 ? ' 等人' : ''}，球迷感謝他們的貢獻。` })
  }

  // 選秀名單
  L.draftPool = []
  for (let i = 0; i < DRAFT_ROUNDS * 6 + 6; i++) {
    const pr = genProspect()
    L.players[pr.id] = pr
    L.draftPool.push(pr.id)
  }
  accrueScoutPoints(L, 6) // 選秀前球探部全力運轉
  // 選秀順位：全年勝率反序
  const order = standings(L, 0).map(r => r.team.id).reverse()
  L.draftOrder = []
  for (let r = 0; r < DRAFT_ROUNDS; r++) L.draftOrder.push(...order)
  L.draftPick = 0
  L.nextPlayerId = getNextPlayerId()
  L.phase = 'fa'
}

function removeFromDepth(t: Team, pid: number) {
  t.lineup = t.lineup.filter(id => id !== pid)
  t.rotation = t.rotation.filter(id => id !== pid)
  t.bullpen = t.bullpen.filter(id => id !== pid)
  if (t.closer === pid) t.closer = -1
}

/** 自由球員要求的合約 */
export function faAsk(p: Player): { salary: number; years: number } {
  const o = ovr(p)
  const years = p.age >= 33 ? 1 : o >= 70 ? randIntStable(p.id, 2, 3) : o >= 55 ? 2 : 1
  return { salary: p.salary, years }
}
const randIntStable = (seed: number, lo: number, hi: number) => lo + (seed * 2654435761 % 2147483647) % (hi - lo + 1)

export function signFA(L: League, teamId: number, p: Player) {
  const ask = faAsk(p)
  p.teamId = teamId
  p.salary = ask.salary
  p.years = ask.years
  p.onMain = false
  L.faPool = L.faPool.filter(id => id !== p.id)
  L.news.unshift({ year: L.year, day: L.day, kind: 'sign', text: `${L.teams[teamId].name} 以月薪 ${ask.salary} 萬、${ask.years} 年約簽下自由球員 ${p.name}。` })
}

/** AI 球隊補強 + 結束自由市場 */
export function finishFA(L: League) {
  const aiTeams = shuffle(L.teams.filter(t => t.id !== L.userTeam))
  let active = true
  while (active) {
    active = false
    for (const t of aiTeams) {
      const roster = Object.values(L.players).filter(p => p.teamId === t.id)
      const nBat = roster.filter(p => !p.isP).length
      const nPit = roster.filter(p => p.isP).length
      const payroll = teamPayroll(L, t.id)
      const needBat = nBat < 23
      const needPit = nPit < 17
      if (!needBat && !needPit) continue
      const cands = L.faPool
        .map(id => L.players[id])
        .filter(p => (needBat && !p.isP) || (needPit && p.isP))
        .filter(p => payroll + p.salary * 12 <= t.budget)
        .sort((a, b) => ovr(b) - ovr(a))
      if (cands.length) { signFA(L, t.id, cands[0]); active = true }
    }
  }
  ensureAllRosters(L)
  L.phase = 'draft'
}

/** 選秀：使用者選一人；AI 自動選 */
export function draftPickPlayer(L: League, p: Player) {
  const teamId = L.draftOrder[L.draftPick]
  p.teamId = teamId
  p.onMain = false
  L.draftPool = L.draftPool.filter(id => id !== p.id)
  const round = Math.floor(L.draftPick / 6) + 1
  if (teamId === L.userTeam || round === 1) {
    L.news.unshift({ year: L.year, day: L.day, kind: 'sign', text: `選秀第 ${round} 輪：${L.teams[teamId].name} 選進 ${p.isP ? '投手' : '野手'} ${p.name}（潛力新星）。` })
  }
  L.draftPick++
}

export function runAIDraftPicks(L: League) {
  while (L.draftPick < L.draftOrder.length && L.draftOrder[L.draftPick] !== L.userTeam) {
    const cands = L.draftPool.map(id => L.players[id]).sort((a, b) => (ovr(b) + b.pot) - (ovr(a) + a.pot))
    if (!cands.length) { L.draftPick = L.draftOrder.length; break }
    draftPickPlayer(L, cands[0])
  }
  if (L.draftPick >= L.draftOrder.length) finishDraft(L)
}

export function finishDraft(L: League) {
  // 未被選走的新秀離開聯盟
  for (const id of L.draftPool) delete L.players[id]
  L.draftPool = []
  developPlayers(L)
  rolloverSeason(L)
}

/** 球員成長與老化 */
function developPlayers(L: League) {
  const keys: (keyof Player)[] = []
  for (const p of Object.values(L.players)) {
    p.age++
    const o = ovr(p)
    const grow = (k: 'contact' | 'power' | 'eye' | 'speed' | 'field' | 'velo' | 'ctrl' | 'stuff' | 'stam', amt: number) => {
      p[k] = clamp(p[k] + amt, 15, 99)
    }
    const batKeys = ['contact', 'power', 'eye', 'speed', 'field'] as const
    const pitKeys = ['velo', 'ctrl', 'stuff', 'stam'] as const
    const ks = p.isP ? pitKeys : batKeys
    if (p.age <= 26 && o < p.pot) {
      // 出賽經驗（一二軍皆計）加速成長
      const usage = p.bat.pa + p.fbat.pa + (p.pit.outs + p.fpit.outs) * 1.5
      const boost = randInt(1, 4) + (usage >= 250 ? 1 : 0)
      for (let i = 0; i < boost; i++) grow(ks[randInt(0, ks.length - 1)], randInt(1, 3))
    } else if (p.age <= 30) {
      grow(ks[randInt(0, ks.length - 1)], randInt(-1, 1))
    } else {
      const decline = p.age >= 34 ? 2 : 1
      for (let i = 0; i < decline; i++) grow(ks[randInt(0, ks.length - 1)], -randInt(1, 3))
      if (!p.isP) grow('speed', -1)
    }
  }
  void keys
}

/** 確保每隊名單足以排出陣容，不足則簽入培訓球員 */
export function ensureAllRosters(L: League) {
  setNextPlayerId(L.nextPlayerId)
  for (const t of L.teams) {
    const roster = () => Object.values(L.players).filter(p => p.teamId === t.id)
    const positions: Pos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
    for (const pos of positions) {
      if (!roster().some(p => !p.isP && p.pos === pos)) {
        const np = genBatter(pos, 40, { age: randInt(19, 23) })
        np.teamId = t.id; np.salary = 8; np.years = 3
        L.players[np.id] = np
      }
    }
    while (roster().filter(p => !p.isP).length < 23) {
      const np = genBatter((['LF', 'RF', '1B', 'DH', 'C', '2B'] as Pos[])[randInt(0, 5)], 40, { age: randInt(19, 23) })
      np.teamId = t.id; np.salary = 8; np.years = 3
      L.players[np.id] = np
    }
    while (roster().filter(p => p.isP && p.pos === 'SP').length < 7) {
      const np = genPitcher('SP', 42, { age: randInt(19, 24) })
      np.teamId = t.id; np.salary = 8; np.years = 3
      L.players[np.id] = np
    }
    while (roster().filter(p => p.isP).length < 17) {
      const np = genPitcher('RP', 40, { age: randInt(19, 24) })
      np.teamId = t.id; np.salary = 8; np.years = 3
      L.players[np.id] = np
    }
  }
  L.nextPlayerId = getNextPlayerId()
}

/** 新賽季開始 */
function rolloverSeason(L: League) {
  ensureAllRosters(L)
  pruneScoutLevels(L)
  L.year++
  L.day = 1
  L.phase = 'season'
  L.ts = null
  L.evalResult = null
  L.allStar = null
  L.schedule = genSeasonSchedule()
  for (const p of Object.values(L.players)) {
    p.bat = emptyBat(); p.pit = emptyPit()
    p.fbat = emptyBat(); p.fpit = emptyPit()
    p.injuryDays = 0
    p.negoFails = 0
  }
  for (const t of L.teams) {
    t.rec = [{ w: 0, l: 0, t: 0 }, { w: 0, l: 0, t: 0 }]
    t.farmRec = { w: 0, l: 0, t: 0 }
    t.morale = 55
    t.nextSP = 0
    L.finance[t.id] = { revenue: 0, salaries: 0 }
    autoLineup(L, t)
    setOwnerGoals(L, t)
  }
  L.news.unshift({ year: L.year, day: 1, kind: 'league', text: `${L.year} 年球季開幕！新的賽季、新的希望，目標台灣大賽！` })
}
