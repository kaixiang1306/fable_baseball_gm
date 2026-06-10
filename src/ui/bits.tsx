import type { Player, Team } from '../types'
import { useStore } from '../store'
import { canScout, potEstimate, SCOUT_LEVEL_LABELS } from '../engine/scouting'

export function Logo({ team, size = 44 }: { team: Pick<Team, 'c1' | 'c2' | 'short'>; size?: number }) {
  return (
    <span
      className="logo-circ"
      style={{
        width: size, height: size, fontSize: size * 0.45,
        background: `linear-gradient(135deg, ${team.c1}, ${team.c2})`,
        color: '#fff',
      }}
    >
      {team.short}
    </span>
  )
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? '' : 'off'}>★</span>
      ))}
    </span>
  )
}

/** 圓形能力儀表（仿 2K） */
export function Gauge({ value, label, size = 84 }: { value: number; label: string; size?: number }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(99, value)) / 99
  return (
    <div className="gauge">
      <div className="glabel">{label}</div>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="#10141a" stroke="#2a3340" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--red)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={size * 0.3} fontWeight="900">
          {value}
        </text>
      </svg>
    </div>
  )
}

export function OvrBadge({ v }: { v: number }) {
  const cls = v >= 75 ? 's' : v >= 65 ? 'a' : v >= 55 ? 'b' : ''
  return <span className={`ovr-badge ${cls}`}>{v}</span>
}

/** 潛力迷霧顯示：依球探情報等級顯示範圍或精確值，可附考察按鈕 */
export function PotFog({ p, withButton = false }: { p: Player; withButton?: boolean }) {
  const league = useStore(s => s.league)
  const scout = useStore(s => s.scout)
  if (!league) return null
  const e = potEstimate(league, p)
  const scoutable = canScout(league, p)
  return (
    <span style={{ whiteSpace: 'nowrap' }} title={`球探情報：${SCOUT_LEVEL_LABELS[e.level]}`}>
      {e.exact
        ? <b className="gold">{p.pot}</b>
        : <span style={{ color: e.level >= 2 ? 'var(--gold)' : e.level >= 1 ? 'var(--txt)' : 'var(--txt-dim)' }}>{e.lo}~{e.hi}</span>}
      {withButton && !e.exact && (
        <button
          className="scout-btn"
          disabled={!scoutable}
          title={scoutable ? '派遣球探考察（消耗 1 點）' : '球探點數不足'}
          onClick={ev => { ev.stopPropagation(); scout(p) }}
        >
          🔍
        </button>
      )}
    </span>
  )
}
