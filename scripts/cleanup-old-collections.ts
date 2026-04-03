/**
 * Cleanup script — removes old collections and fields after verifying
 * the workspace migration was successful.
 *
 * Deletes:
 *   /teams/{teamId}
 *   /clients/{clientId}
 *   /calls/{callId}
 *   /goals/{goalId}
 *   Fields role, team_id, team_ids from /users/{uid}
 *
 * Prerequisites:
 *   1. Firebase service account key at scripts/serviceAccountKey.json
 *   2. Run migrate-to-workspaces.ts first and verify data in Firebase Console
 *
 * Run:
 *   npx tsx scripts/cleanup-old-collections.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load service account
const serviceAccountPath = resolve(__dirname, 'serviceAccountKey.json')
let serviceAccount: Record<string, string>
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'))
} catch {
  console.error('❌ No se encontró scripts/serviceAccountKey.json')
  process.exit(1)
}

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

// ---------------------------------------------------------------------------
// Confirmation prompt
// ---------------------------------------------------------------------------
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer.trim() === 'SI')
    })
  })
}

// ---------------------------------------------------------------------------
// Delete all documents in a collection
// ---------------------------------------------------------------------------
async function deleteCollection(collectionPath: string): Promise<number> {
  const snap = await db.collection(collectionPath).get()
  if (snap.empty) return 0

  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0
  let total = 0

  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    batchCount++
    total++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) {
    await batch.commit()
  }

  return total
}

// ---------------------------------------------------------------------------
// Clean up user profiles (remove old fields)
// ---------------------------------------------------------------------------
async function cleanUserProfiles(): Promise<number> {
  const usersSnap = await db.collection('users').get()
  if (usersSnap.empty) return 0

  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0
  let total = 0

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data()
    const hasOldFields = data.role || data.team_id !== undefined || data.team_ids

    if (!hasOldFields) continue

    batch.update(userDoc.ref, {
      role: FieldValue.delete(),
      team_id: FieldValue.delete(),
      team_ids: FieldValue.delete(),
    })
    batchCount++
    total++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) {
    await batch.commit()
  }

  return total
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🧹 Limpieza de colecciones antiguas\n')
  console.log('⚠️  ADVERTENCIA: Esta operación eliminará las siguientes colecciones:')
  console.log('   /teams, /clients, /calls, /goals')
  console.log('   Y los campos role, team_id, team_ids de /users/{uid}\n')

  // Show counts
  const teamCount = (await db.collection('teams').get()).size
  const clientCount = (await db.collection('clients').get()).size
  const callCount = (await db.collection('calls').get()).size
  const goalCount = (await db.collection('goals').get()).size

  console.log(`   Teams:    ${teamCount} documento(s)`)
  console.log(`   Clients:  ${clientCount} documento(s)`)
  console.log(`   Calls:    ${callCount} documento(s)`)
  console.log(`   Goals:    ${goalCount} documento(s)\n`)

  const confirmed = await confirm(
    '¿Confirmas que verificaste los datos migrados? (escribe SI para continuar): '
  )

  if (!confirmed) {
    console.log('\n❌ Operación cancelada.')
    process.exit(0)
  }

  console.log('\n🗑️  Eliminando colecciones...\n')

  const deletedTeams = await deleteCollection('teams')
  console.log(`   ✅ /teams: ${deletedTeams} documento(s) eliminados`)

  const deletedClients = await deleteCollection('clients')
  console.log(`   ✅ /clients: ${deletedClients} documento(s) eliminados`)

  const deletedCalls = await deleteCollection('calls')
  console.log(`   ✅ /calls: ${deletedCalls} documento(s) eliminados`)

  const deletedGoals = await deleteCollection('goals')
  console.log(`   ✅ /goals: ${deletedGoals} documento(s) eliminados`)

  console.log('\n🧹 Limpiando campos obsoletos de /users/...')
  const cleanedUsers = await cleanUserProfiles()
  console.log(`   ✅ ${cleanedUsers} perfil(es) actualizados\n`)

  console.log('═'.repeat(50))
  console.log('✅ Limpieza completada.')
  console.log('═'.repeat(50))
}

main().catch((err) => {
  console.error('❌ Error en limpieza:', err)
  process.exit(1)
})
