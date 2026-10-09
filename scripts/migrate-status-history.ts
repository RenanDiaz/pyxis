/**
 * Migración del historial de status (spec 05).
 *
 * 1. Clientes sin `contacted_at` / `closed_at` (anteriores al historial):
 *    - `closed_at = updated_at` si hoy están en `cerrado`, si no `null`.
 *    - `contacted_at = updated_at` si su status implica contacto, si no `null`.
 *    Es una APROXIMACIÓN: `updated_at` es la última edición, no la fecha real
 *    del cierre. Es el mismo criterio que usaba el dashboard antes, así que los
 *    números históricos no cambian; los cierres nuevos ya quedan exactos.
 *    No se inventa `status_history`: empieza con el próximo cambio.
 *
 * 2. Intentos de contacto guardados como llamada `pendiente` (notas
 *    "Contacto iniciado vía …"): pasan a `completada` con
 *    `kind: 'contact_attempt'`. Dejan de aparecer como "llamada vencida".
 *
 * Idempotente. Cada cliente se actualiza en una transacción.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/migrate-status-history.ts --dry-run
 *   npx tsx scripts/migrate-status-history.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore'
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

// Mismo criterio que src/lib/statusHistory.ts
const CONTACTED_STATUSES = new Set(['contactado', 'en_proceso', 'cerrado', 'deuda_pendiente'])
const CONTACT_ATTEMPT_RE = /^Contacto iniciado vía (WhatsApp|Llamada|Email)$/

function statusPatch(data: FirebaseFirestore.DocumentData): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  if (data.closed_at === undefined) {
    patch.closed_at = data.status === 'cerrado' ? data.updated_at ?? null : null
  }
  if (data.contacted_at === undefined) {
    patch.contacted_at = CONTACTED_STATUSES.has(data.status) ? data.updated_at ?? null : null
  }
  return Object.keys(patch).length ? patch : null
}

async function migrateClient(ref: DocumentReference): Promise<boolean> {
  if (DRY_RUN) return statusPatch((await ref.get()).data() ?? {}) !== null
  return db.runTransaction(async (tx) => {
    const patch = statusPatch((await tx.get(ref)).data() ?? {})
    if (!patch) return false
    // Sin tocar updated_at: es metadato de la migración, no una edición.
    tx.update(ref, patch)
    return true
  })
}

async function main() {
  console.log(DRY_RUN ? '🔍 Dry run: no se escribe nada\n' : '✍️  Aplicando cambios\n')
  let clients = 0
  let attempts = 0

  const workspaces = await db.collection('workspaces').get()
  for (const ws of workspaces.docs) {
    for (const client of (await ws.ref.collection('clients').get()).docs) {
      if (await migrateClient(client.ref)) clients++
    }

    const pendingCalls = await ws.ref.collection('calls').where('outcome', '==', 'pendiente').get()
    for (const call of pendingCalls.docs) {
      const match = CONTACT_ATTEMPT_RE.exec(String(call.get('notes') ?? ''))
      if (!match) continue
      attempts++
      if (!DRY_RUN) {
        await call.ref.update({ outcome: 'completada', kind: 'contact_attempt', channel: match[1] })
      }
    }
  }

  const verb = DRY_RUN ? 'se actualizarían' : 'actualizados'
  console.log(`Clientes con fechas de status ${verb}: ${clients}`)
  console.log(`Intentos de contacto corregidos (${DRY_RUN ? 'pendientes' : 'hechos'}): ${attempts}`)
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
