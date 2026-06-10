import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

export default function WatchGame() {
  const watch = useStore(s => s.watch)!
  const closeWatch = useStore(s => s.closeWatch)
  const [shown, setShown] = useState(1)
  const [speed, setSpeed] = useState(900)
  const [paused, setPaused] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const events = watch.events
  const done = shown >= events.length

  useEffect(() => {
    if (paused || done) return
    const t = setTimeout(() => setShown(s => Math.min(events.length, s + 1)), speed)
    return () => clearTimeout(t)
  }, [shown, paused, speed, done, events.length])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [shown])

  const cur = events[Math.min(shown, events.length) - 1]

  return (
    <div className="watch-overlay">
      <div className="watch-box">
        <div className="scorebug">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>{watch.awayName}（客）</div>
            <div className="sc">{cur.as}</div>
          </div>
          <div style={{ fontSize: 22, color: 'var(--txt-dim)' }}>:</div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>{watch.homeName}（主）</div>
            <div className="sc">{cur.hs}</div>
          </div>
          <div className="diamond" title="壘上情況">
            <span className={`b2 ${cur.bases[1] ? 'on' : ''}`} />
            <span className={`b1 ${cur.bases[0] ? 'on' : ''}`} />
            <span className={`b3 ${cur.bases[2] ? 'on' : ''}`} />
          </div>
          <div className="inn">
            <div style={{ fontSize: 20, fontWeight: 900 }}>{cur.inn} 局{cur.top ? '上' : '下'}</div>
            <div className="outs-dots">
              {[0, 1, 2].map(i => <i key={i} className={i < Math.min(cur.outs, 3) ? 'on' : ''} />)}
            </div>
          </div>
        </div>

        <div className="pb-log" ref={logRef}>
          {events.slice(0, shown).map((e, i) => (
            <div key={i} className={`pb-line ${e.big ? 'big' : ''}`}>
              <span className="inn-tag">{e.inn}{e.top ? '上' : '下'}</span>
              {e.text}
            </div>
          ))}
        </div>

        <div className="watch-ctrl">
          <button onClick={() => setPaused(p => !p)} disabled={done}>{paused ? '▶ 繼續' : '⏸ 暫停'}</button>
          <button onClick={() => setSpeed(s => (s === 900 ? 380 : s === 380 ? 120 : 900))} disabled={done}>
            轉播速度：{speed === 900 ? '正常' : speed === 380 ? '快' : '極快'}
          </button>
          <button onClick={() => setShown(events.length)} disabled={done}>跳到結果</button>
          <button className="primary" style={{ marginLeft: 'auto' }} onClick={closeWatch} disabled={!done}>
            {done ? '結束轉播' : '比賽進行中…'}
          </button>
        </div>
      </div>
    </div>
  )
}
