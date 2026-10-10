import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { activityFromLegacyLine, getClientActivity, joinNotes, splitNotes } from '@/lib/clientActivity'

describe('clientActivity', () => {
  const notes = 'Llamar en la tarde\n\n[SISTEMA] Cliente reasignado de Ana a Beto por Renán el 2 de octubre 2026\nPrefiere WhatsApp'

  it('separa las líneas de sistema del texto del agente', () => {
    const { agentNotes, legacySystemLines } = splitNotes(notes)
    assert.equal(agentNotes, 'Llamar en la tarde\n\nPrefiere WhatsApp')
    assert.deepEqual(legacySystemLines, ['[SISTEMA] Cliente reasignado de Ana a Beto por Renán el 2 de octubre 2026'])
  })

  it('al guardar conserva las líneas de sistema heredadas', () => {
    const { legacySystemLines } = splitNotes(notes)
    const saved = joinNotes('Solo esto', legacySystemLines)
    assert.equal(splitNotes(saved).agentNotes, 'Solo esto')
    assert.deepEqual(splitNotes(saved).legacySystemLines, legacySystemLines)
    assert.equal(joinNotes('  ', []), '')
  })

  it('convierte líneas viejas en eventos y junta con los nuevos', () => {
    assert.deepEqual(activityFromLegacyLine('[sistema] Algo pasó'), { type: 'system', text: 'Algo pasó', at: null, by: null })
    const nuevo = { type: 'reassigned' as const, text: 'x', at: null, by: 'u' }
    const all = getClientActivity({ notes, activity: [nuevo] })
    assert.equal(all.length, 2)
    assert.equal(all[0].type, 'reassigned')
    assert.equal(all[1], nuevo)
  })
})
