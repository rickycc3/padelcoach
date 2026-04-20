import { supabase, supabaseReady } from '../lib/supabase'

/**
 * Busca o crea un alumno por nombre exacto (trim).
 * @returns {{ id: string, nombre: string }}
 */
export async function ensureAlumno(nombre) {
  if (!supabaseReady || !supabase) {
    throw new Error('Supabase no está configurado')
  }

  const name = nombre.trim()
  const { data: found, error: findError } = await supabase
    .from('alumnos')
    .select('id, nombre')
    .eq('nombre', name)
    .maybeSingle()

  if (findError) throw findError
  if (found) return found

  const { data: created, error: insertError } = await supabase
    .from('alumnos')
    .insert({ nombre: name })
    .select('id, nombre')
    .single()

  if (insertError) throw insertError
  return created
}
