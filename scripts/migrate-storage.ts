/**
 * Migration script — moves Storage files from flat paths to workspace-scoped paths
 * and updates Firestore document metadata accordingly.
 *
 * From:  clients/{clientId}/{filename}
 * To:    workspaces/{workspaceId}/clients/{clientId}/{filename}
 *
 * Steps:
 *   1. Reads all workspaces
 *   2. For each workspace, reads all clients
 *   3. For each client, reads all document metadata
 *   4. Copies each file to the new path, gets new download URL
 *   5. Updates the Firestore document with new storage_path and download_url
 *   6. Deletes the old file from Storage
 *
 * Does NOT delete old files if copy fails. Safe to re-run.
 *
 * Prerequisites:
 *   1. Firebase service account key at scripts/serviceAccountKey.json
 *   2. Storage bucket name (auto-detected from service account project_id)
 *
 * Run:
 *   npx tsx scripts/migrate-storage.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
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

const projectId = serviceAccount.project_id
if (!projectId) {
  console.error('❌ No se encontró project_id en serviceAccountKey.json')
  process.exit(1)
}

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${projectId}.firebasestorage.app`,
})

const db = getFirestore()
const bucket = getStorage().bucket()

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------
const summary = {
  filesTotal: 0,
  filesMigrated: 0,
  filesSkipped: 0,
  errors: [] as string[],
}

// ---------------------------------------------------------------------------
// Migrate a single file
// ---------------------------------------------------------------------------
async function migrateFile(
  workspaceId: string,
  clientId: string,
  docId: string,
  oldPath: string
): Promise<void> {
  summary.filesTotal++

  // Already migrated?
  if (oldPath.startsWith(`workspaces/`)) {
    console.log(`   ⏭️  ${oldPath} ya está migrado`)
    summary.filesSkipped++
    return
  }

  // Extract the filename part: clients/{clientId}/{filename} → {filename}
  const parts = oldPath.split('/')
  const filename = parts.slice(2).join('/') // everything after clients/{clientId}/
  const newPath = `workspaces/${workspaceId}/clients/${clientId}/${filename}`

  try {
    const oldFile = bucket.file(oldPath)
    const [exists] = await oldFile.exists()

    if (!exists) {
      console.log(`   ⚠️  Archivo no encontrado en Storage: ${oldPath}, actualizando solo la ruta`)
      // Update Firestore metadata anyway to fix the path
      await db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('clients')
        .doc(clientId)
        .collection('documents')
        .doc(docId)
        .update({ storage_path: newPath })
      summary.filesSkipped++
      return
    }

    // Copy to new location
    const newFile = bucket.file(newPath)
    const [newExists] = await newFile.exists()

    if (!newExists) {
      await oldFile.copy(newFile)
    }

    // Get new download URL (signed URL valid for 10 years)
    const [downloadUrl] = await newFile.getSignedUrl({
      action: 'read',
      expires: '2036-01-01',
    })

    // Update Firestore document metadata
    await db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('clients')
      .doc(clientId)
      .collection('documents')
      .doc(docId)
      .update({
        storage_path: newPath,
        download_url: downloadUrl,
      })

    // Delete old file
    await oldFile.delete()

    summary.filesMigrated++
    console.log(`   ✅ ${oldPath} → ${newPath}`)
  } catch (err) {
    const msg = `Error migrando ${oldPath}: ${err}`
    summary.errors.push(msg)
    console.error(`   ❌ ${msg}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Iniciando migración de Storage...\n')

  // Get all workspaces
  const workspacesSnap = await db.collection('workspaces').get()

  if (workspacesSnap.empty) {
    console.log('❌ No se encontraron workspaces')
    process.exit(1)
  }

  for (const wsDoc of workspacesSnap.docs) {
    const workspaceId = wsDoc.id
    const wsData = wsDoc.data()
    console.log(`\n📦 Workspace: ${workspaceId} — ${wsData.name ?? 'Sin nombre'}`)

    // Get all clients in this workspace
    const clientsSnap = await db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('clients')
      .get()

    if (clientsSnap.empty) {
      console.log('   ℹ️  No hay clientes en este workspace')
      continue
    }

    for (const clientDoc of clientsSnap.docs) {
      const clientId = clientDoc.id

      // Get all documents for this client
      const docsSnap = await db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('clients')
        .doc(clientId)
        .collection('documents')
        .get()

      if (docsSnap.empty) continue

      console.log(`\n   📇 Cliente: ${clientId} (${docsSnap.size} archivo(s))`)

      for (const fileDoc of docsSnap.docs) {
        const data = fileDoc.data()
        const storagePath = data.storage_path as string

        if (!storagePath) {
          console.log(`   ⚠️  Documento ${fileDoc.id} sin storage_path, saltando`)
          continue
        }

        await migrateFile(workspaceId, clientId, fileDoc.id, storagePath)
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log('📊 RESUMEN DE MIGRACIÓN DE STORAGE')
  console.log('═'.repeat(50))
  console.log(`   Archivos encontrados: ${summary.filesTotal}`)
  console.log(`   Archivos migrados:    ${summary.filesMigrated}`)
  console.log(`   Archivos saltados:    ${summary.filesSkipped}`)

  if (summary.errors.length > 0) {
    console.log(`\n❌ Errores encontrados (${summary.errors.length}):`)
    for (const err of summary.errors) {
      console.log(`   - ${err}`)
    }
  } else {
    console.log(`\n   Errores: 0`)
  }

  console.log('\n✅ Migración de Storage completada.')
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
