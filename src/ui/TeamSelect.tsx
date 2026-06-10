import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { createLeague, teamPayroll, teamPower } from '../engine/league'
import { OPS_COST } from '../engine/season'
import { PREF_LABELS } from '../data/teams'
import { fmtMoney } from '../engine/util'
import { Gauge, Logo, Stars } from './bits'

export default function TeamSelect() {
  const adoptLeague = useStore(s => s.adoptLeague)
  const setScreen = useStore(s => s.setScreen)
  const league = useMemo(() => createLeague(0), [])
  const [idx, setIdx] = useState(0)

  const team = league.teams[idx]
  const power = teamPower(league, team)
  const payroll = teamPayroll(league, team.id)

  return (
    <div className="select-screen">
      <div className="select-head">
        <span className="legend">傳奇經理</span>
        <span className="pick">選擇球隊</span>
        <span className="muted" style={{ marginLeft: 'auto' }}>{league.year} 年寶島職棒大聯盟</span>
      </div>

      <div className="team-switch">
        <button onClick={() => setIdx((idx + 5) % 6)}>◀</button>
        {league.teams.map((t, i) => (
          <span
            key={t.id}
            className={`dot logo-circ ${i === idx ? 'cur' : ''}`}
            style={{ background: `linear-gradient(135deg, ${t.c1}, ${t.c2})`, color: '#fff' }}
            onClick={() => setIdx(i)}
          >
            {t.short}
          </span>
        ))}
        <button onClick={() => setIdx((idx + 1) % 6)}>▶</button>
      </div>

      <div className="select-grid">
        <div className="team-card">
          <div className="team-banner" style={{ background: `linear-gradient(120deg, ${team.c1}33, ${team.c2}55)` }}>
            <Logo team={team} size={64} />
            <div>
              <div className="tcity">{team.city}</div>
              <div className="tname">{team.name}</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-body">
              <div className="gauges">
                <Gauge label="綜合" value={power.ovr} />
                <Gauge label="打擊" value={power.off} />
                <Gauge label="投手" value={power.pit} />
              </div>
              <div className="budget-rows">
                <div className="row"><span>總預算</span><b>{fmtMoney(team.budget + OPS_COST)}</b></div>
                <div className="row"><span>球員薪資預算</span><b>{fmtMoney(team.budget)}</b></div>
                <div className="row"><span>目前球員薪資</span><b>{fmtMoney(payroll)}</b></div>
                <div className="row"><span>球隊營運成本</span><b>{fmtMoney(OPS_COST)}</b></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          <div className="panel">
            <div className="panel-head">{team.name} 球隊老闆</div>
            <div className="panel-body">
              <div className="owner-name">
                <small>OWNER</small>
                {team.owner.name}
              </div>
              <p className="owner-desc" style={{ marginTop: 10 }}>{team.owner.desc}</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">擁有人偏好設定</div>
            <div className="panel-body">
              <div className="muted" style={{ marginBottom: 8 }}>老闆對不同項目的重視度——這將決定你的年度目標與被解雇的速度。</div>
              {PREF_LABELS.map(({ key, label }) => (
                <div className="pref-row" key={key}>
                  <span className="stars" style={{ width: 110, textAlign: 'right' }}><Stars n={team.owner.prefs[key]} /></span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="select-actions">
        <button onClick={() => setScreen('title')}>返回</button>
        <button className="primary" onClick={() => adoptLeague(league, team.id)}>
          執掌 {team.name}
        </button>
      </div>
    </div>
  )
}
