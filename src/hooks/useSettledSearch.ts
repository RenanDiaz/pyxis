import { useEffect, useRef } from 'react'

/**
 * Llama a `onSettled` cuando el texto de búsqueda deja de cambiar (800 ms) y no
 * está vacío. Recibe el texto solo para calcular resultados localmente: la
 * analítica (spec 24) nunca debe enviarlo.
 */
export function useSettledSearch(search: string, onSettled: (term: string) => void, delayMs = 800): void {
  const latest = useRef(onSettled)
  useEffect(() => {
    latest.current = onSettled
  })
  useEffect(() => {
    const term = search.trim()
    if (!term) return
    const id = setTimeout(() => latest.current(term), delayMs)
    return () => clearTimeout(id)
  }, [search, delayMs])
}
