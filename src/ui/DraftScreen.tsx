import { useStore } from '../store'
import { ovr } from '../engine/playerGen'
import { DRAFT_ROUNDS } from '../engine/offseason'
import { OvrBadge } from './bits'

export default function DraftScreen() {
  const league = useStore(s => s.league)!
  const userDraftPick = useStore(s => s.userDraftPick)
  const setViewPlayer = useStore(s => s.setViewPlayer)

  const pickNo = league.draftPick
  const total = league.draftOrder.length
  const round = Math.floor(pickNo / 6) + 1
  const onClock = league.draftOrder[pickNo]
  const isUser = onClock === league.userTeam
  const pool = league.draftPool.map(id => league.players[id]).filter(Boolean)
    .sort((a, b) => (ovr(b) + b.pot) - (ovr(a) + a.pot))

  return (
    <div className="content" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="big-title">{league.year} 新人選秀會</div>
      <div className="muted" style={{ marginBottom: 14 }}>
        共 {DRAFT_ROUNDS} 輪，依全年戰績反序選秀。輪到你時，從名單中挑選最看好的新秀。
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-body" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span>第 <b className="gold">{round}</b> 輪・第 <b className="gold">{pickNo % 6 + 1}</b> 順位（總第 {pickNo + 1}/{total} 籤）</span>
          {isUser
            ? <b className="green">輪到你選擇了！</b>
            : <span className="muted">輪到 {league.teams[onClock]?.name}</span>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">選秀名單（{pool.length} 人）</div>
        <div className="panel-body" style={{ maxHeight: 520, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr><th>球員</th><th>類型</th><th>位置</th><th className="num">年齡</th><th>OVR</th><th className="num">潛力</th><th /></tr>
            </thead>
            <tbody>
              {pool.map(p => (
                <tr key={p.id}>
                  <td><span className="pname-link" onClick={() => setViewPlayer(p.id)}>{p.name}</span></td>
                  <td>{p.isP ? '投手' : '野手'}</td>
                  <td>{p.pos}</td>
                  <td className="num">{p.age}</td>
                  <td><OvrBadge v={ovr(p)} /></td>
                  <td className="num"><b className="gold">{p.pot}</b></td>
                  <td>
                    <button className="primary" style={{ padding: '2px 14px' }} disabled={!isUser} onClick={() => userDraftPick(p)}>
                      指名
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
