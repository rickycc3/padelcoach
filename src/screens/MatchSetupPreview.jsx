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
    format: 'Al mejor de 3 sets',
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
  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-200 p-4">
      <section className="w-full max-w-[390px] rounded-[2.2rem] border-8 border-slate-900 bg-[#F4F7FB] p-5 shadow-2xl">
        <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-slate-300" />

        <header className="mb-10">
          <p className="text-sm font-normal tracking-wide text-[#185FA5]">PadelCoach</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Configurar partido</h1>
          <p className="mt-2 text-sm font-normal text-slate-500">
            Prepara la sesión y empieza el análisis en tiempo real.
          </p>
        </header>

        <div className="space-y-7">
          <label className="block">
            <span className="mb-2 block text-sm font-normal text-slate-600">Alumno</span>
            <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-normal text-slate-400 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
              Nombre del alumno
            </div>
          </label>

          <div>
            <p className="mb-2 text-sm font-normal text-slate-600">Duración estimada</p>
            <div className="grid grid-cols-3 gap-2">
              <Choice label="60 min" selected={false} />
              <Choice label="90 min" selected />
              <Choice label="120 min" selected={false} />
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-normal text-slate-600">Formato</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Al mejor de 3" selected />
              <Choice label="Tie-break" selected={false} />
            </div>
          </label>

          <div>
            <p className="mb-2 text-sm font-normal text-slate-600">Deuce</p>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Ventaja" selected={false} />
              <Choice label="Punto de oro" selected />
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-medium text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]"
          >
            Empezar partido
          </button>
        </div>

        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            Sesiones recientes
          </h2>
          <div className="mt-3 space-y-3">
            {previewSessions.map((session) => (
              <article
                key={session.id}
                className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]"
              >
                <p className="text-sm font-normal text-slate-500">{session.date}</p>
                <p className="mt-1 text-base font-medium text-slate-900">{session.studentName}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-normal text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {session.estimatedDuration} min
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{session.format}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{session.deuceType}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
