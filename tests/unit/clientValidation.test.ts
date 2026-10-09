import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, ownershipWarning, taxIdError } from '@/lib/clientValidation'
import type { Partner } from '@/types'

describe('clientValidation', () => {
  it('email', () => {
    assert.ok(isValidEmail('maria@gmail.com'))
    assert.ok(isValidEmail(' Maria.G@empresa.com.mx '))
    for (const bad of ['maria', 'maria@', 'maria@gmail', 'ma ria@gmail.com']) assert.equal(isValidEmail(bad), false, bad)
  })

  it('SSN e ITIN', () => {
    assert.equal(taxIdError(''), null)
    assert.equal(taxIdError('123-45-6789'), null)
    assert.equal(taxIdError('912 70 1234'), null) // ITIN
    assert.match(taxIdError('12345678')!, /9 dígitos/)
    assert.match(taxIdError('12A456789')!, /9 dígitos/)
    for (const bad of ['000-12-3456', '666-12-3456', '123-00-4567', '123-45-0000']) {
      assert.equal(taxIdError(bad), 'no es un SSN válido', bad)
    }
  })

  it('porcentajes de socios', () => {
    const p = (pct?: number) => ({ first_name: 'A', last_name: 'B', ownership_percentage: pct }) as Partner
    assert.equal(ownershipWarning([]), null)
    assert.equal(ownershipWarning([p(), p()]), null)
    assert.equal(ownershipWarning([p(50), p(50)]), null)
    assert.equal(ownershipWarning([p(33.33), p(33.33), p(33.34)]), null)
    assert.equal(ownershipWarning([p(60), p(30)]), 'Los porcentajes de los socios suman 90%, no 100%.')
  })
})
