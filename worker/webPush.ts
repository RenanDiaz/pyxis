import { concatBytes, fromBase64Url, toBase64Url, utf8 } from './base64url'

// Web Push sin dependencias (spec 21 fase 2), con WebCrypto:
// - cifrado del mensaje: RFC 8291 (Message Encryption for Web Push) sobre
//   RFC 8188 (`aes128gcm`);
// - autenticación del servidor: VAPID, RFC 8292 (JWT ES256).

export interface PushSubscriptionKeys {
  endpoint: string
  /** Clave pública P-256 del navegador (base64url, 65 bytes sin comprimir). */
  p256dh: string
  /** Secreto de autenticación del navegador (base64url, 16 bytes). */
  auth: string
}

export interface VapidKeys {
  /** base64url, 65 bytes sin comprimir: la misma que usa `pushManager.subscribe`. */
  publicKey: string
  /** base64url, 32 bytes (`d`). */
  privateKey: string
  /** Contacto para el servicio de push (`mailto:` o `https:`). */
  subject: string
}

/** Servicios de push de los navegadores: el Worker no envía a ningún otro host. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

/** Tamaño de registro de RFC 8188; el mensaje cabe en uno solo. */
const RECORD_SIZE = 4096

/**
 * Cifra `payload` para una suscripción (un solo registro `aes128gcm`).
 * `salt` y `serverKeys` solo se pasan en tests, para reproducir vectores.
 */
export async function encryptPayload(
  payload: Uint8Array,
  sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  testing: { salt?: Uint8Array<ArrayBuffer>; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error('Mensaje de push demasiado largo')
  const uaPublic = fromBase64Url(sub.p256dh)
  const authSecret = fromBase64Url(sub.auth)
  const serverKeys =
    testing.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', serverKeys.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(
    // El runtime lee `public`; los tipos de Workers lo llaman `$public`.
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0],
      serverKeys.privateKey,
      256,
    ),
  )

  // RFC 8291 §3.4: IKM a partir del secreto ECDH y el auth secret.
  const ikm = await hkdf(authSecret, ecdhSecret, concatBytes(utf8('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = testing.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  // Delimitador 0x02: último (y único) registro, sin relleno.
  const plaintext = concatBytes(payload, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext))

  // Encabezado RFC 8188: salt (16) · rs (4, big endian) · idlen (1) · keyid (clave pública del servidor).
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE)
  return concatBytes(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

async function importVapidPrivateKey(vapid: VapidKeys): Promise<CryptoKey> {
  const pub = fromBase64Url(vapid.publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(pub.slice(1, 33)),
    y: toBase64Url(pub.slice(33, 65)),
    d: vapid.privateKey,
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

/** Header `Authorization` de VAPID para el origen del servicio de push. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSec: number): Promise<string> {
  const header = toBase64Url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toBase64Url(
    utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: vapid.subject })),
  )
  const key = await importVapidPrivateKey(vapid)
  // WebCrypto devuelve r||s (64 bytes), que es justo el formato de JWS.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`))
  return `vapid t=${header}.${claims}.${toBase64Url(signature)}, k=${vapid.publicKey}`
}

export interface SendOptions {
  /** Segundos que el servicio guarda el mensaje si el navegador está apagado. */
  ttl: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

/**
 * Envía un push. Devuelve el status HTTP: 201 = aceptado; 404/410 = la
 * suscripción ya no existe y hay que borrarla.
 */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  vapid: VapidKeys,
  opts: SendOptions,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  if (!isAllowedPushEndpoint(sub.endpoint)) throw new Error(`Endpoint de push no permitido: ${sub.endpoint}`)
  const body = await encryptPayload(utf8(payload), sub)
  const res = await fetcher(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid, Math.floor(Date.now() / 1000)),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl),
      Urgency: opts.urgency ?? 'high',
    },
    body,
  })
  return res.status
}
