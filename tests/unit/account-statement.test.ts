import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess } from '@/types'
import {
  buildAccountStatement,
  canStateAccount,
  defaultStatementSelection,
  hasPendingBalance,
  statementDisabledReason,
  statementNumber,
} from '@/lib/accountStatement'

const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1))
const proc = (over: Partial<ClientProcess>): ClientProcess => ({
  id: 'p', type: 'ein', payments: [], stage: 'pendiente', created_at: now, ...over,
})
const client = (processes: ClientProcess[]) =>
  ({ id: 'abcdXYZ9', first_name: 'MARÍA', last_name: 'GONZÁLEZ', status: 'en_proceso', processes } as unknown as Client)
const pay = (amount: number, date: string, receipt_number?: number) =>
  ({ amount, method: 'zelle' as const, date, ...(receipt_number && { receipt_number }) })

describe('estado de cuenta', () => {
  it('número EC-yyMMdd-XXXX-HHmm', () => {
    assert.equal(statementNumber('abcdXYZ9', new Date(2026, 9, 9, 8, 30)), 'EC-261009-XYZ9-0830')
  })

  it('saldo por proceso y total; pagos ordenados por fecha con su N° de recibo', () => {
    const reg = proc({
      id: 'r', type: 'registration', state: 'FL', total: 579,
      payments: [pay(200, '2026-10-05T12:00:00.000Z', 2), pay(100, '2026-10-01T12:00:00.000Z', 1)],
    })
    const ein = proc({ id: 'e', total: 150, payments: [] })
    const s = buildAccountStatement(client([reg, ein]), [reg, ein], new Date(2026, 9, 9))
    assert.equal(s.recipient, 'MARÍA GONZÁLEZ')
    assert.deepEqual(s.lines.map((l) => [l.label, l.total, l.paid, l.balance]), [
      ['Registro de LLC — FL', 579, 300, 279],
      ['EIN', 150, 0, 150],
    ])
    assert.deepEqual(s.lines[0].payments.map((p) => [p.amount, p.receiptNumber]), [[100, 1], [200, 2]])
    assert.equal(s.total, 729)
    assert.equal(s.paid, 300)
    assert.equal(s.balance, 429)
  })

  it('procesos sin total no se pueden incluir; por defecto, los que deben', () => {
    assert.equal(canStateAccount(proc({})), false)
    assert.equal(hasPendingBalance(proc({ total: 100, payments: [pay(100, '2026-10-01')] })), false)
    assert.equal(hasPendingBalance(proc({ total: 100, payments: [pay(40, '2026-10-01')] })), true)
    assert.throws(() => buildAccountStatement(client([proc({})]), [proc({})]), /al menos un proceso/)
  })

  it('sobrepago: saldo negativo (a favor)', () => {
    const p = proc({ total: 100, payments: [pay(120, '2026-10-01')] })
    assert.equal(buildAccountStatement(client([p]), [p]).balance, -20)
  })
})

describe('estado de cuenta con procesos cancelados (spec 23)', () => {
  const reg = proc({ id: 'r', type: 'registration', state: 'FL', total: 579, payments: [pay(579, '2026-10-01T12:00:00.000Z', 1)] })

  it('un cancelado sin pagos no se puede incluir', () => {
    const ein = proc({ id: 'e', total: 150, stage: 'cancelado' })
    assert.equal(canStateAccount(ein), false)
    assert.equal(statementDisabledReason(ein), 'Cancelado sin pagos')
    assert.equal(hasPendingBalance(ein), false)
  })

  it('un cancelado no viene marcado, ni siquiera en un estado "al día"', () => {
    const ein = proc({ id: 'e', total: 150, stage: 'cancelado', payments: [pay(50, '2026-10-02T12:00:00.000Z', 1)] })
    assert.deepEqual(defaultStatementSelection([reg, ein]).map((p) => p.id), ['r'])
    const owing = proc({ id: 'o', total: 100 })
    assert.deepEqual(defaultStatementSelection([reg, ein, owing]).map((p) => p.id), ['o'])
  })

  it('incluido a mano: pagado, reembolsado y saldo 0; no suma al saldo pendiente', () => {
    const ein = proc({
      id: 'e', total: 150, stage: 'cancelado', refunded_amount: 20,
      payments: [pay(50, '2026-10-02T12:00:00.000Z', 1)],
    })
    const owing = proc({ id: 'o', total: 100 })
    const s = buildAccountStatement(client([ein, owing]), [ein, owing], new Date(2026, 9, 9))
    assert.deepEqual(
      s.lines.map((l) => [l.cancelled, l.total, l.paid, l.refunded, l.balance]),
      [[true, 30, 50, 20, 0], [false, 100, 0, 0, 100]],
    )
    assert.equal(s.lines[0].payments.length, 1)
    assert.equal(s.total, 130)
    assert.equal(s.paid, 30)
    assert.equal(s.balance, 100)
  })
})
