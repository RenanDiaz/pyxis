import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BELL_WINDOW_DAYS, bellWindowStart, selectBellCalls, shouldNotify } from '@/lib/bellCalls'
import type { Call, Client } from '@/types'

const client = (id: string, extra: Partial<Client> = {}) => ({ id, status: 'contactado', ...extra }) as Client
const clients = new Map([
  ['activo', client('activo')],
  ['archivado', client('archivado', { archived: true })],
  ['perdido', client('perdido', { status: 'perdido' })],
])
const call = (id: string, client_id: string | null, lead = false) =>
  ({ id, client_id, ...(lead ? { lead: { name: 'L', phone: 'x', phone_digits: '1' } } : {}) }) as Call

describe('campana (spec 20)', () => {
  it('avisa de clientes activos y leads; no de archivados, perdidos ni inexistentes', () => {
    assert.equal(shouldNotify(call('a', 'activo'), clients), true)
    assert.equal(shouldNotify(call('l', null, true), clients), true)
    assert.equal(shouldNotify(call('b', 'archivado'), clients), false)
    assert.equal(shouldNotify(call('c', 'perdido'), clients), false)
    assert.equal(shouldNotify(call('d', 'borrado'), clients), false)
  })

  it('filtra y recorta al máximo', () => {
    const calls = [call('1', 'archivado'), call('2', 'activo'), call('3', null, true), call('4', 'activo')]
    assert.deepEqual(selectBellCalls(calls, clients, 2).map((c) => c.id), ['2', '3'])
  })

  it('la ventana empieza 14 días antes', () => {
    const now = new Date(2026, 9, 20, 12)
    assert.equal(BELL_WINDOW_DAYS, 14)
    assert.equal(bellWindowStart(now).getTime(), new Date(2026, 9, 6, 12).getTime())
  })
})
