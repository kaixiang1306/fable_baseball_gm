import { useStore } from '../store'
import { teamPayroll } from '../engine/league'
import { OPS_COST, userProfit } from '../engine/season'
import { PREF_LABELS } from '../data/teams'
import { fmtMoney } from '../engine/util'
import { Stars } from './bits'

export default function Finance() {
  const league = useStore(s => s.league)!
  const team = league.teams[league.userTeam]
  const owner = team.owner
  const payroll = teamPayroll(league, team.id)
  const revenue = league.finance[team.id].revenue
  const profit = userProfit(league)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 1000 }}>
      <div className="panel">
        <div className="panel-head">球團財務</div>
        <div className="panel-body">
          <div className="budget-rows">
            <div className="row"><span>球員薪資預算（年）</span><b>{fmtMoney(team.budget)}</b></div>
            <div className="row"><span>目前球員薪資（年）</span><b style={{ color: payroll > team.budget ? 'var(--red2)' : undefined }}>{fmtMoney(payroll)}</b></div>
            <div className="row"><span>本季票房與周邊收入</span><b>{fmtMoney(revenue)}</b></div>
            <div className="row"><span>年度營運成本</span><b>{fmtMoney(OPS_COST)}</b></div>
            <div className="row"><span>目前預估損益</span><b style={{ color: profit < 0 ? 'var(--red2)' : 'var(--green)' }}>{fmtMoney(profit)}</b></div>
          </div>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
            收入隨勝率與球隊士氣成長。薪資超出預算將無法簽下自由球員，交易也會受限。
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">老闆 — {owner.name}</div>
        <div className="panel-body">
          <div style={{ marginBottom: 10 }}>
            信任度：<b className={owner.patienceLeft <= 1 ? 'red' : 'gold'}>{owner.patienceLeft}</b> / {owner.prefs.patience}
            {owner.patienceLeft <= 1 && <span className="red">（再失敗就會被解雇！）</span>}
          </div>
          <h3 className="sec">本季目標</h3>
          {owner.goals.map(g => <div key={g} style={{ padding: '4px 0' }}>◆ {g.split('|')[1]}</div>)}
          <h3 className="sec">偏好</h3>
          {PREF_LABELS.map(({ key, label }) => (
            <div className="pref-row" key={key}>
              <span className="stars" style={{ width: 100, textAlign: 'right' }}><Stars n={owner.prefs[key]} /></span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
