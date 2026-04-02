/**
 * Migration script — moves clients and calls from per-user subcollections
 * to root-level collections with ownership fields.
 *
 * From:  /users/{uid}/clients/{id}  →  /clients/{id}  + owner_uid, team_id
 * From:  /users/{uid}/calls/{id}    →  /calls/{id}    + owner_uid, team_id
 *
 * Prerequisites:
 *   1. Firebase service account key at scripts/serviceAccountKey.json
 *
 * Run:
 *   npx tsx scripts/migrate.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load service account
const serviceAccountPath = resolve(__dirname, 'serviceAccountKey.json')
let serviceAccount: Record<string, string>
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'))
} catch {
  console.error('❌ No se encontró scripts/serviceAccountKey.json')
  console.error('   Descarga la clave desde Firebase Console → Project Settings → Service Accounts')
  process.exit(1)
}

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

async function getAllUserUids(): Promise<string[]> {
  const usersSnap = await db.collection('users').listDocuments()
  const uids = usersSnap.map((doc) => doc.id)

  // Also check for subcollections under UIDs that may not have a user profile doc
  // by listing all documents that have 'clients' or 'calls' subcollections
  const allUids = new Set(uids)

  // Try to discover UIDs from the users path by listing documents
  // that have subcollections even if they don't have a profile doc
  const usersRef = db.collection('users')
  const allUserDocs = await usersRef.listDocuments()
  for (const userDoc of allUserDocs) {
    allUids.add(userDoc.id)
  }

  return Array.from(allUids)
}

async function migrateClients(uid: string): Promise<number> {
  const clientsSnap = await db.collection('users').doc(uid).collection('clients').get()
  if (clientsSnap.empty) return 0

  const batch = db.batch()
  let count = 0

  for (const clientDoc of clientsSnap.docs) {
    const data = clientDoc.data()
    const targetRef = db.collection('clients').doc(clientDoc.id)

    // Check if already migrated
    const existing = await targetRef.get()
    if (existing.exists) {
      console.log(`   ⚠️  Cliente ${clientDoc.id} ya existe en /clients, saltando`)
      continue
    }

    batch.set(targetRef, {
      ...data,
      owner_uid: uid,
      team_id: null,
    })
    count++
  }

  if (count > 0) {
    await batch.commit()
  }
  return count
}

async function migrateCalls(uid: string): Promise<number> {
  const callsSnap = await db.collection('users').doc(uid).collection('calls').get()
  if (callsSnap.empty) return 0

  const batch = db.batch()
  let count = 0

  for (const callDoc of callsSnap.docs) {
    const data = callDoc.data()
    const targetRef = db.collection('calls').doc(callDoc.id)

    // Check if already migrated
    const existing = await targetRef.get()
    if (existing.exists) {
      console.log(`   ⚠️  Llamada ${callDoc.id} ya existe en /calls, saltando`)
      continue
    }

    batch.set(targetRef, {
      ...data,
      owner_uid: uid,
      team_id: null,
    })
    count++
  }

  if (count > 0) {
    await batch.commit()
  }
  return count
}

async function main() {
  console.log('🚀 Iniciando migración de datos...\n')

  const uids = await getAllUserUids()
  console.log(`📋 Encontrados ${uids.length} usuario(s)\n`)

  let totalClients = 0
  let totalCalls = 0

  for (const uid of uids) {
    console.log(`👤 Migrando datos del usuario: ${uid}`)

    const clientCount = await migrateClients(uid)
    totalClients += clientCount
    console.log(`   ✅ ${clientCount} cliente(s) migrados`)

    const callCount = await migrateCalls(uid)
    totalCalls += callCount
    console.log(`   ✅ ${callCount} llamada(s) migradas`)
  }

  console.log(`\n✅ Migración completada:`)
  console.log(`   - ${totalClients} clientes migrados a /clients`)
  console.log(`   - ${totalCalls} llamadas migradas a /calls`)
  console.log(`\n⚠️  Los documentos originales en /users/{uid}/clients y /users/{uid}/calls`)
  console.log(`   NO fueron eliminados. Verifica que la migración sea correcta antes de borrarlos.`)
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
