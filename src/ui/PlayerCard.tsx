import { useStore } from '../store'
import type { Player, SeasonLine } from '../types'
import { ovr, fairSalary } from '../engine/playerGen'
import { getScoutLevel, SCOUT_LEVEL_LABELS } from '../engine/scouting'
import { avg, era, ip, obp } from '../engine/util'
import { OvrBadge, PotFog } from './bits'

function RatingBar({ label, v }: { label: string; v: number }) {
  const color = v >= 70 ? 'var(--gold)' : v >= 55 ? 'var(--green)' : v >= 42 ? 'var(--blue)' : 'var(--txt-dim)'
  return (
    <div className="rating-row">
      <span className="rlabel">{label}</span>
      <div className="rbar"><div style={{ width: `${Math.min(99, v)}%`, background: color }} /></div>
      <b style={{ width: 26, textAlign: 'right' }}>{v}</b>
    </div>
  )
}

/** 生涯 OVR 曲線（SVG 折線圖） */
function CareerCurve({ history, currentOvr, currentYear }: { history: SeasonLine[]; currentOvr: number; currentYear: number }) {
  const pts = [...history.map(h => ({ y: h.y, o: h.o })), { y: currentYear, o: currentOvr }]
  if (pts.length < 2) return <div className="muted" style={{ padding: '8px 0' }}>累積一個完整賽季後，這裡會畫出生涯能力曲線。</div>
  const W = 360, H = 110, PAD = 24
  const minO = Math.min(...pts.map(p => p.o)) - 4
  const maxO = Math.max(...pts.map(p => p.o)) + 4
  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2)
  const y = (o: number) => H - 16 - ((o - minO) / Math.max(1, maxO - minO)) * (H - 34)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.o).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: 'var(--bg2)', borderRadius: 4 }}>
      <path d={path} fill="none" stroke="var(--red2)" strokeWidth="2" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.o)} r="3" fill="var(--gold)" />
          <text x={x(i)} y={y(p.o) - 7} textAnchor="middle" fontSize="9" fill="var(--txt)">{p.o}</text>
          <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--txt-dim)">{String(p.y).slice(2)}年</text>
        </g>
      ))}
    </svg>
  )
}

