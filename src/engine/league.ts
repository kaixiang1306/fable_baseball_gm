import type { Game, League, Player, Team, TeamFinance } from '../types'
import { TEAM_DEFS } from '../data/teams'
import { resetUsedNames } from '../data/names'
import { genRoster, getNextPlayerId, ovr, setNextPlayerId } from './playerGen'
import { shuffle } from './util'

export const DAYS_PER_HALF = 60
export const TRADE_DEADLINE_DAY = 90
export const MAIN_ROSTER_SIZE = 26

/** 自動編排一軍 26 人、打序、輪值、牛棚 */
export function autoLineup(L: League, team: Team) {
  const roster = Object.values(L.players).filter(p => p.teamId === team.id)
  const batters = roster.filter(p => !p.isP).sort((a, b) => ovr(b) - ovr(a))
  const pitchers = roster.filter(p => p.isP).sort((a, b) => ovr(b) - ovr(a))

  // 每個守位挑最強者
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const
  const used = new Set<number>()
  const starters: Player[] = []
  const assigned = new Map<number, string>()
  for (const pos of positions) {
    const cand = batters.find(p => p.pos === pos && !used.has(p.id)) ?? batters.find(p => !used.has(p.id))
    if (cand) { used.add(cand.id); starters.push(cand); assigned.set(cand.id, pos) }
  }
  // DH：剩餘打者中最強
  const dh = batters.find(p => !used.has(p.id))
  if (dh) { used.add(dh.id); starters.push(dh); assigned.set(dh.id, 'DH') }

  // 打序：1 棒重速度上壘、2 棒重巧打、3 棒最強、4 棒重砲，其餘依綜合
  const order = starters.slice()
  order.sort((a, b) => ovr(b) - ovr(a))
  const third = order.shift()
  order.sort((a, b) => (b.power) - (a.power))
  const fourth = order.shift()
  order.sort((a, b) => (b.speed + b.eye) - (a.speed + a.eye))
  const first = order.shift()
  order.sort((a, b) => (b.contact) - (a.contact))
  const second = order.shift()
  order.sort((a, b) => ovr(b) - ovr(a))
  team.lineup = [first, second, third, fourth, ...order].filter((p): p is Player => !!p).map(p => p.id)
  team.lineupPos = team.lineup.map(id => (assigned.get(id) ?? 'DH') as typeof team.lineupPos[number])

  // 投手群
  const sps = pitchers.filter(p => p.pos === 'SP')
  team.rotation = sps.slice(0, 5).map(p => p.id)
  const cp = pitchers.find(p => p.pos === 'CP') ?? pitchers.filter(p => p.pos !== 'SP')[0]
  team.closer = cp ? cp.id : -1
  team.bullpen = pitchers.filter(p => !team.rotation.includes(p.id) && p.id !== team.closer && p.pos !== 'SP').slice(0, 7).map(p => p.id)
  team.nextSP = 0

  // 一軍 26 人：打線 9 + 板凳 4 + 輪值 5 + 牛棚 7 + 終結者 1
  roster.forEach(p => { p.onMain = false })
  const mainIds = new Set<number>([...team.lineup, ...team.rotation, ...team.bullpen])
  if (team.closer >= 0) mainIds.add(team.closer)
  const bench = batters.filter(p => !mainIds.has(p.id)).slice(0, MAIN_ROSTER_SIZE - mainIds.size)
  bench.forEach(p => mainIds.add(p.id))
  for (const id of mainIds) if (L.players[id]) L.players[id].onMain = true
}

/** 產生半季賽程：六隊循環，每天 3 場，每對戰組合 12 次 */
function genHalfSchedule(startDay: number, half: 1 | 2, nextGameId: { v: number }): Game[] {
  // 6 隊輪轉法：5 輪涵蓋所有對戰組合，每輪 3 場
  const ids = [0, 1, 2, 3, 4, 5]
  const rounds: [number, number][][] = []
  const arr = ids.slice(1)
  for (let r = 0; r < 5; r++) {
    const pairs: [number, number][] = [[ids[0], arr[0]]]
    for (let i = 1; i <= 2; i++) pairs.push([arr[i], arr[arr.length - i]])
    rounds.push(pairs)
    arr.unshift(arr.pop()!)
  }
  // 每輪重複 12 天（6 天主場互換），共 60 天
  const days: [number, number][][] = []
  for (let rep = 0; rep < 12; rep++) {
    for (const round of rounds) {
      const flip = rep % 2 === 1
      days.push(round.map(([a, b]) => (flip ? [b, a] : [a, b]) as [number, number]))
    }
  }
  const order = shuffle(days.map((_, i) => i))
  const games: Game[] = []
  order.forEach((dayIdx, i) => {
    for (const [homeId, awayId] of days[dayIdx]) {
      games.push({
        id: nextGameId.v++, day: startDay + i, half,
        home: homeId, away: awayId,
        played: false, hs: 0, as: 0, inn: 9,
      })
    }
  })
  return games
}

