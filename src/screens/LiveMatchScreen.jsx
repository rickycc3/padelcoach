import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n.js'
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

const ACTION_RESULT_KEYS = ['winner', 'errorNoForzado', 'errorForzado']

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function shotLabel(t, shot) {
  return t(`shots.${shot}`)
}

export default function LiveMatchScreen() {
  const { t } = useI18n()
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
  const [pendingAction, setPendingAction] = useState(null)

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
          setError(t('live.loadError'))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch on locale change
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
          setError(t('live.actionsLoadError'))
        }
      }
    }

    syncFromStoredActions()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch on locale change
  }, [session])

  /** @returns {Promise<boolean>} */
  async function registerAction({ shot, result, origin, pointWinner }) {
    if (!session) return false
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
      return true
    } catch {
      setError(t('live.registerError'))
      return false
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
      setError(t('live.undoError'))
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

  const lastActionLine = useMemo(() => {
    if (!lastAction) return ''
    const resKey = `live.results.${lastAction.result}`
    const resLabel = t(resKey)
    return `${shotLabel(t, lastAction.shot)} · ${resLabel} · ${t('live.minShort')} ${lastAction.minute} · ${t('live.setAbbr')} ${lastAction.set}, ${t('live.gameAbbr')} ${lastAction.game} (${lastAction.score})`
  }, [lastAction, t])

  const pendingConfirmDetail = useMemo(() => {
    if (!pendingAction) return ''
    const origin = pendingAction.origin
    if (origin === 'companero-punta') return t('live.direct.confirmCompaneroPunta')
    if (origin === 'companero-falla') return t('live.direct.confirmCompaneroFalla')
    if (origin === 'oponentes-punta') return t('live.direct.confirmOponentesPunta')
    if (origin === 'oponentes-falla') return t('live.direct.confirmOponentesFalla')
    if (origin === 'punto-directo') {
      return pendingAction.pointWinner === 'player' ? t('live.pointWon') : t('live.pointLost')
    }
    const resKey = `live.results.${pendingAction.result}`
    return `${shotLabel(t, pendingAction.shot)} — ${t(resKey)}`
  }, [pendingAction, t])

  const pendingConfirmLine = pendingAction ? t('live.confirmLine', { detail: pendingConfirmDetail }) : ''

  function pendingMatches(partial) {
    if (!pendingAction) return false
    return (
      pendingAction.shot === partial.shot &&
      pendingAction.result === partial.result &&
      pendingAction.origin === partial.origin &&
      pendingAction.pointWinner === partial.pointWinner
    )
  }

  async function handleConfirmPending() {
    if (!pendingAction || savingAction) return
    const ok = await registerAction(pendingAction)
    if (ok) setPendingAction(null)
  }

  const shotResultBaseClass =
    'rounded-lg border-[0.5px] px-1 py-1.5 text-[10px] font-normal transition disabled:cursor-not-allowed disabled:opacity-45'
  const shotResultSelectedClass = 'border-[#185FA5] bg-[#E6F1FB] font-medium text-[#0C447C] ring-1 ring-[#185FA5]/40'
  const shotResultIdleClass = 'border-slate-200 bg-white text-slate-700'

  const directPointBaseClass =
    'w-full min-h-[48px] rounded-xl border-[0.5px] px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45'
  const directPointSelectedClass = 'border-[#185FA5] bg-[#E6F1FB] font-medium text-[#0C447C] ring-1 ring-[#185FA5]/40'
  const directPointIdleClass = 'border-slate-200 bg-white text-slate-700'

  if (loadingSession) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-5 py-9">
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          {t('live.loading')}
        </p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-5 py-9">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {t('live.notFound')}
        </p>
      </main>
    )
  }

  return (
    <main
      className={`mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-5 ${pendingAction ? 'pb-36' : ''}`}
    >
      <header className="mb-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-4">
        <p className="text-xs font-normal tracking-wide text-[#185FA5]">{t('live.title')}</p>
        <h1 className="mt-0.5 text-lg font-medium text-slate-900">{session.studentName}</h1>
        <div className="mt-3 flex justify-center">
          <p className="rounded-xl border-[0.5px] border-slate-200 bg-slate-50 px-4 py-2.5 text-base font-semibold tabular-nums leading-snug text-slate-800">
            {t('live.set')} {matchState.currentSet} · {t('live.game')} {getCurrentGame(matchState, session.format)} ·{' '}
            {displayPointScore(matchState, session.deuceType, session.format)}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 shrink text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
            {formatTime(elapsedSeconds)}
          </p>
          <button
            type="button"
            onClick={() => {
              setTimerStarted(true)
              setIsPaused(false)
            }}
            disabled={timerStarted}
            className="shrink-0 rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] px-4 py-2.5 text-sm font-medium text-[#0C447C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('live.start')}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            disabled={!timerStarted}
            className="shrink-0 rounded-xl border-[0.5px] border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaused ? t('live.resume') : t('live.pause')}
          </button>
        </div>
      </header>

      <section
        className="mt-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-4"
        aria-label={t('live.direct.sectionAria')}
      >
        <div className="grid grid-cols-2 gap-5">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-center text-sm font-semibold text-slate-900">{t('live.direct.partnerTitle')}</h2>
            <div className="mt-2.5 flex flex-col gap-2">
              <button
                type="button"
                disabled={savingAction}
                onClick={() =>
                  setPendingAction({
                    shot: 'Sin golpe',
                    result: 'winner',
                    origin: 'companero-punta',
                    pointWinner: 'player',
                  })
                }
                className={`${directPointBaseClass} ${
                  pendingMatches({
                    shot: 'Sin golpe',
                    result: 'winner',
                    origin: 'companero-punta',
                    pointWinner: 'player',
                  })
                    ? directPointSelectedClass
                    : directPointIdleClass
                }`}
              >
                {t('live.direct.scores')}
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={() =>
                  setPendingAction({
                    shot: 'Sin golpe',
                    result: 'errorNoForzado',
                    origin: 'companero-falla',
                    pointWinner: 'rival',
                  })
                }
                className={`${directPointBaseClass} ${
                  pendingMatches({
                    shot: 'Sin golpe',
                    result: 'errorNoForzado',
                    origin: 'companero-falla',
                    pointWinner: 'rival',
                  })
                    ? directPointSelectedClass
                    : directPointIdleClass
                }`}
              >
                {t('live.direct.miss')}
              </button>
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="text-center text-sm font-semibold text-slate-900">{t('live.direct.oppTitle')}</h2>
            <div className="mt-2.5 flex flex-col gap-2">
              <button
                type="button"
                disabled={savingAction}
                onClick={() =>
                  setPendingAction({
                    shot: 'Sin golpe',
                    result: 'errorNoForzado',
                    origin: 'oponentes-punta',
                    pointWinner: 'rival',
                  })
                }
                className={`${directPointBaseClass} ${
                  pendingMatches({
                    shot: 'Sin golpe',
                    result: 'errorNoForzado',
                    origin: 'oponentes-punta',
                    pointWinner: 'rival',
                  })
                    ? directPointSelectedClass
                    : directPointIdleClass
                }`}
              >
                {t('live.direct.scores')}
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={() =>
                  setPendingAction({
                    shot: 'Sin golpe',
                    result: 'winner',
                    origin: 'oponentes-falla',
                    pointWinner: 'player',
                  })
                }
                className={`${directPointBaseClass} ${
                  pendingMatches({
                    shot: 'Sin golpe',
                    result: 'winner',
                    origin: 'oponentes-falla',
                    pointWinner: 'player',
                  })
                    ? directPointSelectedClass
                    : directPointIdleClass
                }`}
              >
                {t('live.direct.miss')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border-[0.5px] border-slate-200 bg-white p-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{t('live.shotsTitle')}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SHOTS.map((shot) => (
            <article key={shot} className="rounded-xl border-[0.5px] border-slate-200 bg-slate-50/70 p-2">
              <p className="text-xs font-medium text-slate-800">{shotLabel(t, shot)}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {ACTION_RESULT_KEYS.map((resultKey) => {
                  const payload = {
                    shot,
                    result: resultKey,
                    origin: 'golpe',
                    pointWinner: resultKey === 'winner' ? 'player' : 'rival',
                  }
                  return (
                    <button
                      key={`${shot}-${resultKey}`}
                      type="button"
                      disabled={savingAction}
                      onClick={() => setPendingAction(payload)}
                      className={`${shotResultBaseClass} ${pendingMatches(payload) ? shotResultSelectedClass : shotResultIdleClass}`}
                    >
                      {t(`live.results.${resultKey}`)}
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      {lastAction && (
        <section className="mt-3 rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#0C447C]">{t('live.lastAction')}</p>
          <p className="mt-1 text-xs font-normal text-[#0C447C]">{lastActionLine}</p>
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
          {t('live.undoLast')}
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
        {t('live.finish')}
      </button>

      {pendingAction && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm"
          role="region"
          aria-label={pendingConfirmLine}
        >
          <div className="mx-auto w-full max-w-md">
            <p className="text-center text-sm font-medium text-slate-900">{pendingConfirmLine}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={savingAction}
                onClick={() => setPendingAction(null)}
                className="min-h-[48px] flex-1 rounded-xl border-[0.5px] border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t('live.cancel')}
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={handleConfirmPending}
                className="min-h-[48px] flex-[1.15] rounded-xl bg-[#185FA5] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t('live.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
