import type { Game, League, LeaderLine, Team } from '../types'
import { LiveGame, simulateGame, squadFromTeam } from './sim'
import { teamPayroll, DAYS_PER_HALF } from './league'
import { playFarmDay } from './farm'
import { setupAllStar, runAllStarQuick } from './allstar'
import { handleInjury, handleRecovery } from './rosterOps'
import { dailyMoraleDrift } from './contracts'
import { avg, clamp, era, fmtMoney } from './util'

export const OPS_COST = 9000 // 年度固定營運成本（萬）
export const TOTAL_DAYS = DAYS_PER_HALF * 2

export interface HalfStanding { team: Team; w: number; l: number; t: number; pct: number; gb: number }

export function standings(L: League, half: 0 | 1 | 2): HalfStanding[] {
  const rows = L.teams.map(t => {
    const w = half === 0 ? t.rec[0].w + t.rec[1].w : t.rec[half - 1].w
    const l = half === 0 ? t.rec[0].l + t.rec[1].l : t.rec[half - 1].l
    const tt = half === 0 ? t.rec[0].t + t.rec[1].t : t.rec[half - 1].t
    return { team: t, w, l, t: tt, pct: w + l === 0 ? 0 : w / (w + l), gb: 0 }
  }).sort((a, b) => b.pct - a.pct || b.w - a.w)
  const top = rows[0]
  rows.forEach(r => { r.gb = ((top.w - r.w) + (r.l - top.l)) / 2 })
  return rows
}

function gameRevenue(L: League, team: Team): number {
  const s = standings(L, 0).find(r => r.team.id === team.id)!
  const pct = s.w + s.l === 0 ? 0.5 : s.pct
  const att = Math.round(20000 * clamp(0.25 + pct * 0.55 + (team.morale - 50) / 250, 0.18, 0.95))
  return Math.round(att * 0.03) // 萬（每位觀眾約 300 元票房與周邊貢獻）
}

/** 取得（必要時建立）使用者今天要打的比賽 */
export function userGameToday(L: League): Game | null {
  if (L.phase === 'season') {
    return L.schedule.find(g => g.day === L.day && g.half !== 0 && !g.played &&
      (g.home === L.userTeam || g.away === L.userTeam)) ?? null
  }
  if (L.phase === 'ts') {
    const g = ensureTSGame(L)
    return (g.home === L.userTeam || g.away === L.userTeam) ? g : null
  }
  return null
}

/** 建立使用者比賽的即時引擎（供觀看／指揮） */
export function startLiveGame(L: League, g: Game): LiveGame {
  const home = squadFromTeam(L, L.teams[g.home])
  const away = squadFromTeam(L, L.teams[g.away])
  return new LiveGame(L, home, away, { game: g, statMode: 'main', log: true, userTeamId: L.userTeam })
}

function ensureTSGame(L: League): Game {
  const ts = L.ts!
  if (ts.pendingGame != null) {
    const g = L.schedule.find(x => x.id === ts.pendingGame)
    if (g) return g // 已打完但尚未結算的比賽也直接回傳
  }
  const gameNo = ts.wa + ts.wb + 1
  const aHome = [1, 2, 6, 7].includes(gameNo)
  const g: Game = {
    id: 900000 + L.day, day: L.day, half: 0,
    home: aHome ? ts.a : ts.b, away: aHome ? ts.b : ts.a,
    played: false, hs: 0, as: 0, inn: 9,
  }
  L.schedule.push(g)
  ts.pendingGame = g.id
  return g
}

function processGameInjuries(L: League, g: Game) {
  if (!g.injuries) return
  for (const inj of g.injuries) {
    const p = L.players[inj.pid]
    if (p) handleInjury(L, p, inj.days)
  }
  delete g.injuries
}

function tickInjuryAndMorale(L: League) {
  for (const p of Object.values(L.players)) {
    if (p.injuryDays > 0) {
      p.injuryDays--
      if (p.injuryDays === 0) handleRecovery(L, p)
    }
  }
  dailyMoraleDrift(L)
}

