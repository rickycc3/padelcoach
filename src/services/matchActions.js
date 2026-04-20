import { supabase, supabaseReady } from '../lib/supabase'

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

function sortActionsByTime(actions) {
  return [...actions].sort((a, b) => {
    const ta =
      typeof a.createdAt?.toMillis === 'function'
        ? a.createdAt.toMillis()
        : new Date(a.createdAt ?? 0).getTime()
    const tb =
      typeof b.createdAt?.toMillis === 'function'
        ? b.createdAt.toMillis()
        : new Date(b.createdAt ?? 0).getTime()
    return ta - tb
  })
}

function mapActionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    shot: row.shot,
    result: row.result,
    origin: row.origin,
    pointWinner: row.point_winner,
    minute: row.minute != null ? Number(row.minute) : null,
    set: row.set_index,
    game: row.game_index,
    score: row.score,
    createdAt: row.created_at,
  }
}

export async function getMatchActions(sessionId) {
  if (!supabaseReady || !supabase) {
    return sortActionsByTime(readLocalActions(sessionId))
  }

  const { data, error } = await supabase
    .from('match_actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map(mapActionFromRow)
}

export async function deleteLastMatchAction(sessionId) {
  if (!supabaseReady || !supabase) {
    const sorted = sortActionsByTime(readLocalActions(sessionId))
    if (!sorted.length) return []
    sorted.pop()
    writeLocalActions(sessionId, sorted)
    return sorted
  }

  const { data: rows, error: selectError } = await supabase
    .from('match_actions')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (selectError) throw selectError
  const last = rows?.[0]
  if (!last) return []

  const { error: deleteError } = await supabase.from('match_actions').delete().eq('id', last.id)
  if (deleteError) throw deleteError

  return getMatchActions(sessionId)
}

export async function saveMatchAction(sessionId, actionPayload) {
  const payload = {
    ...actionPayload,
    createdAt: new Date().toISOString(),
  }

  if (!supabaseReady || !supabase) {
    const nextActions = [...readLocalActions(sessionId), payload]
    writeLocalActions(sessionId, nextActions)
    return payload
  }

  const insertRow = {
    session_id: sessionId,
    shot: actionPayload.shot,
    result: actionPayload.result,
    origin: actionPayload.origin,
    point_winner: actionPayload.pointWinner,
    minute: actionPayload.minute,
    set_index: actionPayload.set,
    game_index: actionPayload.game,
    score: actionPayload.score,
  }

  const { data, error } = await supabase.from('match_actions').insert(insertRow).select('*').single()

  if (error) throw error
  return mapActionFromRow(data)
}
