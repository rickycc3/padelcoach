import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { SHOTS, createInitialMatchState, replayMatchState } from '../lib/matchScoring'
import { getMatchActions } from '../services/matchActions'
import {
  getPreviousSessionForStudent,
  getSessionById,
  saveSessionCoachNotes,
} from '../services/sessions'

const TIME_BUCKETS = [
  { label: '0-15', min: 0, max: 15 },
  { label: '15-30', min: 15, max: 30 },
  { label: '30-45', min: 30, max: 45 },
  { label: '45-60', min: 45, max: 60 },
  { label: '60-75', min: 60, max: 75 },
  { label: '75-90+', min: 75, max: Infinity },
]

function formatSessionDate(createdAt) {
  if (!createdAt) return '—'
  const date =
    typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s > 0 ? `${m} min ${s}s` : `${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm} min` : `${h}h`
}

function countGeneralStats(actions) {
  let winners = 0
  let errorNoForzado = 0
  let errorForzado = 0
  for (const a of actions) {
    if (a.result === 'winner') winners += 1
    else if (a.result === 'errorNoForzado') errorNoForzado += 1
    else if (a.result === 'errorForzado') errorForzado += 1
  }
  return {
    winners,
    errorNoForzado,
    errorForzado,
    total: actions.length,
  }
}

function countShotBreakdown(actions) {
  const map = Object.fromEntries(SHOTS.map((s) => [s, { winner: 0, errorNoForzado: 0, errorForzado: 0 }]))
  for (const a of actions) {
    if (!SHOTS.includes(a.shot)) continue
    const row = map[a.shot]
    if (!row) continue
    if (a.result === 'winner') row.winner += 1
    else if (a.result === 'errorNoForzado') row.errorNoForzado += 1
    else if (a.result === 'errorForzado') row.errorForzado += 1
  }
  return map
}

function bucketErrorsNoForzados(actions) {
  const counts = TIME_BUCKETS.map(() => 0)
  for (const a of actions) {
    if (a.result !== 'errorNoForzado') continue
    const minute = Number(a.minute)
    const m = Number.isFinite(minute) ? minute : 0
    const idx = TIME_BUCKETS.findIndex((b) => m >= b.min && m < b.max)
    if (idx >= 0) counts[idx] += 1
  }
  return counts
}

function formatSetsBanner(matchState) {
  const completed = matchState.completedSets ?? []
  const parts = completed.map((s) => `${s.playerGames}/${s.rivalGames}`)
  if (
    !matchState.finished &&
    (matchState.gamesPlayer > 0 || matchState.gamesRival > 0 || matchState.inTieBreak)
  ) {
    parts.push(`${matchState.gamesPlayer}/${matchState.gamesRival}`)
  }
  return parts.length ? parts.join(' · ') : '—'
}

function outcomeLabel(matchState) {
  if (matchState.setsPlayer === matchState.setsRival) return 'Empate'
  return matchState.setsPlayer > matchState.setsRival ? 'Victoria' : 'Derrota'
}

function StatCard({ title, value, previousLabel }) {
  return (
    <article className="rounded-2xl border-[0.5px] border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{title}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] font-normal text-slate-400">{previousLabel}</p>
    </article>
  )
}

