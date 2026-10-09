/**
 * Copia los COSTOS estatales de `src/data/states.json` a la colección `states`
 * de Firestore (spec 04, P8), sin tocar el resto de cada estado (precios,
 * notas y demás ediciones hechas desde la app con StateEditDialog).
 *
 * Campos que actualiza:
 *   - `state_fee`                   (costo del registro)
 *   - `annual_report.state_cost`
 *   - `dissolution.state_cost`
 *   - `amendments.state_cost`
 *
 * Fuente: tabla de costos del proveedor (2026_NEW_UPDATED_EXCEL_FOR_LLC), ya
 * volcada en states.json. Solo escribe los campos que cambian.
 *
 * Run:
 *   npx tsx scripts/update-state-costs.ts [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

interface StateCosts {
  abbreviation: string
  state_fee: string
  annual_report: { state_cost?: string }
  dissolution: { state_cost?: string }
  amendments: { state_cost?: string }
}

const statesData: StateCosts[] = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/states.json'), 'utf-8'),
)

/** Lee un campo con notación de puntos (`dissolution.state_cost`). */
function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
    obj,
  )
}

const FIELDS = [
  'state_fee',
  'annual_report.state_cost',
  'dissolution.state_cost',
  'amendments.state_cost',
] as const

async function main() {
  console.log(DRY_RUN ? '🔎 Dry run: no se escribe nada\n' : '✍️  Actualizando costos estatales\n')
  let changedDocs = 0
  let missingDocs = 0

  for (const state of statesData) {
    const ref = db.collection('states').doc(state.abbreviation)
    const snap = await ref.get()
    if (!snap.exists) {
      // seed.ts crea los que faltan (con todos sus campos).
      console.log(`   ⚠️  ${state.abbreviation}: no existe en Firestore (corre scripts/seed.ts)`)
      missingDocs++
      continue
    }
    const current = snap.data()
    const updates: Record<string, string> = {}
    for (const field of FIELDS) {
      const next = (get(state, field) as string | undefined) ?? ''
      const prev = get(current, field)
      if (prev !== next) {
        updates[field] = next
        console.log(`   ${state.abbreviation} ${field}: ${JSON.stringify(prev ?? null)} → ${JSON.stringify(next)}`)
      }
    }
    if (Object.keys(updates).length === 0) continue
    changedDocs++
    // `update` con rutas de puntos: solo toca esos campos anidados.
    if (!DRY_RUN) await ref.update(updates)
  }

  console.log(
    `\n✅ ${changedDocs} estados ${DRY_RUN ? 'por actualizar' : 'actualizados'}` +
      (missingDocs ? ` · ${missingDocs} sin documento` : ''),
  )
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
