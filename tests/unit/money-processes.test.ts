import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess, Payment } from '@/types'
import { roundMoney, sumMoney } from '@/lib/money'
import { getClientPaymentSummary, getProcessBalance } from '@/lib/processUtils'
import {
  addPaymentTo,
  clientMutations,
  getBalanceAfterPayment,
  getReceiptNumber,
  paymentKey,
  removePaymentFrom,
  updatePaymentIn,
} from '@/lib/processMutations'

const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1))

function proc(over: Partial<ClientProcess> = {}): ClientProcess {
  return { id: 'p1', type: 'registration', payments: [], stage: 'pendiente', created_at: now, ...over }
}

function pay(amount: number, date: string, over: Partial<Payment> = {}): Payment {
  return { amount, method: 'zelle', date, ...over }
}

function client(processes: ClientProcess[], status: Client['status'] = 'en_proceso'): Client {
  return {
    id: 'c1',
    phone: '',
    status,
    processes,
    owner_uid: 'u',
    subteam_id: null,
    created_at: now,
    updated_at: now,
  } as unknown as Client
}

describe('dinero en centavos', () => {
  it('33.33 + 33.33 + 33.34 suma exactamente 100', () => {
    assert.equal(sumMoney([33.33, 33.33, 33.34]), 100)
    assert.equal(0.1 + 0.2 === 0.3, false)
    assert.equal(sumMoney([0.1, 0.2]), 0.3)
  })

  it('saldo de proceso sin residuo de coma flotante', () => {
    const p = proc({ total: 100, payments: [pay(33.33, '2026-10-01'), pay(33.33, '2026-10-02'), pay(33.34, '2026-10-03')] })
    assert.equal(getProcessBalance(p), 0)
    assert.equal(getClientPaymentSummary(client([p])).balance, 0)
  })

  it('redondea montos capturados a centavos', () => {
    assert.equal(roundMoney(10.005), 10.01)
    assert.equal(roundMoney(19.999), 20)
  })
})

describe('pagos con identidad y recibos estables', () => {
  it('cada pago nuevo recibe id y número de recibo consecutivo', () => {
    let ps = [proc({ total: 300 })]
    ps = addPaymentTo(ps, 'p1', pay(100, '2026-10-01'), 'a')
    ps = addPaymentTo(ps, 'p1', pay(100, '2026-10-02'), 'b')
    assert.deepEqual(ps[0].payments.map((p) => [p.id, p.receipt_number]), [['a', 1], ['b', 2]])
  })

  it('borrar un pago no renumera los demás (ni los legacy)', () => {
    const legacy = proc({ total: 300, payments: [pay(100, '2026-10-01'), pay(100, '2026-10-02'), pay(100, '2026-10-03')] })
    const [first] = legacy.payments
    const after = removePaymentFrom([legacy], 'p1', paymentKey(first))[0]
    assert.deepEqual(after.payments.map((p) => getReceiptNumber(after, p)), [2, 3])
    // El siguiente pago no reutiliza un número ya emitido.
    const next = addPaymentTo([after], 'p1', pay(50, '2026-10-04'), 'z')[0]
    assert.equal(next.payments.at(-1)?.receipt_number, 4)
  })

  it('el saldo del recibo depende de la fecha, no del orden en el array', () => {
    // Pago con fecha vieja cargado al final.
    const p = proc({
      total: 300,
      payments: [pay(100, '2026-10-05T12:00:00.000Z', { receipt_number: 1 }), pay(50, '2026-10-01T12:00:00.000Z', { receipt_number: 2 })],
    })
    assert.equal(getBalanceAfterPayment(p, p.payments[1]), 250)
    assert.equal(getBalanceAfterPayment(p, p.payments[0]), 150)
  })

  it('con dos pagos legacy idénticos, borrar uno deja el otro', () => {
    const p = proc({ total: 200, payments: [pay(100, '2026-10-01'), pay(100, '2026-10-01')] })
    const after = removePaymentFrom([p], 'p1', paymentKey(p.payments[0]))[0]
    assert.equal(after.payments.length, 1)
    assert.equal(after.payments[0].receipt_number, 2)
  })

  it('pago o proceso inexistente da un error claro', () => {
    assert.throws(() => removePaymentFrom([proc()], 'p1', 'nope'), /ya no existe/)
    assert.throws(() => addPaymentTo([proc()], 'otro', pay(1, '2026-10-01')), /ya no existe/)
  })
})

