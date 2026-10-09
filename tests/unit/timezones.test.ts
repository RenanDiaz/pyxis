import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getClientTimezone } from '@/lib/timezones'
import { getCallTimeLabel, isGoodCallTime } from '@/lib/callTime'
import { getStateByAreaCode } from '@/lib/areaCodeMap'
import type { StateInfo } from '@/types'

describe('getClientTimezone', () => {
  it('estado de una sola zona: la del estado, segura', () => {
    assert.deepEqual(getClientTimezone('CA', '+1 (213) 555-0000'), { timezone: 'America/Los_Angeles', certain: true })
  })

  it('El Paso (915) en Texas es Mountain', () => {
    assert.deepEqual(getClientTimezone('TX', '+1 (915) 555-0000'), { timezone: 'America/Denver', certain: true })
  })

  it('Nashville (615) en Tennessee es Central', () => {
    assert.equal(getClientTimezone('TN', '615-555-0000').timezone, 'America/Chicago')
  })

  it('código ambiguo o sin teléfono: zona del estado, por confirmar', () => {
    assert.deepEqual(getClientTimezone('FL', '+1 (850) 555-0000'), { timezone: 'America/New_York', certain: false })
    assert.equal(getClientTimezone('TX').certain, false)
  })

  it('un código de otro estado no cambia la zona', () => {
    assert.equal(getClientTimezone('FL', '+1 (915) 555-0000').timezone, 'America/New_York')
  })
})

describe('callTime', () => {
  it('zona inválida: hora desconocida, no "buena hora"', () => {
    assert.equal(isGoodCallTime(new Date(), 'Zona/Invalida'), null)
    assert.equal(getCallTimeLabel(new Date(), 'Zona/Invalida'), 'Hora desconocida')
  })
})

describe('getStateByAreaCode', () => {
  it('usa los códigos editados cuando se pasan los estados', () => {
    const edited = [{ abbreviation: 'NV', area_codes: ['999'] }] as StateInfo[]
    assert.equal(getStateByAreaCode('999-555-0000', edited), 'NV')
    assert.equal(getStateByAreaCode('999-555-0000'), null)
  })
})
