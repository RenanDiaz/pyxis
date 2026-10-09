import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLead, findClientByPhone, getCallDisplayName, phoneDigits, splitLeadName } from '@/lib/leads'
import { countContacted } from '@/lib/statusHistory'
import type { Call, Client } from '@/types'

describe('leads', () => {
  it('phoneDigits normaliza a 10 dígitos US', () => {
    assert.equal(phoneDigits('+1 (305) 555-1234'), '3055551234')
    assert.equal(phoneDigits('305-555-1234'), '3055551234')
    assert.equal(phoneDigits('555-1234'), '')
  })

  it('buildLead exige nombre y teléfono válido y formatea', () => {
    assert.equal(buildLead({ name: '  ', phone: '3055551234' }), null)
    assert.equal(buildLead({ name: 'Juan', phone: '555' }), null)
    assert.deepEqual(buildLead({ name: ' Juan Pérez ', phone: '305-555-1234', state: 'FL', notes: '' }), {
      name: 'Juan Pérez',
      phone: '+1 (305) 555-1234',
      phone_digits: '3055551234',
      state: 'FL',
    })
  })

  it('splitLeadName reparte nombre y apellidos', () => {
    assert.deepEqual(splitLeadName('Juan'), { first_name: 'Juan', last_name: '' })
    assert.deepEqual(splitLeadName('Juan Pérez'), { first_name: 'Juan', last_name: 'Pérez' })
    assert.deepEqual(splitLeadName('Juan Pérez García'), { first_name: 'Juan', last_name: 'Pérez García' })
    assert.deepEqual(splitLeadName('Ana María López Díaz'), { first_name: 'Ana María', last_name: 'López Díaz' })
  })

  it('nombre a mostrar de llamadas a lead y a cliente', () => {
    const clients = new Map([['c1', { id: 'c1', first_name: 'MARÍA', last_name: 'GÓMEZ', phone: '' } as Client]])
    assert.equal(getCallDisplayName({ client_id: null, lead: { name: 'Juan', phone: '', phone_digits: '' } } as Call, clients), 'Juan')
    assert.equal(getCallDisplayName({ client_id: 'c1' } as Call, clients), 'MARÍA GÓMEZ')
    assert.equal(getCallDisplayName({ client_id: 'x' } as Call, clients), 'Cliente no disponible')
  })

  it('findClientByPhone compara por dígitos, también secundarios', () => {
    const clients = [
      { id: 'a', phone: '+1 (212) 555-0000', phones: [{ number: '+1 (718) 444-9999' }] } as Client,
    ]
    assert.equal(findClientByPhone(clients, '718-444-9999')?.id, 'a')
    assert.equal(findClientByPhone(clients, '305-555-1234'), undefined)
  })

  it('las llamadas a leads no cuentan como clientes contactados', () => {
    const at = { toDate: () => new Date(2026, 9, 9) }
    const calls = [
      { client_id: null, lead: { name: 'L', phone: '', phone_digits: '' }, outcome: 'completada', scheduled_at: at },
      { client_id: 'c1', outcome: 'completada', scheduled_at: at },
    ] as unknown as Call[]
    assert.equal(countContacted([], calls, () => true), 1)
  })
})
