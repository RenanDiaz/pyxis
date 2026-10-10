/**
 * Backfill del índice de teléfonos (spec 07).
 *
 * Desde la spec 07, al crear o editar un cliente la app escribe
 * `phone_digits` (todos sus teléfonos en 10 dígitos) y lo registra en
 * `workspaces/{wId}/phone_index/{dígitos}`. Los clientes de antes no están en
 * el índice, así que el aviso "ya es cliente de otro agente" no los encuentra
 * hasta correr este script.
 *
 * Por cada workspace:
 * - escribe `phone_digits` en los clientes que no lo tienen o lo tienen viejo
 *   (sin pisar un cliente editado mientras corre: updateIfUnchanged);
 * - agrega cada cliente a los números que usa y quita del índice los ids que
 *   ya no corresponden (cliente borrado o número cambiado).
 *
 * Idempotente: se puede correr las veces que haga falta.
 *
 * Uso:
 *   npx tsx scripts/backfill-phone-index.ts --dry-run
 *   npx tsx scripts/backfill-phone-index.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateIfUnchanged } from './lib/updateIfUnchanged'
import { clientPhoneDigits, PHONE_INDEX } from '../src/lib/phoneIndex'

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

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

async function main() {
  console.log(DRY_RUN ? '🔍 Dry run: no se escribe nada\n' : '✍️  Aplicando cambios\n')
  let clientsUpdated = 0
  let entriesAdded = 0
  let entriesRemoved = 0
  const changedDuringRun: string[] = []

  for (const ws of (await db.collection('workspaces').get()).docs) {
    // dígitos → ids de clientes que lo usan
    const expected = new Map<string, Set<string>>()
    for (const client of (await ws.ref.collection('clients').get()).docs) {
      const digits = clientPhoneDigits(client.data())
      for (const d of digits) {
        if (!expected.has(d)) expected.set(d, new Set())
        expected.get(d)!.add(client.id)
      }
      if (sameList(client.get('phone_digits') ?? [], digits)) continue
      if (DRY_RUN) {
        console.log(`   [dry-run] ${ws.id}/${client.id} → phone_digits ${JSON.stringify(digits)}`)
      } else if (!(await updateIfUnchanged(client, { phone_digits: digits }))) {
        changedDuringRun.push(`${ws.id}/${client.id}`)
        continue
      }
      clientsUpdated++
    }

    const index = ws.ref.collection(PHONE_INDEX)
    const current = new Map((await index.get()).docs.map((d) => [d.id, Object.keys(d.get('client_ids') ?? {})]))
    for (const digits of new Set([...expected.keys(), ...current.keys()])) {
      const want = expected.get(digits) ?? new Set<string>()
      const have = current.get(digits) ?? []
      const add = [...want].filter((id) => !have.includes(id))
      const remove = have.filter((id) => !want.has(id))
      if (add.length === 0 && remove.length === 0) continue
      entriesAdded += add.length
      entriesRemoved += remove.length
      if (DRY_RUN) {
        console.log(`   [dry-run] ${ws.id}/${PHONE_INDEX}/${digits} +${add.length} −${remove.length}`)
        continue
      }
      const client_ids: Record<string, true | FieldValue> = {}
      for (const id of add) client_ids[id] = true
      for (const id of remove) client_ids[id] = FieldValue.delete()
      // Solo estas dos claves: las reglas no aceptan otras en el índice.
      await index.doc(digits).set({ client_ids, last_client_id: add[0] ?? remove[0] }, { merge: true })
    }
  }

  const verb = DRY_RUN ? 'se actualizarían' : 'actualizados'
  console.log(`\nClientes ${verb}: ${clientsUpdated}`)
  console.log(`Índice: +${entriesAdded} / −${entriesRemoved} entrada(s)`)
  if (changedDuringRun.length > 0) {
    console.log('\n⚠️  Editados mientras corría el script, no se tocaron (vuelve a correrlo):')
    for (const r of changedDuringRun) console.log(`   - ${r}`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
