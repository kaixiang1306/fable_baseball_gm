import { useRef, useState } from 'react'
import { useStore } from '../store'
import { teamPower } from '../engine/league'
import { Logo } from './bits'

export default function Title() {
  const hasSave = useStore(s => s.hasSave)
  const setScreen = useStore(s => s.setScreen)
  const loadGame = useStore(s => s.loadGame)
  const deleteSave = useStore(s => s.deleteSave)
  const importSave = useStore(s => s.importSave)
  const importPending = useStore(s => s.importPending)
  const confirmImport = useStore(s => s.confirmImport)
  const cancelImport = useStore(s => s.cancelImport)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importErr, setImportErr] = useState<string | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setImportErr(await importSave(f))
  }

  return (
    <div className="title-screen">
      <div className="sub">傳奇經理</div>
      <h1>寶島職棒 GM</h1>
      <div className="muted" style={{ letterSpacing: 2 }}>BASEBALL GENERAL MANAGER · 賽季模擬經營</div>
      <div className="btns">
        <button className="primary" onClick={() => setScreen('select')}>開始新賽季</button>
        {hasSave && <button onClick={loadGame}>繼續遊戲</button>}
        <button onClick={() => fileRef.current?.click()}>匯入聯盟存檔</button>
        <input
          ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }}
        />
        {hasSave && (
          <button
            className="ghost"
            onClick={() => { if (confirm('確定要刪除目前的存檔嗎？此動作無法復原。')) deleteSave() }}
          >
            刪除存檔
          </button>
        )}
      </div>
      {importErr && <div className="verdict no" style={{ marginTop: 14 }}>{importErr}</div>}

      {importPending && (
        <div className="watch-overlay" onClick={cancelImport}>
          <div className="panel" style={{ width: 'min(520px, 92vw)' }} onClick={e => e.stopPropagation()}>
            <div className="panel-head">匯入聯盟 — {importPending.year} 年球季</div>
            <div className="panel-body">
              <p className="muted" style={{ marginBottom: 12, lineHeight: 1.8 }}>
                聯盟讀取成功！要執掌哪一支球隊？
                <br />（多人聯盟玩法：每位玩家輪流匯入同一份存檔、各自執掌一隊推進）
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {importPending.teams.map(t => {
                  const power = teamPower(importPending, t)
                  return (
                    <button
                      key={t.id}
                      className={t.id === importPending.userTeam ? 'primary' : ''}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}
                      onClick={() => confirmImport(t.id)}
                    >
                      <Logo team={t} size={26} />
                      <b>{t.name}</b>
                      <span className="muted">綜合 {power.ovr}</span>
                      {t.id === importPending.userTeam && <span className="gold">（原存檔執掌球隊）</span>}
                    </button>
                  )
                })}
              </div>
              <button className="ghost" style={{ marginTop: 12 }} onClick={cancelImport}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
