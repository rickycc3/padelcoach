import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseReady = Boolean(url && anonKey)
export const supabase = supabaseReady ? createClient(url, anonKey) : null