export function genSeasonSchedule(): Game[] {
  const nextGameId = { v: 1 }
  return [
    ...genHalfSchedule(1, 1, nextGameId),
    ...genHalfSchedule(DAYS_PER_HALF + 1, 2, nextGameId),
  ]
}

export function createLeague(userTeam: number, year = 2026): League {
  resetUsedNames()
  setNextPlayerId(1)
  const players: Record<number, Player> = {}
  const teams: Team[] = TEAM_DEFS.map((def, id) => ({
    id,
    name: def.name, short: def.short, city: def.city, c1: def.c1, c2: def.c2,
    owner: {
      name: def.ownerName, desc: def.ownerDesc, prefs: { ...def.prefs },
      patienceLeft: def.prefs.patience, goals: [],
    },
    budget: def.budget,
    morale: 55,
    lineup: [], lineupPos: [], rotation: [], bullpen: [], closer: -1, nextSP: 0,
    rec: [{ w: 0, l: 0, t: 0 }, { w: 0, l: 0, t: 0 }],
  }))

  TEAM_DEFS.forEach((def, id) => {
    for (const p of genRoster(id, def.strength, def.bias)) players[p.id] = p
  })

  const finance: Record<number, TeamFinance> = {}
  teams.forEach(t => { finance[t.id] = { revenue: 0, salaries: 0 } })

  const L: League = {
    year, day: 1, daysPerHalf: DAYS_PER_HALF, phase: 'season',
    teams, players, nextPlayerId: getNextPlayerId(),
    schedule: genSeasonSchedule(),
    userTeam,
    news: [],
    ts: null,
    faPool: [], draftPool: [], draftOrder: [], draftPick: 0,
    champs: [],
    finance,
    evalResult: null,
  }
  teams.forEach(t => autoLineup(L, t))
  teams.forEach(t => setOwnerGoals(L, t))
  L.news.push({ year, day: 1, kind: 'league', text: `${year} 年寶島職棒大聯盟賽季正式開打！六隊將展開上下半季各 ${DAYS_PER_HALF} 場的爭霸。` })
  return L
}

/** 依老闆偏好生成本季目標 */
export function setOwnerGoals(L: League, team: Team) {
  const prefs = team.owner.prefs
  const goals: string[] = []
  if (prefs.success >= 5) goals.push('CHAMP|奪下台灣大賽冠軍')
  else if (prefs.success === 4) goals.push('TS|打進台灣大賽')
  else if (prefs.success === 3) goals.push('WPCT50|全年勝率達五成')
  else goals.push('WPCT42|全年勝率達四成二（穩定成長）')
  if (prefs.money >= 4) goals.push('PROFIT|球團本季損益不得為負')
  if (prefs.morale >= 5) goals.push('MORALE|賽季結束時球隊士氣不低於 50')
  team.owner.goals = goals
}

/** 球隊綜合 / 打擊 / 投手指數（顯示用，0-99） */
export function teamPower(L: League, team: Team): { ovr: number; off: number; pit: number } {
  const lineupP = team.lineup.map(id => L.players[id]).filter(Boolean)
  const rot = team.rotation.map(id => L.players[id]).filter(Boolean)
  const pen = [...team.bullpen, team.closer].map(id => L.players[id]).filter(Boolean)
  const off = lineupP.length ? lineupP.reduce((s, p) => s + ovr(p), 0) / lineupP.length : 40
  const pitArr = [...rot, ...rot, ...pen] // 先發加權
  const pit = pitArr.length ? pitArr.reduce((s, p) => s + ovr(p), 0) / pitArr.length : 40
  return { ovr: Math.round(off * 0.5 + pit * 0.5), off: Math.round(off), pit: Math.round(pit) }
}

export function teamPayroll(L: League, teamId: number): number {
  return Object.values(L.players)
    .filter(p => p.teamId === teamId)
    .reduce((s, p) => s + p.salary * 12, 0)
}