export default function PlayerCard() {
  const league = useStore(s => s.league)!
  const viewPlayer = useStore(s => s.viewPlayer)
  const setViewPlayer = useStore(s => s.setViewPlayer)
  const p: Player | undefined = viewPlayer != null ? league.players[viewPlayer] : undefined
  if (!p) return null

  const team = p.teamId >= 0 ? league.teams[p.teamId] : null
  const o = ovr(p)

  return (
    <div className="watch-overlay" onClick={() => setViewPlayer(null)}>
      <div className="panel player-card" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <span>
            {p.name}
            {p.foreign && <span className="foreign-tag">洋將</span>}
            {p.injuryDays > 0 && <span className="injury-tag">傷 {p.injuryDays} 天</span>}
          </span>
          <button className="ghost" style={{ padding: '0 8px' }} onClick={() => setViewPlayer(null)}>✕</button>
        </div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          <div>
            <div className="muted" style={{ lineHeight: 1.9 }}>
              {team ? team.name : p.teamId === -2 ? '選秀適齡' : '自由球員'}・{p.pos}・{p.age} 歲
              <br />綜合 <OvrBadge v={o} />　潛力 <PotFog p={p} withButton />　士氣 <b>{Math.round(p.morale)}</b>
              <br />球探情報：<span className="gold">{SCOUT_LEVEL_LABELS[getScoutLevel(league, p)]}</span>
              <br />月薪 {p.salary} 萬（行情 {fairSalary(p)} 萬）・合約剩 {p.years} 年
              <br />{p.onMain ? '一軍名單' : '二軍名單'}・{p.career.seasons} 個一軍球季
            </div>
            <h3 className="sec">能力值</h3>
            {p.isP ? (
              <>
                <RatingBar label="球威" v={p.stuff} />
                <RatingBar label="控球" v={p.ctrl} />
                <RatingBar label="球速" v={p.velo} />
                <RatingBar label="體力" v={p.stam} />
                <RatingBar label="守備" v={p.field} />
              </>
            ) : (
              <>
                <RatingBar label="打擊" v={p.contact} />
                <RatingBar label="力量" v={p.power} />
                <RatingBar label="選球" v={p.eye} />
                <RatingBar label="速度" v={p.speed} />
                <RatingBar label="守備" v={p.field} />
              </>
            )}
            <h3 className="sec">生涯曲線</h3>
            <CareerCurve history={p.seasonHistory} currentOvr={o} currentYear={league.year} />
          </div>

          <div>
            <h3 className="sec" style={{ marginTop: 0 }}>本季成績</h3>
            <table className="data">
              {p.isP ? (
                <>
                  <thead><tr><th /><th className="num">ERA</th><th className="num">勝-敗</th><th className="num">SV</th><th className="num">局數</th><th className="num">K</th></tr></thead>
                  <tbody>
                    <tr><td>一軍</td><td className="num">{era(p.pit.er, p.pit.outs)}</td><td className="num">{p.pit.w}-{p.pit.l}</td><td className="num">{p.pit.sv}</td><td className="num">{ip(p.pit.outs)}</td><td className="num">{p.pit.so}</td></tr>
                    <tr><td>二軍</td><td className="num">{era(p.fpit.er, p.fpit.outs)}</td><td className="num">{p.fpit.w}-{p.fpit.l}</td><td className="num">{p.fpit.sv}</td><td className="num">{ip(p.fpit.outs)}</td><td className="num">{p.fpit.so}</td></tr>
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th /><th className="num">AVG</th><th className="num">OBP</th><th className="num">HR</th><th className="num">打點</th><th className="num">盜壘</th><th className="num">失誤</th></tr></thead>
                  <tbody>
                    <tr><td>一軍</td><td className="num">{avg(p.bat.h, p.bat.ab)}</td><td className="num">{obp(p.bat.h, p.bat.bb, p.bat.hbp, p.bat.pa)}</td><td className="num">{p.bat.hr}</td><td className="num">{p.bat.rbi}</td><td className="num">{p.bat.sb}</td><td className="num">{p.bat.e}</td></tr>
                    <tr><td>二軍</td><td className="num">{avg(p.fbat.h, p.fbat.ab)}</td><td className="num">{obp(p.fbat.h, p.fbat.bb, p.fbat.hbp, p.fbat.pa)}</td><td className="num">{p.fbat.hr}</td><td className="num">{p.fbat.rbi}</td><td className="num">{p.fbat.sb}</td><td className="num">{p.fbat.e}</td></tr>
                  </tbody>
                </>
              )}
            </table>

            <h3 className="sec">一軍生涯通算</h3>
            <div style={{ lineHeight: 1.9 }}>
              {p.isP
                ? <>ERA <b>{era(p.career.pit.er, p.career.pit.outs)}</b>・{p.career.pit.w} 勝 {p.career.pit.l} 敗 {p.career.pit.sv} 救援・{ip(p.career.pit.outs)} 局・{p.career.pit.so} 次三振</>
                : <>打擊率 <b>{avg(p.career.bat.h, p.career.bat.ab)}</b>・{p.career.bat.h} 安・{p.career.bat.hr} 轟・{p.career.bat.rbi} 打點・{p.career.bat.sb} 盜壘</>}
            </div>

            <h3 className="sec">逐季紀錄</h3>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              <table className="data">
                <thead>
                  {p.isP
                    ? <tr><th>年度</th><th>隊</th><th className="num">OVR</th><th className="num">ERA</th><th className="num">勝-敗</th><th className="num">SV</th><th className="num">K</th></tr>
                    : <tr><th>年度</th><th>隊</th><th className="num">OVR</th><th className="num">AVG</th><th className="num">HR</th><th className="num">打點</th><th className="num">盜</th></tr>}
                </thead>
                <tbody>
                  {p.seasonHistory.length === 0 && <tr><td colSpan={7} className="muted">尚無完整球季紀錄。</td></tr>}
                  {[...p.seasonHistory].reverse().map(h => (
                    <tr key={h.y}>
                      <td>{h.y}</td>
                      <td>{h.t}</td>
                      <td className="num">{h.o}</td>
                      {p.isP ? (
                        h.pit
                          ? <><td className="num">{era(h.pit.er, h.pit.outs)}</td><td className="num">{h.pit.w}-{h.pit.l}</td><td className="num">{h.pit.sv}</td><td className="num">{h.pit.so}</td></>
                          : <td colSpan={4} className="muted">一軍無出賽</td>
                      ) : (
                        h.bat
                          ? <><td className="num">{avg(h.bat.h, h.bat.ab)}</td><td className="num">{h.bat.hr}</td><td className="num">{h.bat.rbi}</td><td className="num">{h.bat.sb}</td></>
                          : <td colSpan={4} className="muted">一軍無出賽</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
