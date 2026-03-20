/**
 * Seed script — populates Firestore with data from JSON files.
 *
 * Prerequisites:
 *   1. Create a Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as `scripts/serviceAccountKey.json` (gitignored)
 *
 * Run:
 *   npx tsx scripts/seed.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
const clientFormData = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/client_form.json'), 'utf-8')
)

async function seedStates() {
  console.log('📍 Seeding states...')
  const batch = db.batch()
  for (const state of statesData) {
    const ref = db.collection('states').doc(state.abbreviation)
    batch.set(ref, state)
  }
  await batch.commit()
  console.log(`   ✅ ${statesData.length} estados creados`)
}

async function seedTrades() {
  console.log('🔧 Seeding trades...')
  const batch = db.batch()
  for (const trade of tradesData) {
    const ref = db.collection('trades').doc(String(trade.id))
    batch.set(ref, trade)
  }
  await batch.commit()
  console.log(`   ✅ ${tradesData.length} oficios creados`)
}

async function seedClientForm() {
  console.log('📋 Seeding client form config...')
  await db.collection('config').doc('clientForm').set(clientFormData)
  console.log('   ✅ Configuración del formulario creada')
}

async function main() {
  console.log('🚀 Iniciando seed de Firestore...\n')
  await seedStates()
  await seedTrades()
  await seedClientForm()
  console.log('\n✅ Seed completado exitosamente')
}

main().catch((err) => {
  console.error('❌ Error en seed:', err)
  process.exit(1)
})
