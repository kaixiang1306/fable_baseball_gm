import { create } from 'zustand'
import type { League, PBEvent, Player } from './types'
import { createLeague, autoLineup } from './engine/league'
import { playDay, TOTAL_DAYS } from './engine/season'
import { setNextPlayerId } from './engine/playerGen'
import { startOffseason, finishFA, signFA, draftPickPlayer, runAIDraftPicks } from './engine/offseason'
import { evaluateTrade, executeTrade, type TradeVerdict } from './engine/trade'

const SAVE_KEY = 'fable-gm-save-v1'

export type Screen = 'title' | 'select' | 'main'
export type MainTab = 'calendar' | 'roster' | 'standings' | 'leaders' | 'trade' | 'finance'

interface PendingWatch { events: PBEvent[]; homeName: string; awayName: string }

interface Store {
  league: League | null
  screen: Screen
  tab: MainTab
  tick: number
  watch: PendingWatch | null
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
  closeWatch: () => void

  proposeTrade: (otherTeam: number, give: Player[], get: Player[]) => TradeVerdict
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
      if (L.phase !== 'season' && L.phase !== 'ts') break
      playDay(L, false)
    }
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  simToHalfEnd: () => {
    const L = get().league
    if (!L) return
    const target = L.day <= L.daysPerHalf ? L.daysPerHalf : TOTAL_DAYS
    let guard = 0
    while (L.phase === 'season' && L.day <= target && guard++ < 200) playDay(L, false)
    save(L)
    set(s => ({ tick: s.tick + 1 }))
  },
  watchToday: () => {
    const L = get().league
    if (!L || (L.phase !== 'season' && L.phase !== 'ts')) return
    let homeName = '', awayName = ''
    if (L.phase === 'season') {
      const g = L.schedule.find(g => g.day === L.day && !g.played && (g.home === L.userTeam || g.away === L.userTeam))
      if (!g) { get().simDays(1); return }
      homeName = L.teams[g.home].name; awayName = L.teams[g.away].name
    } else if (L.ts) {
      if (L.ts.a !== L.userTeam && L.ts.b !== L.userTeam) { get().simDays(1); return }
      const gameNo = L.ts.wa + L.ts.wb + 1
      const aHome = [1, 2, 6, 7].includes(gameNo)
      homeName = L.teams[aHome ? L.ts.a : L.ts.b].name
      awayName = L.teams[aHome ? L.ts.b : L.ts.a].name
    }
    const events = playDay(L, true)
    save(L)
    set(s => ({ tick: s.tick + 1, watch: events ? { events, homeName, awayName } : null }))
  },
  closeWatch: () => set({ watch: null }),

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
