/**
 * Auditoría de membresías — busca indicios de que alguien aprovechó las reglas
 * viejas de `members` (cualquiera podía crearse como owner de cualquier
 * workspace o cambiarse el rol). Solo lee; no modifica nada.
 *
 * Reporta, por workspace:
 *   - members con role "owner" que no son `workspace.owner_uid`
 *   - members sin invitación aceptada que los respalde (excepto el owner)
 *   - members cuyo `users/{uid}.workspace_id` apunta a otro workspace
 *
 * Los hallazgos no son prueba de abuso (un owner pudo promover a alguien a
 * mano), pero cada uno hay que revisarlo con el dueño del workspace.
 *
 * Prerequisitos:
 *   1. Firebase service account key en scripts/serviceAccountKey.json
 *
 * Uso:
 *   npx tsx scripts/audit-members.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  const workspaces = await db.collection('workspaces').get()
  let findings = 0

  for (const ws of workspaces.docs) {
    const ownerUid = ws.get('owner_uid') as string | undefined
    const [members, invitations] = await Promise.all([
      ws.ref.collection('members').get(),
      ws.ref.collection('invitations').where('status', '==', 'accepted').get(),
    ])
    const invitedEmails = new Set(
      invitations.docs.map((d) => String(d.get('email') ?? '').toLowerCase()),
    )

    const issues: string[] = []
    for (const m of members.docs) {
      const role = m.get('role')
      const email = String(m.get('email') ?? '').toLowerCase()
      const label = `${m.get('display_name') ?? '?'} <${email || 'sin email'}> (${m.id})`

      if (role === 'owner' && m.id !== ownerUid) {
        issues.push(`⚠️  owner que no es el dueño del workspace: ${label}`)
      }
      if (m.id !== ownerUid && !invitedEmails.has(email)) {
        issues.push(`⚠️  ${role} sin invitación aceptada para su email: ${label}`)
      }
      const user = await db.collection('users').doc(m.id).get()
      const userWs = user.get('workspace_id')
      if (userWs !== ws.id) {
        issues.push(`ℹ️  ${label}: users.workspace_id = ${userWs ?? 'null'}`)
      }
    }

    if (issues.length) {
      findings += issues.length
      console.log(`\n${ws.get('name') ?? '(sin nombre)'} — ${ws.id} (owner ${ownerUid})`)
      issues.forEach((i) => console.log(`  ${i}`))
    }
  }

  console.log(`\n${workspaces.size} workspaces revisados, ${findings} hallazgos.`)
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
