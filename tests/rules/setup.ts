import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { doc, setDoc, Timestamp } from 'firebase/firestore'

export const PROJECT_ID = 'demo-pyxis'
export const WS = 'ws1'
export const DAY = 24 * 60 * 60 * 1000

/**
 * Workspace de prueba:
 * - own: owner
 * - sup: supervisor del subequipo A · supNo: supervisor sin subequipo
 * - ag: agente de A · ag2: agente de B
 * - out: usuario sin workspace · adm: admin global (sin workspace)
 */
export const USERS = {
  own: { uid: 'own', email: 'own@test.com' },
  sup: { uid: 'sup', email: 'sup@test.com' },
  supNo: { uid: 'supNo', email: 'supno@test.com' },
  ag: { uid: 'ag', email: 'ag@test.com' },
  ag2: { uid: 'ag2', email: 'ag2@test.com' },
  out: { uid: 'out', email: 'out@test.com' },
  adm: { uid: 'adm', email: 'adm@test.com' },
} as const

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
}

export function as(env: RulesTestEnvironment, user: keyof typeof USERS) {
  const { uid, email } = USERS[user]
  return env.authenticatedContext(uid, { email })
}

export async function seed(env: RulesTestEnvironment) {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const now = Timestamp.now()
    const set = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data)

    await set(`workspaces/${WS}`, { name: 'Pyxis Test', owner_uid: 'own', created_at: now })
    const members: [string, string, string | null][] = [
      ['own', 'owner', null],
      ['sup', 'supervisor', 'A'],
      ['supNo', 'supervisor', null],
      ['ag', 'agent', 'A'],
      ['ag2', 'agent', 'B'],
    ]
    for (const [uid, role, subteam_id] of members) {
      await set(`workspaces/${WS}/members/${uid}`, { uid, role, subteam_id, email: `${uid}@test.com` })
      await set(`users/${uid}`, { uid, workspace_id: WS })
    }
    await set('users/out', { uid: 'out', workspace_id: null })
    await set('users/adm', { uid: 'adm', workspace_id: null })
    await set('admins/adm', { email: 'adm@test.com' })

    await set(`workspaces/${WS}/clients/cAg`, { owner_uid: 'ag', subteam_id: 'A', notes: '' })
    await set(`workspaces/${WS}/clients/cAg2`, { owner_uid: 'ag2', subteam_id: 'B', notes: '' })
    await set(`workspaces/${WS}/clients/cNoSub`, { owner_uid: 'own', subteam_id: null, notes: '' })
    // Cliente viejo: el agente cambió de subequipo después de crearlo.
    await set(`workspaces/${WS}/clients/cAgLegacy`, { owner_uid: 'ag', subteam_id: 'OLD', notes: '' })
    await set(`workspaces/${WS}/clients/cAg/documents/d1`, { name: 'id.pdf', uploaded_by_uid: 'ag' })
    await set(`workspaces/${WS}/clients/cAg2/documents/d2`, { name: 'ssn.pdf', uploaded_by_uid: 'ag2' })

    await set(`workspaces/${WS}/calls/callAg`, { client_id: 'cAg', owner_uid: 'ag', subteam_id: 'A' })
    await set(`workspaces/${WS}/calls/callAg2`, { client_id: 'cAg2', owner_uid: 'ag2', subteam_id: 'B' })

    const invitation = (email: string, expiresInMs: number, status = 'pending') => ({
      email,
      role: 'agent',
      subteam_id: 'A',
      token: 'x',
      status,
      created_by_uid: 'own',
      created_at: now,
      expires_at: Timestamp.fromMillis(Date.now() + expiresInMs),
      workspace_name: 'Pyxis Test',
    })
    await set(`workspaces/${WS}/invitations/tok-out`, invitation('out@test.com', 7 * DAY))
    await set(`workspaces/${WS}/invitations/tok-expired`, invitation('out@test.com', -DAY))
    await set(`workspaces/${WS}/invitations/tok-used`, invitation('out@test.com', 7 * DAY, 'accepted'))
    await set('states/FL', { abbreviation: 'FL', state_fee: '$125' })
  })
}
