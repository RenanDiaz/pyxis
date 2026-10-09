import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterClientsBySearch } from '@/lib/clientSearch'
import type { Client } from '@/types'

const client = (id: string, extra: Partial<Client>): Client =>
  ({ id, first_name: '', last_name: '', phone: '', status: 'nuevo', ...extra }) as Client

const clients = [
  client('1', { first_name: 'MARÍA', last_name: 'GONZÁLEZ', phone: '+1 (305) 555-1234', state: 'FL' }),
  client('2', { first_name: 'JOSÉ', last_name: 'PÉREZ', llc_name: 'SABOR LATINO LLC', phone: '+1 (212) 555-0000',
    phones: [{ number: '+1 (718) 444-9999', is_primary: false } as NonNullable<Client['phones']>[number]] }),
]
const ids = (search: string) => filterClientsBySearch(clients, search).map((c) => c.id)

describe('filterClientsBySearch', () => {
  it('búsqueda vacía devuelve todos', () => {
    assert.deepEqual(ids('  '), ['1', '2'])
  })

  it('ignora mayúsculas y acentos', () => {
    assert.deepEqual(ids('maria'), ['1'])
    assert.deepEqual(ids('gonzalez'), ['1'])
    assert.deepEqual(ids('maría gonz'), ['1'])
    assert.deepEqual(ids('sabor'), ['2'])
  })

  it('teléfono en cualquier formato, incluidos los secundarios', () => {
    for (const q of ['3055551234', '305-555-1234', '+1 (305) 555-1234']) assert.deepEqual(ids(q), ['1'], q)
    assert.deepEqual(ids('718 444'), ['2'])
  })

  it('menos de 3 dígitos no busca en teléfonos', () => {
    assert.deepEqual(ids('55'), [])
  })
})