function ShotRow({ name, winner, errorNoForzado, errorForzado }) {
  const total = winner + errorNoForzado + errorForzado
  const wPct = total ? (winner / total) * 100 : 0
  const nfPct = total ? (errorNoForzado / total) * 100 : 0
  const fPct = total ? (errorForzado / total) * 100 : 0

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-2.5 last:border-b-0">
      <p className="w-[4.5rem] shrink-0 text-xs font-medium text-slate-800">{name}</p>
      <div className="min-w-0 flex-1">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          {wPct > 0 && (
            <div className="h-full bg-emerald-500" style={{ width: `${wPct}%` }} title="Winners" />
          )}
          {nfPct > 0 && (
            <div className="h-full bg-rose-500" style={{ width: `${nfPct}%` }} title="Errores no forzados" />
          )}
          {fPct > 0 && (
            <div className="h-full bg-amber-500" style={{ width: `${fPct}%` }} title="Errores forzados" />
          )}
        </div>
      </div>
      <p className="shrink-0 text-[10px] font-normal tabular-nums text-slate-500">
        <span className="text-emerald-600">{winner}</span>
        <span className="text-slate-300"> · </span>
        <span className="text-rose-600">{errorNoForzado}</span>
        <span className="text-slate-300"> · </span>
        <span className="text-amber-600">{errorForzado}</span>
      </p>
    </div>
  )
}

