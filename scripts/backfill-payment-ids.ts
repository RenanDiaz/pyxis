/**
 * Backfill — asigna `id` y `receipt_number` a los pagos que no los tienen.
 *
 * Los pagos nuevos ya nacen con ambos (ver src/lib/processMutations.ts). Los
 * viejos se identificaban por su posición en el array, y el número de recibo
 * era esa posición + 1. Este script fija exactamente ese número, así los
 * recibos ya entregados conservan su N° aunque después se borre otro pago.
 *
 * Es idempotente: solo toca pagos sin `id` o sin `receipt_number`, y cada
 * cliente se actualiza en una transacción (no pisa cambios concurrentes).
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/backfill-payment-ids.ts --dry-run   # solo previsualiza
 *   npx tsx scripts/backfill-payment-ids.ts             # aplica cambios
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

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

type PaymentDoc = Record<string, unknown> & { id?: string; receipt_number?: number }
type ProcessDoc = Record<string, unknown> & { payments?: PaymentDoc[] }

/** Devuelve los procesos con ids/números asignados, o null si no hay nada que cambiar. */
function backfill(processes: ProcessDoc[]): { processes: ProcessDoc[]; count: number } | null {
  let count = 0
  const next = processes.map((process) => ({
    ...process,
    payments: (process.payments ?? []).map((payment, index) => {
      if (payment.id && payment.receipt_number) return payment
      count++
      return {
        ...payment,
        id: payment.id ?? randomUUID(),
        receipt_number: payment.receipt_number ?? index + 1,
      }
    }),
  }))
  return count > 0 ? { processes: next, count } : null
}

async function processClient(ref: DocumentReference): Promise<number> {
  if (DRY_RUN) {
    const snap = await ref.get()
    return backfill((snap.get('processes') as ProcessDoc[] | undefined) ?? [])?.count ?? 0
  }
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const result = backfill((snap.get('processes') as ProcessDoc[] | undefined) ?? [])
    if (!result) return 0
    tx.update(ref, { processes: result.processes })
    return result.count
  })
}

async function main() {
  console.log(DRY_RUN ? '🔍 Dry run: no se escribe nada\n' : '✍️  Aplicando cambios\n')
  const workspaces = await db.collection('workspaces').get()
  let clients = 0
  let payments = 0

  for (const ws of workspaces.docs) {
    const snap = await ws.ref.collection('clients').get()
    for (const client of snap.docs) {
      const count = await processClient(client.ref)
      if (count > 0) {
        clients++
        payments += count
        console.log(`  ${ws.id}/${client.id}: ${count} pago(s)`)
      }
    }
  }

  console.log(`\n${payments} pagos en ${clients} clientes ${DRY_RUN ? 'se actualizarían' : 'actualizados'}.`)
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
