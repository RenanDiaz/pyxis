/**
 * Seed script — populates Firestore with data from JSON files.
 *
 * Prerequisites:
 *   1. Create a Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as `scripts/serviceAccountKey.json` (gitignored)
 *
 * Run:
 *   npx tsx scripts/seed.ts [--dry-run] [--overwrite-states]
 *
 * `states` se edita desde la app (StateEditDialog): por defecto solo se crean
 * los estados que faltan y NUNCA se pisan los existentes. `--overwrite-states`
 * fuerza reemplazarlos con `src/data/states.json` (pierde las ediciones).
 * `trades` y `glossary` no se editan en la app: se reescriben siempre.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// `"type": "module"`: no existe __dirname.
const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const OVERWRITE_STATES = process.argv.includes('--overwrite-states')

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

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

// Load data files
const statesData = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/states.json'), 'utf-8')
)
const tradesData = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/trades.json'), 'utf-8')
)
const glossaryData = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/glossary.json'), 'utf-8')
)

async function seedStates() {
  console.log('📍 Seeding states...')
  const existing = new Set((await db.collection('states').get()).docs.map((d) => d.id))
  const toWrite = OVERWRITE_STATES
    ? statesData
    : statesData.filter((s: { abbreviation: string }) => !existing.has(s.abbreviation))
  const kept = statesData.length - toWrite.length
  if (!DRY_RUN && toWrite.length > 0) {
    const batch = db.batch()
    for (const state of toWrite) {
      batch.set(db.collection('states').doc(state.abbreviation), state)
    }
    await batch.commit()
  }
  console.log(
    `   ✅ ${toWrite.length} estados ${OVERWRITE_STATES ? 'reemplazados' : 'creados'}` +
      (kept ? ` · ${kept} existentes sin tocar (usa --overwrite-states para reemplazarlos)` : '')
  )
}

async function seedTrades() {
  console.log('🔧 Seeding trades...')
  const batch = db.batch()
  for (const trade of tradesData) {
    const ref = db.collection('trades').doc(String(trade.id))
    batch.set(ref, trade)
  }
  if (!DRY_RUN) await batch.commit()
  console.log(`   ✅ ${tradesData.length} oficios creados`)
}

async function seedGlossary() {
  console.log('📖 Seeding glossary...')
  const batch = db.batch()
  for (const term of glossaryData) {
    const ref = db.collection('glossary').doc(term.term)
    batch.set(ref, term)
  }
  if (!DRY_RUN) await batch.commit()
  console.log(`   ✅ ${glossaryData.length} términos creados`)
}

async function main() {
  console.log('🚀 Iniciando seed de Firestore...')
  console.log(DRY_RUN ? '🔍 Dry run: no se escribe nada\n' : '')
  await seedStates()
  await seedTrades()
  await seedGlossary()
  console.log('\n✅ Seed completado exitosamente')
}

main().catch((err) => {
  console.error('❌ Error en seed:', err)
  process.exit(1)
})
