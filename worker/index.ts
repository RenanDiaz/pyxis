// Worker de Pyxis (spec 17). Los archivos estáticos los sirve Cloudflare sin
// pasar por aquí; este código solo recibe /api/* y /assets/* (`run_worker_first`).

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/** Versión desplegada: la misma que ve el frontend en /version.json (spec 14). */
async function deployedVersion(env: Env, request: Request): Promise<string | null> {
  const res = await env.ASSETS.fetch(new URL('/version.json', request.url))
  if (!res.ok) return null
  const data = (await res.json()) as { version?: unknown }
  return typeof data.version === 'string' ? data.version : null
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ ok: true, version: await deployedVersion(env, request) })
  }
  return json({ error: { code: 'not_found', message_es: 'Ruta no encontrada.' } }, 404)
}

/**
 * Chunks de Vite. Con el fallback SPA, un chunk que ya no existe (pestaña abierta
 * con un build viejo) recibiría index.html y el navegador fallaría al parsearlo
 * como JS. Un 404 dispara `vite:preloadError` y el aviso de nueva versión (spec 14).
 */
async function handleAsset(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request)
  if (res.ok && res.headers.get('Content-Type')?.startsWith('text/html')) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  return res
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url)
    if (url.pathname.startsWith('/assets/')) return handleAsset(request, env)
    // Nunca un 404 propio fuera de /api: rompería los deep links de la SPA.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
