/**
 * Migration script — moves data from flat root collections
 * to the new workspace-based structure.
 *
 * From:
 *   /teams/{teamId}              → /workspaces/{teamId}
 *   /users/{uid}                 → /workspaces/{wId}/members/{uid} + slim /users/{uid}
 *   /clients/{clientId}          → /workspaces/{wId}/clients/{clientId}
 *   /calls/{callId}              → /workspaces/{wId}/calls/{callId}
 *   /goals/{goalId}              → /workspaces/{wId}/goals/{goalId}
 *
 * Does NOT modify or delete originals. Run cleanup separately.
 *
 * Prerequisites:
 *   1. Firebase service account key at scripts/serviceAccountKey.json
 *
 * Run:
 *   npx tsx scripts/migrate-to-workspaces.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
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

// ---------------------------------------------------------------------------
// Counters for summary
// ---------------------------------------------------------------------------
const summary = {
  workspaceId: '',
  workspaceName: '',
  membersTotal: 0,
  membersMigrated: 0,
  clientsTotal: 0,
  clientsMigrated: 0,
  callsTotal: 0,
  callsMigrated: 0,
  goalsTotal: 0,
  goalsMigrated: 0,
  errors: [] as string[],
}

// ---------------------------------------------------------------------------
// Step 1 — Create workspace from the single team document
// ---------------------------------------------------------------------------
async function createWorkspace(): Promise<string> {
  const teamsSnap = await db.collection('teams').get()

  if (teamsSnap.empty) {
    throw new Error('No se encontró ningún documento en /teams')
  }

  if (teamsSnap.size > 1) {
    console.warn(`⚠️  Se encontraron ${teamsSnap.size} equipos. Se usará el primero.`)
  }

  const teamDoc = teamsSnap.docs[0]
  const team = teamDoc.data()
  const workspaceId = teamDoc.id

  const workspaceRef = db.collection('workspaces').doc(workspaceId)
  const existing = await workspaceRef.get()

  if (existing.exists) {
    console.log(`   ⚠️  Workspace ${workspaceId} ya existe, saltando creación`)
  } else {
    await workspaceRef.set({
      name: team.name ?? 'Workspace',
      owner_uid: team.supervisor_uid ?? team.created_by ?? null,
      created_at: team.created_at ?? Timestamp.now(),
    })
  }

  summary.workspaceId = workspaceId
  summary.workspaceName = team.name ?? 'Workspace'
  console.log(`✅ Workspace creado: ${workspaceId} — ${summary.workspaceName}\n`)

  return workspaceId
}

// ---------------------------------------------------------------------------
// Step 2 — Migrate members
// ---------------------------------------------------------------------------
async function migrateMembers(workspaceId: string): Promise<void> {
  const usersSnap = await db.collection('users').get()
  summary.membersTotal = usersSnap.size

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id
    const user = userDoc.data()

    // Only migrate users that belong to this team
    const belongsToTeam =
      user.team_id === workspaceId ||
      (Array.isArray(user.team_ids) && user.team_ids.includes(workspaceId))

    if (!belongsToTeam) {
      console.log(`   ⏭️  Usuario ${uid} no pertenece al team ${workspaceId}, saltando`)
      continue
    }

    try {
      const memberRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('members')
        .doc(uid)

      const existing = await memberRef.get()
      if (existing.exists) {
        console.log(`   ⚠️  Miembro ${uid} ya existe en workspace, saltando`)
        summary.membersMigrated++
        continue
      }

      // Map role
      let role: string
      if (user.role === 'admin') {
        role = 'owner'
      } else if (user.role === 'supervisor') {
        role = 'supervisor'
      } else {
        role = 'agent'
      }

      await memberRef.set({
        uid,
        display_name: user.display_name ?? null,
        email: user.email ?? null,
        role,
        subteam_id: null,
        joined_at: user.created_at ?? Timestamp.now(),
      })

      // Update /users/{uid} to slim profile
      await db.collection('users').doc(uid).set(
        {
          display_name: user.display_name ?? null,
          email: user.email ?? null,
          workspace_id: workspaceId,
          created_at: user.created_at ?? Timestamp.now(),
        },
        { merge: false }
      )

      summary.membersMigrated++
      console.log(`   ✅ Miembro migrado: ${uid} (${role})`)
    } catch (err) {
      const msg = `Error migrando miembro ${uid}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Migrate subteams (if any exist as nested data)
// ---------------------------------------------------------------------------
async function migrateSubteams(workspaceId: string): Promise<void> {
  // The current schema uses /teams/ as a flat collection.
  // If there are additional team documents beyond the workspace team,
  // they could be subteams. For now we log if none are found.
  const teamsSnap = await db.collection('teams').get()
  const subteams = teamsSnap.docs.filter((doc) => doc.id !== workspaceId)

  if (subteams.length === 0) {
    console.log('   ℹ️  No se encontraron subequipos para migrar\n')
    return
  }

  for (const subteamDoc of subteams) {
    try {
      const data = subteamDoc.data()
      const subteamRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('subteams')
        .doc(subteamDoc.id)

      const existing = await subteamRef.get()
      if (existing.exists) {
        console.log(`   ⚠️  Subteam ${subteamDoc.id} ya existe, saltando`)
        continue
      }

      await subteamRef.set({
        name: data.name ?? 'Subteam',
        created_by: data.created_by ?? null,
        created_at: data.created_at ?? Timestamp.now(),
      })
      console.log(`   ✅ Subteam migrado: ${subteamDoc.id}`)
    } catch (err) {
      const msg = `Error migrando subteam ${subteamDoc.id}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Migrate clients
// ---------------------------------------------------------------------------
async function migrateClients(workspaceId: string): Promise<void> {
  const clientsSnap = await db.collection('clients').get()
  summary.clientsTotal = clientsSnap.size

  if (clientsSnap.empty) {
    console.log('   ℹ️  No se encontraron clientes para migrar\n')
    return
  }

  // Batch writes in groups of 400 (Firestore limit is 500 per batch)
  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0

  for (const clientDoc of clientsSnap.docs) {
    try {
      const targetRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('clients')
        .doc(clientDoc.id)

      const existing = await targetRef.get()
      if (existing.exists) {
        console.log(`   ⚠️  Cliente ${clientDoc.id} ya existe en workspace, saltando`)
        summary.clientsMigrated++
        continue
      }

      const data = clientDoc.data()
      batch.set(targetRef, {
        ...data,
        subteam_id: data.subteam_id ?? null,
      })
      batchCount++
      summary.clientsMigrated++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    } catch (err) {
      const msg = `Error migrando cliente ${clientDoc.id}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }

  if (batchCount > 0) {
    await batch.commit()
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Migrate calls
// ---------------------------------------------------------------------------
async function migrateCalls(workspaceId: string): Promise<void> {
  const callsSnap = await db.collection('calls').get()
  summary.callsTotal = callsSnap.size

  if (callsSnap.empty) {
    console.log('   ℹ️  No se encontraron llamadas para migrar\n')
    return
  }

  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0

  for (const callDoc of callsSnap.docs) {
    try {
      const targetRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('calls')
        .doc(callDoc.id)

      const existing = await targetRef.get()
      if (existing.exists) {
        console.log(`   ⚠️  Llamada ${callDoc.id} ya existe en workspace, saltando`)
        summary.callsMigrated++
        continue
      }

      batch.set(targetRef, callDoc.data())
      batchCount++
      summary.callsMigrated++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    } catch (err) {
      const msg = `Error migrando llamada ${callDoc.id}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }

  if (batchCount > 0) {
    await batch.commit()
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Migrate goals
// ---------------------------------------------------------------------------
async function migrateGoals(workspaceId: string): Promise<void> {
  const goalsSnap = await db.collection('goals').get()
  summary.goalsTotal = goalsSnap.size

  if (goalsSnap.empty) {
    console.log('   ℹ️  No se encontraron metas para migrar\n')
    return
  }

  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0

  for (const goalDoc of goalsSnap.docs) {
    try {
      const targetRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('goals')
        .doc(goalDoc.id)

      const existing = await targetRef.get()
      if (existing.exists) {
        console.log(`   ⚠️  Meta ${goalDoc.id} ya existe en workspace, saltando`)
        summary.goalsMigrated++
        continue
      }

      batch.set(targetRef, goalDoc.data())
      batchCount++
      summary.goalsMigrated++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    } catch (err) {
      const msg = `Error migrando meta ${goalDoc.id}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }

  if (batchCount > 0) {
    await batch.commit()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Iniciando migración a workspaces...\n')

  // Step 1
  console.log('📦 Paso 1 — Crear workspace')
  const workspaceId = await createWorkspace()

  // Step 2
  console.log('👥 Paso 2 — Migrar miembros')
  await migrateMembers(workspaceId)
  console.log(`   → ${summary.membersMigrated} de ${summary.membersTotal} miembro(s) migrados\n`)

  // Step 3
  console.log('🏷️  Paso 3 — Migrar subequipos')
  await migrateSubteams(workspaceId)

  // Step 4
  console.log('📇 Paso 4 — Migrar clientes')
  await migrateClients(workspaceId)
  console.log(`   → ${summary.clientsMigrated} de ${summary.clientsTotal} cliente(s) migrados\n`)

  // Step 5
  console.log('📞 Paso 5 — Migrar llamadas')
  await migrateCalls(workspaceId)
  console.log(`   → ${summary.callsMigrated} de ${summary.callsTotal} llamada(s) migradas\n`)

  // Step 6
  console.log('🎯 Paso 6 — Migrar metas')
  await migrateGoals(workspaceId)
  console.log(`   → ${summary.goalsMigrated} de ${summary.goalsTotal} meta(s) migradas\n`)

  // Summary
  console.log('═'.repeat(50))
  console.log('📊 RESUMEN DE MIGRACIÓN')
  console.log('═'.repeat(50))
  console.log(`   Workspace creado: ${summary.workspaceId} — ${summary.workspaceName}`)
  console.log(`   Miembros migrados: ${summary.membersMigrated} de ${summary.membersTotal}`)
  console.log(`   Clientes migrados: ${summary.clientsMigrated} de ${summary.clientsTotal}`)
  console.log(`   Llamadas migradas: ${summary.callsMigrated} de ${summary.callsTotal}`)
  console.log(`   Metas migradas:    ${summary.goalsMigrated} de ${summary.goalsTotal}`)

  if (summary.errors.length > 0) {
    console.log(`\n❌ Errores encontrados (${summary.errors.length}):`)
    for (const err of summary.errors) {
      console.log(`   - ${err}`)
    }
  } else {
    console.log(`\n   Errores: 0`)
  }

  console.log('\n✅ Migración completada. Verifica los datos en Firebase Console')
  console.log('   antes de ejecutar cleanup. Para limpiar datos antiguos corre:')
  console.log('   npx tsx scripts/cleanup-old-collections.ts')
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
