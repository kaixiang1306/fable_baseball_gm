import { useState } from 'react'
import { useStore } from '../store'
import type { Player } from '../types'
import { ovr } from '../engine/playerGen'
import { MAIN_ROSTER_SIZE } from '../engine/league'
import { extensionAsk, MAX_NEGO_FAILS, type NegoResult } from '../engine/contracts'
import { posFactor } from '../engine/positions'
import type { Pos } from '../types'
import { avg, era, ip } from '../engine/util'
import { Logo, OvrBadge } from './bits'

function PName({ p }: { p: Player }) {
  const setViewPlayer = useStore(s => s.setViewPlayer)
  return (
    <span className="pname-link" onClick={() => setViewPlayer(p.id)}>
      {p.name}
      {p.foreign && <span className="foreign-tag">洋將</span>}
      {p.injuryDays > 0 && <span className="injury-tag">傷 {p.injuryDays} 天</span>}
    </span>
  )
}

function MoraleDot({ v }: { v: number }) {
  const c = v >= 65 ? 'var(--green)' : v >= 45 ? 'var(--gold)' : 'var(--red2)'
  return <span style={{ color: c, fontWeight: 700 }}>{Math.round(v)}</span>
}

/** 續約談判視窗 */
function NegoModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const negotiate = useStore(s => s.negotiate)
  const ask = extensionAsk(p)
  const [salary, setSalary] = useState(ask.salary)
  const [years, setYears] = useState(Math.min(2, ask.maxYears))
  const [msg, setMsg] = useState<NegoResult | null>(null)
  const locked = p.negoFails >= MAX_NEGO_FAILS

  return (
    <div className="watch-overlay" onClick={onClose}>
      <div className="panel" style={{ width: 'min(460px, 92vw)' }} onClick={e => e.stopPropagation()}>
        <div className="panel-head">續約談判 — {p.name}</div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="muted">
            {p.pos}・{p.age} 歲・OVR {ovr(p)}・士氣 {Math.round(p.morale)}
            <br />現約：月薪 {p.salary} 萬，剩 {p.years} 年
            <br />經紀人開價：月薪 <b className="gold">{ask.salary} 萬</b>，最長 {ask.maxYears} 年
            {p.morale >= 65 && <span className="green">（士氣高昂，願意給友情價）</span>}
            {p.morale < 45 && <span className="red">（士氣低落，要價變高）</span>}
          </div>
          {locked
            ? <div className="verdict no">經紀人表示本季不再協商。</div>
            : (
              <>
                <label>
                  月薪（萬）：
                  <input
                    type="number" min={7} max={300} value={salary}
                    onChange={e => setSalary(Number(e.target.value))}
                    style={{ width: 90, marginLeft: 8 }}
                  />
                </label>
                <label>
                  年限：
                  <select value={years} onChange={e => setYears(Number(e.target.value))} style={{ marginLeft: 8 }}>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} 年</option>)}
                  </select>
                </label>
                <div className="muted" style={{ fontSize: 12 }}>提示：簽長約需要每年多一點誠意；談崩 {MAX_NEGO_FAILS} 次球員本季將拒絕再談。</div>
                <button className="primary" onClick={() => setMsg(negotiate(p, salary, years))}>提出合約</button>
              </>
            )}
          {msg && <div className={`verdict ${msg.ok ? 'ok' : 'no'}`}>{msg.msg}</div>}
          <button onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  )
}

