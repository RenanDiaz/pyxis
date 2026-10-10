import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess } from '@/types'
import { getClientCompanies, getProcessCompanyName, hasUnassignedCompany } from '@/lib/companyUtils'
import { processQuoteLine } from '@/lib/quote'

const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 12))
const proc = (over: Partial<ClientProcess>): ClientProcess => ({
  id: 'p', type: 'registration', payments: [], stage: 'pendiente', created_at: now, ...over,
})
const client = (over: Partial<Client>, processes: ClientProcess[]) =>
  ({ id: 'c1', first_name: 'ANA', last_name: 'PÉREZ', status: 'en_proceso', processes, ...over } as unknown as Client)

describe('compañía de un servicio que no es registro (spec 04, #2)', () => {
  const a = proc({ id: 'a', llc_name: 'ALFA LLC' })
  const b = proc({ id: 'b', llc_name: 'BETA LLC' })

  it('con varias compañías, la del registro vinculado; sin vínculo, ninguna', () => {
    const ein = proc({ id: 'e', type: 'ein', company_id: 'b' })
    const boi = proc({ id: 'o', type: 'boi' })
    const c = client({ llc_name: 'ALFA LLC' }, [a, b, ein, boi])
    assert.equal(getProcessCompanyName(c, ein), 'BETA LLC')
    assert.equal(getProcessCompanyName(c, boi), '')
    assert.equal(hasUnassignedCompany(c, boi), true)
    assert.equal(hasUnassignedCompany(c, ein), false)
  })

  it('con una sola compañía (registro o legacy del cliente), automática', () => {
    const ein = proc({ id: 'e', type: 'ein' })
    assert.equal(getProcessCompanyName(client({}, [a, ein]), ein), 'ALFA LLC')
    // Sin registros: la LLC del cliente (registrada en otro lado).
    assert.equal(getProcessCompanyName(client({ llc_name: 'LONE WOLF LLC' }, [ein]), ein), 'LONE WOLF LLC')
    assert.equal(hasUnassignedCompany(client({}, [a, ein]), ein), false)
  })

  it('otra compañía escrita a mano; un vínculo roto cae a las demás reglas', () => {
    const amend = proc({ id: 'm', type: 'amendment', llc_name: 'GAMMA LLC' })
    const orphan = proc({ id: 'x', type: 'ein', company_id: 'borrado' })
    const c = client({}, [a, b, amend, orphan])
    assert.equal(getProcessCompanyName(c, amend), 'GAMMA LLC')
    assert.equal(getProcessCompanyName(c, orphan), '')
    assert.equal(hasUnassignedCompany(c, orphan), true)
    assert.equal(getProcessCompanyName(client({}, [a, orphan]), orphan), 'ALFA LLC')
  })

  it('el registro no cambia: solo el primero hereda la del cliente', () => {
    const unnamed = proc({ id: 'u' })
    const c = client({ llc_name: 'ALFA LLC' }, [proc({ id: 'first' }), unnamed])
    assert.deepEqual(getClientCompanies(c), [{ id: 'first', name: 'ALFA LLC' }, { id: 'u', name: '' }])
    assert.equal(getProcessCompanyName(c, unnamed), '')
  })

  it('la cotización muestra la compañía del servicio', () => {
    const ein = proc({ id: 'e', type: 'ein', company_id: 'b' })
    assert.equal(processQuoteLine(client({}, [a, b, ein]), ein, 150).detail, 'BETA LLC')
  })
})
