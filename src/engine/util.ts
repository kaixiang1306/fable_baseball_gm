export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const rand = () => Math.random()
export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
export const choice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 常態分佈（Box-Muller） */
export function gauss(mean = 0, sd = 1): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export const genRating = (mean = 50, sd = 12, lo = 20, hi = 95) =>
  Math.round(clamp(gauss(mean, sd), lo, hi))

/** 金額（萬元）轉顯示字串 */
export function fmtMoney(wan: number): string {
  const neg = wan < 0
  const v = Math.abs(wan)
  let s: string
  if (v >= 10000) s = `${(v / 10000).toFixed(2)} 億`
  else s = `${Math.round(v).toLocaleString()} 萬`
  return (neg ? '-' : '') + s
}

export const avg = (h: number, ab: number) => (ab === 0 ? '.---' : (h / ab).toFixed(3).replace(/^0/, ''))
export const era = (er: number, outs: number) => (outs === 0 ? '-.--' : ((er * 27) / outs).toFixed(2))
export const ip = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`
export const obp = (h: number, bb: number, hbp: number, pa: number) =>
  pa === 0 ? '.---' : ((h + bb + hbp) / pa).toFixed(3).replace(/^0/, '')