export default function Roster() {
  const league = useStore(s => s.league)!
  const bump = useStore(s => s.bump)
  const [viewTeam, setViewTeam] = useState(league.userTeam)
  const [mode, setMode] = useState<'rate' | 'stat'>('rate')
  const [negoTarget, setNegoTarget] = useState<Player | null>(null)

  const team = league.teams[viewTeam]
  const editable = viewTeam === league.userTeam
  const roster = Object.values(league.players).filter(p => p.teamId === viewTeam)
  const mainCount = roster.filter(p => p.onMain).length

  const lineup = team.lineup.map(id => league.players[id]).filter(Boolean)
  const bench = roster.filter(p => !p.isP && p.onMain && !team.lineup.includes(p.id))
  const farm = roster.filter(p => !p.onMain).sort((a, b) => ovr(b) - ovr(a))
  const rotation = team.rotation.map(id => league.players[id]).filter(Boolean)
  const closer = team.closer >= 0 ? league.players[team.closer] : null
  const bullpen = roster.filter(p => p.isP && p.onMain && !team.rotation.includes(p.id) && p.id !== team.closer)

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= team.lineup.length) return
    ;[team.lineup[i], team.lineup[j]] = [team.lineup[j], team.lineup[i]]
    if (team.lineupPos) [team.lineupPos[i], team.lineupPos[j]] = [team.lineupPos[j], team.lineupPos[i]]
    bump()
  }
  const replaceLineup = (i: number, newId: number) => {
    const exist = team.lineup.indexOf(newId)
    // 守位跟著棒次走：只交換球員，不交換守位
    if (exist >= 0) [team.lineup[i], team.lineup[exist]] = [team.lineup[exist], team.lineup[i]]
    else team.lineup[i] = newId
    bump()
  }
  const replaceRotation = (i: number, newId: number) => {
    const exist = team.rotation.indexOf(newId)
    if (exist >= 0) [team.rotation[i], team.rotation[exist]] = [team.rotation[exist], team.rotation[i]]
    else team.rotation[i] = newId
    bump()
  }
  const inUse = (id: number) => team.lineup.includes(id) || team.rotation.includes(id) || team.closer === id
  const toggleMain = (p: Player) => {
    if (p.onMain) {
      if (inUse(p.id)) { alert('此球員目前在打線、輪值或終結者位置上，請先替換後再下放二軍。'); return }
      p.onMain = false
    } else {
      if (p.injuryDays > 0) { alert(`${p.name} 仍在傷兵名單（剩 ${p.injuryDays} 天），無法升上一軍。`); return }
      if (mainCount >= MAIN_ROSTER_SIZE) { alert(`一軍名單已滿（${MAIN_ROSTER_SIZE} 人），請先下放其他球員。`); return }
      p.onMain = true
    }
    bump()
  }

  const batCols = mode === 'rate'
    ? ['打擊', '力量', '選球', '速度', '守備', '士氣']
    : ['AVG', 'HR', '打點', '盜壘', '失誤', '士氣']
  const batVals = (p: Player) => mode === 'rate'
    ? [p.contact, p.power, p.eye, p.speed, p.field]
    : [avg(p.bat.h, p.bat.ab), p.bat.hr, p.bat.rbi, p.bat.sb, p.bat.e]
  const pitCols = mode === 'rate'
    ? ['球威', '控球', '球速', '體力', '士氣']
    : ['ERA', '勝-敗', 'SV', '局數', '士氣']
  const pitVals = (p: Player) => mode === 'rate'
    ? [p.stuff, p.ctrl, p.velo, p.stam]
    : [era(p.pit.er, p.pit.outs), `${p.pit.w}-${p.pit.l}`, p.pit.sv, ip(p.pit.outs)]

  const healthyEligible = (q: Player) => q.onMain && q.injuryDays === 0

  return (
    <div>
      {negoTarget && <NegoModal p={negoTarget} onClose={() => setNegoTarget(null)} />}
      <div className="roster-tabs">
        <select value={viewTeam} onChange={e => setViewTeam(Number(e.target.value))}>
          {league.teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === league.userTeam ? '（我的球隊）' : ''}</option>)}
        </select>
        <button className={mode === 'rate' ? 'primary' : ''} onClick={() => setMode('rate')}>能力</button>
        <button className={mode === 'stat' ? 'primary' : ''} onClick={() => setMode('stat')}>本季數據</button>
        <span className="muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <Logo team={team} size={22} /> 一軍 {mainCount}/{MAIN_ROSTER_SIZE} 人・二軍戰績 {team.farmRec.w}勝{team.farmRec.l}敗{team.farmRec.t}和
        </span>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">先發打線</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr>
                <th>棒次</th><th>守位</th><th>球員</th><th>年齡</th><th>OVR</th>
                {batCols.map(c => <th key={c} className="num">{c}</th>)}
                {editable && <th>調整</th>}
              </tr>
            </thead>
            <tbody>
              {lineup.map((p, i) => {
                const slotPos = (team.lineupPos?.[i] ?? p.pos) as Pos
                const apt = posFactor(p.pos, slotPos)
                const eligible = roster
                  .filter(q => !q.isP && healthyEligible(q) && q.id !== p.id)
                  .sort((a, b) => posFactor(b.pos, slotPos) - posFactor(a.pos, slotPos) || ovr(b) - ovr(a))
                return (
                  <tr key={p.id}>
                    <td><b>{i + 1}</b></td>
                    <td>
                      <span className="lineup-pos">{slotPos}</span>
                      {apt < 1 && slotPos !== 'DH' && (
                        <span style={{ fontSize: 11, color: apt >= 0.85 ? 'var(--gold)' : 'var(--red2)' }}>
                          {p.pos} 適性{Math.round(apt * 100)}%
                        </span>
                      )}
                    </td>
                    <td><PName p={p} /></td>
                    <td className="num">{p.age}</td>
                    <td><OvrBadge v={ovr(p)} /></td>
                    {batVals(p).map((v, k) => <td key={k} className="num">{v}</td>)}
                    <td className="num"><MoraleDot v={p.morale} /></td>
                    {editable && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button style={{ padding: '1px 7px' }} onClick={() => move(i, -1)}>↑</button>
                        <button style={{ padding: '1px 7px' }} onClick={() => move(i, 1)}>↓</button>
                        <select value="" onChange={e => { if (e.target.value) replaceLineup(i, Number(e.target.value)) }}>
                          <option value="">替換…</option>
                          {eligible.map(q => (
                            <option key={q.id} value={q.id}>
                              {q.name} ({q.pos}/{ovr(q)}{slotPos !== 'DH' ? `・適性${Math.round(posFactor(q.pos, slotPos) * 100)}%` : ''})
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {bench.length > 0 && (
            <div className="muted" style={{ marginTop: 8 }}>板凳：{bench.map(p => `${p.name}(${p.pos}${p.injuryDays > 0 ? `・傷${p.injuryDays}` : ''})`).join('、')}</div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">投手調度</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr>
                <th>位置</th><th>球員</th><th>年齡</th><th>OVR</th>
                {pitCols.map(c => <th key={c} className="num">{c}</th>)}
                {editable && <th>調整</th>}
              </tr>
            </thead>
            <tbody>
              {rotation.map((p, i) => {
                const eligible = roster.filter(q => q.isP && healthyEligible(q) && q.id !== p.id && !team.rotation.includes(q.id) && q.id !== team.closer)
                return (
                  <tr key={p.id}>
                    <td><span className="lineup-pos">先發{i + 1}</span>{league.phase === 'season' && i === team.nextSP ? <span className="gold"> ●今日</span> : ''}</td>
                    <td><PName p={p} /></td>
                    <td className="num">{p.age}</td>
                    <td><OvrBadge v={ovr(p)} /></td>
                    {pitVals(p).map((v, k) => <td key={k} className="num">{v}</td>)}
                    <td className="num"><MoraleDot v={p.morale} /></td>
                    {editable && (
                      <td>
                        <select value="" onChange={e => { if (e.target.value) replaceRotation(i, Number(e.target.value)) }}>
                          <option value="">替換…</option>
                          {eligible.map(q => <option key={q.id} value={q.id}>{q.name} ({q.pos}/{ovr(q)})</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
              {closer && (
                <tr>
                  <td><span className="lineup-pos" style={{ width: 60 }}>終結者</span></td>
                  <td><PName p={closer} /></td>
                  <td className="num">{closer.age}</td>
                  <td><OvrBadge v={ovr(closer)} /></td>
                  {pitVals(closer).map((v, k) => <td key={k} className="num">{v}</td>)}
                  <td className="num"><MoraleDot v={closer.morale} /></td>
                  {editable && (
                    <td>
                      <select value="" onChange={e => { if (e.target.value) { team.closer = Number(e.target.value); bump() } }}>
                        <option value="">替換…</option>
                        {roster.filter(q => q.isP && healthyEligible(q) && q.id !== team.closer && !team.rotation.includes(q.id))
                          .map(q => <option key={q.id} value={q.id}>{q.name} ({q.pos}/{ovr(q)})</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              )}
              {bullpen.map(p => (
                <tr key={p.id}>
                  <td><span className="lineup-pos" style={{ width: 60 }}>牛棚</span></td>
                  <td><PName p={p} /></td>
                  <td className="num">{p.age}</td>
                  <td><OvrBadge v={ovr(p)} /></td>
                  {pitVals(p).map((v, k) => <td key={k} className="num">{v}</td>)}
                  <td className="num"><MoraleDot v={p.morale} /></td>
                  {editable && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">全名單與合約（二軍 {farm.length} 人）</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr>
                <th>球員</th><th>位置</th><th>年齡</th><th>OVR</th><th>潛力</th>
                <th className="num">士氣</th><th className="num">二軍成績</th>
                <th className="num">月薪</th><th className="num">合約</th>{editable && <th />}
              </tr>
            </thead>
            <tbody>
              {[...roster.filter(p => p.onMain), ...farm].map(p => (
                <tr key={p.id} className={p.onMain ? '' : 'hl'} style={p.onMain ? { opacity: 0.55 } : {}}>
                  <td><PName p={p} />{p.onMain && <span className="muted">（一軍）</span>}</td>
                  <td>{p.pos}</td>
                  <td className="num">{p.age}</td>
                  <td><OvrBadge v={ovr(p)} /></td>
                  <td className="num">{p.pot}</td>
                  <td className="num"><MoraleDot v={p.morale} /></td>
                  <td className="num muted">
                    {p.isP
                      ? (p.fpit.outs > 0 ? `${era(p.fpit.er, p.fpit.outs)} ERA/${ip(p.fpit.outs)}局` : '—')
                      : (p.fbat.ab > 0 ? `${avg(p.fbat.h, p.fbat.ab)}/${p.fbat.hr}轟` : '—')}
                  </td>
                  <td className="num">{p.salary} 萬</td>
                  <td className="num" style={p.years <= 1 ? { color: 'var(--gold)' } : {}}>{p.years} 年</td>
                  {editable && (
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button style={{ padding: '1px 10px', fontSize: 12 }} onClick={() => toggleMain(p)}>
                        {p.onMain ? '降二軍' : '升一軍'}
                      </button>
                      <button style={{ padding: '1px 10px', fontSize: 12 }} onClick={() => setNegoTarget(p)}>續約</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
