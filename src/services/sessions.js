import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db, firebaseReady } from '../firebase'

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

export async function getRecentSessions() {
  if (!firebaseReady) {
    return readLocalSessions()
  }

  const sessionsRef = collection(db, 'sessions')
  const recentSessionsQuery = query(
    sessionsRef,
    orderBy('createdAt', 'desc'),
    limit(8),
  )
  const snapshot = await getDocs(recentSessionsQuery)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

export async function createSession(payload) {
  const sessionPayload = {
    studentName: payload.studentName.trim(),
    estimatedDuration: payload.estimatedDuration,
    format: payload.format,
    deuceType: payload.deuceType,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  if (!firebaseReady) {
    const existing = readLocalSessions()
    const nextSessions = [{ id: crypto.randomUUID(), ...sessionPayload }, ...existing].slice(0, 8)
    writeLocalSessions(nextSessions)
    return nextSessions[0]
  }

  const docRef = await addDoc(collection(db, 'sessions'), {
    ...sessionPayload,
    createdAt: serverTimestamp(),
  })

  return {
    id: docRef.id,
    ...sessionPayload,
  }
}

export async function getSessionById(sessionId) {
  if (!firebaseReady) {
    const sessions = readLocalSessions()
    return sessions.find((session) => session.id === sessionId) ?? null
  }

  const snapshot = await getDoc(doc(db, 'sessions', sessionId))
  if (!snapshot.exists()) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

export async function finalizeSession(sessionId) {
  if (!firebaseReady) {
    const sessions = readLocalSessions()
    const nextSessions = sessions.map((session) =>
      session.id === sessionId ? { ...session, status: 'finished' } : session,
    )
    writeLocalSessions(nextSessions)
    return
  }

  await updateDoc(doc(db, 'sessions', sessionId), {
    status: 'finished',
    finishedAt: serverTimestamp(),
  })
}
