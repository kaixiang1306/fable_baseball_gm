import { useStore } from '../store'
import { dayToDate, TOTAL_DAYS } from '../engine/season'
import { Logo } from './bits'

export default function Calendar() {
  const league = useStore(s => s.league)!
  const simDays = useStore(s => s.simDays)
  const simToHalfEnd = useStore(s => s.simToHalfEnd)
  const watchToday = useStore(s => s.watchToday)

  const user = league.userTeam
  const inTS = league.phase === 'ts'
  const inAS = league.phase === 'allstar'

  // 顯示視窗：目前天的前 7 天～後 20 天
  const from = Math.max(1, league.day - 7)
  const to = Math.min(TOTAL_DAYS, from + 27)
  const cells = []
  for (let d = from; d <= to; d++) {
    const g = league.schedule.find(g => g.day === d && g.half !== 0 && (g.home === user || g.away === user))
    const date = dayToDate(league.year, d)
    let body = null
    if (g) {
      const oppId = g.home === user ? g.away : g.home
      const opp = league.teams[oppId]
      const home = g.home === user
      let res: 'W' | 'L' | 'T' | null = null
      if (g.played) {
        const us = home ? g.hs : g.as, them = home ? g.as : g.hs
        res = us > them ? 'W' : us < them ? 'L' : 'T'
      }
      body = (
        <>
          <div className="opp">
            <Logo team={opp} size={22} />
            <span>{home ? 'vs' : '@'} {opp.short}</span>
          </div>
          {g.played
            ? <div className={`res ${res}`}>{res === 'W' ? '勝' : res === 'L' ? '敗' : '和'} {home ? `${g.hs}:${g.as}` : `${g.as}:${g.hs}`}</div>
            : <div className="ha">{home ? '主場' : '客場'}</div>}
        </>
      )
    }
    cells.push(
      <div key={d} className={`cal-cell ${d === league.day && !inTS ? 'today' : ''} ${g ? '' : 'off'}`}>
        <div className="d">{date.label}{d === league.day && !inTS ? ' ・今天' : ''}</div>
        {body ?? <div className="ha" style={{ marginTop: 8 }}>休兵日</div>}
      </div>,
    )
  }

  const canPlay = league.phase === 'season' || league.phase === 'ts' || inAS
  const userInTS = inTS && league.ts && (league.ts.a === user || league.ts.b === user)
  const allStarNames = (ids: number[]) =>
    ids.map(id => league.players[id]).filter(Boolean).map(p => p.name).join('、')

  return (
    <div className="cal-layout">
      <div>
        {inAS && league.allStar && (
          <div className="allstar-banner">
            <div className="big-title" style={{ fontSize: 24 }}>⭐ 明星賽週末 — 北軍 vs 南軍</div>
            <div className="muted" style={{ margin: '6px 0 10px', lineHeight: 1.8 }}>
              北軍先發：{allStarNames(league.allStar.nLineup)}<br />
              南軍先發：{allStarNames(league.allStar.sLineup)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary" onClick={watchToday}>觀看明星賽</button>
              <button onClick={() => simDays(1)}>快速進行</button>
            </div>
          </div>
        )}
        {inTS && league.ts && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">台灣大賽</div>
            <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 18 }}>
              <Logo team={league.teams[league.ts.a]} size={40} />
              <b>{league.teams[league.ts.a].name}</b>
              <span className="sc" style={{ fontSize: 28, fontWeight: 900 }}>{league.ts.wa} - {league.ts.wb}</span>
              <b>{league.teams[league.ts.b].name}</b>
              <Logo team={league.teams[league.ts.b]} size={40} />
              <span className="muted" style={{ fontSize: 13 }}>{league.ts.note}・七戰四勝</span>
            </div>
          </div>
        )}

        {!inAS && (
          <div className="sim-actions">
            <button className="primary" onClick={watchToday} disabled={!canPlay || (inTS && !userInTS)}>
              觀看今日比賽
            </button>
            <button onClick={() => simDays(1)} disabled={!canPlay}>模擬 1 天</button>
            <button onClick={() => simDays(7)} disabled={!canPlay || inTS}>模擬 1 週</button>
            <button onClick={simToHalfEnd} disabled={league.phase !== 'season'}>
              模擬至{league.day <= league.daysPerHalf ? '上' : '下'}半季結束
            </button>
            {inTS && <button onClick={() => simDays(1)}>模擬下一戰</button>}
          </div>
        )}

        {!inTS && !inAS && <div className="cal-grid">{cells}</div>}
      </div>

      <div className="panel">
        <div className="panel-head">聯盟動態</div>
        <div className="panel-body news-feed">
          {league.news.slice(0, 60).map((n, i) => (
            <div key={i} className={`news-item ${n.kind}`}>
              <span className="nd">{n.year} 第{n.day}天</span>
              {n.text}
            </div>
          ))}
          {league.news.length === 0 && <div className="muted">目前沒有新聞。</div>}
        </div>
      </div>
    </div>
  )
}
