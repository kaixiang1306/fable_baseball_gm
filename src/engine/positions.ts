import type { PitRole, Pos } from '../types'

/**
 * 守備位置適性：球員在非本職守位的守備能力折扣（0.4 ~ 1.0）。
 * 回傳值乘上原始守備能力即為該守位的有效守備值。
 */
export function posFactor(natural: Pos | PitRole, slot: Pos): number {
  if (slot === 'DH') return 1            // DH 不守備
  if (natural === slot) return 1
  // 投手客串野手（理論上不會發生，保險用）
  if (natural === 'SP' || natural === 'RP' || natural === 'CP') return 0.5

  const nat = natural as Pos
  // 捕手是特殊工種
  if (slot === 'C') return 0.45
  if (nat === 'C') return ({ '1B': 0.9, '3B': 0.8, 'LF': 0.8, 'RF': 0.8, '2B': 0.7, 'SS': 0.65, 'CF': 0.65 } as Record<Pos, number>)[slot] ?? 0.7
  if (nat === 'DH') return ({ '1B': 0.85, 'LF': 0.85, 'RF': 0.85, '3B': 0.75, '2B': 0.7, 'SS': 0.65, 'CF': 0.7 } as Record<Pos, number>)[slot] ?? 0.7

  const isIF = (p: Pos) => p === '1B' || p === '2B' || p === '3B' || p === 'SS'
  const isOF = (p: Pos) => p === 'LF' || p === 'CF' || p === 'RF'

  if (isIF(nat) && isIF(slot)) {
    const map: Record<string, number> = {
      'SS-2B': 0.92, '2B-SS': 0.88, 'SS-3B': 0.88, '3B-SS': 0.78,
      '2B-3B': 0.85, '3B-2B': 0.8, '3B-1B': 0.95, '1B-3B': 0.75,
      'SS-1B': 0.92, '2B-1B': 0.92, '1B-2B': 0.68, '1B-SS': 0.62,
    }
    return map[`${nat}-${slot}`] ?? 0.8
  }
  if (isOF(nat) && isOF(slot)) {
    if (nat === 'CF') return 0.95
    if (slot === 'CF') return 0.82
    return 0.92 // 左右外野互換
  }
  if (isIF(nat) && isOF(slot)) return nat === '1B' ? 0.78 : 0.82
  if (isOF(nat) && isIF(slot)) return slot === '1B' ? 0.85 : 0.7
  return 0.75
}

/** 有效守備值 */
export function effField(field: number, natural: Pos | PitRole, slot: Pos): number {
  return field * posFactor(natural, slot)
}
