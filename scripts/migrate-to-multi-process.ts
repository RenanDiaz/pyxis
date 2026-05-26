/**
 * Migration script — convierte el modelo de proceso único por cliente
 * (`process` + `payment_total` + `payments`) al nuevo modelo de múltiples
 * procesos (`processes[]`), donde cada proceso lleva su propio total y pagos.
 *
 * Para cada cliente de cada workspace que tenga datos legacy y NO tenga aún
 * `processes`, crea un único proceso a partir de los campos viejos.
 *
 * NO borra los campos legacy (`process`, `payment_total`, `payments`); solo
 * agrega `processes`. Es idempotente: si el cliente ya tiene `processes`, lo salta.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/migrate-to-multi-process.ts            # aplica cambios
 *   npx tsx scripts/migrate-to-multi-process.ts --dry-run  # solo previsualiza
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

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

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const VALID_PROCESS_TYPES = new Set([
  'registration',
  'annual_report',
  'dissolution',
  'amendment',
  'newspaper_research',
  'newspaper_publication',
])

interface LegacyPayment {
  amount: number
  method: string
  date: string
  note?: string
}

function deriveStage(total: number, paid: number): string {
  if (total > 0 && paid >= total) return 'completado'
  if (paid > 0) return 'en_proceso'
  return 'pendiente'
}

const summary = {
  workspaces: 0,
  clientsTotal: 0,
  migrated: 0,
  skippedAlready: 0,
  skippedNoData: 0,
  needsReview: [] as string[],
  errors: [] as string[],
}

async function migrateWorkspace(workspaceId: string): Promise<void> {
  const clientsSnap = await db
    .collection('workspaces')
    .doc(workspaceId)
    .collection('clients')
    .get()

  summary.clientsTotal += clientsSnap.size

  const BATCH_SIZE = 400
  let batch = db.batch()
  let batchCount = 0

  for (const clientDoc of clientsSnap.docs) {
    try {
      const data = clientDoc.data()

      // Idempotencia
      if (Array.isArray(data.processes) && data.processes.length > 0) {
        summary.skippedAlready++
        continue
      }

      const legacyType: string | undefined = data.process
      const total: number = typeof data.payment_total === 'number' ? data.payment_total : 0
      const payments: LegacyPayment[] = Array.isArray(data.payments) ? data.payments : []
      const paid = payments.reduce((s, p) => s + (p.amount ?? 0), 0)

      // Nada que migrar
      if (!legacyType && total === 0 && payments.length === 0) {
        summary.skippedNoData++
        continue
      }

      let type = legacyType
      if (!type || !VALID_PROCESS_TYPES.has(type)) {
        // Tiene pagos pero no un proceso válido: best-effort 'registration', marcado para revisión.
        type = 'registration'
        summary.needsReview.push(`${workspaceId}/${clientDoc.id} (process legacy: ${legacyType ?? 'ninguno'})`)
      }

      const process: Record<string, unknown> = {
        id: randomUUID(),
        type,
        payments,
        stage: deriveStage(total, paid),
        created_at: data.created_at ?? Timestamp.now(),
      }
      if (typeof data.state === 'string' && data.state) process.state = data.state
      if (total > 0) process.total = total

      if (DRY_RUN) {
        console.log(`   [dry-run] ${workspaceId}/${clientDoc.id} → proceso ${type} (total ${total}, pagos ${payments.length}, etapa ${process.stage})`)
      } else {
        batch.update(clientDoc.ref, { processes: [process] })
        batchCount++
        if (batchCount >= BATCH_SIZE) {
          await batch.commit()
          batch = db.batch()
          batchCount = 0
        }
      }
      summary.migrated++
    } catch (err) {
      const msg = `Error en cliente ${workspaceId}/${clientDoc.id}: ${err}`
      summary.errors.push(msg)
      console.error(`   ❌ ${msg}`)
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit()
  }
}

async function main() {
  console.log(`🚀 Migración a múltiples procesos${DRY_RUN ? ' (DRY RUN — sin escribir)' : ''}...\n`)

  const workspacesSnap = await db.collection('workspaces').get()
  summary.workspaces = workspacesSnap.size

  for (const wsDoc of workspacesSnap.docs) {
    console.log(`📦 Workspace ${wsDoc.id}`)
    await migrateWorkspace(wsDoc.id)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('📊 RESUMEN')
  console.log('═'.repeat(50))
  console.log(`   Workspaces:               ${summary.workspaces}`)
  console.log(`   Clientes revisados:       ${summary.clientsTotal}`)
  console.log(`   Migrados:                 ${summary.migrated}`)
  console.log(`   Saltados (ya migrados):   ${summary.skippedAlready}`)
  console.log(`   Saltados (sin datos):     ${summary.skippedNoData}`)

  if (summary.needsReview.length > 0) {
    console.log(`\n⚠️  Revisar manualmente (pagos sin proceso válido, asignados a 'registration'):`)
    for (const r of summary.needsReview) console.log(`   - ${r}`)
  }

  if (summary.errors.length > 0) {
    console.log(`\n❌ Errores (${summary.errors.length}):`)
    for (const e of summary.errors) console.log(`   - ${e}`)
  } else {
    console.log(`\n   Errores: 0`)
  }

  console.log(DRY_RUN
    ? '\nℹ️  Dry run completado. Corre sin --dry-run para aplicar los cambios.'
    : '\n✅ Migración completada. Verifica los datos en Firebase Console.')
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
