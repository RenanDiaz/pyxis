import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { runClientMutation, runClientUpdate } from '@/lib/clientTransactions'
import { clientMutations } from '@/lib/processMutations'
import type { ClientProcess } from '@/types'
import { as, createEnv, seed, WS } from '../rules/setup'

// Dos instancias distintas del SDK (dos "pestañas") escribiendo a la vez sobre
// el mismo cliente: con la transacción, ningún cambio se pierde.

let env: RulesTestEnvironment
const db = (user: Parameters<typeof as>[1]) => as(env, user).firestore() as unknown as Firestore
const CLIENT = `workspaces/${WS}/clients/cAg`

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
  const processes: ClientProcess[] = ['p1', 'p2'].map((id) => ({
    id,
    type: 'registration',
    total: 300,
    payments: [],
    stage: 'pendiente',
    created_at: Timestamp.now(),
  }))
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), CLIENT), { owner_uid: 'ag', subteam_id: 'A', status: 'contactado', phone: '', processes }),
  )
})

async function read() {
  const snap = await getDoc(doc(db('own'), CLIENT))
  return snap.data() as { processes: ClientProcess[]; status: string }
}

const payment = (amount: number) => ({ amount, method: 'zelle' as const, date: new Date().toISOString() })

describe('mutaciones transaccionales de procesos', () => {
  it('dos pagos concurrentes en el mismo proceso persisten ambos', async () => {
    await Promise.all([
      runClientMutation(db('ag'), WS, 'cAg', clientMutations.addPayment('p1', payment(100))),
      runClientMutation(db('own'), WS, 'cAg', clientMutations.addPayment('p1', payment(50))),
    ])
    const { processes } = await read()
    const p1 = processes.find((p) => p.id === 'p1')!
    assert.deepEqual(p1.payments.map((p) => p.amount).sort((a, b) => a - b), [50, 100])
    assert.deepEqual(p1.payments.map((p) => p.receipt_number).sort(), [1, 2])
  })

  it('un pago en p1 y un cambio de etapa en p2 concurrentes persisten ambos', async () => {
    await Promise.all([
      runClientMutation(db('ag'), WS, 'cAg', clientMutations.addPayment('p1', payment(100))),
      runClientMutation(db('own'), WS, 'cAg', clientMutations.updateProcess('p2', { stage: 'completado' })),
    ])
    const { processes, status } = await read()
    assert.equal(processes.find((p) => p.id === 'p1')!.payments.length, 1)
    assert.equal(processes.find((p) => p.id === 'p2')!.stage, 'completado')
    assert.equal(status, 'en_proceso')
  })

  it('el agente no puede mutar un cliente ajeno (las reglas siguen aplicando)', async () => {
    await assert.rejects(
      runClientMutation(db('ag'), WS, 'cAg2', clientMutations.updateProcess('p1', { stage: 'completado' })),
      (err: { code?: string }) => err.code === 'permission-denied',
    )
  })
})

describe('historial de status', () => {
  it('saldar con pagos cierra al cliente y registra closed_at e historial', async () => {
    await runClientMutation(db('ag'), WS, 'cAg', clientMutations.addPayment('p1', payment(300)), 'ag')
    const snap = await getDoc(doc(db('own'), CLIENT))
    const data = snap.data()!
    assert.equal(data.status, 'en_proceso')
    await runClientMutation(db('ag'), WS, 'cAg', clientMutations.addPayment('p2', payment(300)), 'ag')
    const closed = (await getDoc(doc(db('own'), CLIENT))).data()!
    assert.equal(closed.status, 'cerrado')
    assert.ok(closed.closed_at)
    assert.deepEqual(
      closed.status_history.map((e: { from: string; to: string; by: string }) => [e.from, e.to, e.by]),
      [['contactado', 'en_proceso', 'ag'], ['en_proceso', 'cerrado', 'ag']],
    )
  })

  it('un trigger (form de edición) no revierte un status que cambió mientras tanto', async () => {
    // El cliente se cerró (p. ej. por un pago) con el form de edición abierto.
    await runClientUpdate(db('own'), WS, 'cAg', { status: 'cerrado' }, { by: 'own' })
    // El form guarda con trigger info_added: no debe volver a "contactado".
    await runClientUpdate(db('ag'), WS, 'cAg', { email: 'X@Y.COM' }, { trigger: 'info_added', by: 'ag' })
    const data = (await getDoc(doc(db('own'), CLIENT))).data()!
    assert.equal(data.status, 'cerrado')
    assert.equal(data.status_history.length, 1)
    assert.equal(data.email, 'X@Y.COM')
  })
})
