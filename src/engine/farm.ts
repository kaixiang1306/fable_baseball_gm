import type { Game, League, Player, Team } from '../types'
import { LiveGame, type Squad } from './sim'
import { ovr } from './playerGen'
import { handleInjury } from './rosterOps'

/** 組出二軍出賽陣容；人手不足時回傳 null（當日二軍輪空） */
export function farmSquad(L: League, team: Team, dayIdx: number): Squad | null {
  const pool = Object.values(L.players).filter(p => p.teamId === team.id && !p.onMain && p.injuryDays === 0)
  const batters = pool.filter(p => !p.isP).sort((a, b) => ovr(b) - ovr(a))
  const pitchers = pool.filter(p => p.isP).sort((a, b) => ovr(b) - ovr(a))
  if (batters.length < 9 || pitchers.length < 2) return null

  // 守位涵蓋：每個位置找一人，找不到就用最佳剩餘者頂替
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  const used = new Set<number>()
  const lineup: Player[] = []
  const lineupPos: string[] = []
  for (const pos of positions) {
    const cand = batters.find(p => p.pos === pos && !used.has(p.id)) ?? batters.find(p => !used.has(p.id))!
    used.add(cand.id); lineup.push(cand); lineupPos.push(pos)
  }
  const dh = batters.find(p => !used.has(p.id))!
  used.add(dh.id); lineup.push(dh); lineupPos.push('DH')

  const sps = pitchers.filter(p => p.pos === 'SP')
  const starter = sps.length ? sps[dayIdx % sps.length] : pitchers[0]
  const bullpen = pitchers.filter(p => p.id !== starter.id).slice(0, 5)

  return {
    name: `${team.name}二軍`, short: team.short, teamId: team.id, team: undefined,
    lineup, lineupPos, startPitcher: starter, bullpen, closer: null,
  }
}

/** 模擬當日所有二軍比賽（與一軍同對戰組合） */
export function playFarmDay(L: League, mainGames: Game[]) {
  for (const g of mainGames) {
    const home = L.teams[g.home]
    const away = L.teams[g.away]
    const hs = farmSquad(L, home, L.day)
    const as = farmSquad(L, away, L.day)
    if (!hs || !as) continue
    const lg = new LiveGame(L, hs, as, { statMode: 'farm', log: false })
    let guard = 0
    while (!lg.done && guard++ < 2000) lg.step()
    if (lg.hs > lg.as) { home.farmRec.w++; away.farmRec.l++ }
    else if (lg.as > lg.hs) { away.farmRec.w++; home.farmRec.l++ }
    else { home.farmRec.t++; away.farmRec.t++ }
    for (const inj of lg.injuries) {
      const p = L.players[inj.pid]
      if (p) handleInjury(L, p, inj.days)
    }
  }
}
