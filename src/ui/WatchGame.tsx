import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ovr } from '../engine/playerGen'

export default function WatchGame() {
  const watch = useStore(s => s.watch)!
  const finishWatch = useStore(s => s.finishWatch)
  const lg = watch.lg
  const [, force] = useState(0)
  const [speed, setSpeed] = useState(800)
  const [paused, setPaused] = useState(false)
  const [showBench, setShowBench] = useState(false)
  const [showPen, setShowPen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const rerender = () => force(x => x + 1)

  useEffect(() => {
    if (paused || lg.done) return
    const t = setTimeout(() => { lg.step(); rerender() }, speed)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, speed, lg.done, lg.events.length])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [lg.events.length])

  const last = lg.events[lg.events.length - 1]
  const hs = lg.done || !last ? lg.hs : last.hs
  const as = lg.done || !last ? lg.as : last.as

  const userOff = !lg.done && lg.isUserOffense()
  const userDef = !lg.done && lg.isUserDefense()
  const next = lg.done ? null : lg.nextBatter()
  const bench = userOff && showBench ? lg.benchFor() : []
  const pen = userDef && showPen ? lg.availableRelievers() : []
  const pInfo = lg.done ? null : lg.pitcherInfo()

  const skipToEnd = () => {
    let guard = 0
    while (!lg.done && guard++ < 2000) lg.step()
    rerender()
  }

  return (
    <div className="watch-overlay">
      <div className="watch-box">
        <div className="scorebug">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>{watch.awayName}（客）</div>
            <div className="sc">{as}</div>
          </div>
          <div style={{ fontSize: 22, color: 'var(--txt-dim)' }}>:</div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>{watch.homeName}（主）</div>
            <div className="sc">{hs}</div>
          </div>
          <div className="diamond" title="壘上情況">
            <span className={`b2 ${lg.bases[1] ? 'on' : ''}`} />
            <span className={`b1 ${lg.bases[0] ? 'on' : ''}`} />
            <span className={`b3 ${lg.bases[2] ? 'on' : ''}`} />
          </div>
          <div className="inn">
            <div style={{ fontSize: 20, fontWeight: 900 }}>{lg.inn} 局{lg.top ? '上' : '下'}</div>
            <div className="outs-dots">
              {[0, 1, 2].map(i => <i key={i} className={i < Math.min(lg.outs, 3) ? 'on' : ''} />)}
            </div>
          </div>
        </div>

        {!lg.done && next && (
          <div className="tactics-bar">
            <span className="muted">下一棒：</span>
            <b>{next.name}</b>
            <span className="muted">({ovr(next)})</span>
            {pInfo && (
              <span className="muted" style={{ marginLeft: 6 }}>
                投手 {pInfo.name}
                <b style={{ color: pInfo.tired ? 'var(--red2)' : 'var(--txt)', marginLeft: 4 }}>{pInfo.pitches} 球</b>
                {pInfo.tired && <span className="red">（已疲勞）</span>}
              </span>
            )}
            {(userOff || userDef) && <span className="gold" style={{ marginLeft: 6 }}>⚾ 臨場指揮</span>}
            {userOff && (
              <>
                <button
                  className={lg.pendingBunt ? 'primary' : ''}
                  disabled={!lg.canBunt() && !lg.pendingBunt}
                  onClick={() => { lg.pendingBunt = !lg.pendingBunt; rerender() }}
                  title="有跑者且兩出局前可下達"
                >
                  {lg.pendingBunt ? '✓ 觸擊' : '觸擊'}
                </button>
                <button onClick={() => setShowBench(b => !b)}>代打…</button>
              </>
            )}
            {userDef && (
              <>
                <button
                  className={lg.pendingIBB ? 'primary' : ''}
                  disabled={!lg.canIBB() && !lg.pendingIBB}
                  onClick={() => { lg.pendingIBB = !lg.pendingIBB; rerender() }}
                  title="一壘無人且得點圈有人時可下達"
                >
                  {lg.pendingIBB ? '✓ 敬遠' : '敬遠'}
                </button>
                <button onClick={() => setShowPen(s => !s)}>換投…</button>
              </>
            )}
          </div>
        )}

        {showBench && userOff && (
          <div className="bench-pop">
            {bench.length === 0 && <span className="muted">板凳已無可用野手。</span>}
            {bench.map(p => (
              <button key={p.id} onClick={() => { lg.pinchHit(p); setShowBench(false); rerender() }}>
                {p.name} {p.pos}/{ovr(p)}
              </button>
            ))}
            <button className="ghost" onClick={() => setShowBench(false)}>取消</button>
          </div>
        )}

        {showPen && userDef && (
          <div className="bench-pop">
            {pen.length === 0 && <span className="muted">牛棚已無可用投手。</span>}
            {pen.map(p => (
              <button key={p.id} onClick={() => { lg.manualChangePitcher(p); setShowPen(false); rerender() }}>
                {p.name} {p.pos}/{ovr(p)}（球威{p.stuff}/控球{p.ctrl}）
              </button>
            ))}
            <button className="ghost" onClick={() => setShowPen(false)}>取消</button>
          </div>
        )}

        <div className="pb-log" ref={logRef}>
          {lg.events.map((e, i) => (
            <div key={i} className={`pb-line ${e.big ? 'big' : ''}`}>
              <span className="inn-tag">{e.inn}{e.top ? '上' : '下'}</span>
              {e.text}
            </div>
          ))}
          {lg.events.length === 0 && <div className="muted">比賽即將開始⋯⋯</div>}
        </div>

        <div className="watch-ctrl">
          <button onClick={() => setPaused(p => !p)} disabled={lg.done}>{paused ? '▶ 繼續' : '⏸ 暫停'}</button>
          <button onClick={() => setSpeed(s => (s === 800 ? 350 : s === 350 ? 110 : 800))} disabled={lg.done}>
            轉播速度：{speed === 800 ? '正常' : speed === 350 ? '快' : '極快'}
          </button>
          <button onClick={skipToEnd} disabled={lg.done}>跳到結果</button>
          <button className="primary" style={{ marginLeft: 'auto' }} onClick={finishWatch} disabled={!lg.done}>
            {lg.done ? '結束轉播' : '比賽進行中…'}
          </button>
        </div>
      </div>
    </div>
  )
}
