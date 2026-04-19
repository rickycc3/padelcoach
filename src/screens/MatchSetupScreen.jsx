import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession, getRecentSessions } from '../services/sessions'
import { firebaseReady } from '../firebase'

const DURATION_OPTIONS = [60, 90, 120]
const MATCH_FORMATS = ['Al mejor de 3', 'Tie-break']
const DEUCE_OPTIONS = ['Ventaja', 'Punto de oro']

const initialForm = {
  studentName: '',
  estimatedDuration: 90,
  format: MATCH_FORMATS[0],
  deuceType: DEUCE_OPTIONS[1],
}

function SessionCard({ session }) {
  const createdDate = useMemo(() => {
    if (!session.createdAt) return 'Sin fecha'
    const date =
      typeof session.createdAt?.toDate === 'function'
        ? session.createdAt.toDate()
        : new Date(session.createdAt)

    if (Number.isNaN(date.getTime())) return 'Sin fecha'
    return date.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }, [session.createdAt])

  return (
    <article className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-normal text-slate-500">{createdDate}</p>
      <p className="mt-1 text-base font-medium text-slate-900">{session.studentName}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-normal text-slate-600">
        <span className="rounded-full bg-slate-100/90 px-2.5 py-1">{session.estimatedDuration} min</span>
        <span className="rounded-full bg-slate-100/90 px-2.5 py-1">{session.format}</span>
        <span className="rounded-full bg-slate-100/90 px-2.5 py-1">{session.deuceType}</span>
      </div>
    </article>
  )
}

export default function MatchSetupScreen() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialForm)
  const [recentSessions, setRecentSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadRecentSessions() {
      try {
        const sessions = await getRecentSessions()
        if (mounted) {
          setRecentSessions(sessions)
        }
      } catch {
        if (mounted) {
          setError('No se pudieron cargar las sesiones recientes.')
        }
      } finally {
        if (mounted) {
          setLoadingSessions(false)
        }
      }
    }

    loadRecentSessions()

    return () => {
      mounted = false
    }
  }, [])

  const isValid = formData.studentName.trim().length >= 2

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const selectedOptionClass = 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] shadow-[0_2px_8px_rgba(24,95,165,0.14)]'
  const unselectedOptionClass = 'border-slate-200 bg-white text-slate-600'

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isValid) return

    setSubmitting(true)
    setError('')
    try {
      const newSession = await createSession(formData)
      setRecentSessions((current) => [newSession, ...current].slice(0, 8))
      setFormData((current) => ({ ...current, studentName: '' }))
      navigate(`/partido-en-vivo/${newSession.id}`, { state: { session: newSession } })
    } catch {
      setError('No se pudo crear la sesión. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-5 py-9">
      <header className="mb-10">
        <p className="text-sm font-normal tracking-wide text-[#185FA5]">PadelCoach</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Configurar partido</h1>
        <p className="mt-2 text-sm font-normal text-slate-500">
          Prepara la sesión y empieza el análisis en tiempo real.
        </p>
        {!firebaseReady && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-normal text-amber-800">
            Firebase no está configurado. Se guardará en almacenamiento local.
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-7">
        <label className="block">
          <span className="mb-2 block text-sm font-normal text-slate-600">Alumno</span>
          <input
            value={formData.studentName}
            onChange={(event) => updateField('studentName', event.target.value)}
            placeholder="Nombre del alumno"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-normal text-slate-900 outline-none shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition focus:border-[#185FA5] focus:ring-2 focus:ring-[#E6F1FB]"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-normal text-slate-600">Duración estimada</p>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_OPTIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => updateField('estimatedDuration', duration)}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  formData.estimatedDuration === duration
                    ? selectedOptionClass
                    : unselectedOptionClass
                }`}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-normal text-slate-600">Formato</p>
          <div className="grid grid-cols-2 gap-2">
            {MATCH_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => updateField('format', format)}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  formData.format === format ? selectedOptionClass : unselectedOptionClass
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-normal text-slate-600">Deuce</p>
          <div className="grid grid-cols-2 gap-2">
            {DEUCE_OPTIONS.map((deuce) => (
              <button
                key={deuce}
                type="button"
                onClick={() => updateField('deuceType', deuce)}
                className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  formData.deuceType === deuce ? selectedOptionClass : unselectedOptionClass
                }`}
              >
                {deuce}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={!isValid || submitting}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-medium text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? 'Creando sesión...' : 'Empezar partido'}
        </button>
      </form>

      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Sesiones recientes
        </h2>
        <div className="mt-3 space-y-3">
          {loadingSessions && (
            <p className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm font-normal text-slate-500">
              Cargando sesiones...
            </p>
          )}
          {!loadingSessions && recentSessions.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm font-normal text-slate-500">
              Aún no hay sesiones registradas.
            </p>
          )}
          {recentSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </section>
    </main>
  )
}
