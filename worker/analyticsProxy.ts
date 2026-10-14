// Proxy de la analítica de uso (spec 24). La app habla con `mipyxis.com/ingest/*`
// y el Worker lo reenvía a PostHog: mismo dominio (los adblockers no lo cortan) y,
// sobre todo, sin pasarle al proveedor las cookies ni la IP de los agentes.

const INGEST_HOST = 'us.i.posthog.com'
const ASSETS_HOST = 'us-assets.i.posthog.com'

// Se omiten los de la IP real (`cf-connecting-ip`, `x-forwarded-for`…) y las cookies.
const DROPPED_HEADERS = [
  'cookie',
  'set-cookie',
  'authorization',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'true-client-ip',
  'forwarded',
  'host',
]

export function isAnalyticsPath(pathname: string): boolean {
  return pathname === '/ingest' || pathname.startsWith('/ingest/')
}

/** Reenvía la request a PostHog sin cookies ni IP; las redirecciones no se siguen. */
export function proxyAnalytics(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  const path = incoming.pathname.slice('/ingest'.length) || '/'
  const host = path.startsWith('/static/') ? ASSETS_HOST : INGEST_HOST
  const target = new URL(path + incoming.search, `https://${host}`)
  const headers = new Headers(request.headers)
  for (const name of DROPPED_HEADERS) headers.delete(name)
  headers.set('host', host)
  return fetch(
    new Request(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      redirect: 'manual',
      // Node (tests) exige `duplex` con un body en stream; el runtime de Workers lo ignora.
      duplex: 'half',
    } as RequestInit),
  )
}
