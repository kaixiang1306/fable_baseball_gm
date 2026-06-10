import type { BatStats, PitRole, PitStats, Player, Pos } from '../types'
import { genName, genForeignName } from '../data/names'
import { clamp, genRating, randInt, rand } from './util'

export const emptyBat = (): BatStats => ({ pa: 0, ab: 0, h: 0, d2: 0, d3: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, sb: 0, cs: 0, hbp: 0 })
export const emptyPit = (): PitStats => ({ g: 0, gs: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, w: 0, l: 0, sv: 0 })

/** 綜合能力值 */
export function ovr(p: Player): number {
  if (p.isP) return Math.round(p.stuff * 0.35 + p.ctrl * 0.3 + p.velo * 0.2 + p.stam * 0.15)
  return Math.round(p.contact * 0.3 + p.power * 0.25 + p.eye * 0.15 + p.speed * 0.1 + p.field * 0.2)
}

/** 依能力與年齡估算合理月薪（萬） */
export function fairSalary(p: Player): number {
  const o = ovr(p)
  let base = 7 + Math.pow(Math.max(0, o - 38), 1.62) / 7
  if (p.foreign) base *= 2.2
  if (p.age >= 31) base *= 1.1
  if (p.age <= 23) base *= 0.7
  return Math.round(clamp(base, 7, 200))
}

function genPotential(age: number, o: number): number {
  if (age <= 21) return clamp(o + randInt(8, 22), o, 99)
  if (age <= 24) return clamp(o + randInt(4, 16), o, 99)
  if (age <= 27) return clamp(o + randInt(0, 8), o, 99)
  return o
}

let nextId = 1
export function setNextPlayerId(id: number) { nextId = id }
export function getNextPlayerId() { return nextId }

function base(name: string, age: number, foreign: boolean): Player {
  return {
    id: nextId++, name, age, foreign,
    isP: false, pos: 'DH',
    contact: 30, power: 30, eye: 30, speed: 30, field: 30,
    velo: 30, ctrl: 30, stuff: 30, stam: 30,
    pot: 50, salary: 10, years: randInt(1, 4), teamId: -1, onMain: false,
    morale: randInt(50, 70), injuryDays: 0, negoFails: 0,
    bat: emptyBat(), pit: emptyPit(),
    fbat: emptyBat(), fpit: emptyPit(),
    career: { bat: emptyBat(), pit: emptyPit(), seasons: 0 },
  }
}

export function genBatter(pos: Pos, mean = 50, opts: { age?: number; foreign?: boolean } = {}): Player {
  const foreign = opts.foreign ?? false
  const age = opts.age ?? randInt(20, 34)
  const p = base(foreign ? genForeignName() : genName(), age, foreign)
  p.isP = false
  p.pos = pos
  const sd = 9
  p.contact = genRating(mean + 2, sd)
  p.power = genRating(mean - 2, sd + 3)
  p.eye = genRating(mean, sd)
  p.speed = genRating(mean + (pos === 'CF' || pos === 'SS' || pos === '2B' ? 6 : 0) - (pos === '1B' || pos === 'DH' || pos === 'C' ? 6 : 0), sd)
  p.field = genRating(mean + (pos === 'SS' || pos === 'C' || pos === 'CF' ? 5 : 0) - (pos === 'DH' ? 12 : 0), sd)
  if (pos === '1B' || pos === 'DH' || pos === 'LF' || pos === 'RF') p.power = genRating(mean + 4, sd + 3)
  p.pot = genPotential(age, ovr(p))
  p.salary = Math.round(fairSalary(p) * (0.85 + rand() * 0.3))
  return p
}

export function genPitcher(role: PitRole, mean = 50, opts: { age?: number; foreign?: boolean } = {}): Player {
  const foreign = opts.foreign ?? false
  const age = opts.age ?? randInt(20, 35)
  const p = base(foreign ? genForeignName() : genName(), age, foreign)
  p.isP = true
  p.pos = role
  const sd = 9
  p.velo = genRating(mean + (role === 'CP' ? 8 : 0), sd)
  p.ctrl = genRating(mean, sd)
  p.stuff = genRating(mean + (role === 'CP' ? 4 : 0), sd)
  p.stam = role === 'SP' ? genRating(62, 10, 40, 95) : genRating(32, 8, 15, 55)
  // 投手打擊很弱（DH 制下幾乎用不到）
  p.contact = randInt(15, 30); p.power = randInt(10, 25); p.eye = randInt(15, 30)
  p.speed = randInt(20, 40); p.field = randInt(30, 55)
  p.pot = genPotential(age, ovr(p))
  p.salary = Math.round(fairSalary(p) * (0.85 + rand() * 0.3))
  return p
}

/** 為一支球隊生成完整球員名單（約 32 人） */
export function genRoster(teamId: number, strength: number, bias: 'bat' | 'pit' | 'even'): Player[] {
  const players: Player[] = []
  const batMean = 50 + strength + (bias === 'bat' ? 3 : bias === 'pit' ? -2 : 0)
  const pitMean = 50 + strength + (bias === 'pit' ? 3 : bias === 'bat' ? -2 : 0)

  const posPlan: Pos[] = ['C', 'C', '1B', '1B', '2B', '2B', '3B', '3B', 'SS', 'SS', 'LF', 'LF', 'CF', 'CF', 'RF', 'RF', 'DH', 'DH']
  posPlan.forEach((pos, i) => {
    const starter = i % 2 === 0
    players.push(genBatter(pos, batMean + (starter ? 4 : -5)))
  })
  // 洋將：以先發投手為主
  const foreignSP = randInt(2, 3)
  for (let i = 0; i < foreignSP; i++) players.push(genPitcher('SP', pitMean + 10, { foreign: true, age: randInt(27, 33) }))
  for (let i = 0; i < 6 - foreignSP; i++) players.push(genPitcher('SP', pitMean + (i < 2 ? 3 : -3)))
  for (let i = 0; i < 7; i++) players.push(genPitcher('RP', pitMean + (i < 3 ? 1 : -5)))
  players.push(genPitcher('CP', pitMean + 5))

  // 二軍梯隊：年輕便宜的養成球員
  const farmPos: Pos[] = ['C', 'SS', '2B', '3B', 'CF', 'RF', '1B', 'LF']
  for (let i = 0; i < 6; i++) {
    const p = genBatter(farmPos[i % farmPos.length], batMean - 11, { age: randInt(19, 24) })
    p.salary = randInt(6, 10); players.push(p)
  }
  for (let i = 0; i < 3; i++) {
    const p = genPitcher('SP', pitMean - 10, { age: randInt(19, 24) })
    p.salary = randInt(6, 10); players.push(p)
  }
  for (let i = 0; i < 3; i++) {
    const p = genPitcher('RP', pitMean - 11, { age: randInt(19, 24) })
    p.salary = randInt(6, 10); players.push(p)
  }

  players.forEach(p => { p.teamId = teamId })
  return players
}

/** 生成選秀新秀 */
export function genProspect(): Player {
  const isP = rand() < 0.5
  const age = randInt(18, 23)
  const mean = 38 + randInt(0, 10)
  const p = isP
    ? genPitcher(rand() < 0.7 ? 'SP' : 'RP', mean, { age })
    : genBatter((['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as Pos[])[randInt(0, 8)], mean, { age })
  p.teamId = -2
  p.pot = clamp(ovr(p) + randInt(10, 32), 45, 99)
  p.salary = randInt(8, 14)
  p.years = 3
  return p
}
