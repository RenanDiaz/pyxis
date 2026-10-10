import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decodeFields, encodeValue, RestTimestamp, type RestValue } from '../../worker/firestore'
import { getAccessToken, signServiceAccountJwt } from '../../worker/googleAuth'
import { fromBase64Url, utf8 } from '../../worker/base64url'

// Piezas del Worker para hablar con Firestore sin SDK (spec 21 fase 2).

describe('Firestore REST: tipos', () => {
  it('decodifica los tipos que usa la app', () => {
    const fields: Record<string, RestValue> = {
      s: { stringValue: 'pendiente' },
      n: { integerValue: '42' },
      d: { doubleValue: 1.5 },
      b: { booleanValue: true },
      z: { nullValue: null },
      t: { timestampValue: '2026-10-10T15:00:00Z' },
      a: { arrayValue: { values: [{ stringValue: 'x' }] } },
      e: { arrayValue: {} },
      m: { mapValue: { fields: { name: { stringValue: 'Juan' } } } },
    }
    const out = decodeFields(fields)
    assert.equal(out.s, 'pendiente')
    assert.equal(out.n, 42)
    assert.equal(out.d, 1.5)
    assert.equal(out.b, true)
    assert.equal(out.z, null)
    assert.equal((out.t as RestTimestamp).toMillis(), Date.parse('2026-10-10T15:00:00Z'))
    assert.deepEqual(out.a, ['x'])
    assert.deepEqual(out.e, [])
    assert.deepEqual(out.m, { name: 'Juan' })
  })

  it('codifica y vuelve igual', () => {
    const value = { s: 'a', n: 3, d: 0.5, b: false, z: null, arr: ['k1', 'k2'], m: { x: 1 } }
    const encoded = encodeValue(value) as { mapValue: { fields: Record<string, RestValue> } }
    assert.deepEqual(decodeFields(encoded.mapValue.fields), value)
    assert.deepEqual(encodeValue(new RestTimestamp(0)), { timestampValue: '1970-01-01T00:00:00.000Z' })
  })
})

describe('service account de Google', () => {
  async function serviceAccount() {
    const pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')
    // Como viene en el JSON de la service account: `\n` escapados.
    const pem = `-----BEGIN PRIVATE KEY-----\\n${der.match(/.{1,64}/g)!.join('\\n')}\\n-----END PRIVATE KEY-----\\n`
    return { pair, sa: { clientEmail: 'pyxis-worker@demo.iam.gserviceaccount.com', privateKey: pem } }
  }

  it('firma el JWT RS256 con los claims de OAuth', async () => {
    const { pair, sa } = await serviceAccount()
    const jwt = await signServiceAccountJwt(sa, 1000)
    const [h, c, s] = jwt.split('.')
    assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, fromBase64Url(s), utf8(`${h}.${c}`)))
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(c)))
    assert.equal(claims.iss, sa.clientEmail)
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token')
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/datastore')
    assert.equal(claims.exp - claims.iat, 3600)
  })

  it('reutiliza el token mientras no vence', async () => {
    const { sa } = await serviceAccount()
    let calls = 0
    const fetcher = (async () => {
      calls++
      return Response.json({ access_token: `tok${calls}`, expires_in: 3600 })
    }) as unknown as typeof fetch
    assert.equal(await getAccessToken(sa, fetcher), 'tok1')
    assert.equal(await getAccessToken(sa, fetcher), 'tok1')
    assert.equal(calls, 1)
  })
})
