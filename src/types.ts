export type Pos = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'
export type PitRole = 'SP' | 'RP' | 'CP'

export interface BatStats {
  pa: number; ab: number; h: number; d2: number; d3: number; hr: number
  rbi: number; r: number; bb: number; so: number; sb: number; cs: number; hbp: number
}
export interface PitStats {
  g: number; gs: number; outs: number; h: number; r: number; er: number
  bb: number; so: number; hr: number; w: number; l: number; sv: number
}

export interface Player {
  id: number
  name: string
  age: number
  foreign: boolean
  isP: boolean
  pos: Pos | PitRole
  // 打者能力
  contact: number; power: number; eye: number; speed: number; field: number
  // 投手能力
  velo: number; ctrl: number; stuff: number; stam: number
  pot: number          // 潛力上限
  salary: number       // 月薪（萬元）
  years: number        // 合約剩餘年數
  teamId: number       // -1 = 自由球員, -2 = 選秀新秀
  onMain: boolean      // 一軍
  bat: BatStats
  pit: PitStats
}

export interface OwnerPrefs {
  money: number; success: number; image: number
  involve: number; morale: number; patience: number
}
export interface Owner {
  name: string
  desc: string
  prefs: OwnerPrefs
  patienceLeft: number
  goals: string[]
}

export interface TeamRecord { w: number; l: number; t: number }

export interface Team {
  id: number
  name: string
  short: string       // 單字隊徽
  city: string
  c1: string          // 主色
  c2: string          // 輔色
  owner: Owner
  budget: number      // 年度球員薪資預算（萬）
  morale: number      // 球隊士氣 0-100
  lineup: number[]    // 9 人先發打序（含 DH）
  lineupPos: Pos[]    // 與 lineup 對應的守位安排
  rotation: number[]  // 先發輪值
  bullpen: number[]   // 牛棚
  closer: number      // 終結者 id（-1 無）
  nextSP: number      // 下一位先發索引
  rec: [TeamRecord, TeamRecord]  // [上半季, 下半季]
}

export interface Game {
  id: number
  day: number
  half: 0 | 1 | 2     // 0 = 台灣大賽
  home: number
  away: number
  played: boolean
  hs: number
  as: number
  inn: number
}

export interface NewsItem { year: number; day: number; text: string; kind: 'game' | 'trade' | 'sign' | 'league' | 'owner' }

export interface PBEvent {
  text: string
  inn: number
  top: boolean
  hs: number
  as: number
  outs: number
  bases: [boolean, boolean, boolean]
  pitcher: string
  batter: string
  big: boolean        // 重要事件（得分/全壘打）
}

export type Phase = 'season' | 'ts' | 'eval' | 'fa' | 'draft' | 'gameover'

export interface TaiwanSeries { a: number; b: number; wa: number; wb: number; note: string }

export interface TeamFinance { revenue: number; salaries: number }

export interface League {
  year: number
  day: number          // 目前天數（1-based，尚未進行）
  daysPerHalf: number
  phase: Phase
  teams: Team[]
  players: Record<number, Player>
  nextPlayerId: number
  schedule: Game[]
  userTeam: number
  news: NewsItem[]
  ts: TaiwanSeries | null
  faPool: number[]
  draftPool: number[]
  draftOrder: number[]   // team ids，重複輪數
  draftPick: number
  champs: { year: number; team: number }[]
  finance: Record<number, TeamFinance>
  evalResult: { passed: boolean; lines: string[]; fired: boolean } | null
}
