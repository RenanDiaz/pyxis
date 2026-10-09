import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Call } from '@/types'
import { filterAgenda, isInPast, isOverdue, scheduledInstant } from '@/lib/agenda'

const now = new Date(2026, 9, 9, 12, 0) // vie 9 oct 2026, 12:00 local
const at = (d: number, h = 10) => Timestamp.fromDate(new Date(2026, 9, d, h))
const call = (id: string, d: number, outcome: Call['outcome'] = 'pendiente', over: Partial<Call> = {}) =>
  ({ id, client_id: 'c', scheduled_at: at(d), outcome, notes: '', ...over } as Call)

const calls = [
  call('vencida', 8),
  call('hoy', 9, 'pendiente'),
  call('futura', 20),
  call('hecha', 7, 'completada'),
  call('hecha2', 9, 'no_contesto'),
  call('intento', 9, 'completada', { kind: 'contact_attempt' }),
]

describe('agenda', () => {
  it('pendientes: vencidas primero, sin intentos de contacto', () => {
    assert.deepEqual(filterAgenda(calls, 'pendientes', now).map((c) => c.id), ['vencida', 'hoy', 'futura'])
  })

  it('hoy y semana en orden cronológico; historial de la más reciente a la más vieja', () => {
    assert.deepEqual(filterAgenda(calls, 'hoy', now).map((c) => c.id).sort(), ['hecha2', 'hoy'])
    assert.deepEqual(filterAgenda(calls, 'semana', now).map((c) => c.id), ['hecha', 'vencida', 'hoy', 'hecha2'])
    assert.deepEqual(filterAgenda(calls, 'historial', now).map((c) => c.id), ['hecha2', 'hecha'])
  })

  it('vencida = pendiente con fecha pasada', () => {
    assert.equal(isOverdue(call('x', 8), now), true)
    assert.equal(isOverdue(call('x', 8, 'completada'), now), false)
  })

  it('10:00 hora del cliente en California = 17:00 UTC (horario de verano)', () => {
    assert.equal(scheduledInstant('2026-10-09', '10:00', 'America/Los_Angeles').toISOString(), '2026-10-09T17:00:00.000Z')
  })

  it('en el pasado, con margen de 5 minutos', () => {
    assert.equal(isInPast(new Date(now.getTime() - 4 * 60_000), now), false)
    assert.equal(isInPast(new Date(now.getTime() - 6 * 60_000), now), true)
  })
})
