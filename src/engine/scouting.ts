import type { League, Player } from '../types'
import { ovr } from './playerGen'
import { clamp } from './util'

export const SCOUT_MAX_LEVEL = 3
export const SCOUT_POINT_CAP = 30
export const SCOUT_LEVEL_LABELS = ['未考察', '初步報告', '詳細報告', '完整考察']

/** 使用者球團對該球員的情報等級（自家球員教練團天天看，至少詳細報告） */
export function getScoutLevel(L: League, p: Player): number {
  const base = L.scout.levels[p.id] ?? 0
  if (p.teamId === L.userTeam) return Math.max(2, base)
  return base
}

/** 穩定雜訊：同一球員永遠回傳相同值（避免每次顯示都跳動） */
function noise(id: number, salt: number): number {
  let h = (id * 2654435761 + salt * 40503) >>> 0
  h ^= h >>> 13
  h = (h * 1274126177) >>> 0
  return ((h >>> 8) % 1000) / 1000 // 0~1
}

export interface PotEstimate { lo: number; hi: number; exact: boolean; level: number }

/** 潛力估計範圍：考察等級越高，中心越準、範圍越窄 */
export function potEstimate(L: League, p: Player): PotEstimate {
  const level = getScoutLevel(L, p)
  if (level >= SCOUT_MAX_LEVEL) return { lo: p.pot, hi: p.pot, exact: true, level }
  const o = ovr(p)
  // 低等級情報偏差大：球探可能高估（水貨）或低估（遺珠）
  const bias = (noise(p.id, 1) - 0.5) * [26, 14, 5][level]
  const width = [9, 6, 3][level]
  const center = p.pot + bias
  let lo = Math.round(clamp(center - width, 20, 99))
  let hi = Math.round(clamp(center + width, 20, 99))
  lo = Math.max(lo, o)          // 潛力不會低於現在的能力
  hi = Math.max(hi, lo)
  return { lo, hi, exact: false, level }
}

export function fmtPot(L: League, p: Player): string {
  const e = potEstimate(L, p)
  return e.exact ? String(p.pot) : `${e.lo}~${e.hi}`
}

export function canScout(L: League, p: Player): boolean {
  return L.scout.points > 0 && getScoutLevel(L, p) < SCOUT_MAX_LEVEL
}

/** 派遣球探考察（花 1 點，情報等級 +1） */
export function scoutPlayer(L: League, p: Player): boolean {
  if (!canScout(L, p)) return false
  L.scout.points--
  const lvl = Math.min(SCOUT_MAX_LEVEL, getScoutLevel(L, p) + 1)
  L.scout.levels[p.id] = lvl
  if (lvl === SCOUT_MAX_LEVEL && p.pot - ovr(p) >= 14) {
    L.news.unshift({
      year: L.year, day: L.day, kind: 'sign',
      text: `球探回報：${p.name} 是顆未經雕琢的鑽石，天花板遠高於現在的表現！`,
    })
  }
  return true
}

export function accrueScoutPoints(L: League, n: number) {
  L.scout.points = Math.min(SCOUT_POINT_CAP, L.scout.points + n)
}

/** 清掉已離開聯盟球員的情報紀錄 */
export function pruneScoutLevels(L: League) {
  for (const id of Object.keys(L.scout.levels)) {
    if (!L.players[Number(id)]) delete L.scout.levels[Number(id)]
  }
}
