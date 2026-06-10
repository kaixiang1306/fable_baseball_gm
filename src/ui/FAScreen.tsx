import { useState } from 'react'
import { useStore } from '../store'
import { ovr } from '../engine/playerGen'
import { faAsk } from '../engine/offseason'
import { teamPayroll } from '../engine/league'
import { fmtMoney } from '../engine/util'
import { OvrBadge } from './bits'

export default function FAScreen() {
  const league = useStore(s => s.league)!
  const userSignFA = useStore(s => s.userSignFA)
  const userFinishFA = useStore(s => s.userFinishFA)
  const [filter, setFilter] = useState<'all' | 'bat' | 'pit'>('all')

  const setViewPlayer = useStore(s => s.setViewPlayer)
  const team = league.teams[league.userTeam]
  const payroll = teamPayroll(league, league.userTeam)
  const pool = league.faPool
    .map(id => league.players[id])
    .filter(Boolean)
    .filter(p => filter === 'all' ? true : filter === 'bat' ? !p.isP : p.isP)
    .sort((a, b) => ovr(b) - ovr(a))

  return (
    <div className="content" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="big-title">{league.year} 休賽季 — 自由球員市場</div>
      <div className="muted" style={{ marginBottom: 14 }}>
        合約到期的球員進入自由市場。簽下你需要的戰力——薪資總額不可超過預算 {fmtMoney(team.budget)}（目前 {fmtMoney(payroll)}）。
        完成後 AI 球隊將進行補強，接著進入新人選秀。
      </div>
      <div className="roster-tabs">
        <button className={filter === 'all' ? 'primary' : ''} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'bat' ? 'primary' : ''} onClick={() => setFilter('bat')}>野手</button>
        <button className={filter === 'pit' ? 'primary' : ''} onClick={() => setFilter('pit')}>投手</button>
        <button className="primary" style={{ marginLeft: 'auto' }} onClick={userFinishFA}>完成簽約，進入選秀 ▶</button>
      </div>
      <div className="panel">
        <div className="panel-head">自由球員（{pool.length} 人）</div>
        <div className="panel-body" style={{ maxHeight: 520, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr><th>球員</th><th>位置</th><th className="num">年齡</th><th>OVR</th><th className="num">潛力</th><th className="num">要求月薪</th><th className="num">年限</th><th /></tr>
            </thead>
            <tbody>
              {pool.map(p => {
                const ask = faAsk(p)
                const afford = payroll + ask.salary * 12 <= team.budget
                return (
                  <tr key={p.id}>
                    <td><span className="pname-link" onClick={() => setViewPlayer(p.id)}>{p.name}{p.foreign ? <span className="foreign-tag">洋</span> : ''}</span></td>
                    <td>{p.pos}</td>
                    <td className="num">{p.age}</td>
                    <td><OvrBadge v={ovr(p)} /></td>
                    <td className="num">{p.pot}</td>
                    <td className="num">{ask.salary} 萬</td>
                    <td className="num">{ask.years} 年</td>
                    <td>
                      <button disabled={!afford} title={afford ? '' : '超出薪資預算'} onClick={() => userSignFA(p)} style={{ padding: '2px 12px' }}>
                        簽下
                      </button>
                    </td>
                  </tr>
                )
              })}
              {pool.length === 0 && <tr><td colSpan={8} className="muted">市場上已無球員。</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
