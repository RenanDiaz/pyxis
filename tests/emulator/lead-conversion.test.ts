import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { convertLeadCalls, convertedClientStatus, getLeadCalls } from '@/lib/leadConversion'
import { as, createEnv, seed, WS } from '../rules/setup'

// Conversión de un lead en cliente (spec 19) con las reglas reales.

let env: RulesTestEnvironment
const db = (user: Parameters<typeof as>[1]) => as(env, user).firestore() as unknown as Firestore
const agCtx = { uid: 'ag', workspaceId: WS, role: 'agent' as const, subteamId: 'A' }
const lead = (digits: string) => ({ name: 'Juan Pérez', phone: '+1 (305) 555-1234', phone_digits: digits })

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
    const call = (id: string, owner: string, sub: string, digits: string, outcome = 'pendiente') =>
      setDoc(doc(fs, `workspaces/${WS}/calls/${id}`), {
        client_id: null, lead: lead(digits), owner_uid: owner, subteam_id: sub, outcome, notes: '',
      })
    await call('l1', 'ag', 'A', '3055551234', 'completada')
    await call('l2', 'ag', 'A', '3055551234')
    await call('l3', 'ag', 'A', '7865550000')
    await call('lOtro', 'ag2', 'B', '3055551234') // mismo número, otro agente
  })
})

describe('conversión de lead', () => {
  it('encuentra solo las llamadas visibles de ese lead y deduce el status', async () => {
    const calls = await getLeadCalls(db('ag'), agCtx, '3055551234')
    assert.deepEqual(calls.map((c) => c.id).sort(), ['l1', 'l2'])
    assert.equal(convertedClientStatus(calls), 'contactado')
    assert.equal(convertedClientStatus(calls.filter((c) => c.id === 'l2')), 'nuevo')
  })

  it('vincula esas llamadas al cliente nuevo y no toca las de otros', async () => {
    assert.equal(await convertLeadCalls(db('ag'), agCtx, '3055551234', 'cAg'), 2)
    const read = async (id: string) => {
      let data: Record<string, unknown> | undefined
      await env.withSecurityRulesDisabled(async (ctx) => {
        data = (await getDoc(doc(ctx.firestore(), `workspaces/${WS}/calls/${id}`))).data()
      })
      return data!
    }
    const l1 = await read('l1')
    assert.equal(l1.client_id, 'cAg')
    assert.equal(l1.converted_client_id, 'cAg')
    assert.equal('lead' in l1, false)
    assert.equal((await read('l3')).client_id, null)
    assert.equal((await read('lOtro')).client_id, null)
  })
})
