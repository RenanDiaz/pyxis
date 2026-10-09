// Detección de deploys nuevos (spec 14). El build publica /version.json con la
// misma versión que compila en la app; si difieren, esta pestaña quedó vieja.

/** Versión de este bundle. `dev` en desarrollo (y en tests, sin Vite). */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/** Si la versión publicada indica que esta pestaña corre código viejo. */
export function isOutdated(current: string, deployed: string | null | undefined): boolean {
  if (current === 'dev' || !deployed) return false
  return deployed !== current
}

/** Versión publicada ahora mismo, o `null` si no se pudo consultar (offline, etc.). */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' ? data.version : null
  } catch {
    return null
  }
}
