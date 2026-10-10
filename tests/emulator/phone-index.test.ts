import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { runClientCreate, runClientUpdate } from '@/lib/clientTransactions'
import { findPhoneMatches } from '@/lib/phoneIndex'
import { deleteClientCascade } from '@/lib/workspaceAdmin'
import { as, createEnv, seed, WS } from '../rules/setup'

// Teléfonos duplicados (spec 07) con las reglas reales: el índice se mantiene
// al crear, editar y borrar, y cada rol se entera de lo que le corresponde.

let env: RulesTestEnvironment
const db = (user: Parameters<typeof as>[1]) => as(env, user).firestore() as unknown as Firestore
const PHONE = '+1 (305) 555-1234'

async function indexIds(digits: string): Promise<string[]> {
  let ids: string[] = []
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), `workspaces/${WS}/phone_index/${digits}`))
    ids = Object.keys(snap.get('client_ids') ?? {}).sort()
  })
  return ids
}

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
})

describe('índice de teléfonos', () => {
  it('al crear, el agente queda en el índice y otro agente solo se entera de que existe', async () => {
    const id = await runClientCreate(db('ag'), WS, {
      phone: PHONE,
      phones: [{ number: PHONE, label: 'personal', is_primary: true }],
      owner_uid: 'ag',
      subteam_id: 'A',
      notes: '',
    })
    assert.deepEqual(await indexIds('3055551234'), [id])

    const ag2 = await findPhoneMatches(db('ag2'), WS, ['3055551234'])
    assert.deepEqual(ag2, { visible: [], hiddenCount: 1 })

    const own = await findPhoneMatches(db('own'), WS, ['3055551234'])
    assert.equal(own.hiddenCount, 0)
    assert.deepEqual(own.visible.map((c) => c.id), [id])

    // Editando ese mismo cliente no es duplicado.
    assert.deepEqual(await findPhoneMatches(db('ag'), WS, ['3055551234'], id), { visible: [], hiddenCount: 0 })
  })

  it('al cambiar el teléfono, sale del número viejo y entra al nuevo', async () => {
    const id = await runClientCreate(db('ag'), WS, { phone: PHONE, owner_uid: 'ag', subteam_id: 'A', notes: '' })
    await runClientUpdate(db('ag'), WS, id, {
      phone: '+1 (786) 555-0000',
      phones: [
        { number: '+1 (786) 555-0000', label: 'personal', is_primary: true },
        { number: '305 555 9999', label: 'trabajo', is_primary: false },
      ],
    })
    assert.deepEqual(await indexIds('3055551234'), [])
    assert.deepEqual(await indexIds('7865550000'), [id])
    assert.deepEqual(await indexIds('3055559999'), [id])
  })

  it('al borrar el cliente (owner), sale del índice', async () => {
    const id = await runClientCreate(db('ag'), WS, { phone: PHONE, owner_uid: 'ag', subteam_id: 'A', notes: '' })
    await deleteClientCascade(db('own'), WS, id)
    assert.deepEqual(await indexIds('3055551234'), [])
  })
})
