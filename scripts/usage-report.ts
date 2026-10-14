/**
 * Reporte de uso con datos de negocio (spec 24). Complementa a PostHog: cuenta
 * lo que los agentes CREAN en Pyxis (clientes, procesos, pagos, llamadas), sin
 * depender de que nadie haya aceptado tracking.
 *
 * Solo lectura. Imprime conteos agregados por workspace y por agente (uid
 * opaco): nunca nombres, teléfonos, notas ni montos de clientes.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/usage-report.ts                    # mes actual
 *   npx tsx scripts/usage-report.ts --month=2026-09
 *   npx tsx scripts/usage-report.ts --month=2026-09 --csv > uso.csv
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, type Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV = process.argv.includes('--csv')
const monthArg = process.argv.find((a) => a.startsWith('--month='))?.slice('--month='.length)
const now = new Date()
const MONTH = monthArg ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(MONTH)) {
  console.error('❌ --month debe ser yyyy-MM, p. ej. --month=2026-09')
  process.exit(1)
}
const [year, month] = MONTH.split('-').map(Number)
const START = new Date(year, month - 1, 1)
const END = new Date(year, month, 1)

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

const inMonth = (d: Date | null | undefined): boolean => !!d && d >= START && d < END
const tsDate = (t: unknown): Date | null => (t && typeof (t as Timestamp).toDate === 'function' ? (t as Timestamp).toDate() : null)
const isoDate = (s: unknown): Date | null => {
  if (typeof s !== 'string') return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

interface Usage {
  clients: number
  processes: Record<string, number>
  payments: number
  receipts: number
  calls_scheduled: number
  calls_resolved: number
  lead_calls: number
}
const empty = (): Usage => ({
  clients: 0,
  processes: {},
  payments: 0,
  receipts: 0,
  calls_scheduled: 0,
  calls_resolved: 0,
  lead_calls: 0,
})

async function main() {
  const workspaces = await db.collection('workspaces').get()
  const rows: Array<{ workspace: string; agent: string; usage: Usage }> = []

  for (const ws of workspaces.docs) {
    const byAgent = new Map<string, Usage>()
    const usageOf = (uid: string) => {
      let u = byAgent.get(uid)
      if (!u) byAgent.set(uid, (u = empty()))
      return u
    }

    for (const doc of (await ws.ref.collection('clients').get()).docs) {
      const c = doc.data()
      const u = usageOf(c.owner_uid ?? '(sin agente)')
      if (inMonth(tsDate(c.created_at))) u.clients++
      for (const p of (c.processes ?? []) as Array<Record<string, unknown>>) {
        const type = String(p.type)
        if (inMonth(tsDate(p.created_at))) u.processes[type] = (u.processes[type] ?? 0) + 1
        for (const pay of (p.payments ?? []) as Array<Record<string, unknown>>) {
          if (!inMonth(isoDate(pay.date))) continue
          u.payments++
          if (pay.receipt_number) u.receipts++
        }
      }
    }

    for (const doc of (await ws.ref.collection('calls').get()).docs) {
      const c = doc.data()
      if (c.kind === 'contact_attempt' || !inMonth(tsDate(c.scheduled_at))) continue
      const u = usageOf(c.owner_uid ?? '(sin agente)')
      u.calls_scheduled++
      if (c.outcome && c.outcome !== 'pendiente') u.calls_resolved++
      if (c.lead) u.lead_calls++
    }

    for (const [agent, usage] of byAgent) rows.push({ workspace: ws.id, agent, usage })
  }

  const processTypes = [...new Set(rows.flatMap((r) => Object.keys(r.usage.processes)))].sort()
  const header = [
    'workspace', 'agente', 'clientes', ...processTypes.map((t) => `proc:${t}`),
    'pagos', 'recibos', 'llamadas', 'llamadas_resueltas', 'llamadas_leads',
  ]
  const lines = rows.map(({ workspace, agent, usage: u }) => [
    workspace, agent, u.clients, ...processTypes.map((t) => u.processes[t] ?? 0),
    u.payments, u.receipts, u.calls_scheduled, u.calls_resolved, u.lead_calls,
  ])

  if (CSV) {
    console.log(header.join(','))
    for (const l of lines) console.log(l.join(','))
  } else {
    console.log(`# Uso de Pyxis — ${MONTH}\n`)
    console.log(`| ${header.join(' | ')} |`)
    console.log(`|${header.map(() => '---').join('|')}|`)
    for (const l of lines) console.log(`| ${l.join(' | ')} |`)
  }
  if (rows.length === 0) console.error('Sin datos de uso en el mes.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
