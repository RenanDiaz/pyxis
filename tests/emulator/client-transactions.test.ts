import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { runClientMutation } from '@/lib/clientTransactions'
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
