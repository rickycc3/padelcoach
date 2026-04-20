import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n.js'
import { SHOTS } from '../lib/matchScoring'
import { getMatchActions } from '../services/matchActions'
import { getSessionById } from '../services/sessions'

const RESULT_ORDER = ['winner', 'errorNoForzado', 'errorForzado']

function actionTimeMs(action) {
  if (!action?.createdAt) return 0
  if (typeof action.createdAt?.toMillis === 'function') return action.createdAt.toMillis()
  const t = new Date(action.createdAt).getTime()
  return Number.isNaN(t) ? 0 : t
}

function sortActions(actions) {
  return [...actions].sort((a, b) => actionTimeMs(a) - actionTimeMs(b))
}

function buildShotTable(actions) {
  const map = Object.fromEntries(
    SHOTS.map((s) => [s, { winner: 0, errorNoForzado: 0, errorForzado: 0 }]),
  )
  for (const a of actions) {
    if (!SHOTS.includes(a.shot)) continue
    const row = map[a.shot]
    if (a.result === 'winner') row.winner += 1
    else if (a.result === 'errorNoForzado') row.errorNoForzado += 1
    else if (a.result === 'errorForzado') row.errorForzado += 1
  }
  return map
}

function computeSetChangeMinutes(sortedActions) {
  const lines = []
  let prevSet = null
  for (const a of sortedActions) {
    const setNum = Number(a.set)
    if (prevSet !== null && Number.isFinite(setNum) && setNum !== prevSet) {
      const m = Number(a.minute)
      if (Number.isFinite(m)) lines.push({ minute: m, setFrom: prevSet, setTo: setNum })
    }
    if (Number.isFinite(setNum)) prevSet = setNum
  }
  return lines
}

function shotT(t, shot) {
  return t(`shots.${shot}`)
}

function computeInsights(shotMap, sortedActions, axisMaxMinutes, t) {
  const positive = { text: '', detail: '' }
  const improvement = { text: '', detail: '' }

  let bestShot = null
  let bestRate = -1
  let bestTotal = 0
  for (const shot of SHOTS) {
    const r = shotMap[shot]
    const total = r.winner + r.errorNoForzado + r.errorForzado
    if (total < 2) continue
    const rate = r.winner / total
    if (rate > bestRate || (rate === bestRate && total > bestTotal)) {
      bestRate = rate
      bestShot = shot
      bestTotal = total
    }
  }
  if (bestShot) {
    positive.text = t('timeline.insightBestTitle', { shot: shotT(t, bestShot) })
    positive.detail = t('timeline.insightBestDetail', {
      w: shotMap[bestShot].winner,
      total: bestTotal,
      pct: Math.round(bestRate * 100),
    })
  } else {
    positive.text = t('timeline.insightBestEmptyTitle')
    positive.detail = t('timeline.insightBestEmptyDetail')
  }

  let worstShot = null
  let maxLibres = -1
  for (const shot of SHOTS) {
    const e = shotMap[shot].errorNoForzado
    if (e > maxLibres) {
      maxLibres = e
      worstShot = shot
    }
  }

  const libres = sortedActions.filter((a) => a.result === 'errorNoForzado')
  const scanEnd = Math.max(90, Math.ceil(axisMaxMinutes / 15) * 15)
  let windowLabel = ''
  let windowMax = 0
  for (let start = 0; start < scanEnd; start += 15) {
    const end = start + 15
    const c = libres.filter((a) => {
      const m = Number(a.minute)
      return Number.isFinite(m) && m >= start && m < end
    }).length
    if (c > windowMax) {
      windowMax = c
      windowLabel = `${start}–${end} min`
    }
  }

  if (maxLibres > 0 && worstShot) {
    improvement.text = t('timeline.insightTweakTitle', { shot: shotT(t, worstShot) })
    improvement.detail =
      maxLibres === 1
        ? t('timeline.insightTweakDetail', { n: maxLibres })
        : t('timeline.insightTweakDetailPlural', { n: maxLibres })
    if (windowMax >= 2 && windowLabel) {
      improvement.detail += t('timeline.insightTweakWindow', { w: windowMax, window: windowLabel })
    }
  } else if (windowMax >= 3 && windowLabel) {
    improvement.text = t('timeline.insightPatternTitle')
    improvement.detail = t('timeline.insightPatternDetail', { window: windowLabel })
  } else {
    improvement.text = t('timeline.insightConsistencyTitle')
    improvement.detail = t('timeline.insightConsistencyDetail')
  }

  return { positive, improvement }
}

