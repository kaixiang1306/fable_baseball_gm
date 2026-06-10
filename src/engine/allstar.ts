import type { AllStarState, League, PBEvent, Player, Pos } from '../types'
import { LiveGame, type Squad } from './sim'
import { ovr } from './playerGen'
import { clamp } from './util'

const POSITIONS: Pos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

function perfScore(p: Player): number {
  if (p.isP) {
    if (p.pit.outs < 60) return ovr(p)
    const eraVal = (p.pit.er * 27) / p.pit.outs
    return ovr(p) + clamp((4.2 - eraVal) * 4, -10, 12)
  }
  if (p.bat.pa < 80) return ovr(p)
  const avgVal = p.bat.h / Math.max(1, p.bat.ab)
  return ovr(p) + clamp((avgVal - 0.27) * 80, -8, 10) + p.bat.hr * 0.15
}

function selectSide(L: League, conf: 'north' | 'south') {
  const teamIds = L.teams.filter(t => t.conference === conf).map(t => t.id)
  const cands = Object.values(L.players).filter(p =>
    teamIds.includes(p.teamId) && p.injuryDays === 0 && p.onMain)
  const batters = cands.filter(p => !p.isP).sort((a, b) => perfScore(b) - perfScore(a))
  const pitchers = cands.filter(p => p.isP).sort((a, b) => perfScore(b) - perfScore(a))

  const used = new Set<number>()
  const lineup: number[] = []
  const pos: Pos[] = []
  for (const ps of POSITIONS) {
    const c = batters.find(p => p.pos === ps && !used.has(p.id)) ?? batters.find(p => !used.has(p.id))
    if (c) { used.add(c.id); lineup.push(c.id); pos.push(ps) }
  }
  const dh = batters.find(p => !used.has(p.id))
  if (dh) { used.add(dh.id); lineup.push(dh.id); pos.push('DH') }
  return { lineup, pos, pitchers: pitchers.slice(0, 6).map(p => p.id) }
}

export function setupAllStar(L: League) {
  const n = selectSide(L, 'north')
  const s = selectSide(L, 'south')
  L.allStar = {
    nLineup: n.lineup, nPos: n.pos, nPitchers: n.pitchers,
    sLineup: s.lineup, sPos: s.pos, sPitchers: s.pitchers,
    played: false, ns: 0, ss: 0, mvp: '',
  }
  L.phase = 'allstar'
  const userStars = [...n.lineup, ...n.pitchers, ...s.lineup, ...s.pitchers]
    .map(id => L.players[id]).filter(p => p && p.teamId === L.userTeam)
  L.news.unshift({
    year: L.year, day: L.day, kind: 'league',
    text: `上半季戰罷，明星賽週末登場！北軍 vs 南軍${userStars.length ? `——本隊 ${userStars.map(p => p.name).join('、')} 入選明星隊！` : '。'}`,
  })
  userStars.forEach(p => { p.morale = clamp(p.morale + 4, 0, 100) })
}

export function allStarSquads(L: League): { north: Squad; south: Squad } {
  const as = L.allStar!
  const mk = (name: string, short: string, lineup: number[], pos: Pos[], pitchers: number[]): Squad => {
    const ps = pitchers.map(id => L.players[id]).filter(Boolean)
    return {
      name, short, teamId: -1, team: undefined,
      lineup: lineup.map(id => L.players[id]).filter(Boolean),
      lineupPos: pos,
      startPitcher: ps[0],
      bullpen: ps.slice(1),
      closer: null,
    }
  }
  return {
    north: mk('北軍明星隊', '北', as.nLineup, as.nPos, as.nPitchers),
    south: mk('南軍明星隊', '南', as.sLineup, as.sPos, as.sPitchers),
  }
}

/** 建立明星賽 LiveGame（表演賽：不計數據、不判傷） */
export function allStarLiveGame(L: League): LiveGame {
  const { north, south } = allStarSquads(L)
  return new LiveGame(L, north, south, { statMode: 'none', log: true, injuries: false })
}

/** 套用明星賽結果並回到例行賽 */
export function applyAllStarResult(L: League, lg: LiveGame) {
  const as = L.allStar!
  as.played = true
  as.ns = lg.hs // 北軍為主隊
  as.ss = lg.as
  const winnerIds = lg.hs >= lg.as ? as.nLineup : as.sLineup
  const mvpP = winnerIds.map(id => L.players[id]).filter(Boolean).sort((a, b) => ovr(b) - ovr(a))[0]
  as.mvp = mvpP?.name ?? ''
  L.news.unshift({
    year: L.year, day: L.day, kind: 'league',
    text: `明星賽落幕：北軍 ${as.ns}:${as.ss} 南軍${as.ns === as.ss ? '，握手言和' : `，${as.ns > as.ss ? '北軍' : '南軍'}獲勝`}！MVP：${as.mvp}${mvpP ? `（${L.teams[mvpP.teamId]?.name ?? ''}）` : ''}。下半季戰火重燃！`,
  })
  L.phase = 'season'
}

export function runAllStarQuick(L: League) {
  const lg = allStarLiveGame(L)
  let guard = 0
  while (!lg.done && guard++ < 2000) lg.step()
  applyAllStarResult(L, lg)
}

export type { PBEvent }
