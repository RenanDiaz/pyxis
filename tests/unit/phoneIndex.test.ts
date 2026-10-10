import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clientPhoneDigits } from '@/lib/phoneIndex'

describe('clientPhoneDigits (spec 07)', () => {
  it('junta principal y secundarios en 10 dígitos, sin repetir', () => {
    assert.deepEqual(
      clientPhoneDigits({
        phone: '+1 (305) 555-1234',
        phones: [
          { number: '+1 (305) 555-1234', label: 'personal', is_primary: true },
          { number: '786-555-0000', label: 'trabajo', is_primary: false },
        ],
      }),
      ['3055551234', '7865550000'],
    )
  })

  it('ignora números incompletos y clientes sin teléfono', () => {
    assert.deepEqual(clientPhoneDigits({ phone: '555-1234' }), [])
    assert.deepEqual(clientPhoneDigits({}), [])
  })
})