export default function MatchSummaryScreen() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [session, setSession] = useState(null)
  const [actions, setActions] = useState([])
  const [matchState, setMatchState] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [prevStats, setPrevStats] = useState(null)
  const [notes, setNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setNotFound(false)
      setSaveStatus('')
      try {
        const fromNav = location.state?.session
        const s = fromNav ?? (await getSessionById(sessionId))
        if (!s) {
          if (mounted) setNotFound(true)
          return
        }
        if (!mounted) return
        setSession(s)
        const acts = await getMatchActions(sessionId)
        if (!mounted) return
        setActions(acts)

        const replayed = replayMatchState(s, acts)
        const ms =
          acts.length > 0 ? replayed : location.state?.matchState ?? createInitialMatchState()
        setMatchState(ms)

        const elapsedFromActions =
          acts.length > 0 ? Math.ceil(Math.max(...acts.map((a) => Number(a.minute) || 0))) * 60 : 0
        setElapsedSeconds(
          typeof location.state?.elapsedSeconds === 'number'
            ? location.state.elapsedSeconds
            : elapsedFromActions,
        )

        setNotes(typeof s.coachNotes === 'string' ? s.coachNotes : '')

        const prev = await getPreviousSessionForStudent({
          currentSessionId: sessionId,
          studentName: s.studentName,
          currentCreatedAt: s.createdAt,
        })
        if (!mounted) return
        if (prev) {
          const prevActs = await getMatchActions(prev.id)
          if (!mounted) return
          setPrevStats(countGeneralStats(prevActs))
        } else {
          setPrevStats(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
    // Recarga al cambiar de entrada de navegación; `location.state` se lee dentro del efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionId + location.key definen la carga
  }, [sessionId, location.key])

  const stats = useMemo(() => countGeneralStats(actions), [actions])
  const shotMap = useMemo(() => countShotBreakdown(actions), [actions])
  const errorBuckets = useMemo(() => bucketErrorsNoForzados(actions), [actions])
  const maxBucket = useMemo(() => Math.max(1, ...errorBuckets), [errorBuckets])

  const setsLine = useMemo(() => {
    if (!matchState) return '—'
    return formatSetsBanner(matchState)
  }, [matchState])

  const resultKind = matchState ? outcomeLabel(matchState) : ''
  const isVictory = resultKind === 'Victoria'
  const isDefeat = resultKind === 'Derrota'

  const prevLine = (key) =>
    prevStats && typeof prevStats[key] === 'number'
      ? `Sesión anterior: ${prevStats[key]}`
      : 'Sesión anterior: —'

  async function handleSaveSession() {
    setSaving(true)
    setSaveStatus('')
    try {
      await saveSessionCoachNotes(sessionId, notes)
      setSaveStatus('Cambios guardados.')
    } catch {
      setSaveStatus('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function handleSendPdf() {
    window.alert('El envío de PDF por email estará disponible próximamente.')
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          Cargando resumen...
        </p>
      </main>
    )
  }

  if (notFound || !session || !matchState) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-6">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          No encontramos esta sesión.
        </p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-normal text-white"
        >
          Volver al inicio
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-5 pb-10">
      <header className="rounded-2xl border-[0.5px] border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-normal tracking-wide text-[#185FA5]">Resumen del partido</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{session.studentName}</h1>
        <dl className="mt-3 space-y-1.5 text-xs font-normal text-slate-600">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Fecha</dt>
            <dd className="text-right text-slate-800">{formatSessionDate(session.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Duración</dt>
            <dd className="text-right text-slate-800">{formatDuration(elapsedSeconds)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Formato</dt>
            <dd className="text-right text-slate-800">{session.format}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Deuce</dt>
            <dd className="text-right text-slate-800">{session.deuceType}</dd>
          </div>
        </dl>
      </header>

      <section
        className={`mt-4 rounded-2xl border-[0.5px] px-4 py-4 text-center ${
          isVictory
            ? 'border-emerald-200 bg-emerald-50'
            : isDefeat
              ? 'border-rose-200 bg-rose-50'
              : 'border-slate-200 bg-white'
        }`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-[0.14em] ${
            isVictory ? 'text-emerald-800' : isDefeat ? 'text-rose-800' : 'text-slate-500'
          }`}
        >
          Resultado
        </p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            isVictory ? 'text-emerald-900' : isDefeat ? 'text-rose-900' : 'text-slate-900'
          }`}
        >
          {resultKind}
        </p>
        <p className="mt-2 font-mono text-sm font-medium tracking-tight text-slate-800">{setsLine}</p>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Sets alumno {matchState.setsPlayer} · Rival {matchState.setsRival}
        </p>
      </section>

      <section className="mt-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Estadísticas generales
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatCard title="Winners" value={stats.winners} previousLabel={prevLine('winners')} />
          <StatCard
            title="Errores no forzados"
            value={stats.errorNoForzado}
            previousLabel={prevLine('errorNoForzado')}
          />
          <StatCard
            title="Errores forzados"
            value={stats.errorForzado}
            previousLabel={prevLine('errorForzado')}
          />
          <StatCard title="Total acciones" value={stats.total} previousLabel={prevLine('total')} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Rendimiento por golpe
        </h2>
        <p className="mt-1 text-[10px] font-normal text-slate-400">
          Verde: winners · Rojo: errores no forzados · Naranja: errores forzados
        </p>
        <div className="mt-2">
          {SHOTS.map((shot) => (
            <ShotRow key={shot} name={shot} {...shotMap[shot]} />
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Errores no forzados por tramo (15 min)
        </h2>
        <div className="mt-4 flex h-36 items-end justify-between gap-1.5">
          {TIME_BUCKETS.map((b, i) => {
            const count = errorBuckets[i] ?? 0
            const h = Math.round((count / maxBucket) * 100)
            return (
              <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-medium tabular-nums text-slate-600">{count}</span>
                <div
                  className="w-full max-w-[2.25rem] rounded-t-md bg-rose-400/90"
                  style={{ height: `${Math.max(count ? 8 : 0, h)}%` }}
                  title={`${b.label} min`}
                />
                <span className="text-[9px] font-normal leading-tight text-slate-400">{b.label}</span>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/sesion/${sessionId}/timeline`)}
          className="mt-4 w-full rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] px-3 py-2.5 text-xs font-medium text-[#0C447C]"
        >
          Ver timeline detallado
        </button>
      </section>

      <section className="mt-5">
        <label htmlFor="coach-notes" className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Notas del entrenador
        </label>
        <textarea
          id="coach-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Observaciones para el alumno..."
          className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.03)] outline-none transition focus:border-[#185FA5] focus:ring-2 focus:ring-[#E6F1FB]"
        />
        {saveStatus && <p className="mt-1.5 text-xs text-slate-500">{saveStatus}</p>}
      </section>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveSession}
          className="w-full rounded-xl border-[0.5px] border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar sesión'}
        </button>
        <button
          type="button"
          onClick={handleSendPdf}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
        >
          Enviar PDF por email
        </button>
      </div>
    </main>
  )
}
