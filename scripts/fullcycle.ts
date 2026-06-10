// 多賽季完整循環測試：賽季 → 台灣大賽 → 評鑑 → 自由市場 → 選秀 → 新賽季
import { createLeague } from '../src/engine/league'
import { playDay, standings } from '../src/engine/season'
import { startOffseason, finishFA, runAIDraftPicks, draftPickPlayer } from '../src/engine/offseason'
import { ovr } from '../src/engine/playerGen'

const L = createLeague(5) // 執掌台鈦雄鷹（老闆耐心 5）

for (let season = 0; season < 5; season++) {
  let guard = 0
  while ((L.phase === 'season' || L.phase === 'ts') && guard++ < 400) playDay(L, false)
  if (L.phase !== 'eval') throw new Error(`賽季未正常結束: phase=${L.phase}`)

  const overall = standings(L, 0)
  const me = overall.find(r => r.team.id === L.userTeam)!
  console.log(`${L.year}: ${me.team.name} ${me.w}勝${me.l}敗${me.t}和 (第${overall.indexOf(me) + 1}名)  冠軍=${L.teams[L.champs.find(c => c.year === L.year)!.team].name}  評鑑=${L.evalResult?.passed ? '過關' : '未達標'} 信任=${L.teams[L.userTeam].owner.patienceLeft}`)

  if (L.evalResult?.fired) { console.log('>>> 被解雇，遊戲結束'); break }

  startOffseason(L)
  if ((L.phase as string) !== 'fa') throw new Error('未進入 FA')
  console.log(`  FA 市場 ${L.faPool.length} 人、選秀名單 ${L.draftPool.length} 人`)
  finishFA(L)
  if ((L.phase as string) !== 'draft') throw new Error('未進入選秀')
  runAIDraftPicks(L)
  // 模擬使用者選秀：每次輪到就選最佳
  let dguard = 0
  while ((L.phase as string) === 'draft' && dguard++ < 30) {
    const best = L.draftPool.map(id => L.players[id]).sort((a, b) => (ovr(b) + b.pot) - (ovr(a) + a.pot))[0]
    if (!best) break
    draftPickPlayer(L, best)
    runAIDraftPicks(L)
  }
  if ((L.phase as string) !== 'season') throw new Error(`選秀後未開新季: phase=${L.phase}`)

  // 驗證每隊陣容完整性
  for (const t of L.teams) {
    if (t.lineup.length !== 9) throw new Error(`${t.name} 打線只有 ${t.lineup.length} 人`)
    if (t.rotation.length < 5) throw new Error(`${t.name} 輪值只有 ${t.rotation.length} 人`)
    const mains = Object.values(L.players).filter(p => p.teamId === t.id && p.onMain).length
    if (mains > 26) throw new Error(`${t.name} 一軍 ${mains} 人超編`)
    for (const id of [...t.lineup, ...t.rotation, ...t.bullpen]) {
      if (!L.players[id]) throw new Error(`${t.name} 名單中有幽靈球員 ${id}`)
    }
  }
}
const total = Object.keys(L.players).length
console.log(`\n✅ 5 個賽季循環完成，聯盟現有球員 ${total} 人，存檔大小 ${(JSON.stringify(L).length / 1024).toFixed(0)} KB`)
