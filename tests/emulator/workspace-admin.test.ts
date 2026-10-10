import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore'
import {
  countClientDependents,
  deleteClientCascade,
  deleteWorkspaceCascade,
  removeMemberWithReassign,
  transferOwnership,
} from '@/lib/workspaceAdmin'
import { as, createEnv, seed, WS } from '../rules/setup'

// Operaciones del owner (spec 06) contra el emulador, con las reglas reales.

let env: RulesTestEnvironment
const db = (user: Parameters<typeof as>[1]) => as(env, user).firestore() as unknown as Firestore

/** Lectura sin reglas, para verificar el resultado. */
async function raw<T>(fn: (fs: Firestore) => Promise<T>): Promise<T> {
  let out!: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = await fn(ctx.firestore() as unknown as Firestore)
  })
  return out
}
const exists = (path: string) => raw(async (fs) => (await getDoc(doc(fs, path))).exists())
const field = (path: string, key: string) => raw(async (fs) => (await getDoc(doc(fs, path))).get(key))

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, `workspaces/${WS}/clients/cAg/documents/d1`), {
      name: 'id.pdf',
      uploaded_by_uid: 'ag',
      storage_path: `workspaces/${WS}/clients/cAg/1_id.pdf`,
    })
    await setDoc(doc(fs, `workspaces/${WS}/calls/callAg2b`), { client_id: 'cAg2', owner_uid: 'ag2', subteam_id: 'B' })
    await setDoc(doc(fs, `workspaces/${WS}/goals/g1`), { type: 'monthly' })
    await setDoc(doc(fs, `workspaces/${WS}/subteams/A`), { name: 'A' })
  })
})

describe('workspaceAdmin', () => {
  it('quitar miembro reasigna sus clientes y llamadas y lo desvincula', async () => {
    const result = await removeMemberWithReassign(db('own'), WS, 'ag2', { uid: 'ag', subteam_id: 'A' })
    assert.deepEqual(result, { clients: 1, calls: 2 })
    assert.equal(await field(`workspaces/${WS}/clients/cAg2`, 'owner_uid'), 'ag')
    assert.equal(await field(`workspaces/${WS}/clients/cAg2`, 'subteam_id'), 'A')
    assert.equal(await field(`workspaces/${WS}/calls/callAg2b`, 'owner_uid'), 'ag')
    assert.equal(await exists(`workspaces/${WS}/members/ag2`), false)
    assert.equal(await field('users/ag2', 'workspace_id'), null)
  })

  it('transferir propiedad: nuevo owner con rol owner, el anterior supervisor', async () => {
    await transferOwnership(db('own'), WS, 'own', 'sup')
    assert.equal(await field(`workspaces/${WS}`, 'owner_uid'), 'sup')
    assert.equal(await field(`workspaces/${WS}/members/sup`, 'role'), 'owner')
    assert.equal(await field(`workspaces/${WS}/members/own`, 'role'), 'supervisor')
  })

  it('borrar cliente se lleva sus llamadas, documentos y archivos', async () => {
    assert.deepEqual(await countClientDependents(db('own'), WS, 'cAg'), { calls: 1, documents: 1 })
    const deleted: string[] = []
    await deleteClientCascade(db('own'), WS, 'cAg', async (path) => {
      deleted.push(path)
    })
    assert.deepEqual(deleted, [`workspaces/${WS}/clients/cAg/1_id.pdf`])
    assert.equal(await exists(`workspaces/${WS}/clients/cAg`), false)
    assert.equal(await exists(`workspaces/${WS}/clients/cAg/documents/d1`), false)
    assert.equal(await exists(`workspaces/${WS}/calls/callAg`), false)
    assert.equal(await exists(`workspaces/${WS}/calls/callAg2`), true)
  })

  it('un agente no puede borrar su cliente en cascada', async () => {
    await assert.rejects(deleteClientCascade(db('ag'), WS, 'cAg'))
  })

  it('borrar workspace no deja nada y desvincula a todos los miembros', async () => {
    const steps = new Set<string>()
    await deleteWorkspaceCascade(db('own'), WS, 'own', { onProgress: (p) => steps.add(p.step) })
    for (const sub of ['clients', 'calls', 'goals', 'invitations', 'subteams', 'members']) {
      const left = await raw(async (fs) => (await getDocs(collection(fs, `workspaces/${WS}/${sub}`))).size)
      assert.equal(left, 0, sub)
    }
    assert.equal(await exists(`workspaces/${WS}/clients/cAg/documents/d1`), false)
    assert.equal(await exists(`workspaces/${WS}`), false)
    for (const uid of ['own', 'sup', 'supNo', 'ag', 'ag2']) {
      assert.equal(await field(`users/${uid}`, 'workspace_id'), null, uid)
    }
    assert.ok(steps.has('Miembros') && steps.has('Workspace'))
  })
})
