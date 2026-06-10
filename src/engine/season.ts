import type { Game, League, PBEvent, Team } from '../types'
import { simulateGame } from './sim'
import { autoLineup, teamPayroll, DAYS_PER_HALF } from './league'
import { clamp, fmtMoney } from './util'

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

/** 推進一天。watchUser = true 時回傳使用者球隊比賽的逐打席事件 */
export function playDay(L: League, watchUser: boolean): PBEvent[] | null {
  if (L.phase === 'ts') return playTSDay(L, watchUser)
  if (L.phase !== 'season') return null

  const games = L.schedule.filter(g => g.day === L.day && !g.played)
  let userEvents: PBEvent[] | null = null

  for (const g of games) {
    const isUser = g.home === L.userTeam || g.away === L.userTeam
    const { events } = simulateGame(L, g, watchUser && isUser)
    if (events) userEvents = events
    const home = L.teams[g.home], away = L.teams[g.away]
    const rec = (t: Team) => t.rec[(g.half as 1 | 2) - 1]
    if (g.hs > g.as) { rec(home).w++; rec(away).l++ }
    else if (g.as > g.hs) { rec(away).w++; rec(home).l++ }
    else { rec(home).t++; rec(away).t++ }
    L.finance[g.home].revenue += gameRevenue(L, home)
    if (isUser) {
      const us = g.home === L.userTeam ? g.hs : g.as
      const them = g.home === L.userTeam ? g.as : g.hs
      const opp = g.home === L.userTeam ? away : home
      const result = us > them ? '勝' : us < them ? '敗' : '和'
      L.news.unshift({ year: L.year, day: L.day, kind: 'game', text: `對戰 ${opp.name}：${us}:${them} ${result}${g.inn !== 9 ? `（${g.inn} 局）` : ''}` })
    }
  }

  // 半季結束新聞
  if (L.day === DAYS_PER_HALF) {
    const champ = standings(L, 1)[0].team
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `上半季戰罷！${champ.name} 奪下上半季冠軍，預先取得台灣大賽門票！` })
  }
  L.day++
  if (L.day > TOTAL_DAYS) startTaiwanSeries(L)
  return userEvents
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

function playTSDay(L: League, watchUser: boolean): PBEvent[] | null {
  const ts = L.ts!
  const gameNo = ts.wa + ts.wb + 1
  // 2-3-2 主場安排（a 為較高種子）
  const aHome = [1, 2, 6, 7].includes(gameNo)
  const g: Game = {
    id: 9000 + L.day, day: L.day, half: 0,
    home: aHome ? ts.a : ts.b, away: aHome ? ts.b : ts.a,
    played: false, hs: 0, as: 0, inn: 9,
  }
  const isUser = g.home === L.userTeam || g.away === L.userTeam
  const { events } = simulateGame(L, g, watchUser && isUser)
  L.schedule.push(g)
  L.finance[g.home].revenue += gameRevenue(L, L.teams[g.home]) * 1.6

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
  L.day++

  if (ts.wa >= 4 || ts.wb >= 4) {
    const champ = ts.wa >= 4 ? ts.a : ts.b
    L.champs.push({ year: L.year, team: champ })
    L.news.unshift({ year: L.year, day: L.day, kind: 'league', text: `🏆 ${L.teams[champ].name} 奪下 ${L.year} 年總冠軍！` })
    L.teams[champ].morale = clamp(L.teams[champ].morale + 10, 20, 95)
    L.phase = 'eval'
    evaluateOwner(L)
  }
  return events
}

export function userProfit(L: League): number {
  const f = L.finance[L.userTeam]
  return Math.round(f.revenue - teamPayroll(L, L.userTeam) - OPS_COST)
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
      ? `老闆對未達成的目標感到不滿。（信任度剩餘 ${Math.max(0, owner.patienceLeft)}/${owner.prefs.patience}）`
      : '老闆的耐心已經耗盡⋯⋯')
  }
  const fired = owner.patienceLeft <= 0
  L.evalResult = { passed, lines, fired }
  if (fired) L.news.unshift({ year: L.year, day: L.day, kind: 'owner', text: `${team.name} 宣布撤換總經理，球團將展開重組。` })
}

/** 比賽日期顯示：開季 3/28 起，週一休兵 */
export function dayToDate(year: number, day: number): { m: number; d: number; label: string } {
  // 上半季 3/28 開打；下半季中間休 10 天（明星賽）
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
