import { useEffect, useState } from 'react'

/**
 * Reloj reactivo: devuelve un `Date` que se actualiza cada `intervalMs`.
 * Útil para relojes locales en vivo y semáforos de "buena hora para llamar".
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
