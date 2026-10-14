// Analítica (spec 24): las URLs con ids reales (`/clientes/abc123`) identifican a
// un cliente, así que a PostHog solo llega el patrón de la ruta.

/** Patrones de las rutas de `App.tsx`, de lo más específico a lo más general. */
const ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/clientes\/nuevo$/, '/clientes/nuevo'],
  [/^\/clientes\/[^/]+\/editar$/, '/clientes/:id/editar'],
  [/^\/clientes\/[^/]+$/, '/clientes/:id'],
  [/^\/estados\/[^/]+$/, '/estados/:abbreviation'],
]

/** Patrón de una ruta; las rutas fijas (`/agenda`, `/workspace/miembros`…) quedan igual. */
export function routePattern(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const [re, pattern] of ROUTE_PATTERNS) if (re.test(clean)) return pattern
  return clean || '/'
}

/** `url` con el patrón en lugar del path, sin query ni hash; lo que no sea URL queda igual. */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${routePattern(u.pathname)}`
  } catch {
    return url
  }
}
