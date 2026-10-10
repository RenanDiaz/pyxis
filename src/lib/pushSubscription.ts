import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { UserFacingError } from '@/lib/errors'

// Avisos con Pyxis cerrado (spec 21 fase 2), lado del navegador: registra el
// service worker (`public/sw.js`), suscribe el navegador a Web Push con la
// clave VAPID del Worker y guarda la suscripción en
// `users/{uid}/push_subscriptions/{id}`. El cron del Worker la usa para avisar.

export type PushStatus = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Clave pública VAPID; `null` si el Worker no tiene push configurado (o en `vite dev`). */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/config', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { publicKey?: string | null }
    return data.publicKey ?? null
  } catch {
    return null
  }
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function bytesToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Doc ID estable por navegador: hash del endpoint. */
async function subscriptionId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return bytesToBase64Url(hash).slice(0, 32)
}

const subRef = async (fs: Firestore, uid: string, endpoint: string) =>
  doc(fs, 'users', uid, 'push_subscriptions', await subscriptionId(endpoint))

async function browserSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

export async function getPushStatus(fs: Firestore, uid: string): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  if (!(await fetchVapidPublicKey())) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await browserSubscription()
  if (!sub) return 'off'
  // El navegador puede estar suscrito por otro usuario que usó esta computadora.
  const snap = await getDoc(await subRef(fs, uid, sub.endpoint))
  return snap.exists() ? 'on' : 'off'
}

export async function enablePush(fs: Firestore, uid: string): Promise<void> {
  if (!pushSupported()) throw new UserFacingError('Este navegador no puede recibir avisos con Pyxis cerrado.')
  // El permiso primero, mientras el clic todavía cuenta como gesto del usuario.
  if (Notification.permission === 'default') await Notification.requestPermission()
  if (Notification.permission !== 'granted') {
    throw new UserFacingError('El navegador bloqueó las notificaciones. Permítelas en la configuración del sitio.')
  }
  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) throw new UserFacingError('Los avisos con Pyxis cerrado no están configurados.')
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  // Si las claves VAPID cambiaron, la suscripción vieja ya no sirve.
  if (sub && bytesToBase64Url(sub.options.applicationServerKey) !== publicKey) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  await setDoc(await subRef(fs, uid, sub.endpoint), {
    endpoint: sub.endpoint,
    p256dh: bytesToBase64Url(sub.getKey('p256dh')),
    auth: bytesToBase64Url(sub.getKey('auth')),
    // La hora del aviso se muestra en la zona de este navegador.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: serverTimestamp(),
  })
}

/** Deja de avisar a este navegador (al apagar el switch o al cerrar sesión). */
export async function disablePush(fs: Firestore, uid: string): Promise<void> {
  if (!pushSupported()) return
  const sub = await browserSubscription()
  if (!sub) return
  await deleteDoc(await subRef(fs, uid, sub.endpoint))
  await sub.unsubscribe()
}
