export const SHOTS = [
  'Derecha',
  'Revés',
  'Bandeja',
  'Víbora',
  'Smash',
  'Volea',
  'Globo',
  'Saque',
]

function buildSetSnapshot(state, format) {
  if (format === 'Tie-break') {
    return {
      setNumber: state.currentSet,
      playerGames: state.tieBreakPlayer,
      rivalGames: state.tieBreakRival,
      isTieBreakPoints: true,
    }
  }
  return {
    setNumber: state.currentSet,
    playerGames: state.gamesPlayer,
    rivalGames: state.gamesRival,
    isTieBreakPoints: false,
  }
}

export function createInitialMatchState() {
  return {
    currentSet: 1,
    setsPlayer: 0,
    setsRival: 0,
    gamesPlayer: 0,
    gamesRival: 0,
    playerPoints: 0,
    rivalPoints: 0,
    advantage: null,
    inTieBreak: false,
    tieBreakPlayer: 0,
    tieBreakRival: 0,
    finished: false,
    completedSets: [],
  }
}

export function displayPointScore(state, deuceType, format) {
  if (format === 'Tie-break') {
    return `${state.tieBreakPlayer}/${state.tieBreakRival}`
  }

  if (state.inTieBreak) {
    return `${state.tieBreakPlayer}/${state.tieBreakRival}`
  }

  if (deuceType === 'Ventaja' && state.advantage) {
    return state.advantage === 'player' ? 'Ad/40' : '40/Ad'
  }

  const pointLabels = ['0', '15', '30', '40']
  const playerLabel = pointLabels[Math.min(state.playerPoints, 3)] ?? '40'
  const rivalLabel = pointLabels[Math.min(state.rivalPoints, 3)] ?? '40'
  return `${playerLabel}/${rivalLabel}`
}

export function getCurrentGame(state, format) {
  if (format === 'Tie-break') return 1
  if (state.inTieBreak) return 7
  return state.gamesPlayer + state.gamesRival + 1
}

function winSet(state, winner, format) {
  const snapshot = buildSetSnapshot(state, format)
  const completedSets = [...(state.completedSets ?? []), snapshot]

  const nextState = { ...state, completedSets }
  if (winner === 'player') {
    nextState.setsPlayer += 1
  } else {
    nextState.setsRival += 1
  }

  const targetSets = format === 'Al mejor de 3' ? 2 : 1
  if (nextState.setsPlayer === targetSets || nextState.setsRival === targetSets) {
    nextState.finished = true
    return nextState
  }

  return {
    ...nextState,
    currentSet: nextState.currentSet + 1,
    gamesPlayer: 0,
    gamesRival: 0,
    playerPoints: 0,
    rivalPoints: 0,
    advantage: null,
    inTieBreak: false,
    tieBreakPlayer: 0,
    tieBreakRival: 0,
  }
}

function winGame(state, winner, format) {
  const next = {
    ...state,
    playerPoints: 0,
    rivalPoints: 0,
    advantage: null,
  }

  if (winner === 'player') {
    next.gamesPlayer += 1
  } else {
    next.gamesRival += 1
  }

  if (next.gamesPlayer === 6 && next.gamesRival === 6) {
    return {
      ...next,
      inTieBreak: true,
      tieBreakPlayer: 0,
      tieBreakRival: 0,
    }
  }

  if (next.gamesPlayer >= 6 || next.gamesRival >= 6) {
    const diff = Math.abs(next.gamesPlayer - next.gamesRival)
    if (diff >= 2 || next.gamesPlayer === 7 || next.gamesRival === 7) {
      const setWinner = next.gamesPlayer > next.gamesRival ? 'player' : 'rival'
      return winSet(next, setWinner, format)
    }
  }

  return next
}

export function progressScore(state, pointWinner, config) {
  if (state.finished) return state

  const format = config.format
  const deuceType = config.deuceType

  if (format === 'Tie-break') {
    const next = { ...state }
    if (pointWinner === 'player') {
      next.tieBreakPlayer += 1
    } else {
      next.tieBreakRival += 1
    }
    const diff = Math.abs(next.tieBreakPlayer - next.tieBreakRival)
    if ((next.tieBreakPlayer >= 7 || next.tieBreakRival >= 7) && diff >= 2) {
      const winner = next.tieBreakPlayer > next.tieBreakRival ? 'player' : 'rival'
      return winSet(next, winner, format)
    }
    return next
  }

  if (state.inTieBreak) {
    const next = { ...state }
    if (pointWinner === 'player') {
      next.tieBreakPlayer += 1
    } else {
      next.tieBreakRival += 1
    }

    const diff = Math.abs(next.tieBreakPlayer - next.tieBreakRival)
    if ((next.tieBreakPlayer >= 7 || next.tieBreakRival >= 7) && diff >= 2) {
      const winner = next.tieBreakPlayer > next.tieBreakRival ? 'player' : 'rival'
      const setResult = {
        ...next,
        inTieBreak: false,
        gamesPlayer: winner === 'player' ? 7 : 6,
        gamesRival: winner === 'rival' ? 7 : 6,
      }
      return winSet(setResult, winner, format)
    }
    return next
  }

  const next = { ...state }
  if (pointWinner === 'player') {
    next.playerPoints += 1
  } else {
    next.rivalPoints += 1
  }

  if (deuceType === 'Punto de oro') {
    if (state.playerPoints >= 3 && state.rivalPoints >= 3) {
      return winGame(state, pointWinner, format)
    }
    if (next.playerPoints >= 4 || next.rivalPoints >= 4) {
      const winner = next.playerPoints > next.rivalPoints ? 'player' : 'rival'
      return winGame(next, winner, format)
    }
    return next
  }

  if (state.playerPoints >= 3 && state.rivalPoints >= 3) {
    if (!state.advantage) {
      next.advantage = pointWinner
      next.playerPoints = 3
      next.rivalPoints = 3
      return next
    }

    if (state.advantage === pointWinner) {
      return winGame(state, pointWinner, format)
    }

    return {
      ...next,
      playerPoints: 3,
      rivalPoints: 3,
      advantage: null,
    }
  }

  if (next.playerPoints >= 4 || next.rivalPoints >= 4) {
    const winner = next.playerPoints > next.rivalPoints ? 'player' : 'rival'
    return winGame(next, winner, format)
  }

  return next
}

function actionTimeMs(action) {
  if (!action?.createdAt) return 0
  if (typeof action.createdAt?.toMillis === 'function') {
    return action.createdAt.toMillis()
  }
  const t = new Date(action.createdAt).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function replayMatchState(session, actions) {
  let state = createInitialMatchState()
  const sorted = [...actions].sort((a, b) => actionTimeMs(a) - actionTimeMs(b))
  for (const action of sorted) {
    if (!action?.pointWinner) continue
    state = progressScore(state, action.pointWinner, session)
  }
  return state
}
