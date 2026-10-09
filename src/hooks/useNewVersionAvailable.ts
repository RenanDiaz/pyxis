import { useCallback, useEffect, useState } from 'react'
import { APP_VERSION, fetchDeployedVersion, isOutdated } from '@/lib/appVersion'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
const SNOOZE_MS = 60 * 60 * 1000

/**
 * Avisa cuando hay un deploy nuevo de Pyxis: consulta /version.json cada 5 min
 * y al volver a la pestaña, y reacciona a chunks que ya no existen
 * (`vite:preloadError`). No recarga solo: eso lo decide el usuario.
 */
export function useNewVersionAvailable() {
  const [deployed, setDeployed] = useState<string | null>(null)
  const [chunkFailed, setChunkFailed] = useState(false)
  const [snoozed, setSnoozed] = useState<{ version: string | null; until: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const check = useCallback(async () => {
    const version = await fetchDeployedVersion()
    setNow(Date.now())
    if (version) setDeployed(version)
  }, [])

  useEffect(() => {
    if (APP_VERSION === 'dev') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    // Un chunk de un deploy anterior ya no existe: la única salida es recargar.
    const onPreloadError = () => setChunkFailed(true)

    const first = setTimeout(check, 0)
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('vite:preloadError', onPreloadError)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('vite:preloadError', onPreloadError)
    }
  }, [check])

  const outdated = chunkFailed || isOutdated(APP_VERSION, deployed)
  // "Más tarde" vale para esta versión durante 1 hora; una versión aún más
  // nueva vuelve a mostrar el aviso.
  const isSnoozed = !!snoozed && snoozed.version === deployed && now < snoozed.until

  return {
    updateAvailable: outdated && !isSnoozed,
    reload: () => window.location.reload(),
    snooze: () => setSnoozed({ version: deployed, until: Date.now() + SNOOZE_MS }),
  }
}
