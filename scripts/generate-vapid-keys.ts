/**
 * Genera las claves VAPID de Web Push (spec 21 fase 2).
 *
 * Correr UNA vez y guardar el resultado como secretos del Worker de
 * producción (Cloudflare → pyxis → Settings → Variables & Secrets):
 *   VAPID_PUBLIC_KEY  y  VAPID_PRIVATE_KEY
 *
 * Si se cambian después, los navegadores ya suscritos dejan de recibir avisos
 * hasta que el usuario vuelva a activar "También con Pyxis cerrado".
 *
 * Uso:
 *   npx tsx scripts/generate-vapid-keys.ts
 */

const toBase64Url = (buf: ArrayBuffer) => Buffer.from(buf).toString('base64url')

const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair
const publicKey = toBase64Url(await crypto.subtle.exportKey('raw', keys.publicKey))
const { d } = await crypto.subtle.exportKey('jwk', keys.privateKey)

console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${d}`)
