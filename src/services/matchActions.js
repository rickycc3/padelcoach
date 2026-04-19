import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, firebaseReady } from '../firebase'

function getLocalActionsKey(sessionId) {
  return `padelcoach-actions-${sessionId}`
}

function readLocalActions(sessionId) {
  try {
    const raw = localStorage.getItem(getLocalActionsKey(sessionId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocalActions(sessionId, actions) {
  localStorage.setItem(getLocalActionsKey(sessionId), JSON.stringify(actions))
}

export async function saveMatchAction(sessionId, actionPayload) {
  const payload = {
    ...actionPayload,
    createdAt: new Date().toISOString(),
  }

  if (!firebaseReady) {
    const nextActions = [...readLocalActions(sessionId), payload]
    writeLocalActions(sessionId, nextActions)
    return payload
  }

  await addDoc(collection(db, 'sessions', sessionId, 'actions'), {
    ...payload,
    createdAt: serverTimestamp(),
  })

  return payload
}
