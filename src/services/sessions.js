import { supabase, supabaseReady } from '../lib/supabase'
import { ensureAlumno } from './alumnos'

const LOCAL_STORAGE_KEY = 'padelcoach-recent-sessions'

function readLocalSessions() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocalSessions(sessions) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions))
}

function mapSessionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    estimatedDuration: row.estimated_duration,
    format: row.format,
    deuceType: row.deuce_type,
    status: row.status,
    coachNotes: row.coach_notes ?? '',
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    notesUpdatedAt: row.notes_updated_at,
  }
}

export async function getRecentSessions() {
  if (!supabaseReady || !supabase) {
    return readLocalSessions()
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) throw error
  return (data ?? []).map(mapSessionFromRow)
}

export async function createSession(payload) {
  const studentName = payload.studentName.trim()
  const sessionPayload = {
    studentName,
    estimatedDuration: payload.estimatedDuration,
    format: payload.format,
    deuceType: payload.deuceType,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  if (!supabaseReady || !supabase) {
    const existing = readLocalSessions()
    const nextSessions = [
      { id: crypto.randomUUID(), ...sessionPayload },
      ...existing,
    ].slice(0, 8)
    writeLocalSessions(nextSessions)
    return nextSessions[0]
  }

  const alumno = await ensureAlumno(studentName)
  const row = {
    student_id: alumno.id,
    student_name: alumno.nombre,
    estimated_duration: payload.estimatedDuration,
    format: payload.format,
    deuce_type: payload.deuceType,
    status: 'pending',
  }

  const { data, error } = await supabase.from('sessions').insert(row).select('*').single()

  if (error) throw error
  return mapSessionFromRow(data)
}

export async function getSessionById(sessionId) {
  if (!supabaseReady || !supabase) {
    const sessions = readLocalSessions()
    return sessions.find((session) => session.id === sessionId) ?? null
  }

  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle()

  if (error) throw error
  return mapSessionFromRow(data)
}

export async function finalizeSession(sessionId) {
  if (!supabaseReady || !supabase) {
    const sessions = readLocalSessions()
    const nextSessions = sessions.map((session) =>
      session.id === sessionId
        ? { ...session, status: 'finished', finishedAt: new Date().toISOString() }
        : session,
    )
    writeLocalSessions(nextSessions)
    return
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw error
}

function sessionDateMs(createdAt) {
  if (!createdAt) return 0
  if (typeof createdAt?.toMillis === 'function') {
    return createdAt.toMillis()
  }
  const parsed = new Date(createdAt).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export async function getPreviousSessionForStudent({
  currentSessionId,
  studentName,
  currentCreatedAt,
}) {
  const sessions = await getRecentSessions()
  const current = sessions.find((s) => s.id === currentSessionId)
  const currentTime = sessionDateMs(current?.createdAt ?? currentCreatedAt) || Date.now()

  const candidates = sessions
    .filter(
      (s) =>
        s.id !== currentSessionId &&
        s.studentName === studentName &&
        s.status === 'finished',
    )
    .filter((s) => sessionDateMs(s.createdAt) < currentTime)
    .sort((a, b) => sessionDateMs(b.createdAt) - sessionDateMs(a.createdAt))

  return candidates[0] ?? null
}

export async function saveSessionCoachNotes(sessionId, notes) {
  if (!supabaseReady || !supabase) {
    const sessions = readLocalSessions()
    const nextSessions = sessions.map((session) =>
      session.id === sessionId ? { ...session, coachNotes: notes } : session,
    )
    writeLocalSessions(nextSessions)
    return
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      coach_notes: notes,
      notes_updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw error
}