describe('editar un pago (spec 04, req. 14)', () => {
  it('corrige monto, fecha, método y nota sin cambiar id ni número de recibo', () => {
    const p = proc({
      total: 600,
      payments: [
        pay(300, '2026-09-03T12:00:00.000Z', { id: 'a', receipt_number: 1, note: 'anticipo' }),
        pay(100, '2026-09-09T12:00:00.000Z', { id: 'b', receipt_number: 2 }),
      ],
    })
    const after = updatePaymentIn([p], 'p1', 'a', {
      amount: 312.004, date: '2026-08-28T12:00:00.000Z', method: 'stripe', note: '',
    })[0]
    assert.deepEqual(after.payments[0], {
      id: 'a', receipt_number: 1, amount: 312, date: '2026-08-28T12:00:00.000Z', method: 'stripe',
    })
    assert.deepEqual(after.payments[1], p.payments[1])
  })

  it('un pago legacy conserva el número que tenía y recibe id', () => {
    const p = proc({ total: 300, payments: [pay(100, '2026-10-01'), pay(100, '2026-10-02')] })
    const after = updatePaymentIn([p], 'p1', paymentKey(p.payments[1]), { amount: 150 }, 'nuevo')[0]
    assert.deepEqual(after.payments[1], { amount: 150, method: 'zelle', date: '2026-10-02', id: 'nuevo', receipt_number: 2 })
    assert.equal(getReceiptNumber(after, after.payments[0]), 1)
  })

  it('subir el monto hasta saldar cierra al cliente; bajarlo lo reabre', () => {
    const p = proc({ total: 300, payments: [pay(200, '2026-10-01', { id: 'a', receipt_number: 1 })] })
    assert.equal(clientMutations.updatePayment('p1', 'a', { amount: 300 })(client([p])).status, 'cerrado')
    const paid = proc({ total: 300, payments: [pay(300, '2026-10-01', { id: 'a', receipt_number: 1 })] })
    assert.equal(clientMutations.updatePayment('p1', 'a', { amount: 250 })(client([paid], 'cerrado')).status, 'en_proceso')
  })

  it('pago inexistente da un error claro', () => {
    assert.throws(() => updatePaymentIn([proc()], 'p1', 'nope', { amount: 1 }), /ya no existe/)
  })
})

describe('status según saldos', () => {
  it('saldar el total con centavos cierra al cliente', () => {
    let c = client([proc({ total: 100 })], 'contactado')
    for (const [i, amount] of [33.33, 33.33].entries()) {
      const change = clientMutations.addPayment('p1', pay(amount, `2026-10-0${i + 1}`))(c)
      c = { ...c, processes: change.processes, status: change.status ?? c.status }
    }
    assert.equal(c.status, 'en_proceso')
    const last = clientMutations.addPayment('p1', pay(33.34, '2026-10-03'))(c)
    assert.equal(last.status, 'cerrado')
  })

  it('borrar un pago de un cliente cerrado lo reabre', () => {
    const p = proc({ total: 100, payments: [pay(60, '2026-10-01', { id: 'x', receipt_number: 1 }), pay(40, '2026-10-02', { id: 'y', receipt_number: 2 })] })
    const change = clientMutations.removePayment('p1', 'y')(client([p], 'cerrado'))
    assert.equal(change.status, 'en_proceso')
  })

  it('bajar el total al monto pagado cierra; cambiar la etapa no toca el status', () => {
    const p = proc({ total: 200, payments: [pay(150, '2026-10-01', { id: 'x', receipt_number: 1 })] })
    assert.equal(clientMutations.updateProcess('p1', { total: 150 })(client([p])).status, 'cerrado')
    assert.equal(clientMutations.updateProcess('p1', { stage: 'completado' })(client([p])).status, undefined)
  })

  it('un cliente cerrado a mano con saldo no se reabre por editar el total', () => {
    const p = proc({ total: 200, payments: [pay(50, '2026-10-01', { id: 'x', receipt_number: 1 })] })
    assert.equal(clientMutations.updateProcess('p1', { total: 250 })(client([p], 'cerrado')).status, undefined)
  })

  it('patch con undefined quita la clave (volver a heredar la compañía)', () => {
    const p = proc({ llc_name: 'ACME LLC' })
    const after = clientMutations.updateProcess('p1', { llc_name: undefined })(client([p])).processes[0]
    assert.equal('llc_name' in after, false)
  })
})
