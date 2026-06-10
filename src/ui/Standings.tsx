import { useState } from 'react'
import { useStore } from '../store'
import { standings } from '../engine/season'
import { Logo } from './bits'

export default function Standings() {
  const league = useStore(s => s.league)!
  const [half, setHalf] = useState<0 | 1 | 2>(league.day > league.daysPerHalf ? 2 : 1)

  const rows = standings(league, half)

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="roster-tabs">
        <button className={half === 1 ? 'primary' : ''} onClick={() => setHalf(1)}>上半季</button>
        <button className={half === 2 ? 'primary' : ''} onClick={() => setHalf(2)}>下半季</button>
        <button className={half === 0 ? 'primary' : ''} onClick={() => setHalf(0)}>全年</button>
      </div>
      <div className="panel">
        <div className="panel-head">{half === 0 ? '全年' : half === 1 ? '上半季' : '下半季'}戰績</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr><th>排名</th><th>球隊</th><th className="num">勝</th><th className="num">敗</th><th className="num">和</th><th className="num">勝率</th><th className="num">勝差</th><th className="num">士氣</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team.id} className={r.team.id === league.userTeam ? 'hl' : ''}>
                  <td><b>{i + 1}</b></td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Logo team={r.team} size={24} />{r.team.name}</td>
                  <td className="num">{r.w}</td>
                  <td className="num">{r.l}</td>
                  <td className="num">{r.t}</td>
                  <td className="num">{r.pct.toFixed(3)}</td>
                  <td className="num">{r.gb === 0 ? '-' : r.gb.toFixed(1)}</td>
                  <td className="num">{r.team.morale}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {league.champs.length > 0 && (
            <div style={{ marginTop: 14 }} className="muted">
              歷年冠軍：{league.champs.map(c => `${c.year} ${league.teams[c.team].name}`).join('　')}
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">二軍戰績</div>
        <div className="panel-body">
          <table className="data">
            <thead>
              <tr><th>球隊</th><th className="num">勝</th><th className="num">敗</th><th className="num">和</th><th className="num">勝率</th></tr>
            </thead>
            <tbody>
              {league.teams.slice().sort((a, b) => {
                const pa = a.farmRec.w + a.farmRec.l === 0 ? 0 : a.farmRec.w / (a.farmRec.w + a.farmRec.l)
                const pb = b.farmRec.w + b.farmRec.l === 0 ? 0 : b.farmRec.w / (b.farmRec.w + b.farmRec.l)
                return pb - pa
              }).map(t => (
                <tr key={t.id} className={t.id === league.userTeam ? 'hl' : ''}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Logo team={t} size={22} />{t.name}二軍</td>
                  <td className="num">{t.farmRec.w}</td>
                  <td className="num">{t.farmRec.l}</td>
                  <td className="num">{t.farmRec.t}</td>
                  <td className="num">{t.farmRec.w + t.farmRec.l === 0 ? '-' : (t.farmRec.w / (t.farmRec.w + t.farmRec.l)).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>二軍每日與一軍同步開打，年輕球員累積出賽經驗可加速成長。</div>
        </div>
      </div>
    </div>
  )
}
