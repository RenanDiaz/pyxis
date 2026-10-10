// Worker de Pyxis (spec 17). Los archivos estáticos los sirve Cloudflare sin
// pasar por aquí; este código solo recibe /api/* y /assets/* (`run_worker_first`)
// y el cron de los avisos de llamadas (spec 21 fase 2).

import { FirestoreRest } from './firestore'
import { getAccessToken } from './googleAuth'
import { runPushReminders } from './pushReminders'
import { VAPID_SUBJECT, type WorkerEnv } from './secrets'
import { sendWebPush } from './webPush'

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

async function handleApi(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ ok: true, version: await deployedVersion(env, request) })
  }
  // Clave pública VAPID para `pushManager.subscribe` (spec 21 fase 2). Sin
  // los secretos de push configurados, la app no ofrece la opción.
  if (url.pathname === '/api/push/config' && request.method === 'GET') {
    return json({ publicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : null })
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

function pushConfigured(env: WorkerEnv): boolean {
  return Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_SA_CLIENT_EMAIL &&
      env.FIREBASE_SA_PRIVATE_KEY &&
      env.VAPID_PUBLIC_KEY &&
      env.VAPID_PRIVATE_KEY,
  )
}

/** Cron cada minuto (wrangler.jsonc, solo producción): avisos con Pyxis cerrado. */
async function sendCallReminders(env: WorkerEnv): Promise<void> {
  if (!pushConfigured(env)) return
  const sa = { clientEmail: env.FIREBASE_SA_CLIENT_EMAIL!, privateKey: env.FIREBASE_SA_PRIVATE_KEY! }
  const fs = new FirestoreRest({ projectId: env.FIREBASE_PROJECT_ID!, getToken: () => getAccessToken(sa) })
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: VAPID_SUBJECT }
  const summary = await runPushReminders({
    fs,
    send: (sub, payload, opts) => sendWebPush(sub, payload, vapid, opts),
    now: Date.now(),
  })
  if (summary.due > 0) console.log('avisos de llamadas', JSON.stringify(summary))
}

export default {
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(sendCallReminders(env))
  },

  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url)
    if (url.pathname.startsWith('/assets/')) return handleAsset(request, env)
    // Nunca un 404 propio fuera de /api: rompería los deep links de la SPA.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>
