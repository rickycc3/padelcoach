import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  SHOTS,
  createInitialMatchState,
  displayPointScore,
  getCurrentGame,
  progressScore,
  replayMatchState,
} from '../lib/matchScoring'
import { deleteLastMatchAction, getMatchActions, saveMatchAction } from '../services/matchActions'
import { finalizeSession, getSessionById } from '../services/sessions'

const ACTION_RESULTS = [
  { key: 'winner', label: 'Winner' },
  { key: 'errorNoForzado', label: 'Error no forzado' },
  { key: 'errorForzado', label: 'Error forzado' },
]

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default function LiveMatchScreen() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(location.state?.session ?? null)
  const [loadingSession, setLoadingSession] = useState(!location.state?.session)
  const [error, setError] = useState('')
  const [timerStarted, setTimerStarted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [matchState, setMatchState] = useState(createInitialMatchState)
  const [lastAction, setLastAction] = useState(null)
  const [savingAction, setSavingAction] = useState(false)
  const [actionCount, setActionCount] = useState(0)

  useEffect(() => {
    if (session) return

    let mounted = true
    async function loadSession() {
      try {
        const loadedSession = await getSessionById(sessionId)
        if (mounted) {
          setSession(loadedSession)
        }
      } catch {
        if (mounted) {
          setError('No se pudo cargar la sesión de partido.')
        }
      } finally {
        if (mounted) {
          setLoadingSession(false)
        }
      }
    }

    loadSession()
    return () => {
      mounted = false
    }
  }, [session, sessionId])

  useEffect(() => {
    if (!timerStarted || isPaused) return undefined
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isPaused, timerStarted])

  useEffect(() => {
    if (!session?.id) return undefined

    let mounted = true
    async function syncFromStoredActions() {
      try {
        const actions = await getMatchActions(session.id)
        if (!mounted) return
        setActionCount(actions.length)
        setMatchState(replayMatchState(session, actions))
        setLastAction(actions.length ? actions[actions.length - 1] : null)
      } catch {
        if (mounted) {
          setError('No se pudieron cargar las acciones del partido.')
        }
      }
    }

    syncFromStoredActions()
    return () => {
      mounted = false
    }
  }, [session])

  async function registerAction({ shot, result, origin, pointWinner }) {
    if (!session) return
    setSavingAction(true)
    setError('')

    const scoreBeforePoint = {
      set: matchState.currentSet,
      game: getCurrentGame(matchState, session.format),
      point: displayPointScore(matchState, session.deuceType, session.format),
    }

    const action = {
      shot,
      result,
      origin,
      pointWinner,
      minute: Number((elapsedSeconds / 60).toFixed(2)),
      set: scoreBeforePoint.set,
      game: scoreBeforePoint.game,
      score: scoreBeforePoint.point,
    }

    try {
      await saveMatchAction(session.id, action)
      const nextMatchState = progressScore(matchState, pointWinner, session)
      setMatchState(nextMatchState)
      setLastAction(action)
      setActionCount((c) => c + 1)
    } catch {
      setError('No se pudo registrar la acción.')
    } finally {
      setSavingAction(false)
    }
  }

  async function handleUndoLastAction() {
    if (!session || savingAction || actionCount === 0) return
    setSavingAction(true)
    setError('')
    try {
      const actions = await deleteLastMatchAction(session.id)
      setActionCount(actions.length)
      setMatchState(replayMatchState(session, actions))
      setLastAction(actions.length ? actions[actions.length - 1] : null)
    } catch {
      setError('No se pudo deshacer la última acción.')
    } finally {
      setSavingAction(false)
    }
  }

  async function handleFinishMatch() {
    if (!session) return
    try {
      await finalizeSession(session.id)
    } finally {
      navigate(`/resumen/${session.id}`, {
        replace: true,
        state: {
          session,
          matchState,
          elapsedSeconds,
        },
      })
    }
  }

  if (loadingSession) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-5 py-9">
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          Cargando partido...
        </p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-5 py-9">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          Sesión no encontrada.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-5">
      <header className="mb-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3">
        <p className="text-xs font-normal tracking-wide text-[#185FA5]">Partido en vivo</p>
        <h1 className="mt-0.5 text-lg font-medium text-slate-900">{session.studentName}</h1>
        <div className="mt-2 flex justify-center">
          <p className="rounded-lg border-[0.5px] border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
            Set {matchState.currentSet} · Juego {getCurrentGame(matchState, session.format)} ·{' '}
            {displayPointScore(matchState, session.deuceType, session.format)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-2xl font-medium tabular-nums text-slate-900">{formatTime(elapsedSeconds)}</p>
          <button
            type="button"
            onClick={() => {
              setTimerStarted(true)
              setIsPaused(false)
            }}
            disabled={timerStarted}
            className="rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] px-2.5 py-1.5 text-xs font-normal text-[#0C447C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Iniciar
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            disabled={!timerStarted}
            className="rounded-xl border-[0.5px] border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-normal text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaused ? 'Reanudar' : 'Pausar'}
          </button>
        </div>
      </header>

      <section className="mt-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Punto sin acción del alumno
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={savingAction}
            onClick={() =>
              registerAction({
                shot: 'Sin golpe',
                result: 'winner',
                origin: 'punto-directo',
                pointWinner: 'player',
              })
            }
            className="rounded-xl border-[0.5px] border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-700"
          >
            Punto ganado
          </button>
          <button
            type="button"
            disabled={savingAction}
            onClick={() =>
              registerAction({
                shot: 'Sin golpe',
                result: 'errorNoForzado',
                origin: 'punto-directo',
                pointWinner: 'rival',
              })
            }
            className="rounded-xl border-[0.5px] border-slate-200 bg-white px-2 py-2 text-xs font-normal text-slate-700"
          >
            Punto perdido
          </button>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          Golpes del alumno
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SHOTS.map((shot) => (
            <article key={shot} className="rounded-xl border-[0.5px] border-slate-200 bg-slate-50/70 p-2">
              <p className="text-xs font-medium text-slate-800">{shot}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {ACTION_RESULTS.map((result) => (
                  <button
                    key={`${shot}-${result.key}`}
                    type="button"
                    disabled={savingAction}
                    onClick={() =>
                      registerAction({
                        shot,
                        result: result.key,
                        origin: 'golpe',
                        pointWinner: result.key === 'errorNoForzado' ? 'rival' : 'player',
                      })
                    }
                    className="rounded-lg border-[0.5px] border-slate-200 bg-white px-1 py-1.5 text-[10px] font-normal text-slate-700"
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {lastAction && (
        <section className="mt-3 rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#0C447C]">Última acción</p>
          <p className="mt-1 text-xs font-normal text-[#0C447C]">
            {lastAction.shot} - {lastAction.result} - min {lastAction.minute} - set {lastAction.set}, juego{' '}
            {lastAction.game} ({lastAction.score})
          </p>
        </section>
      )}

      {actionCount > 0 && (
        <button
          type="button"
          disabled={savingAction}
          onClick={handleUndoLastAction}
          className="mt-3 flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-400 bg-white px-4 py-4 text-base font-semibold text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition active:scale-[0.99] active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="text-xl leading-none" aria-hidden>
            ↩
          </span>
          Deshacer último golpe
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-xl border-[0.5px] border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleFinishMatch}
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-normal text-white"
      >
        Finalizar partido
      </button>
    </main>
  )
}
