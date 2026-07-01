/**
 * Migration script — convierte las fechas de pago del formato legacy solo-fecha
 * (`yyyy-MM-dd`) al nuevo formato ISO con hora (`2026-06-23T12:00:00.000Z`).
 *
 * Motivación: guardar solo la fecha impide ordenar un pago respecto a otros
 * eventos del mismo día y hace que `new Date("2026-06-23")` se interprete como
 * medianoche UTC (se corre un día en zonas UTC-negativas). Los pagos nuevos ya
 * nacen con hora real; este script normaliza los datos existentes.
 *
 * Sin hora original disponible, se usa MEDIODÍA LOCAL (12:00) de la fecha
 * guardada, para no cruzar de día en ninguna zona horaria al serializar a ISO.
 *
 * Recorre `workspaces/*/clients` y convierte:
 *   - `processes[].payments[].date`  (modelo actual)
 *   - `payments[].date`              (modelo legacy a nivel cliente)
 * Solo toca valores con formato exacto `yyyy-MM-dd`; los que ya son ISO con
 * hora (u otro formato) se dejan intactos. Es idempotente y OPCIONAL: los
 * lectores toleran ambos formatos, así que puede correrse cuando se desee.
 *
 * NOTA: como los lectores parsean `yyyy-MM-dd` en hora local, esta migración
 * conviene correrla en la misma zona horaria (o similar) que usan los usuarios,
 * para que el "mediodía local" coincida con el día correcto.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/migrate-payment-dates.ts            # aplica cambios
 *   npx tsx scripts/migrate-payment-dates.ts --dry-run  # solo previsualiza
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

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Convierte `yyyy-MM-dd` → ISO a mediodía local. Devuelve `null` si el valor no
 * es una fecha solo-fecha (ya es ISO con hora u otro formato) → no se toca.
 */
function toIsoNoon(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = DATE_ONLY.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

interface RawPayment {
  date?: unknown
  [k: string]: unknown
}

/**
 * Devuelve una copia del array de pagos con las fechas convertidas, o `null` si
 * ninguna cambió (para no reescribir el documento innecesariamente).
 */
function convertPayments(payments: unknown): { next: RawPayment[]; changed: number } | null {
  if (!Array.isArray(payments)) return null
  let changed = 0
  const next = payments.map((p: RawPayment) => {
    const iso = toIsoNoon(p?.date)
    if (iso === null) return p
    changed++
    return { ...p, date: iso }
  })
  return changed > 0 ? { next, changed } : null
}

const summary = {
  workspaces: 0,
  clientsTotal: 0,
  clientsUpdated: 0,
  paymentsConverted: 0,
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
      const update: Record<string, unknown> = {}
      let clientConverted = 0

      // 1. Modelo actual: processes[].payments[].date
      if (Array.isArray(data.processes)) {
        let anyProcessChanged = false
        const nextProcesses = data.processes.map((proc: Record<string, unknown>) => {
          const res = convertPayments(proc?.payments)
          if (!res) return proc
          anyProcessChanged = true
          clientConverted += res.changed
          return { ...proc, payments: res.next }
        })
        if (anyProcessChanged) update.processes = nextProcesses
      }

      // 2. Modelo legacy a nivel cliente: payments[].date
      const legacyRes = convertPayments(data.payments)
      if (legacyRes) {
        update.payments = legacyRes.next
        clientConverted += legacyRes.changed
      }

      if (clientConverted === 0) continue

      summary.clientsUpdated++
      summary.paymentsConverted += clientConverted

      if (DRY_RUN) {
        console.log(
          `   [dry-run] ${workspaceId}/${clientDoc.id} → ${clientConverted} fecha(s) de pago a ISO`,
        )
      } else {
        batch.update(clientDoc.ref, update)
        batchCount++
        if (batchCount >= BATCH_SIZE) {
          await batch.commit()
          batch = db.batch()
          batchCount = 0
        }
      }
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
    `🚀 Migración de fechas de pago a ISO${DRY_RUN ? ' (DRY RUN — sin escribir)' : ''}...\n`,
  )

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
  console.log(`   Clientes actualizados:    ${summary.clientsUpdated}`)
  console.log(`   Fechas convertidas:       ${summary.paymentsConverted}`)

  if (summary.errors.length > 0) {
    console.log(`\n❌ Errores (${summary.errors.length}):`)
    for (const e of summary.errors) console.log(`   - ${e}`)
  } else {
    console.log(`\n   Errores: 0`)
  }

  console.log(
    DRY_RUN
      ? '\nℹ️  Dry run completado. Corre sin --dry-run para aplicar los cambios.'
      : '\n✅ Migración completada. Verifica los datos en Firebase Console.',
  )
}

main().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
