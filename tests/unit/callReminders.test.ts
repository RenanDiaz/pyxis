import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dueReminders, reminderKey } from '@/lib/callReminders'
import type { Call } from '@/types'

const MIN = 60_000
const T = Date.UTC(2026, 9, 9, 15, 0) // la llamada es a las T
const call = (over: Partial<Call> = {}) =>
  ({
    id: 'c1',
    client_id: 'x',
    owner_uid: 'me',
    outcome: 'pendiente',
    kind: 'scheduled',
    scheduled_at: { toMillis: () => T },
    ...over,
  }) as unknown as Call
const none = () => false
const kinds = (now: number, calls = [call()], fired = none) => dueReminders(calls, 'me', now, fired).map((d) => d.kind)

describe('avisos de llamadas (spec 21)', () => {
  it('nada antes de los 5 minutos; "before" a T−5; "now" a T', () => {
    assert.deepEqual(kinds(T - 6 * MIN), [])
    assert.deepEqual(kinds(T - 5 * MIN), ['before'])
    assert.deepEqual(kinds(T - 2 * MIN, [call()], (k) => k.endsWith(`before:${T}`)), [])
    assert.deepEqual(kinds(T, [call()], (k) => k.includes(':before:')), ['now'])
  })

  it('si llegan los dos juntos, solo "es la hora"', () => {
    assert.deepEqual(kinds(T + MIN), ['now'])
  })

  it('pasada la hora, "en 5 minutos" no sale aunque "es la hora" ya se haya mostrado', () => {
    assert.deepEqual(kinds(T + MIN, [call()], (k) => k.includes(':now:')), [])
  })

  it('margen de 10 minutos para avisos atrasados', () => {
    assert.deepEqual(kinds(T + 10 * MIN), ['now'])
    assert.deepEqual(kinds(T + 11 * MIN), [])
  })

  it('solo llamadas propias, pendientes y agendadas', () => {
    assert.deepEqual(kinds(T, [call({ owner_uid: 'otro' })]), [])
    assert.deepEqual(kinds(T, [call({ outcome: 'completada' })]), [])
    assert.deepEqual(kinds(T, [call({ kind: 'contact_attempt' })]), [])
  })

  it('reagendar cambia la clave: avisa de nuevo a la hora nueva', () => {
    assert.notEqual(reminderKey('c1', 'now', T), reminderKey('c1', 'now', T + 30 * MIN))
  })
})
