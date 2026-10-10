import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { concatBytes, fromBase64Url, toBase64Url, utf8 } from '../../worker/base64url'
import { encryptPayload, isAllowedPushEndpoint, sendWebPush, vapidAuthorization } from '../../worker/webPush'

// Web Push del Worker (spec 21 fase 2). El cifrado se verificó además contra
// `http_ece` (la librería de `web-push`); aquí, el navegador simulado lo descifra.

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** Lo que hace el navegador al recibir el push (RFC 8291 / 8188). */
async function browserDecrypt(body: Uint8Array<ArrayBuffer>, uaKeys: CryptoKeyPair, authSecret: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey))
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concatBytes(utf8('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  assert.equal(plain[plain.length - 1], 2, 'delimitador de último registro')
  return { rs, idlen, text: new TextDecoder().decode(plain.slice(0, -1)) }
}

async function browserSubscription() {
  const uaKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  const p256dh = toBase64Url(await crypto.subtle.exportKey('raw', uaKeys.publicKey))
  return { uaKeys, authSecret, keys: { p256dh, auth: toBase64Url(authSecret) } }
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const publicKey = toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey))
  const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { pair, vapid: { publicKey, privateKey: d!, subject: 'mailto:soporte@mipyxis.com' } }
}

describe('Web Push (spec 21 fase 2)', () => {
  it('el navegador descifra el mensaje (aes128gcm, un registro)', async () => {
    const { uaKeys, authSecret, keys } = await browserSubscription()
    const message = JSON.stringify({ title: 'Es la hora: llamada con José Núñez', tag: 'c1:now:1' })
    const body = await encryptPayload(utf8(message), keys)
    const out = await browserDecrypt(body, uaKeys, authSecret)
    assert.equal(out.text, message)
    assert.equal(out.rs, 4096)
    assert.equal(out.idlen, 65)
  })

  it('cada envío usa salt y clave efímera nuevas', async () => {
    const { keys } = await browserSubscription()
    const a = await encryptPayload(utf8('x'), keys)
    const b = await encryptPayload(utf8('x'), keys)
    assert.notDeepEqual(a.slice(0, 86), b.slice(0, 86))
  })

  it('el JWT de VAPID está firmado con la clave privada y apunta al origen del servicio', async () => {
    const { pair, vapid } = await vapidKeys()
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, 1_000_000)
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
    assert.equal(k, vapid.publicKey)
    const [h, c, s] = jwt.split('.')
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      fromBase64Url(s),
      utf8(`${h}.${c}`),
    )
    assert.ok(ok)
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(c)))
    assert.deepEqual(claims, { aud: 'https://fcm.googleapis.com', exp: 1_000_000 + 12 * 3600, sub: vapid.subject })
  })

  it('solo envía a servicios de push conocidos', async () => {
    assert.ok(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'))
    assert.ok(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'))
    assert.ok(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x'))
    assert.ok(isAllowedPushEndpoint('https://web.push.apple.com/abc'))
    assert.ok(!isAllowedPushEndpoint('https://evil.example.com/fcm.googleapis.com'))
    assert.ok(!isAllowedPushEndpoint('http://fcm.googleapis.com/x'))
    assert.ok(!isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x'))

    const { keys } = await browserSubscription()
    const { vapid } = await vapidKeys()
    await assert.rejects(sendWebPush({ endpoint: 'https://evil.example.com/x', ...keys }, '{}', vapid, { ttl: 60 }))
  })

  it('manda los headers que piden los servicios de push', async () => {
    const { keys } = await browserSubscription()
    const { vapid } = await vapidKeys()
    let seen: RequestInit | undefined
    const status = await sendWebPush(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', ...keys },
      '{"title":"x"}',
      vapid,
      { ttl: 300 },
      (async (_url: string, init: RequestInit) => {
        seen = init
        return new Response(null, { status: 201 })
      }) as typeof fetch,
    )
    assert.equal(status, 201)
    const headers = seen!.headers as Record<string, string>
    assert.equal(headers['Content-Encoding'], 'aes128gcm')
    assert.equal(headers.TTL, '300')
    assert.equal(headers.Urgency, 'high')
    assert.match(headers.Authorization, /^vapid t=.+, k=/)
  })
})
