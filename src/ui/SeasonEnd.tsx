import { useStore } from '../store'
import { Logo } from './bits'

export default function SeasonEnd() {
  const league = useStore(s => s.league)!
  const goOffseason = useStore(s => s.goOffseason)
  const team = league.teams[league.userTeam]
  const result = league.evalResult
  const champ = league.champs.find(c => c.year === league.year)
  const isChamp = champ?.team === league.userTeam

  return (
    <div className="center-screen">
      <div className="panel eval-box">
        <div className="panel-head">{league.year} 賽季結束 — 老闆評鑑</div>
        <div className="panel-body">
          {champ && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 18 }}>
              <Logo team={league.teams[champ.team]} size={44} />
              <div>
                <div className="gold big-title" style={{ fontSize: 22 }}>🏆 {league.teams[champ.team].name} 奪得總冠軍！</div>
                {isChamp && <div className="green">恭喜！這是屬於你的賽季！</div>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Logo team={team} size={36} />
            <b style={{ fontSize: 17 }}>{team.name}</b>
            <span className="muted">老闆 {team.owner.name} 的年度檢討</span>
          </div>
          {result && <div className="eval-lines">{result.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
          <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
            <button className="primary" onClick={goOffseason}>
              {result?.fired ? '面對現實⋯⋯' : '進入休賽季（自由市場與選秀）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