/** 推進一天（已含明星賽／台灣大賽分流）。使用者比賽若已由 LiveGame 打完則不重模擬。 */
export function advanceDay(L: League) {
  if (L.phase === 'allstar') { runAllStarQuick(L); return }
  if (L.phase === 'ts') { finishTSDay(L); return }
  if (L.phase !== 'season') return

  const games = L.schedule.filter(g => g.day === L.day && g.half !== 0)
  for (const g of games) if (!g.played) simulateGame(L, g, false)

  for (const g of games) {
    const home = L.teams[g.home], away = L.teams[g.away]
    const rec = (t: Team) => t.rec[(g.half as 1 | 2) - 1]
    if (g.hs > g.as) { rec(home).w++; rec(away).l++ }
    else if (g.as > g.hs) { rec(away).w++; rec(home).l++ }
    else { rec(home).t++; rec(away).t++ }
    L.finance[g.home].revenue += gameRevenue(L, home)
    if (g.home === L.userTeam || g.away === L.userTeam) {
      const us = g.home === L.userTeam ? g.hs : g.as
      const them = g.home === L.userTeam ? g.as : g.hs
      const opp = g.home === L.userTeam ? away : home
      const result = us > them ? '勝' : us < them ? '敗' : '和'
      L.news.unshift({ year: L.year, day: L.day, kind: 'game', text: `對戰 ${opp.name}：${us}:${them} ${result}${g.inn !== 9 ? `（${g.inn} 局）` : ''}` })
    }
    processGameInjuries(L, g)
  }

  // 二軍同日開打
  playFarmDay(L, games)
  tickInjuryAndMorale(L)

  if (L.day === DAYS_PER_HALF) {
    const champ = standings(L, 1)[0].team
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `上半季戰罷！${champ.name} 奪下上半季冠軍，預先取得台灣大賽門票！` })
  }
  L.day++
  if (L.day === DAYS_PER_HALF + 1) { setupAllStar(L); return }
  if (L.day > TOTAL_DAYS) startTaiwanSeries(L)
}

export function tsParticipants(L: League): { a: number; b: number; note: string } {
  const h1 = standings(L, 1)[0].team
  const h2 = standings(L, 2)[0].team
  if (h1.id !== h2.id) return { a: h1.id, b: h2.id, note: '上半季冠軍 vs 下半季冠軍' }
  const overall = standings(L, 0).filter(r => r.team.id !== h1.id)
  return { a: h1.id, b: overall[0].team.id, note: `${h1.name} 包辦上下半季冠軍，由全年勝率次佳的 ${overall[0].team.name} 挑戰` }
}

function startTaiwanSeries(L: League) {
  const { a, b, note } = tsParticipants(L)
  L.phase = 'ts'
  L.ts = { a, b, wa: 0, wb: 0, note }
  const h2 = standings(L, 2)[0].team
  L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `下半季戰罷！${h2.name} 奪下下半季冠軍！` })
  L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `台灣大賽即將開打：${L.teams[a].name} vs ${L.teams[b].name}（${note}），七戰四勝制。` })
}