function ScatterChart({
  actions,
  shotFilter,
  xMaxMinutes,
  setLines,
  selected,
  onSelect,
  chartAria,
  yAxisLabels,
}) {
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ w: 320, h: 200 })

  useEffect(() => {
    const el = svgRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const w = Math.max(260, rect.width)
      setDims({ w, h: 200 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filtered = useMemo(() => {
    if (shotFilter === 'all') return actions
    return actions.filter((a) => a.shot === shotFilter)
  }, [actions, shotFilter])

  const padL = 52
  const padR = 12
  const padT = 12
  const padB = 36
  const plotW = dims.w - padL - padR
  const plotH = dims.h - padT - padB
  const xMax = Math.max(1, xMaxMinutes)

  const xAt = (minute) => {
    const m = Number(minute)
    const clamped = Number.isFinite(m) ? Math.min(Math.max(0, m), xMax * 1.02) : 0
    return padL + (clamped / xMax) * plotW
  }

  const yAt = (result) => {
    const idx = RESULT_ORDER.indexOf(result)
    const i = idx >= 0 ? idx : 1
    return padT + ((i + 0.5) / 3) * plotH
  }

  const overlapGroups = new Map()
  const points = filtered.map((a, idx) => {
    const m = Number(a.minute)
    const rounded = Number.isFinite(m) ? Math.round(m * 20) / 20 : 0
    const gKey = `${a.result}-${rounded}`
    const n = overlapGroups.get(gKey) ?? 0
    overlapGroups.set(gKey, n + 1)
    const spread = n * 4
    const rawCx = xAt(a.minute) + spread
    const cx = Math.min(dims.w - padR - 8, Math.max(padL + 8, rawCx))
    return {
      action: a,
      cx,
      cy: yAt(a.result),
      key: a.id ?? `${idx}-${gKey}`,
    }
  })

  const tickCount = 5
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (xMax / tickCount) * i)

  return (
    <div ref={svgRef} className="w-full overflow-hidden">
      <svg
        width={dims.w}
        height={dims.h}
        className="max-w-full touch-manipulation"
        role="img"
        aria-label={chartAria}
      >
        <rect x={0} y={0} width={dims.w} height={dims.h} fill="#F4F7FB" rx={8} />

        {[1, 2].map((k) => (
          <line
            key={`h-${k}`}
            x1={padL}
            y1={padT + (k / 3) * plotH}
            x2={dims.w - padR}
            y2={padT + (k / 3) * plotH}
            stroke="#e2e8f0"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}
        {RESULT_ORDER.map((res, i) => {
          const yMid = padT + ((i + 0.5) / 3) * plotH
          return (
            <text
              key={res}
              x={padL - 6}
              y={yMid + 3}
              textAnchor="end"
              className="fill-slate-500"
              style={{ fontSize: 9 }}
            >
              {yAxisLabels[res]}
            </text>
          )
        })}

        {setLines.map((sl, idx) => {
          const x = xAt(sl.minute)
          return (
            <line
              key={`set-${idx}`}
              x1={x}
              y1={padT}
              x2={x}
              y2={padT + plotH}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )
        })}

        <line
          x1={padL}
          y1={padT + plotH}
          x2={dims.w - padR}
          y2={padT + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1} />

        {ticks.map((tick) => {
          const x = padL + (tick / xMax) * plotW
          return (
            <g key={tick}>
              <line x1={x} y1={padT + plotH} x2={x} y2={padT + plotH + 4} stroke="#94a3b8" strokeWidth={0.75} />
              <text
                x={x}
                y={dims.h - 10}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 9 }}
              >
                {Math.round(tick)}′
              </text>
            </g>
          )
        })}

        {points.map(({ action: a, cx, cy }, idx) => {
          const fill =
            a.result === 'winner'
              ? '#10b981'
              : a.result === 'errorNoForzado'
                ? '#f43f5e'
                : '#f59e0b'
          const isSel = selected === a
          return (
            <circle
              key={a.id ?? `${idx}-${cx}`}
              cx={cx}
              cy={cy}
              r={isSel ? 9 : 7}
              fill={fill}
              stroke={isSel ? '#0f172a' : '#fff'}
              strokeWidth={isSel ? 2 : 1}
              className="cursor-pointer"
              onClick={() => onSelect(isSel ? null : a)}
            />
          )
        })}
      </svg>
    </div>
  )
}

export default function MatchTimelineScreen() {
  const { t } = useI18n()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [actions, setActions] = useState([])
  const [error, setError] = useState('')
  const [shotFilter, setShotFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const yAxisLabels = useMemo(
    () => ({
      winner: t('timeline.legendWinner'),
      errorNoForzado: t('timeline.legendUnforced'),
      errorForzado: t('timeline.legendForced'),
    }),
    [t],
  )

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const s = await getSessionById(sessionId)
        if (!mounted) return
        if (!s) {
          setError(t('timeline.notFound'))
          return
        }
        setSession(s)
        const acts = await getMatchActions(sessionId)
        if (mounted) setActions(sortActions(acts))
      } catch {
        if (mounted) setError(t('timeline.loadError'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch on locale change
  }, [sessionId])

  const shotMap = useMemo(() => buildShotTable(actions), [actions])

  const totals = useMemo(() => {
    let w = 0
    let nf = 0
    let f = 0
    for (const shot of SHOTS) {
      const r = shotMap[shot]
      w += r.winner
      nf += r.errorNoForzado
      f += r.errorForzado
    }
    return { w, nf, f }
  }, [shotMap])

  const xMaxMinutes = useMemo(() => {
    const configured = Number(session?.estimatedDuration) || 90
    const maxFromData = actions.reduce((acc, a) => {
      const m = Number(a.minute)
      return Number.isFinite(m) ? Math.max(acc, m) : acc
    }, 0)
    return Math.max(configured, Math.ceil(maxFromData) + 1, 15)
  }, [session, actions])

  const setLines = useMemo(() => computeSetChangeMinutes(actions), [actions])

  const insights = useMemo(
    () => computeInsights(shotMap, actions, xMaxMinutes, t),
    [shotMap, actions, xMaxMinutes, t],
  )

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-6">
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          {t('timeline.loading')}
        </p>
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-6">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error || t('timeline.notFound')}
        </p>
        <button
          type="button"
          onClick={() => navigate(`/resumen/${sessionId}`)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-normal text-slate-800"
        >
          {t('timeline.backSummary')}
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#F4F7FB] px-4 py-5 pb-10">
      <button
        type="button"
        onClick={() => navigate(`/resumen/${sessionId}`)}
        className="mb-4 flex items-center gap-1 text-xs font-medium text-[#0C447C]"
      >
        <span aria-hidden>←</span> {t('timeline.back')}
      </button>

      <header className="mb-6">
        <p className="text-xs font-normal tracking-wide text-[#185FA5]">{t('timeline.title')}</p>
        <h1 className="mt-0.5 text-xl font-semibold text-slate-900">{session.studentName}</h1>
        <p className="mt-1 text-xs font-normal text-slate-500">
          {t('timeline.actionsMeta', { count: actions.length, min: session.estimatedDuration ?? 90 })}
        </p>
      </header>

      <section className="rounded-2xl border-[0.5px] border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          {t('timeline.analysisTitle')}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 pr-2 font-medium text-slate-600">{t('timeline.colShot')}</th>
                <th className="pb-2 px-1 text-right font-medium text-slate-600">{t('timeline.colWinners')}</th>
                <th className="pb-2 px-1 text-right font-medium text-slate-600">{t('timeline.colUnforced')}</th>
                <th className="pb-2 pl-1 text-right font-medium text-slate-600">{t('timeline.colForced')}</th>
              </tr>
            </thead>
            <tbody>
              {SHOTS.map((shot) => {
                const r = shotMap[shot]
                return (
                  <tr key={shot} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-2 font-medium text-slate-800">{shotT(t, shot)}</td>
                    <td className="py-2 px-1 text-right tabular-nums font-medium text-emerald-600">
                      {r.winner}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums font-medium text-rose-600">
                      {r.errorNoForzado}
                    </td>
                    <td className="py-2 pl-1 text-right tabular-nums font-medium text-amber-600">
                      {r.errorForzado}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t border-slate-300">
                <td className="pt-2.5 pr-2 font-semibold text-slate-900">{t('timeline.total')}</td>
                <td className="pt-2.5 px-1 text-right tabular-nums font-semibold text-emerald-600">
                  {totals.w}
                </td>
                <td className="pt-2.5 px-1 text-right tabular-nums font-semibold text-rose-600">
                  {totals.nf}
                </td>
                <td className="pt-2.5 pl-1 text-right tabular-nums font-semibold text-amber-600">
                  {totals.f}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border-[0.5px] border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{t('timeline.chartTitle')}</h2>
        <p className="mt-1 text-[11px] font-normal text-slate-400">
          {t('timeline.chartHint', { max: xMaxMinutes })}
        </p>

        <label htmlFor="shot-filter" className="mt-3 block text-[11px] font-medium text-slate-600">
          {t('timeline.filterLabel')}
        </label>
        <select
          id="shot-filter"
          value={shotFilter}
          onChange={(e) => {
            setShotFilter(e.target.value)
            setSelected(null)
          }}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#E6F1FB]"
        >
          <option value="all">{t('timeline.allShots')}</option>
          {SHOTS.map((s) => (
            <option key={s} value={s}>
              {shotT(t, s)}
            </option>
          ))}
        </select>

        <div className="mt-4 rounded-xl border border-slate-100 bg-[#F4F7FB] p-2">
          <ScatterChart
            actions={actions}
            shotFilter={shotFilter}
            xMaxMinutes={xMaxMinutes}
            setLines={setLines}
            selected={selected}
            onSelect={setSelected}
            chartAria={t('timeline.chartAria')}
            yAxisLabels={yAxisLabels}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-normal text-slate-500">
          <span>
            <span className="inline-block size-2.5 rounded-full bg-emerald-500 align-middle" />{' '}
            {t('timeline.legendWinner')}
          </span>
          <span>
            <span className="inline-block size-2.5 rounded-full bg-rose-500 align-middle" />{' '}
            {t('timeline.legendUnforced')}
          </span>
          <span>
            <span className="inline-block size-2.5 rounded-full bg-amber-500 align-middle" />{' '}
            {t('timeline.legendForced')}
          </span>
        </div>

        {selected && (
          <div className="mt-4 rounded-xl border-[0.5px] border-[#185FA5] bg-[#E6F1FB] px-3 py-3 text-xs text-[#0C447C]">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#0C447C]/80">
              {t('timeline.selectedTitle')}
            </p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{t('timeline.shot')}</dt>
                <dd className="font-medium text-slate-900">{shotT(t, selected.shot)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{t('timeline.result')}</dt>
                <dd className="font-medium text-slate-900">
                  {yAxisLabels[selected.result] ?? selected.result}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{t('timeline.minute')}</dt>
                <dd className="tabular-nums font-medium text-slate-900">{selected.minute ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{t('timeline.setGame')}</dt>
                <dd className="tabular-nums font-medium text-slate-900">
                  {t('live.set')} {selected.set ?? '—'} · {t('live.game')} {selected.game ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">{t('timeline.score')}</dt>
                <dd className="font-medium text-slate-900">{selected.score ?? '—'}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-3 text-[11px] font-medium text-[#0C447C] underline"
            >
              {t('timeline.closeDetail')}
            </button>
          </div>
        )}
      </section>

      <section className="mt-5 space-y-3">
        <article className="rounded-2xl border-[0.5px] border-emerald-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
            {t('timeline.insightPositive')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{insights.positive.text}</p>
          <p className="mt-1 text-xs font-normal leading-relaxed text-slate-600">{insights.positive.detail}</p>
        </article>
        <article className="rounded-2xl border-[0.5px] border-amber-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-800">
            {t('timeline.insightImprove')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{insights.improvement.text}</p>
          <p className="mt-1 text-xs font-normal leading-relaxed text-slate-600">{insights.improvement.detail}</p>
        </article>
      </section>
    </main>
  )
}
