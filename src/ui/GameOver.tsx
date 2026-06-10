import { useStore } from '../store'

export default function GameOver() {
  const league = useStore(s => s.league)!
  const setScreen = useStore(s => s.setScreen)
  const deleteSave = useStore(s => s.deleteSave)
  const team = league.teams[league.userTeam]
  const myChamps = league.champs.filter(c => c.team === league.userTeam).length

  return (
    <div className="title-screen">
      <div className="sub red">GAME OVER</div>
      <h1 style={{ fontSize: 40 }}>你被解雇了</h1>
      <p className="muted" style={{ maxWidth: 520, textAlign: 'center', lineHeight: 2 }}>
        {team.owner.name} 在記者會上宣布：「感謝你為 {team.name} 的付出，但球隊需要新的方向。」
        <br />
        你執掌期間：{league.year - 2026 + 1} 個賽季，{myChamps} 座總冠軍。
      </p>
      <div className="btns">
        <button className="primary" onClick={() => { deleteSave(); setScreen('select') }}>接受新的挑戰（重新開始）</button>
        <button onClick={() => setScreen('title')}>回到主選單</button>
      </div>
    </div>
  )
}
