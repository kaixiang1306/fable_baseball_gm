import { create } from 'zustand'
import type { League, Player } from './types'
import { createLeague, autoLineup } from './engine/league'
import { advanceDay, startLiveGame, userGameToday, TOTAL_DAYS } from './engine/season'
import { setNextPlayerId } from './engine/playerGen'
import { LiveGame } from './engine/sim'
import { allStarLiveGame, applyAllStarResult } from './engine/allstar'
import { startOffseason, finishFA, signFA, draftPickPlayer, runAIDraftPicks } from './engine/offseason'
import { evaluateTrade, executeTrade, type TradeVerdict } from './engine/trade'
import { offerExtension, type NegoResult } from './engine/contracts'

const SAVE_KEY = 'fable-gm-save-v2'

export type Screen = 'title' | 'select' | 'main'
export type MainTab = 'calendar' | 'roster' | 'standings' | 'leaders' | 'trade' | 'finance' | 'history'

export interface WatchState {
  lg: LiveGame
  homeName: string
  awayName: string
  exhibition: boolean
}

interface Store {
  league: League | null
  screen: Screen
  tab: MainTab
  tick: number
  watch: WatchState | null
  hasSave: boolean

  newGame: (teamId: number) => void
  adoptLeague: (league: League, teamId: number) => void
  loadGame: () => void
  deleteSave: () => void
  setScreen: (s: Screen) => void
  setTab: (t: MainTab) => void
  bump: () => void

  simDays: (n: number) => void
  simToHalfEnd: () => void
  watchToday: () => void
  finishWatch: () => void

  proposeTrade: (otherTeam: number, give: Player[], get: Player[]) => TradeVerdict
  negotiate: (p: Player, salary: number, years: number) => NegoResult
  goOffseason: () => void
  userSignFA: (p: Player) => void
  userFinishFA: () => void
  userDraftPick: (p: Player) => void
}

function save(league: League) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(league)) } catch { /* 容量滿時忽略 */ }
}

export function loadSavedLeague(): League | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as League
  } catch { return null }
}

export const useStore = create<Store>((set, get) => ({
  league: null,
  screen: 'title',
  tab: 'calendar',
  tick: 0,
  watch: null,
  hasSave: !!loadSavedLeague(),

  newGame: (teamId) => {
    const league = createLeague(teamId)
    save(league)
    set({ league, screen: 'main', tab: 'calendar', tick: get().tick + 1, hasSave: true })
  },
  adoptLeague: (league, teamId) => {
    league.userTeam = teamId
    save(league)
    set({ league, screen: 'main', tab: 'calendar', tick: get().tick + 1, hasSave: true })
  },
  loadGame: () => {
    const league = loadSavedLeague()
    if (league) {
      setNextPlayerId(league.nextPlayerId)
      set({ league, screen: 'main', tab: 'calendar', tick: get().tick + 1 })
    }
  },
  deleteSave: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ hasSave: false })
  },
  setScreen: (screen) => set({ screen }),
  setTab: (tab) => set({ tab }),
  bump: () => { const L = get().league; if (L) save(L); set(s => ({ tick: s.tick + 1 })) },

  simDays: (n) => {
    const L = get().league
    if (!L) return
    for (let i = 0; i < n; i++) {
      if (L.phase !== 'season' && L.phase !== 'ts' && L.phase !== 'allstar') break
      advanceDay(L)
    }
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  simToHalfEnd: () => {
    const L = get().league
    if (!L) return
    const target = L.day <= L.daysPerHalf ? L.daysPerHalf : TOTAL_DAYS
    let guard = 0
    while (L.phase === 'season' && L.day <= target && guard++ < 200) advanceDay(L)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  watchToday: () => {
    const L = get().league
    if (!L || get().watch) return
    if (L.phase === 'allstar') {
      const lg = allStarLiveGame(L)
      set(s => ({ tick: s.tick + 1, watch: { lg, homeName: '北軍明星隊', awayName: '南軍明星隊', exhibition: true } }))
      return
    }
    if (L.phase !== 'season' && L.phase !== 'ts') return
    const g = userGameToday(L)
    if (!g) { get().simDays(1); return }
    const lg = startLiveGame(L, g)
    set(s => ({
      tick: s.tick + 1,
      watch: { lg, homeName: L.teams[g.home].name, awayName: L.teams[g.away].name, exhibition: false },
    }))
  },
  finishWatch: () => {
    const L = get().league
    const w = get().watch
    if (!L || !w) return
    let guard = 0
    while (!w.lg.done && guard++ < 2000) w.lg.step()
    if (w.exhibition) applyAllStarResult(L, w.lg)
    else advanceDay(L) // 結算當日其餘比賽並推進
    save(L)
    set(s => ({ tick: s.tick + 1, watch: null }))
  },

  proposeTrade: (otherTeam, give, get_) => {
    const L = get().league!
    const verdict = evaluateTrade(L, otherTeam, give, get_)
    if (verdict.accept) {
      executeTrade(L, otherTeam, give, get_)
      autoLineup(L, L.teams[otherTeam])
      autoLineup(L, L.teams[L.userTeam])
      save(L)
      set(s => ({ tick: s.tick + 1 }))
    }
    return verdict
  },

  negotiate: (p, salary, years) => {
    const L = get().league!
    const result = offerExtension(L, p, salary, years)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
    return result
  },

  goOffseason: () => {
    const L = get().league
    if (!L) return
    if (L.evalResult?.fired) { L.phase = 'gameover' }
    else startOffseason(L)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  userSignFA: (p) => {
    const L = get().league!
    signFA(L, L.userTeam, p)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  userFinishFA: () => {
    const L = get().league!
    finishFA(L)
    runAIDraftPicks(L)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  userDraftPick: (p) => {
    const L = get().league!
    draftPickPlayer(L, p)
    runAIDraftPicks(L)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
}))
