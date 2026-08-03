/**
 * Backfill script — baja los datos de compañía del cliente (`llc_name`,
 * `business_address`, `business_purpose`, `state`) al PRIMER registro de LLC de
 * los clientes que tienen más de un registro.
 *
 * Contexto: los campos de compañía vivían en el cliente y cada proceso de
 * registro los heredaba cuando no tenía los suyos. Con varios registros por
 * cliente esa herencia hacía que la misma compañía se viera repetida en todos
 * los registros (y que se generaran documentos Word idénticos). Ahora solo el
 * primer registro hereda; este script le copia los datos para que los tenga
 * propios y ninguna compañía quede sin identidad.
 *
 * Solo escribe cuando el cliente tiene 2+ registros y al primero le falta algún
 * campo que el cliente sí tiene. Es idempotente y no toca los campos del
 * cliente ni los demás registros.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/backfill-registration-company.ts            # aplica cambios
 *   npx tsx scripts/backfill-registration-company.ts --dry-run  # solo previsualiza
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

/** Campos de compañía que el primer registro debe tener propios. */
const COMPANY_KEYS = ['llc_name', 'business_address', 'business_purpose', 'state'] as const

type ProcessDoc = Record<string, unknown>

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const summary = {
  workspaces: 0,
  clientsTotal: 0,
  multiRegistration: 0,
  updated: 0,
  skippedComplete: 0,
  noClientData: [] as string[],
  errors: [] as string[],
}

async function backfillWorkspace(workspaceId: string): Promise<void> {
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
      const processes: ProcessDoc[] = Array.isArray(data.processes) ? data.processes : []
      const registrations = processes.filter((p) => p.type === 'registration')

      // La herencia solo era ambigua con más de un registro.
      if (registrations.length < 2) continue
      summary.multiRegistration++

      const first = registrations[0]
      const patch: Record<string, string> = {}
      const missing: string[] = []
      for (const key of COMPANY_KEYS) {
        if (str(first[key])) continue
        const inherited = str(data[key])
        if (inherited) patch[key] = inherited
        else missing.push(key)
      }

      if (Object.keys(patch).length === 0) {
        summary.skippedComplete++
        if (missing.length > 0) {
          summary.noClientData.push(
            `${workspaceId}/${clientDoc.id} (primer registro sin ${missing.join(', ')})`,
          )
        }
        continue
      }

      const nextProcesses = processes.map((p) => (p === first ? { ...p, ...patch } : p))

      if (DRY_RUN) {
        console.log(
          `   [dry-run] ${workspaceId}/${clientDoc.id} → primer registro recibe ${Object.keys(patch).join(', ')} (${registrations.length} registros)`,
        )
      } else {
        batch.update(clientDoc.ref, { processes: nextProcesses })
        batchCount++
        if (batchCount >= BATCH_SIZE) {
          await batch.commit()
          batch = db.batch()
          batchCount = 0
        }
      }
      summary.updated++
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
  console.log(
    `🚀 Backfill de datos de compañía al primer registro${DRY_RUN ? ' (DRY RUN — sin escribir)' : ''}...\n`,
  )

  const workspacesSnap = await db.collection('workspaces').get()
  summary.workspaces = workspacesSnap.size

  for (const wsDoc of workspacesSnap.docs) {
    console.log(`📦 Workspace ${wsDoc.id}`)
    await backfillWorkspace(wsDoc.id)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('📊 RESUMEN')
  console.log('═'.repeat(50))
  console.log(`   Workspaces:                    ${summary.workspaces}`)
  console.log(`   Clientes revisados:            ${summary.clientsTotal}`)
  console.log(`   Con 2+ registros:              ${summary.multiRegistration}`)
  console.log(`   Actualizados:                  ${summary.updated}`)
  console.log(`   Sin cambios (ya completos):    ${summary.skippedComplete}`)

  if (summary.noClientData.length > 0) {
    console.log(`\n⚠️  Revisar manualmente (ni el registro ni el cliente tienen el dato):`)
    for (const r of summary.noClientData) console.log(`   - ${r}`)
  }

  if (summary.errors.length > 0) {
    console.log(`\n❌ Errores (${summary.errors.length}):`)
    for (const e of summary.errors) console.log(`   - ${e}`)
  } else {
    console.log(`\n   Errores: 0`)
  }

  console.log(
    DRY_RUN
      ? '\nℹ️  Dry run completado. Corre sin --dry-run para aplicar los cambios.'
      : '\n✅ Backfill completado. Verifica los datos en Firebase Console.',
  )
}

main().catch((err) => {
  console.error('❌ Error en backfill:', err)
  process.exit(1)
})