/** 台灣大賽推進一天（比賽可能已由 LiveGame 打完） */
export function finishTSDay(L: League) {
  const ts = L.ts!
  const gameNo = ts.wa + ts.wb + 1
  const g = ensureTSGame(L)
  if (!g.played) simulateGame(L, g, false)
  ts.pendingGame = undefined
  L.finance[g.home].revenue += gameRevenue(L, L.teams[g.home]) * 1.6
  processGameInjuries(L, g)

  if (g.hs === g.as) {
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `台灣大賽第 ${gameNo} 戰戰成 ${g.hs}:${g.as} 和局，將擇日重賽！` })
  } else {
    const winner = g.hs > g.as ? g.home : g.away
    if (winner === ts.a) ts.wa++; else ts.wb++
    L.news.unshift({
      year: L.year, day: L.day, kind: 'league',
      text: `台灣大賽 G${gameNo}：${L.teams[g.away].name} ${g.as}:${g.hs} ${L.teams[g.home].name}，系列賽 ${L.teams[ts.a].name} ${ts.wa}-${ts.wb} ${L.teams[ts.b].name}。`,
    })
  }
  tickInjuryAndMorale(L)
  L.day++

  if (ts.wa >= 4 || ts.wb >= 4) {
    const champ = ts.wa >= 4 ? ts.a : ts.b
    L.champs.push({ year: L.year, team: champ })
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `🏆 ${L.teams[champ].name} 奪下 ${L.year} 年總冠軍！` })
    L.teams[champ].morale = clamp(L.teams[champ].morale + 10, 20, 95)
    recordYearHistory(L, champ)
    L.phase = 'eval'
    evaluateOwner(L)
  }
}

/** 舊名稱相容（腳本用）：快速推進一天 */
export function playDay(L: League, _watch = false) {
  advanceDay(L)
  return null
}

export function userProfit(L: League): number {
  const f = L.finance[L.userTeam]
  return Math.round(f.revenue - teamPayroll(L, L.userTeam) - OPS_COST)
}

/** 年度數據王（單一領先者） */
export function seasonLeaders(L: League): LeaderLine[] {
  const players = Object.values(L.players).filter(p => p.teamId >= 0)
  const teamGames = Math.max(1, ...L.teams.map(t => t.rec[0].w + t.rec[0].l + t.rec[0].t + t.rec[1].w + t.rec[1].l + t.rec[1].t))
  const qualBat = players.filter(p => p.bat.pa >= teamGames * 2.6)
  const qualPit = players.filter(p => p.isP && p.pit.outs >= teamGames * 2.4)
  const tn = (p: { teamId: number }) => L.teams[p.teamId]?.short ?? '-'
  const top = <T,>(arr: T[], f: (x: T) => number): T | undefined => arr.slice().sort((a, b) => f(b) - f(a))[0]

  const lines: LeaderLine[] = []
  const aL = top(qualBat, p => p.bat.h / Math.max(1, p.bat.ab))
  if (aL) lines.push({ label: '打擊率', name: aL.name, team: tn(aL), value: avg(aL.bat.h, aL.bat.ab) })
  const hrL = top(players, p => p.bat.hr)
  if (hrL && hrL.bat.hr > 0) lines.push({ label: '全壘打', name: hrL.name, team: tn(hrL), value: `${hrL.bat.hr} 支` })
  const rbiL = top(players, p => p.bat.rbi)
  if (rbiL && rbiL.bat.rbi > 0) lines.push({ label: '打點', name: rbiL.name, team: tn(rbiL), value: `${rbiL.bat.rbi} 分` })
  const sbL = top(players, p => p.bat.sb)
  if (sbL && sbL.bat.sb > 0) lines.push({ label: '盜壘', name: sbL.name, team: tn(sbL), value: `${sbL.bat.sb} 次` })
  const eraL = top(qualPit, p => -(p.pit.er * 27) / Math.max(1, p.pit.outs))
  if (eraL) lines.push({ label: '防禦率', name: eraL.name, team: tn(eraL), value: era(eraL.pit.er, eraL.pit.outs) })
  const wL = top(players, p => p.pit.w)
  if (wL && wL.pit.w > 0) lines.push({ label: '勝投', name: wL.name, team: tn(wL), value: `${wL.pit.w} 勝` })
  const soL = top(players, p => p.pit.so)
  if (soL && soL.pit.so > 0) lines.push({ label: '三振', name: soL.name, team: tn(soL), value: `${soL.pit.so} 次` })
  const svL = top(players, p => p.pit.sv)
  if (svL && svL.pit.sv > 0) lines.push({ label: '救援', name: svL.name, team: tn(svL), value: `${svL.pit.sv} 次` })
  return lines
}

