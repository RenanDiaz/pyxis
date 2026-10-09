import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Call, Client } from '@/types'
import {
  countClosed,
  countContacted,
  initialStatusFields,
  statusChangeFields,
} from '@/lib/statusHistory'

const day = (d: number) => Timestamp.fromDate(new Date(2026, 9, d, 12))
const isOct = (n: number) => (d: Date) => d.getMonth() === 9 && d.getDate() === n
const isOctober = (d: Date) => d.getMonth() === 9

function client(over: Partial<Client>): Client {
  return { id: 'c', status: 'nuevo', updated_at: day(1), ...over } as Client
}

describe('statusChangeFields', () => {
  it('sin cambio de status no escribe nada', () => {
    assert.equal(statusChangeFields({ status: 'cerrado' }, 'cerrado', 'u'), null)
  })

  it('registra el evento y fija contacted_at solo la primera vez', () => {
    const first = statusChangeFields({ status: 'nuevo' }, 'contactado', 'u', day(2))!
    assert.deepEqual(first.status_history, [{ from: 'nuevo', to: 'contactado', at: day(2), by: 'u' }])
    assert.deepEqual(first.contacted_at, day(2))
    const later = statusChangeFields({ status: 'contactado', contacted_at: day(2) }, 'en_proceso', 'u', day(5))!
    assert.equal('contacted_at' in later, false)
  })

  it('cerrar fija closed_at; reabrir lo limpia', () => {
    assert.deepEqual(statusChangeFields({ status: 'en_proceso' }, 'cerrado', 'u', day(3))!.closed_at, day(3))
    assert.equal(statusChangeFields({ status: 'cerrado', closed_at: day(3) }, 'en_proceso', 'u')!.closed_at, null)
  })

  it('perdido desde nuevo no cuenta como contactado', () => {
    assert.equal('contacted_at' in statusChangeFields({ status: 'nuevo' }, 'perdido', 'u')!, false)
  })

  it('el historial se limita a 50 eventos', () => {
    const history = Array.from({ length: 50 }, () => ({ from: 'nuevo' as const, to: 'contactado' as const, at: day(1), by: null }))
    const f = statusChangeFields({ status: 'contactado', status_history: history }, 'en_proceso', 'u')!
    assert.equal(f.status_history!.length, 50)
    assert.equal(f.status_history!.at(-1)!.to, 'en_proceso')
  })

  it('alta: evento inicial y fechas según el status de entrada', () => {
    const f = initialStatusFields('en_proceso', 'u', day(4))
    assert.deepEqual(f.status_history, [{ from: null, to: 'en_proceso', at: day(4), by: 'u' }])
    assert.deepEqual(f.contacted_at, day(4))
    assert.equal(f.closed_at, null)
  })
})

describe('métricas del dashboard', () => {
  it('editar un cliente cerrado el mes pasado no lo cuenta como venta de hoy', () => {
    const viejo = client({ status: 'cerrado', closed_at: Timestamp.fromDate(new Date(2026, 8, 10)), updated_at: day(9) })
    assert.equal(countClosed([viejo], isOct(9)), 0)
    assert.equal(countClosed([viejo], isOctober), 0)
  })

  it('un cliente reabierto no cuenta como cerrado', () => {
    assert.equal(countClosed([client({ status: 'en_proceso', closed_at: null, updated_at: day(9) })], isOctober), 0)
  })

  it('clientes sin migrar caen a updated_at (criterio anterior)', () => {
    assert.equal(countClosed([client({ status: 'cerrado', updated_at: day(9) })], isOct(9)), 1)
  })

  it('contactados hoy: clientes distintos entre status e intentos de contacto', () => {
    const a = client({ id: 'a', status: 'contactado', contacted_at: day(9) })
    const b = client({ id: 'b', status: 'en_proceso', contacted_at: day(1) })
    const calls = [
      { client_id: 'a', outcome: 'completada', scheduled_at: day(9) },
      { client_id: 'b', outcome: 'completada', scheduled_at: day(9) },
      { client_id: 'b', outcome: 'completada', scheduled_at: day(9) },
      { client_id: 'c', outcome: 'pendiente', scheduled_at: day(9) },
    ] as Call[]
    assert.equal(countContacted([a, b], calls, isOct(9)), 2)
  })
})
