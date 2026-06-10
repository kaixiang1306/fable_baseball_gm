import { useStore } from '../store'

export default function Title() {
  const hasSave = useStore(s => s.hasSave)
  const setScreen = useStore(s => s.setScreen)
  const loadGame = useStore(s => s.loadGame)
  const deleteSave = useStore(s => s.deleteSave)

  return (
    <div className="title-screen">
      <div className="sub">傳奇經理</div>
      <h1>寶島職棒 GM</h1>
      <div className="muted" style={{ letterSpacing: 2 }}>BASEBALL GENERAL MANAGER · 賽季模擬經營</div>
      <div className="btns">
        <button className="primary" onClick={() => setScreen('select')}>開始新賽季</button>
        {hasSave && <button onClick={loadGame}>繼續遊戲</button>}
        {hasSave && (
          <button
            className="ghost"
            onClick={() => { if (confirm('確定要刪除目前的存檔嗎？此動作無法復原。')) deleteSave() }}
          >
            刪除存檔
          </button>
        )}
      </div>
    </div>
  )
}