function recordYearHistory(L: League, champ: number) {
  const ts = L.ts!
  const me = standings(L, 0).find(r => r.team.id === L.userTeam)!
  const rank = standings(L, 0).findIndex(r => r.team.id === L.userTeam) + 1
  L.history.unshift({
    year: L.year,
    champion: L.teams[champ].name,
    tsLine: `${L.teams[ts.a].name} ${ts.wa} - ${ts.wb} ${L.teams[ts.b].name}`,
    leaders: seasonLeaders(L),
    userLine: `${L.teams[L.userTeam].name}：${me.w}勝${me.l}敗${me.t}和（第 ${rank} 名）${champ === L.userTeam ? '・總冠軍 🏆' : ''}`,
  })
}

/** 賽季結束老闆評鑑 */
function evaluateOwner(L: League) {
  const team = L.teams[L.userTeam]
  const owner = team.owner
  const overall = standings(L, 0).find(r => r.team.id === team.id)!
  const champ = L.champs.find(c => c.year === L.year)?.team === team.id
  const inTS = L.ts && (L.ts.a === team.id || L.ts.b === team.id)
  const profit = userProfit(L)

  const lines: string[] = []
  let failures = 0
  for (const goal of owner.goals) {
    const [code, label] = goal.split('|')
    let ok = false
    switch (code) {
      case 'CHAMP': ok = champ; break
      case 'TS': ok = !!inTS; break
      case 'WPCT50': ok = overall.pct >= 0.5; break
      case 'WPCT42': ok = overall.pct >= 0.42; break
      case 'PROFIT': ok = profit >= 0; break
      case 'MORALE': ok = team.morale >= 50; break
    }
    if (!ok) failures++
    lines.push(`${ok ? '✅' : '❌'} ${label}`)
  }
  lines.push(`— 全年戰績 ${overall.w} 勝 ${overall.l} 敗 ${overall.t} 和（勝率 ${overall.pct.toFixed(3)}）`)
  lines.push(`— 球團損益：${fmtMoney(profit)}（收入 ${fmtMoney(L.finance[team.id].revenue)}／薪資 ${fmtMoney(teamPayroll(L, team.id))}／營運 ${fmtMoney(OPS_COST)}）`)

  const passed = failures === 0
  if (passed) {
    owner.patienceLeft = Math.min(owner.prefs.patience, owner.patienceLeft + 1)
    lines.push(`老闆對本季表現表示滿意。（信任度回升至 ${owner.patienceLeft}/${owner.prefs.patience}）`)
  } else {
    owner.patienceLeft = Math.max(0, owner.patienceLeft - (failures >= 2 ? 2 : 1))
    lines.push(owner.patienceLeft > 0
      ? `老闆對未達成的目標感到不滿。（信任度剩餘 ${owner.patienceLeft}/${owner.prefs.patience}）`
      : '老闆的耐心已經耗盡⋯⋯')
  }
  const fired = owner.patienceLeft <= 0
  L.evalResult = { passed, lines, fired }
  if (fired) L.news.unshift({ year: L.year, day: L.day, kind: 'owner', text: `${team.name} 宣布撤換總經理，球團將展開重組。` })
}

/** 比賽日期顯示：開季 3/28 起，週一休兵 */
export function dayToDate(year: number, day: number): { m: number; d: number; label: string } {
  const start = new Date(year, 2, 28)
  let gameDays = 0
  const cur = new Date(start)
  let target = day
  if (day > DAYS_PER_HALF) target += 10
  while (gameDays < target) {
    if (cur.getDay() !== 1) gameDays++ // 週一休兵
    if (gameDays >= target) break
    cur.setDate(cur.getDate() + 1)
  }
  return { m: cur.getMonth() + 1, d: cur.getDate(), label: `${cur.getMonth() + 1}/${cur.getDate()}` }
}
