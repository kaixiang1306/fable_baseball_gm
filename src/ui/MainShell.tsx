import { useStore, type MainTab } from '../store'
import { fmtMoney } from '../engine/util'
import { teamPayroll } from '../engine/league'
import { dayToDate, TOTAL_DAYS } from '../engine/season'
import { Logo } from './bits'
import Calendar from './Calendar'
import Roster from './Roster'
import Standings from './Standings'
import Leaders from './Leaders'
import Trade from './Trade'
import Finance from './Finance'
import History from './History'

const TABS: { key: MainTab; label: string }[] = [
  { key: 'calendar', label: '行事曆' },
  { key: 'roster', label: '球隊陣容' },
  { key: 'standings', label: '戰績' },
  { key: 'leaders', label: '數據王' },
  { key: 'trade', label: '交易' },
  { key: 'finance', label: '財務與老闆' },
  { key: 'history', label: '歷史' },
]

export default function MainShell() {
  const league = useStore(s => s.league)!
  const tab = useStore(s => s.tab)
  const setTab = useStore(s => s.setTab)
  const setScreen = useStore(s => s.setScreen)
  const exportSave = useStore(s => s.exportSave)

  const team = league.teams[league.userTeam]
  const rec = team.rec
  const w = rec[0].w + rec[1].w, l = rec[0].l + rec[1].l, t = rec[0].t + rec[1].t
  const inSeason = league.phase === 'season'
  const dateLabel = inSeason && league.day <= TOTAL_DAYS
    ? `${league.year}/${dayToDate(league.year, league.day).label}`
    : league.phase === 'ts' ? `${league.year} 台灣大賽`
      : league.phase === 'allstar' ? `${league.year} 明星賽` : `${league.year}`
  const halfLabel = inSeason ? (league.day <= league.daysPerHalf ? `上半季 第 ${league.day} 戰` : `下半季 第 ${league.day - league.daysPerHalf} 戰`) : ''

  return (
    <>
      <div className="topbar">
        <span className="brand">寶島職棒 GM</span>
        <span className="team-chip">
          <Logo team={team} size={34} />
          <b>{team.name}</b>
        </span>
        <span className="meta">
          <span>戰績 <b>{w}勝 {l}敗 {t}和</b></span>
          <span>士氣 <b>{team.morale}</b></span>
          <span>年薪資 <b>{fmtMoney(teamPayroll(league, team.id))}</b> / {fmtMoney(team.budget)}</span>
          <span><b>{dateLabel}</b> {halfLabel}</span>
          <button className="ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={exportSave} title="下載聯盟存檔 JSON，可分享給其他玩家匯入">匯出存檔</button>
          <button className="ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setScreen('title')}>主選單</button>
        </span>
      </div>
      <div className="tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div className="content">
        {tab === 'calendar' && <Calendar />}
        {tab === 'roster' && <Roster />}
        {tab === 'standings' && <Standings />}
        {tab === 'leaders' && <Leaders />}
        {tab === 'trade' && <Trade />}
        {tab === 'finance' && <Finance />}
        {tab === 'history' && <History />}
      </div>
    </>
  )
}
