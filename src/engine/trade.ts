import type { League, Player } from '../types'
import { fairSalary, ovr } from './playerGen'
import { teamPayroll } from './league'
import { TRADE_DEADLINE_DAY } from './league'
import { clamp } from './util'

/** 球員交易價值 */
export function tradeValue(p: Player): number {
  const o = ovr(p)
  let v = Math.pow(o, 2.3) / 120
  // 年齡
  if (p.age <= 24) v *= 1.2
  else if (p.age <= 28) v *= 1.05
  else if (p.age <= 31) v *= 0.9
  else if (p.age <= 34) v *= 0.7
  else v *= 0.5
  // 潛力
  v *= 1 + Math.max(0, p.pot - o) / 90
  // 薪資負擔
  v -= Math.max(0, p.salary - fairSalary(p)) * 0.35
  // 洋將約短，價值略低
  if (p.foreign) v *= 0.85
  // 傷兵與低士氣折價
  if (p.injuryDays > 0) v *= clamp(1 - p.injuryDays / 120, 0.5, 1)
  v *= 1 + (p.morale - 55) / 400
  return Math.max(1, v)
}

export interface TradeVerdict { accept: boolean; reason: string; diff: number }

export function canTrade(L: League): boolean {
  return L.phase === 'season' && L.day <= TRADE_DEADLINE_DAY
}

/** AI 評估交易（give = 使用者送出，get = 使用者取得） */
export function evaluateTrade(L: League, otherTeam: number, give: Player[], get: Player[]): TradeVerdict {
  if (give.length === 0 || get.length === 0) return { accept: false, reason: '雙方都必須包含球員。', diff: 0 }
  if (give.length > 4 || get.length > 4) return { accept: false, reason: '單筆交易每隊最多 4 名球員。', diff: 0 }

  const vGive = give.reduce((s, p) => s + tradeValue(p), 0)
  const vGet = get.reduce((s, p) => s + tradeValue(p), 0)
  const diff = vGive - vGet * 1.08 // AI 要求約 8% 溢價

  // 對方薪資空間
  const otherPayroll = teamPayroll(L, otherTeam)
  const salaryIn = give.reduce((s, p) => s + p.salary * 12, 0)
  const salaryOut = get.reduce((s, p) => s + p.salary * 12, 0)
  if (otherPayroll + salaryIn - salaryOut > L.teams[otherTeam].budget * 1.05) {
    return { accept: false, reason: `${L.teams[otherTeam].name} 表示薪資空間不足，無法吃下這筆合約。`, diff }
  }
  // 對方不能交易到剩太少人
  const otherRoster = Object.values(L.players).filter(p => p.teamId === otherTeam)
  const batLeft = otherRoster.filter(p => !p.isP).length - get.filter(p => !p.isP).length + give.filter(p => !p.isP).length
  const pitLeft = otherRoster.filter(p => p.isP).length - get.filter(p => p.isP).length + give.filter(p => p.isP).length
  if (batLeft < 14 || pitLeft < 12) {
    return { accept: false, reason: `${L.teams[otherTeam].name} 表示交易後陣容深度不足，婉拒這筆交易。`, diff }
  }

  if (diff >= 0) return { accept: true, reason: `${L.teams[otherTeam].name} 接受了這筆交易！`, diff }
  if (diff > -8) return { accept: false, reason: '對方總管沉吟許久：「很接近了，再加一點誠意吧。」', diff }
  if (diff > -25) return { accept: false, reason: '對方總管搖了搖頭：「這筆交易對我們不夠划算。」', diff }
  return { accept: false, reason: '對方總管直接掛上電話——這提案差距太大了。', diff }
}

export function executeTrade(L: League, otherTeam: number, give: Player[], get: Player[]) {
  const user = L.userTeam
  give.forEach(p => { p.teamId = otherTeam; p.onMain = false; p.morale = clamp(p.morale - 8, 5, 99) })
  get.forEach(p => { p.teamId = user; p.onMain = false; p.morale = clamp(p.morale - 8, 5, 99) })
  const giveNames = give.map(p => p.name).join('、')
  const getNames = get.map(p => p.name).join('、')
  L.news.unshift({
    year: L.year, day: L.day, kind: 'trade',
    text: `重磅交易！${L.teams[user].name} 送出 ${giveNames}，自 ${L.teams[otherTeam].name} 換來 ${getNames}。`,
  })
}
