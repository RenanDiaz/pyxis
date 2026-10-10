/**
 * Alta de workspaces (spec 22). Desde la app nadie puede crear un workspace:
 * lo crea un admin con este script y el resto del equipo entra por invitación.
 *
 * El owner tiene que haber iniciado sesión al menos una vez en la app (para
 * que exista en Firebase Auth y en `users/{uid}`) y no pertenecer a otro
 * workspace.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/create-workspace.ts --name "Mi Empresa" --owner owner@empresa.com [--dry-run]
 *   npx tsx scripts/create-workspace.ts --list
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, type Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_URL = 'https://mipyxis.com'

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

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const USAGE =
  'Uso: npx tsx scripts/create-workspace.ts --name "<nombre>" --owner <email> [--dry-run]\n' +
  '     npx tsx scripts/create-workspace.ts --list'

function formatDate(ts: Timestamp | undefined): string {
  return ts ? ts.toDate().toISOString().slice(0, 10) : '?'
}

async function list() {
  const workspaces = await db.collection('workspaces').orderBy('created_at', 'asc').get()
  if (workspaces.empty) {
    console.log('(sin workspaces)')
    return
  }
  for (const ws of workspaces.docs) {
    const ownerUid = ws.get('owner_uid') as string | undefined
    const [owner, members] = await Promise.all([
      ownerUid ? db.collection('users').doc(ownerUid).get() : null,
      ws.ref.collection('members').count().get(),
    ])
    console.log(
      [
        ws.id,
        ws.get('name') ?? '(sin nombre)',
        owner?.get('email') ?? `owner ${ownerUid ?? '?'}`,
        `${members.data().count} miembros`,
        `creado ${formatDate(ws.get('created_at'))}`,
      ].join('\t'),
    )
  }
  console.log(`\n${workspaces.size} workspaces.`)
}

async function create(name: string, email: string, dryRun: boolean) {
  let authUser
  try {
    authUser = await auth.getUserByEmail(email)
  } catch {
    throw new Error(
      `${email} no existe en Firebase Auth. Pídele que inicie sesión una vez en ${APP_URL} y vuelve a correr el script.`,
    )
  }
  const uid = authUser.uid
  const userRef = db.collection('users').doc(uid)
  const wsRef = db.collection('workspaces').doc()

  await db.runTransaction(async (tx) => {
    const user = await tx.get(userRef)
    if (!user.exists) {
      throw new Error(
        `${email} no tiene perfil (users/${uid}). Pídele que inicie sesión una vez en ${APP_URL} y vuelve a correr el script.`,
      )
    }
    const current = user.get('workspace_id')
    if (current) {
      throw new Error(`${email} ya pertenece al workspace ${current}. Cada usuario pertenece a un solo workspace.`)
    }

    const displayName = (user.get('display_name') as string | undefined) || authUser.displayName || email
    console.log(`${dryRun ? '[dry-run] ' : ''}Workspace "${name}" (${wsRef.id})`)
    console.log(`  owner: ${displayName} <${email}> (${uid})`)
    if (dryRun) return

    tx.set(wsRef, { name, owner_uid: uid, created_at: FieldValue.serverTimestamp() })
    tx.set(wsRef.collection('members').doc(uid), {
      uid,
      display_name: displayName,
      email: authUser.email ?? email,
      role: 'owner',
      subteam_id: null,
      joined_at: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, { workspace_id: wsRef.id })
  })

  if (!dryRun) console.log(`✅ Listo. Al recargar ${APP_URL}, ${email} entra a su workspace como owner.`)
}

async function main() {
  if (flag('--list')) return list()

  const name = option('--name')?.trim()
  const email = option('--owner')?.trim()
  if (!name || !email) {
    console.error(USAGE)
    process.exit(1)
  }
  await create(name, email, flag('--dry-run'))
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
