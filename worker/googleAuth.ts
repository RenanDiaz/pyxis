import { toBase64Url, utf8 } from './base64url'

// Access token de Google para la service account del Worker (spec 21 fase 2,
// reutilizable por la spec 18): JWT RS256 firmado con WebCrypto e
// intercambiado en oauth2.googleapis.com. Se cachea en memoria del isolate.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'

export interface ServiceAccount {
  clientEmail: string
  /** Clave PEM (PKCS#8). Acepta los `\n` escapados como vienen en el JSON. */
  privateKey: string
}

let cached: { email: string; token: string; expiresAt: number } | null = null

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

export async function signServiceAccountJwt(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = toBase64Url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = toBase64Url(
    utf8(JSON.stringify({ iss: sa.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 })),
  )
  const key = await importPrivateKey(sa.privateKey)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${header}.${claims}`))
  return `${header}.${claims}.${toBase64Url(signature)}`
}

export async function getAccessToken(sa: ServiceAccount, fetcher: typeof fetch = fetch): Promise<string> {
  const now = Date.now()
  // Un minuto de margen para no usar un token a punto de vencer.
  if (cached && cached.email === sa.clientEmail && cached.expiresAt - 60_000 > now) return cached.token
  const assertion = await signServiceAccountJwt(sa, Math.floor(now / 1000))
  const res = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { email: sa.clientEmail, token: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return data.access_token
}
