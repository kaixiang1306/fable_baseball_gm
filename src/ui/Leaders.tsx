import { useStore } from '../store'
import type { Player } from '../types'
import { avg, era, ip, obp } from '../engine/util'

interface Board { title: string; rows: { p: Player; v: string }[] }

export default function Leaders() {
  const league = useStore(s => s.league)!
  const setViewPlayer = useStore(s => s.setViewPlayer)
  const players = Object.values(league.players).filter(p => p.teamId >= 0)
  const teamGames = Math.max(1, ...league.teams.map(t => t.rec[0].w + t.rec[0].l + t.rec[0].t + t.rec[1].w + t.rec[1].l + t.rec[1].t))

  const qualBat = players.filter(p => p.bat.pa >= teamGames * 2.6)
  const qualPit = players.filter(p => p.isP && p.pit.outs >= teamGames * 2.4)
  const top = <T,>(arr: T[], f: (x: T) => number, n = 5) => arr.slice().sort((a, b) => f(b) - f(a)).slice(0, n)

  const boards: Board[] = [
    { title: '打擊率', rows: top(qualBat, p => p.bat.h / Math.max(1, p.bat.ab)).map(p => ({ p, v: avg(p.bat.h, p.bat.ab) })) },
    { title: '全壘打', rows: top(players, p => p.bat.hr).map(p => ({ p, v: String(p.bat.hr) })) },
    { title: '打點', rows: top(players, p => p.bat.rbi).map(p => ({ p, v: String(p.bat.rbi) })) },
    { title: '盜壘', rows: top(players, p => p.bat.sb).map(p => ({ p, v: String(p.bat.sb) })) },
    { title: '上壘率', rows: top(qualBat, p => (p.bat.h + p.bat.bb + p.bat.hbp) / Math.max(1, p.bat.pa)).map(p => ({ p, v: obp(p.bat.h, p.bat.bb, p.bat.hbp, p.bat.pa) })) },
    { title: '防禦率', rows: top(qualPit, p => -(p.pit.er * 27) / Math.max(1, p.pit.outs)).map(p => ({ p, v: era(p.pit.er, p.pit.outs) })) },
    { title: '勝投', rows: top(players.filter(p => p.isP), p => p.pit.w).map(p => ({ p, v: String(p.pit.w) })) },
    { title: '三振', rows: top(players.filter(p => p.isP), p => p.pit.so).map(p => ({ p, v: String(p.pit.so) })) },
    { title: '救援成功', rows: top(players.filter(p => p.isP), p => p.pit.sv).map(p => ({ p, v: String(p.pit.sv) })) },
    { title: '投球局數', rows: top(players.filter(p => p.isP), p => p.pit.outs).map(p => ({ p, v: ip(p.pit.outs) })) },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
      {boards.map(b => (
        <div className="panel" key={b.title}>
          <div className="panel-head">{b.title}王</div>
          <div className="panel-body">
            <table className="data">
              <tbody>
                {b.rows.map(({ p, v }, i) => (
                  <tr key={p.id} className={p.teamId === league.userTeam ? 'hl' : ''}>
                    <td style={{ width: 24 }}><b>{i + 1}</b></td>
                    <td><span className="pname-link" onClick={() => setViewPlayer(p.id)}>{p.name}{p.foreign ? <span className="foreign-tag">洋</span> : ''}</span></td>
                    <td className="muted">{league.teams[p.teamId]?.short}</td>
                    <td className="num"><b>{v}</b></td>
                  </tr>
                ))}
                {b.rows.length === 0 && <tr><td className="muted">尚無符合資格的球員</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
