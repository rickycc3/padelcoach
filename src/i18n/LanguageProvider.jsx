import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './languageContext.js'
import { translate } from './translations'

const STORAGE_KEY = 'padelcoach-locale'

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s === 'en' || s === 'es' ? s : 'es'
    } catch {
      return 'es'
    }
  })

  const setLocale = useCallback((next) => {
    if (next !== 'en' && next !== 'es') return
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (path, vars) => {
      return translate(locale, path, vars)
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
