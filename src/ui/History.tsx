import { useStore } from '../store'

export default function History() {
  const league = useStore(s => s.league)!

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
      <div className="panel">
        <div className="panel-head">歷年大事紀</div>
        <div className="panel-body" style={{ maxHeight: 600, overflow: 'auto' }}>
          {league.history.length === 0 && <div className="muted">完成第一個賽季後，這裡會留下聯盟的歷史。</div>}
          {league.history.map(h => (
            <div className="year-card" key={h.year}>
              <div style={{ fontSize: 16 }}>
                <b className="gold">{h.year} 年</b>　🏆 總冠軍：<b>{h.champion}</b>
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>台灣大賽 {h.tsLine}</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{h.userLine}</div>
              <div style={{ fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 4 }}>
                {h.leaders.map(l => (
                  <span key={l.label}>
                    <span className="muted">{l.label}王</span> {l.name}（{l.team}）{l.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">名人堂</div>
        <div className="panel-body" style={{ maxHeight: 600, overflow: 'auto' }}>
          {league.hallOfFame.length === 0 && (
            <div className="muted">尚無球員入選。當偉大的球員高掛球鞋，他們的名字會永遠留在這裡。</div>
          )}
          {league.hallOfFame.map((h, i) => (
            <div className="hof-card" key={i}>
              <b style={{ fontSize: 15 }}>⭐ {h.name}</b>
              <span className="muted">　{h.pos}・{h.retiredYear} 年引退・效力 {h.seasons} 季・最後球隊 {h.lastTeam}</span>
              <div className="gold" style={{ fontSize: 13 }}>{h.line}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
