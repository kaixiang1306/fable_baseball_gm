import type { League, Player } from '../types'
import { fairSalary, ovr } from './playerGen'
import { teamPayroll } from './league'
import { clamp } from './util'

export const MAX_NEGO_FAILS = 3

/** 球員續約要價：士氣高給折扣、士氣低要溢價 */
export function extensionAsk(p: Player): { salary: number; maxYears: number } {
  const salary = Math.round(fairSalary(p) * (1 + (58 - p.morale) / 250))
  const maxYears = p.age >= 34 ? 1 : p.age >= 31 ? 2 : p.age >= 28 ? 3 : 4
  return { salary: Math.max(7, salary), maxYears }
}

export interface NegoResult { ok: boolean; msg: string }

/** 使用者提出續約（新約立即取代舊約） */
export function offerExtension(L: League, p: Player, salary: number, years: number): NegoResult {
  if (p.teamId !== L.userTeam) return { ok: false, msg: '只能與自家球員談續約。' }
  if (p.negoFails >= MAX_NEGO_FAILS) return { ok: false, msg: `${p.name} 的經紀人表示本季不再進行協商。` }

  const ask = extensionAsk(p)
  if (years > ask.maxYears) {
    p.negoFails++
    return { ok: false, msg: `${p.name} 考量生涯規劃，最多只願意簽 ${ask.maxYears} 年。` }
  }
  const newPayroll = teamPayroll(L, L.userTeam) - p.salary * 12 + salary * 12
  if (newPayroll > L.teams[L.userTeam].budget) {
    return { ok: false, msg: '這份合約將超出球團薪資預算，老闆不會批准。' }
  }
  // 長約要求每年遞增一點誠意
  const needed = ask.salary * (1 + Math.max(0, years - 1) * 0.03)
  if (salary >= needed * 0.97) {
    p.salary = salary
    p.years = years
    p.morale = clamp(p.morale + 8, 0, 100)
    L.news.unshift({
      year: L.year, day: L.day, kind: 'sign',
      text: `${L.teams[L.userTeam].name} 與 ${p.name} 完成續約：月薪 ${salary} 萬、${years} 年。`,
    })
    return { ok: true, msg: `${p.name} 爽快簽下合約：「我會用表現回報球團！」` }
  }
  p.negoFails++
  p.morale = clamp(p.morale - 2, 0, 100)
  if (salary >= needed * 0.85) {
    return { ok: false, msg: `經紀人搖頭：「誠意還差一點，${p.name} 的行情不只這個數字。」（剩餘協商機會 ${MAX_NEGO_FAILS - p.negoFails} 次）` }
  }
  return { ok: false, msg: `${p.name} 的經紀人冷笑一聲掛了電話。（剩餘協商機會 ${MAX_NEGO_FAILS - p.negoFails} 次）` }
}

/** 每日士氣漂移 */
export function dailyMoraleDrift(L: League) {
  const wpct = new Map<number, number>()
  for (const t of L.teams) {
    const w = t.rec[0].w + t.rec[1].w
    const l = t.rec[0].l + t.rec[1].l
    wpct.set(t.id, w + l === 0 ? 0.5 : w / (w + l))
  }
  for (const p of Object.values(L.players)) {
    if (p.teamId < 0) continue
    const wp = wpct.get(p.teamId) ?? 0.5
    const target =
      52 +
      (wp - 0.5) * 30 +
      (p.onMain ? 6 : ovr(p) >= 60 ? -8 : 0) +
      (p.salary >= fairSalary(p) ? 2 : -5) +
      (p.injuryDays > 0 ? -5 : 0) +
      (p.years === 1 ? -2 : 0)
    p.morale = clamp(p.morale + clamp((target - p.morale) * 0.08, -2, 2), 5, 99)
  }
}
