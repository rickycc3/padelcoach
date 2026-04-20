import { useI18n } from '../i18n/useI18n.js'
import { deuceStoredToPath, formatStoredToPath } from '../i18n/display'

const previewSessions = [
  {
    id: '1',
    date: '19/04/26, 18:40',
    studentName: 'Lucia Martinez',
    estimatedDuration: 90,
    format: 'Al mejor de 3',
    deuceType: 'Punto de oro',
  },
  {
    id: '2',
    date: '17/04/26, 20:05',
    studentName: 'Carlos Vidal',
    estimatedDuration: 120,
    format: 'Tie-break',
    deuceType: 'Punto de oro',
  },
  {
    id: '3',
    date: '14/04/26, 19:15',
    studentName: 'Marta Soria',
    estimatedDuration: 60,
    format: 'Al mejor de 3',
    deuceType: 'Ventaja',
  },
]

function Choice({ label, selected }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 text-center text-sm font-medium ${
        selected
          ? 'border-[#185FA5] bg-[#E6F1FB] text-[#0C447C] shadow-[0_2px_8px_rgba(24,95,165,0.14)]'
          : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      {label}
    </div>
  )
}

export default function MatchSetupPreview() {
  const { t, locale, setLocale } = useI18n()

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-200 p-4">
      <section className="w-full max-w-[390px] rounded-[2.2rem] border-8 border-slate-900 bg-[#F4F7FB] p-5 shadow-2xl">
        <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-slate-300" />

        <header className="mb-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-normal tracking-wide text-[#185FA5]">{t('setup.brand')}</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{t('setup.title')}</h1>
              <p className="mt-2 text-sm font-normal text-slate-500">{t('setup.subtitle')}</p>
            </div>
            <div className="flex shrink-0 gap-0.5 rounded-2xl border border-slate-200/90 bg-white p-0.5 shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
              <button
                type="button"
                onClick={() => setLocale('es')}
                className={`rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${
                  locale === 'es'
                    ? 'bg-[#E6F1FB] text-[#0C447C]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                🇪🇸 {t('setup.langEs')}
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${
                  locale === 'en'
                    ? 'bg-[#E6F1FB] text-[#0C447C]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                🇬🇧 {t('setup.langEn')}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-7">
          <label className="block">
            <span className="mb-2 block text-sm font-normal text-slate-600">{t('setup.student')}</span>
            <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-normal text-slate-400 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
              {t('setup.studentPlaceholder')}
            </div>
          </label>

          <div>
            <p className="mb-2 text-sm font-normal text-slate-600">{t('setup.duration')}</p>
            <div className="grid grid-cols-3 gap-2">
              <Choice label={`60 ${t('setup.min')}`} selected={false} />
              <Choice label={`90 ${t('setup.min')}`} selected />
              <Choice label={`120 ${t('setup.min')}`} selected={false} />
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-normal text-slate-600">{t('setup.format')}</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice label={t('formats.bestOf3')} selected />
              <Choice label={t('formats.tieBreak')} selected={false} />
            </div>
          </label>

          <div>
            <p className="mb-2 text-sm font-normal text-slate-600">{t('setup.deuce')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Choice label={t('deuces.advantage')} selected={false} />
              <Choice label={t('deuces.golden')} selected />
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-medium text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]"
          >
            {t('setup.startMatch')}
          </button>
        </div>

        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {t('setup.recentSessions')}
          </h2>
          <div className="mt-3 space-y-3">
            {previewSessions.map((session) => {
              const formatLabel = formatStoredToPath(session.format)
                ? t(formatStoredToPath(session.format))
                : session.format
              const deuceLabel = deuceStoredToPath(session.deuceType)
                ? t(deuceStoredToPath(session.deuceType))
                : session.deuceType
              return (
                <article
                  key={session.id}
                  className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-sm font-normal text-slate-500">{session.date}</p>
                  <p className="mt-1 text-base font-medium text-slate-900">{session.studentName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-normal text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {session.estimatedDuration} {t('setup.min')}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{formatLabel}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{deuceLabel}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}
