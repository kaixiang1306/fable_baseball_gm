import { useState } from 'react'
import { useStore } from '../store'
import type { Player } from '../types'
import { ovr } from '../engine/playerGen'
import { canTrade, tradeValue } from '../engine/trade'
import { TRADE_DEADLINE_DAY } from '../engine/league'
import { OvrBadge } from './bits'

function PlayerRow({ p, picked, onToggle }: { p: Player; picked: boolean; onToggle: () => void }) {
  return (
    <tr className={picked ? 'hl' : ''} onClick={onToggle} style={{ cursor: 'pointer' }}>
      <td><input type="checkbox" checked={picked} readOnly /></td>
      <td>{p.name}{p.foreign ? <span className="foreign-tag">洋</span> : ''}</td>
      <td>{p.pos}</td>
      <td className="num">{p.age}</td>
      <td><OvrBadge v={ovr(p)} /></td>
      <td className="num">{p.pot}</td>
      <td className="num">{p.salary} 萬</td>
      <td className="num">{Math.round(tradeValue(p))}</td>
    </tr>
  )
}

export default function Trade() {
  const league = useStore(s => s.league)!
  const proposeTrade = useStore(s => s.proposeTrade)
  const [other, setOther] = useState(league.teams.find(t => t.id !== league.userTeam)!.id)
  const [give, setGive] = useState<number[]>([])
  const [get_, setGet] = useState<number[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const open = canTrade(league)
  const mine = Object.values(league.players).filter(p => p.teamId === league.userTeam).sort((a, b) => ovr(b) - ovr(a))
  const theirs = Object.values(league.players).filter(p => p.teamId === other).sort((a, b) => ovr(b) - ovr(a))

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) => {
    setMsg(null)
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const submit = () => {
    const verdict = proposeTrade(other, give.map(id => league.players[id]), get_.map(id => league.players[id]))
    setMsg({ ok: verdict.accept, text: verdict.reason })
    if (verdict.accept) { setGive([]); setGet([]) }
  }

  const head = (
    <thead>
      <tr><th /><th>球員</th><th>位置</th><th className="num">年齡</th><th>OVR</th><th className="num">潛力</th><th className="num">月薪</th><th className="num">價值</th></tr>
    </thead>
  )

  return (
    <div>
      {!open && (
        <div className="verdict no" style={{ marginBottom: 14 }}>
          交易窗口目前關閉（每年開季至第 {TRADE_DEADLINE_DAY} 天為交易期限）。
        </div>
      )}
      <div className="roster-tabs">
        <span style={{ alignSelf: 'center' }}>交易對象：</span>
        <select value={other} onChange={e => { setOther(Number(e.target.value)); setGet([]); setMsg(null) }}>
          {league.teams.filter(t => t.id !== league.userTeam).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="trade-grid">
        <div className="panel">
          <div className="panel-head">我方送出 — {league.teams[league.userTeam].name}</div>
          <div className="panel-body trade-list">
            <table className="data">
              {head}
              <tbody>
                {mine.map(p => <PlayerRow key={p.id} p={p} picked={give.includes(p.id)} onToggle={() => toggle(give, setGive, p.id)} />)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">我方取得 — {league.teams[other].name}</div>
          <div className="panel-body trade-list">
            <table className="data">
              {head}
              <tbody>
                {theirs.map(p => <PlayerRow key={p.id} p={p} picked={get_.includes(p.id)} onToggle={() => toggle(get_, setGet, p.id)} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="trade-summary">
        送出：{give.length ? give.map(id => league.players[id].name).join('、') : '—'}（總價值 {Math.round(give.reduce((s, id) => s + tradeValue(league.players[id]), 0))}）
        <br />
        取得：{get_.length ? get_.map(id => league.players[id].name).join('、') : '—'}（總價值 {Math.round(get_.reduce((s, id) => s + tradeValue(league.players[id]), 0))}）
        <div style={{ marginTop: 10 }}>
          <button className="primary" disabled={!open || give.length === 0 || get_.length === 0} onClick={submit}>
            提出交易
          </button>
        </div>
        {msg && <div className={`verdict ${msg.ok ? 'ok' : 'no'}`}>{msg.text}</div>}
      </div>
    </div>
  )
}
