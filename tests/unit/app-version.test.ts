import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isOutdated } from '@/lib/appVersion'

describe('isOutdated', () => {
  it('versión publicada distinta ⇒ pestaña vieja', () => {
    assert.equal(isOutdated('abc', 'def'), true)
    assert.equal(isOutdated('abc', 'abc'), false)
  })

  it('sin respuesta (offline) o en desarrollo no avisa', () => {
    assert.equal(isOutdated('abc', null), false)
    assert.equal(isOutdated('dev', 'def'), false)
  })
})
