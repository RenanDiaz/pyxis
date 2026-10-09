import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeClientFields } from '@/lib/clientUtils'

describe('normalizeClientFields', () => {
  it('nombres y compañía en mayúsculas, email en minúsculas, notas tal cual', () => {
    const out = normalizeClientFields({
      first_name: 'María',
      llc_name: 'Sabor Latino llc',
      email: '  Maria.Gonzalez@Gmail.COM ',
      notes: 'Llamar después de las 5pm',
    })
    assert.equal(out.first_name, 'MARÍA')
    assert.equal(out.llc_name, 'SABOR LATINO LLC')
    assert.equal(out.email, 'maria.gonzalez@gmail.com')
    assert.equal(out.notes, 'Llamar después de las 5pm')
  })

  it('socios y compañías de procesos también en mayúsculas', () => {
    const out = normalizeClientFields({
      partners: [{ first_name: 'josé', last_name: 'pérez', address: '1 main st' }],
      processes: [{ id: 'p', type: 'registration', payments: [], stage: 'pendiente', llc_name: 'dos llc' }],
    })
    assert.equal(out.partners[0].first_name, 'JOSÉ')
    assert.equal(out.partners[0].address, '1 MAIN ST')
    assert.equal(out.processes[0].llc_name, 'DOS LLC')
  })
})
