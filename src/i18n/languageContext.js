import { createContext } from 'react'

/** @type {import('react').Context<null | { locale: 'es' | 'en', setLocale: (l: 'es' | 'en') => void, t: (path: string, vars?: Record<string, string | number>) => string }>} */
export const LanguageContext = createContext(null)
