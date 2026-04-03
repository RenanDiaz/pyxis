/**
 * Migration script — moves Storage files from flat paths to workspace-scoped paths
 * and migrates Firestore document metadata from old flat collections.
 *
 * Storage:
 *   From:  clients/{clientId}/{filename}
 *   To:    workspaces/{workspaceId}/clients/{clientId}/{filename}
 *
 * Firestore metadata:
 *   From:  clients/{clientId}/documents/{docId}
 *   To:    workspaces/{workspaceId}/clients/{clientId}/documents/{docId}
 *
 * The original migrate-to-workspaces.ts script migrated client documents
 * but NOT the documents subcollection. This script handles both the
 * subcollection metadata and the Storage files.
 *
 * Also scans Storage directly for orphan files (files without Firestore
 * metadata) and migrates them too.
 *
 * Does NOT delete originals if copy fails. Safe to re-run.
 *
 * Prerequisites:
 *   1. Firebase service account key at scripts/serviceAccountKey.json
 *
 * Run:
 *   npx tsx scripts/migrate-storage.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
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
  metadataMigrated: 0,
  metadataSkipped: 0,
  filesMoved: 0,
  filesSkipped: 0,
  orphansMigrated: 0,
  errors: [] as string[],
}

// ---------------------------------------------------------------------------
// Step 1 — Migrate Firestore document metadata from old path to workspace path
// ---------------------------------------------------------------------------
async function migrateDocumentMetadata(
  workspaceId: string,
  clientId: string
): Promise<void> {
  // Check old flat Firestore path: clients/{clientId}/documents/
  const oldDocsSnap = await db
    .collection('clients')
    .doc(clientId)
    .collection('documents')
    .get()

  if (oldDocsSnap.empty) return

  console.log(`      📄 ${oldDocsSnap.size} doc(s) en ruta vieja clients/${clientId}/documents/`)

  for (const oldDoc of oldDocsSnap.docs) {
    const docId = oldDoc.id
    const data = oldDoc.data()

    const newDocRef = db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('clients')
      .doc(clientId)
      .collection('documents')
      .doc(docId)

    const existing = await newDocRef.get()
    if (existing.exists) {
      console.log(`      ⏭️  Metadata ${docId} ya existe en workspace`)
      summary.metadataSkipped++
      continue
    }

    await newDocRef.set(data)
    summary.metadataMigrated++
    console.log(`      ✅ Metadata migrada: ${docId} — ${data.name ?? 'sin nombre'}`)
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Move Storage files to workspace-scoped paths
// ---------------------------------------------------------------------------
async function moveStorageFile(
  workspaceId: string,
  clientId: string,
  docId: string,
  oldPath: string
): Promise<void> {
  // Already migrated?
  if (oldPath.startsWith('workspaces/')) {
    console.log(`      ⏭️  ${oldPath} ya migrado`)
    summary.filesSkipped++
    return
  }

  // Build new path
  const parts = oldPath.split('/')
  const filename = parts.slice(2).join('/') // everything after clients/{clientId}/
  const newPath = `workspaces/${workspaceId}/clients/${clientId}/${filename}`

  try {
    const oldFile = bucket.file(oldPath)
    const [exists] = await oldFile.exists()

    if (!exists) {
      console.log(`      ⚠️  Archivo no existe en Storage: ${oldPath}, actualizando ruta`)
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

    // Get new download URL (signed, valid 10 years)
    const [downloadUrl] = await newFile.getSignedUrl({
      action: 'read',
      expires: '2036-01-01',
    })

    // Update Firestore metadata with new path and URL
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

    summary.filesMoved++
    console.log(`      ✅ ${oldPath} → ${newPath}`)
  } catch (err) {
    const msg = `Error moviendo ${oldPath}: ${err}`
    summary.errors.push(msg)
    console.error(`      ❌ ${msg}`)
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Scan Storage for orphan files without Firestore metadata
// ---------------------------------------------------------------------------
async function migrateOrphanFiles(
  workspaceId: string,
  clientId: string
): Promise<void> {
  const prefix = `clients/${clientId}/`

  try {
    const [files] = await bucket.getFiles({ prefix })

    if (files.length === 0) return

    // Get all known storage_paths from workspace documents metadata
    const docsSnap = await db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('clients')
      .doc(clientId)
      .collection('documents')
      .get()

    const knownPaths = new Set(docsSnap.docs.map((d) => d.data().storage_path as string))

    for (const file of files) {
      const oldPath = file.name
      if (knownPaths.has(oldPath)) continue // already tracked, will be moved in step 2

      // Also check if the new path version is already known
      const parts = oldPath.split('/')
      const filename = parts.slice(2).join('/')
      const newPath = `workspaces/${workspaceId}/clients/${clientId}/${filename}`
      if (knownPaths.has(newPath)) continue

      console.log(`      🔍 Archivo huérfano encontrado: ${oldPath}`)

      try {
        // Copy to new location
        const newFile = bucket.file(newPath)
        const [newExists] = await newFile.exists()
        if (!newExists) {
          await file.copy(newFile)
        }

        // Get download URL
        const [downloadUrl] = await newFile.getSignedUrl({
          action: 'read',
          expires: '2036-01-01',
        })

        // Infer file info from metadata
        const [metadata] = await newFile.getMetadata()
        const originalName = filename.replace(/^\d+_/, '') // remove timestamp prefix

        // Determine file type
        const ext = originalName.split('.').pop()?.toLowerCase() ?? ''
        const typeMap: Record<string, string> = {
          jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
          webp: 'image', heic: 'image', pdf: 'pdf', doc: 'word',
          docx: 'word', xls: 'excel', xlsx: 'excel',
        }

        // Create Firestore metadata
        await db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('clients')
          .doc(clientId)
          .collection('documents')
          .add({
            name: originalName,
            storage_path: newPath,
            download_url: downloadUrl,
            type: typeMap[ext] ?? 'other',
            mime_type: metadata.contentType ?? 'application/octet-stream',
            size_bytes: Number(metadata.size ?? 0),
            uploaded_by_uid: 'migration',
            uploaded_by_name: 'Migración automática',
            uploaded_at: Timestamp.now(),
          })

        // Delete old file
        await file.delete()

        summary.orphansMigrated++
        console.log(`      ✅ Huérfano migrado: ${oldPath} → ${newPath}`)
      } catch (err) {
        const msg = `Error migrando huérfano ${oldPath}: ${err}`
        summary.errors.push(msg)
        console.error(`      ❌ ${msg}`)
      }
    }
  } catch (err) {
    const msg = `Error listando archivos para clients/${clientId}/: ${err}`
    summary.errors.push(msg)
    console.error(`      ❌ ${msg}`)
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
      const clientData = clientDoc.data()
      const clientName = clientData.first_name
        ? `${clientData.first_name} ${clientData.last_name ?? ''}`.trim()
        : clientId

      console.log(`\n   📇 Cliente: ${clientName} (${clientId})`)

      // Step 1: Migrate metadata from old flat path
      await migrateDocumentMetadata(workspaceId, clientId)

      // Step 2: Move tracked Storage files
      const docsSnap = await db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('clients')
        .doc(clientId)
        .collection('documents')
        .get()

      for (const fileDoc of docsSnap.docs) {
        const data = fileDoc.data()
        const storagePath = data.storage_path as string

        if (!storagePath) {
          console.log(`      ⚠️  Documento ${fileDoc.id} sin storage_path, saltando`)
          continue
        }

        await moveStorageFile(workspaceId, clientId, fileDoc.id, storagePath)
      }

      // Step 3: Find and migrate orphan files in Storage
      await migrateOrphanFiles(workspaceId, clientId)
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log('📊 RESUMEN DE MIGRACIÓN DE STORAGE')
  console.log('═'.repeat(50))
  console.log(`   Metadata migrada:      ${summary.metadataMigrated}`)
  console.log(`   Metadata saltada:      ${summary.metadataSkipped}`)
  console.log(`   Archivos movidos:      ${summary.filesMoved}`)
  console.log(`   Archivos saltados:     ${summary.filesSkipped}`)
  console.log(`   Huérfanos migrados:    ${summary.orphansMigrated}`)

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
