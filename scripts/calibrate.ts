import { createLeague } from '../src/engine/league'
import { playDay, standings } from '../src/engine/season'
import { ovr } from '../src/engine/playerGen'

const L = createLeague(0)

let guard = 0
while ((L.phase === 'season' || L.phase === 'ts' || L.phase === 'allstar') && guard++ < 400) {
  playDay(L, false)
}

const players = Object.values(L.players)
const bat = players.filter(p => !p.isP)
const sum = (f: (p: typeof players[0]) => number) => players.reduce((s, p) => s + f(p), 0)

const ab = sum(p => p.bat.ab), h = sum(p => p.bat.h), hr = sum(p => p.bat.hr)
const bb = sum(p => p.bat.bb), so = sum(p => p.bat.so), pa = sum(p => p.bat.pa)
const sb = sum(p => p.bat.sb)
const outs = sum(p => p.pit.outs), er = sum(p => p.pit.er), r = sum(p => p.bat.r)
const games = L.schedule.filter(g => g.played).length

console.log('=== 聯盟整體數據 ===')
console.log(`比賽場數: ${games}`)
console.log(`打擊率 AVG: ${(h / ab).toFixed(3)}`)
console.log(`每隊每場得分 R/G: ${(r / games / 2).toFixed(2)}`)
console.log(`全壘打/場(兩隊): ${(hr / games).toFixed(2)}`)
console.log(`三振率 K%: ${(so / pa * 100).toFixed(1)}%  保送率 BB%: ${(bb / pa * 100).toFixed(1)}%`)
console.log(`防禦率 ERA: ${(er * 27 / outs).toFixed(2)}`)
console.log(`盜壘/隊/季: ${(sb / 6).toFixed(0)}`)

console.log('\n=== 全年戰績 ===')
for (const row of standings(L, 0)) {
  console.log(`${row.team.name}  ${row.w}勝${row.l}敗${row.t}和  勝率 ${row.pct.toFixed(3)}`)
}

console.log('\n=== 打擊率前五（規定打席）===')
const qual = bat.filter(p => p.bat.pa >= 120 * 2.5)
qual.sort((a, b) => b.bat.h / b.bat.ab - a.bat.h / a.bat.ab)
for (const p of qual.slice(0, 5)) {
  console.log(`${p.name} (${L.teams[p.teamId]?.name}) AVG ${(p.bat.h / p.bat.ab).toFixed(3)} HR ${p.bat.hr} RBI ${p.bat.rbi} OVR ${ovr(p)}`)
}
console.log('\n=== 全壘打前五 ===')
bat.sort((a, b) => b.bat.hr - a.bat.hr)
for (const p of bat.slice(0, 5)) console.log(`${p.name} HR ${p.bat.hr} AVG ${(p.bat.h / Math.max(1, p.bat.ab)).toFixed(3)}`)

console.log('\n=== ERA 前五（規定局數）===')
const pit = players.filter(p => p.isP && p.pit.outs >= 120 * 1.5)
pit.sort((a, b) => a.pit.er / a.pit.outs - b.pit.er / b.pit.outs)
for (const p of pit.slice(0, 5)) {
  console.log(`${p.name}${p.foreign ? '(洋)' : ''} ERA ${(p.pit.er * 27 / p.pit.outs).toFixed(2)} ${p.pit.w}勝${p.pit.l}敗 K ${p.pit.so} IP ${Math.floor(p.pit.outs / 3)}`)
}
console.log('\n=== 勝投前三 ===')
const pitAll = players.filter(p => p.isP).sort((a, b) => b.pit.w - a.pit.w)
for (const p of pitAll.slice(0, 3)) console.log(`${p.name} ${p.pit.w}勝${p.pit.l}敗 SV ${p.pit.sv}`)
const sv = players.filter(p => p.isP).sort((a, b) => b.pit.sv - a.pit.sv)
console.log('\n=== 救援前三 ===')
for (const p of sv.slice(0, 3)) console.log(`${p.name} SV ${p.pit.sv}`)
console.log(`\n台灣大賽: ${L.ts ? `${L.teams[L.ts.a].name} ${L.ts.wa}-${L.ts.wb} ${L.teams[L.ts.b].name}` : '無'}`)
console.log(`冠軍: ${L.champs.map(c => L.teams[c.team].name).join(', ')}`)
