import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAuthDomain } from '../../src/lib/authDomain'

const CONFIGURED = 'pyxis-crm.firebaseapp.com'

describe('resolveAuthDomain', () => {
  it('usa el dominio de la página en los hosts del Worker', () => {
    assert.equal(resolveAuthDomain('mipyxis.com', CONFIGURED), 'mipyxis.com')
    assert.equal(resolveAuthDomain('www.mipyxis.com', CONFIGURED), 'www.mipyxis.com')
    assert.equal(resolveAuthDomain('staging.mipyxis.com', CONFIGURED), 'staging.mipyxis.com')
  })

  it('cae a la config en local y en otros hosts', () => {
    assert.equal(resolveAuthDomain('localhost', CONFIGURED), CONFIGURED)
    assert.equal(resolveAuthDomain('pyxis.renandiaz.workers.dev', CONFIGURED), CONFIGURED)
    assert.equal(resolveAuthDomain('mipyxis.com.evil.test', CONFIGURED), CONFIGURED)
  })
})
