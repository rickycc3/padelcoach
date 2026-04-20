/** Map stored session.format (Spanish) to translation key path */
export function formatStoredToPath(format) {
  if (format === 'Al mejor de 3') return 'formats.bestOf3'
  if (format === 'Tie-break') return 'formats.tieBreak'
  return null
}

/** Map stored session.deuceType (Spanish) to translation key path */
export function deuceStoredToPath(deuce) {
  if (deuce === 'Ventaja') return 'deuces.advantage'
  if (deuce === 'Punto de oro') return 'deuces.golden'
  return null
}
