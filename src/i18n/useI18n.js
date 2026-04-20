import { useContext } from 'react'
import { LanguageContext } from './languageContext.js'

/** @returns {{ locale: 'es' | 'en', setLocale: (l: 'es' | 'en') => void, t: (path: string, vars?: Record<string, string | number>) => string }} */
export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useI18n must be used within LanguageProvider')
  }
  return ctx
}
