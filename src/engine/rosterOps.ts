import type { League, Player, Team } from '../types'
import { ovr } from './playerGen'
import { autoLineup, MAIN_ROSTER_SIZE } from './league'

const healthy = (p: Player | undefined): p is Player => !!p && p.injuryDays === 0

/** 球員受傷後的處理：移出一軍與先發位置、自動遞補 */
export function handleInjury(L: League, p: Player, days: number) {
  if (p.teamId < 0) return
  const team = L.teams[p.teamId]
  const isUser = p.teamId === L.userTeam

  if (isUser) {
    L.news.unshift({
      year: L.year, day: L.day, kind: 'owner',
      text: `傷報：${p.name} 因傷預計缺陣 ${days} 天，已移出一軍並自動遞補，請檢視陣容。`,
    })
  }

  if (team.id !== L.userTeam) {
    // AI 球隊：整體重整
    aiReorganize(L, team)
    return
  }

  // 使用者球隊：只做必要遞補，不動其他安排
  p.onMain = false
  patchUserSlots(L, team)
}

/** 球員傷癒 */
export function handleRecovery(L: League, p: Player) {
  if (p.teamId < 0) return
  if (p.teamId === L.userTeam) {
    L.news.unshift({
      year: L.year, day: L.day, kind: 'owner',
      text: `好消息：${p.name} 傷癒歸隊，目前在二軍名單，可至陣容頁升上一軍。`,
    })
  } else {
    aiReorganize(L, L.teams[p.teamId])
  }
}

/** 補齊使用者球隊的打線／輪值／終結者空缺（被傷兵佔走的位置） */
export function patchUserSlots(L: League, team: Team) {
  const roster = Object.values(L.players).filter(q => q.teamId === team.id)
  const mainCount = () => roster.filter(q => q.onMain).length
  const promoteBestFarm = (isP: boolean): Player | null => {
    const cand = roster
      .filter(q => !q.onMain && healthy(q) && q.isP === isP)
      .sort((a, b) => ovr(b) - ovr(a))[0]
    if (cand && mainCount() < MAIN_ROSTER_SIZE) { cand.onMain = true; return cand }
    return null
  }

  // 打線
  team.lineup.forEach((id, i) => {
    const cur = L.players[id]
    if (healthy(cur) && cur.onMain) return
    const slotPos = team.lineupPos?.[i]
    let sub = roster
      .filter(q => !q.isP && q.onMain && healthy(q) && !team.lineup.includes(q.id))
      .sort((a, b) => (a.pos === slotPos ? -1 : 0) - (b.pos === slotPos ? -1 : 0) || ovr(b) - ovr(a))[0]
    if (!sub) sub = promoteBestFarm(false) ?? undefined as unknown as Player
    if (sub) team.lineup[i] = sub.id
  })
  // 輪值
  team.rotation.forEach((id, i) => {
    const cur = L.players[id]
    if (healthy(cur) && cur.onMain) return
    let sub = roster
      .filter(q => q.isP && q.onMain && healthy(q) && !team.rotation.includes(q.id) && q.id !== team.closer)
      .sort((a, b) => (a.pos === 'SP' ? -1 : 0) - (b.pos === 'SP' ? -1 : 0) || ovr(b) - ovr(a))[0]
    if (!sub) sub = promoteBestFarm(true) ?? undefined as unknown as Player
    if (sub) team.rotation[i] = sub.id
  })
  // 終結者
  const closer = team.closer >= 0 ? L.players[team.closer] : undefined
  if (!healthy(closer) || !closer!.onMain) {
    const sub = roster
      .filter(q => q.isP && q.onMain && healthy(q) && !team.rotation.includes(q.id))
      .sort((a, b) => ovr(b) - ovr(a))[0]
    if (sub) team.closer = sub.id
  }
  // 牛棚剔除傷兵
  team.bullpen = team.bullpen.filter(id => healthy(L.players[id]) && L.players[id].onMain)
  const penCands = roster.filter(q =>
    q.isP && q.onMain && healthy(q) && !team.rotation.includes(q.id) && q.id !== team.closer && !team.bullpen.includes(q.id))
  for (const c of penCands) { if (team.bullpen.length >= 7) break; team.bullpen.push(c.id) }
}

/** AI 球隊整體重整：健康優先選入一軍、重排陣容 */
export function aiReorganize(L: League, team: Team) {
  if (team.id === L.userTeam) return
  const roster = Object.values(L.players).filter(q => q.teamId === team.id)
  // 傷兵下放
  roster.forEach(q => { if (q.injuryDays > 0) q.onMain = false })
  autoLineup(L, team)
}
