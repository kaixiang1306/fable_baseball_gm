// 多賽季完整循環測試：賽季 → 明星賽 → 台灣大賽 → 評鑑 → 自由市場 → 選秀 → 新賽季
import { createLeague } from '../src/engine/league'
import { advanceDay, standings } from '../src/engine/season'
import { startOffseason, finishFA, runAIDraftPicks, draftPickPlayer } from '../src/engine/offseason'
import { offerExtension, extensionAsk } from '../src/engine/contracts'
import { ovr } from '../src/engine/playerGen'

const L = createLeague(2) // 執掌新竹風獅（老闆耐心 5）

for (let season = 0; season < 6; season++) {
  let guard = 0
  let sawAllStar = false
  while ((L.phase === 'season' || L.phase === 'ts' || L.phase === 'allstar') && guard++ < 400) {
    if (L.phase === 'allstar') sawAllStar = true
    // 季中試一次續約談判
    if (L.day === 30 && L.phase === 'season') {
      const target = Object.values(L.players).find(p => p.teamId === L.userTeam && p.years === 1 && ovr(p) >= 55)
      if (target) {
        const ask = extensionAsk(target)
        const r = offerExtension(L, target, ask.salary + 2, Math.min(2, ask.maxYears))
        console.log(`  [續約] ${target.name}: ${r.ok ? '成功' : '失敗'} — ${r.msg.slice(0, 30)}`)
      }
    }
    advanceDay(L)
  }
  if (L.phase !== 'eval') throw new Error(`賽季未正常結束: phase=${L.phase}`)
  if (!sawAllStar) throw new Error('未觸發明星賽')
  if (!L.allStar?.played) throw new Error('明星賽未進行')

  const overall = standings(L, 0)
  const me = overall.find(r => r.team.id === L.userTeam)!
  const injured = Object.values(L.players).filter(p => p.injuryDays > 0).length
  const farmGames = L.teams[0].farmRec.w + L.teams[0].farmRec.l + L.teams[0].farmRec.t
  console.log(`${L.year}: ${me.team.name} ${me.w}勝${me.l}敗${me.t}和 (第${overall.indexOf(me) + 1}名) 冠軍=${L.teams[L.champs.find(c => c.year === L.year)!.team].name} 評鑑=${L.evalResult?.passed ? '過' : '未達標'} 信任=${L.teams[L.userTeam].owner.patienceLeft} 傷兵=${injured} 二軍場次=${farmGames} 明星賽=北${L.allStar.ns}:南${L.allStar.ss}`)

  if (L.evalResult?.fired) { console.log('>>> 被解雇，遊戲結束'); break }

  startOffseason(L)
  finishFA(L)
  runAIDraftPicks(L)
  let dguard = 0
  while ((L.phase as string) === 'draft' && dguard++ < 30) {
    const best = L.draftPool.map(id => L.players[id]).sort((a, b) => (ovr(b) + b.pot) - (ovr(a) + a.pot))[0]
    if (!best) break
    draftPickPlayer(L, best)
    runAIDraftPicks(L)
  }
  if ((L.phase as string) !== 'season') throw new Error(`選秀後未開新季: phase=${L.phase}`)

  // 陣容完整性
  for (const t of L.teams) {
    if (t.lineup.length !== 9) throw new Error(`${t.name} 打線只有 ${t.lineup.length} 人`)
    if (t.rotation.length < 5) throw new Error(`${t.name} 輪值只有 ${t.rotation.length} 人`)
    const mains = Object.values(L.players).filter(p => p.teamId === t.id && p.onMain).length
    if (mains > 26) throw new Error(`${t.name} 一軍 ${mains} 人超編`)
    for (const id of [...t.lineup, ...t.rotation, ...t.bullpen]) {
      if (!L.players[id]) throw new Error(`${t.name} 名單中有幽靈球員 ${id}`)
    }
    const batters = Object.values(L.players).filter(p => p.teamId === t.id && !p.isP).length
    const pitchers = Object.values(L.players).filter(p => p.teamId === t.id && p.isP).length
    if (batters < 18 || pitchers < 14) throw new Error(`${t.name} 名單太薄: 野手${batters} 投手${pitchers}`)
  }
}

console.log(`\n歷史紀錄 ${L.history.length} 年、名人堂 ${L.hallOfFame.length} 人`)
for (const h of L.hallOfFame.slice(0, 5)) console.log(`  ⭐ ${h.name} ${h.pos} ${h.retiredYear} ${h.line}`)
const total = Object.keys(L.players).length
const careerTop = Object.values(L.players).map(p => ({ p, h: p.career.bat.h })).sort((a, b) => b.h - a.h)[0]
console.log(`聯盟現有球員 ${total} 人、生涯安打最多 ${careerTop.p.name} ${careerTop.h} 支、存檔大小 ${(JSON.stringify(L).length / 1024).toFixed(0)} KB`)
console.log('✅ 全循環測試通過')
