/**
 * Migración de notas de sistema (spec 03-R6).
 *
 * Antes, las reasignaciones se escribían como líneas "[SISTEMA] …" dentro de
 * `notes`, mezcladas con lo que edita el agente. Este script las mueve a
 * `activity` (eventos de solo lectura) y deja en `notes` solo el texto del
 * agente. Los eventos migrados quedan con `at: null`: la fecha va en el texto.
 *
 * La app ya muestra bien los datos sin migrar (separa las líneas al leer y las
 * conserva al guardar), así que esto es limpieza, no urgente.
 *
 * Idempotente. No pisa un cliente editado mientras corre (updateIfUnchanged).
 *
 * Uso:
 *   npx tsx scripts/migrate-system-notes.ts --dry-run
 *   npx tsx scripts/migrate-system-notes.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { updateIfUnchanged } from './lib/updateIfUnchanged'
import { activityFromLegacyLine, splitNotes } from '../src/lib/clientActivity'

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

async function main() {
  console.log(DRY_RUN ? '🔍 Dry run: no se escribe nada\n' : '✍️  Aplicando cambios\n')
  let migrated = 0
  let events = 0
  const changedDuringRun: string[] = []

  for (const ws of (await db.collection('workspaces').get()).docs) {
    for (const client of (await ws.ref.collection('clients').get()).docs) {
      const { agentNotes, legacySystemLines } = splitNotes(client.get('notes'))
      if (legacySystemLines.length === 0) continue
      const activity = [...legacySystemLines.map(activityFromLegacyLine), ...(client.get('activity') ?? [])]
      if (DRY_RUN) {
        console.log(`   [dry-run] ${ws.id}/${client.id} → ${legacySystemLines.length} evento(s)`)
      } else if (!(await updateIfUnchanged(client, { notes: agentNotes, activity }))) {
        changedDuringRun.push(`${ws.id}/${client.id}`)
        continue
      }
      migrated++
      events += legacySystemLines.length
    }
  }

  const verb = DRY_RUN ? 'se migrarían' : 'migrados'
  console.log(`Clientes ${verb}: ${migrated} (${events} evento(s))`)
  if (changedDuringRun.length > 0) {
    console.log('\n⚠️  Editados mientras corría el script, no se tocaron (vuelve a correrlo):')
    for (const r of changedDuringRun) console.log(`   - ${r}`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
