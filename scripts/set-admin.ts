/**
 * Gestiona los admins globales (`admins/{uid}`): el único rol que puede editar
 * la referencia de estados (`states`). La colección no es escribible desde la
 * app; solo con el Admin SDK.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/set-admin.ts --list
 *   npx tsx scripts/set-admin.ts --add correo@empresa.com
 *   npx tsx scripts/set-admin.ts --remove correo@empresa.com
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const serviceAccountPath = resolve(__dirname, 'serviceAccountKey.json')
let serviceAccount: Record<string, string>
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'))
} catch {
  console.error('❌ No se encontró scripts/serviceAccountKey.json')
  console.error('   Descarga la clave desde Firebase Console → Project Settings → Service Accounts')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

const [flag, email] = process.argv.slice(2)

async function main() {
  if (flag === '--list') {
    const snap = await db.collection('admins').get()
    if (snap.empty) console.log('(sin admins)')
    snap.forEach((d) => console.log(`${d.id}\t${d.get('email') ?? ''}`))
    return
  }

  if ((flag !== '--add' && flag !== '--remove') || !email) {
    console.error('Uso: npx tsx scripts/set-admin.ts --list | --add <email> | --remove <email>')
    process.exit(1)
  }

  const user = await auth.getUserByEmail(email)
  const ref = db.collection('admins').doc(user.uid)

  if (flag === '--add') {
    await ref.set({ email: user.email ?? email, added_at: FieldValue.serverTimestamp() })
    console.log(`✅ ${email} (${user.uid}) ahora es admin global`)
  } else {
    await ref.delete()
    console.log(`✅ ${email} (${user.uid}) ya no es admin global`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
