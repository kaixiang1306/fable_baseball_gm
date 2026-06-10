import { useState } from 'react'
import { useStore } from '../store'
import type { Player } from '../types'
import { ovr } from '../engine/playerGen'
import { MAIN_ROSTER_SIZE } from '../engine/league'
import { avg, era, ip } from '../engine/util'
import { Logo, OvrBadge } from './bits'

function PName({ p }: { p: Player }) {
  return <>{p.name}{p.foreign && <span className="foreign-tag">洋將</span>}</>
}

export default function Roster() {
  const league = useStore(s => s.league)!
  const bump = useStore(s => s.bump)
  const [viewTeam, setViewTeam] = useState(league.userTeam)
  const [mode, setMode] = useState<'rate' | 'stat'>('rate')

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
      if (mainCount >= MAIN_ROSTER_SIZE) { alert(`一軍名單已滿（${MAIN_ROSTER_SIZE} 人），請先下放其他球員。`); return }
      p.onMain = true
    }
    bump()
  }

  const batCols = mode === 'rate'
    ? ['打擊', '力量', '選球', '速度', '守備']
    : ['AVG', 'HR', '打點', '盜壘', '三振']
  const batVals = (p: Player) => mode === 'rate'
    ? [p.contact, p.power, p.eye, p.speed, p.field]
    : [avg(p.bat.h, p.bat.ab), p.bat.hr, p.bat.rbi, p.bat.sb, p.bat.so]
  const pitCols = mode === 'rate'
    ? ['球威', '控球', '球速', '體力']
    : ['ERA', '勝-敗', 'SV', '局數']
  const pitVals = (p: Player) => mode === 'rate'
    ? [p.stuff, p.ctrl, p.velo, p.stam]
    : [era(p.pit.er, p.pit.outs), `${p.pit.w}-${p.pit.l}`, p.pit.sv, ip(p.pit.outs)]

  return (
    <div>
      <div className="roster-tabs">
        <select value={viewTeam} onChange={e => setViewTeam(Number(e.target.value))}>
          {league.teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === league.userTeam ? '（我的球隊）' : ''}</option>)}
        </select>
        <button className={mode === 'rate' ? 'primary' : ''} onClick={() => setMode('rate')}>能力</button>
        <button className={mode === 'stat' ? 'primary' : ''} onClick={() => setMode('stat')}>本季數據</button>
        <span className="muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <Logo team={team} size={22} /> 一軍 {mainCount}/{MAIN_ROSTER_SIZE} 人
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
                const slotPos = team.lineupPos?.[i] ?? p.pos
                const eligible = roster.filter(q =>
                  !q.isP && q.onMain && q.id !== p.id && (slotPos === 'DH' ? true : q.pos === slotPos || team.lineup.includes(q.id)))
                return (
                  <tr key={p.id}>
                    <td><b>{i + 1}</b></td>
                    <td><span className="lineup-pos">{slotPos}</span>{slotPos !== p.pos && slotPos !== 'DH' && <span className="muted" style={{ fontSize: 11 }}>({p.pos})</span>}</td>
                    <td><PName p={p} /></td>
                    <td className="num">{p.age}</td>
                    <td><OvrBadge v={ovr(p)} /></td>
                    {batVals(p).map((v, k) => <td key={k} className="num">{v}</td>)}
                    {editable && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button style={{ padding: '1px 7px' }} onClick={() => move(i, -1)}>↑</button>
                        <button style={{ padding: '1px 7px' }} onClick={() => move(i, 1)}>↓</button>
                        <select value="" onChange={e => { if (e.target.value) replaceLineup(i, Number(e.target.value)) }}>
                          <option value="">替換…</option>
                          {eligible.map(q => <option key={q.id} value={q.id}>{q.name} ({q.pos}/{ovr(q)})</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {bench.length > 0 && (
            <div className="muted" style={{ marginTop: 8 }}>板凳：{bench.map(p => `${p.name}(${p.pos})`).join('、')}</div>
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
                const eligible = roster.filter(q => q.isP && q.onMain && q.id !== p.id && !team.rotation.includes(q.id) && q.id !== team.closer)
                return (
                  <tr key={p.id}>
                    <td><span className="lineup-pos">先發{i + 1}</span>{league.phase === 'season' && i === team.nextSP ? <span className="gold"> ●今日</span> : ''}</td>
                    <td><PName p={p} /></td>
                    <td className="num">{p.age}</td>
                    <td><OvrBadge v={ovr(p)} /></td>
                    {pitVals(p).map((v, k) => <td key={k} className="num">{v}</td>)}
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
                  {editable && (
                    <td>
                      <select value="" onChange={e => { if (e.target.value) { team.closer = Number(e.target.value); bump() } }}>
                        <option value="">替換…</option>
                        {roster.filter(q => q.isP && q.onMain && q.id !== team.closer && !team.rotation.includes(q.id))
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
                  {editable && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">二軍名單（{farm.length} 人）</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr><th>球員</th><th>位置</th><th>年齡</th><th>OVR</th><th>潛力</th><th className="num">月薪</th><th className="num">合約</th>{editable && <th />}</tr>
            </thead>
            <tbody>
              {[...roster.filter(p => p.onMain), ...farm].map(p => (
                <tr key={p.id} className={p.onMain ? '' : 'hl'} style={p.onMain ? { opacity: 0.55 } : {}}>
                  <td><PName p={p} />{p.onMain && <span className="muted">（一軍）</span>}</td>
                  <td>{p.pos}</td>
                  <td className="num">{p.age}</td>
                  <td><OvrBadge v={ovr(p)} /></td>
                  <td className="num">{p.pot}</td>
                  <td className="num">{p.salary} 萬</td>
                  <td className="num">{p.years} 年</td>
                  {editable && (
                    <td>
                      <button style={{ padding: '1px 10px', fontSize: 12 }} onClick={() => toggleMain(p)}>
                        {p.onMain ? '降二軍' : '升一軍'}
                      </button>
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
