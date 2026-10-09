import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess, StateInfo } from '@/types'
import { buildQuote, defaultQuotePrice, isQuotableByDefault, processQuoteLine, quoteNumber } from '@/lib/quote'
import { clientMutations } from '@/lib/processMutations'

const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1))
const proc = (over: Partial<ClientProcess>): ClientProcess => ({
  id: 'p', type: 'ein', payments: [], stage: 'pendiente', created_at: now, ...over,
})
const client = (processes: ClientProcess[]) =>
  ({ id: 'abcdXYZ9', status: 'contactado', processes } as unknown as Client)

describe('cotización', () => {
  it('número COT-yyMMdd-XXXX-HHmm', () => {
    assert.equal(quoteNumber('abcdXYZ9', new Date(2026, 9, 9, 14, 5)), 'COT-261009-XYZ9-1405')
  })

  it('precio inicial: total acordado, si no el sugerido del estado; manual sin total queda vacío', () => {
    const fl = { abbreviation: 'FL', price: '$699' } as unknown as StateInfo
    assert.equal(defaultQuotePrice(proc({ type: 'registration', total: 500 }), fl), 500)
    assert.equal(defaultQuotePrice(proc({ type: 'ein' }), null), null)
  })

  it('total en centavos y vigencia acotada a 1–90 días', () => {
    const q = buildQuote({
      ref: 'abcd1234',
      lines: [{ label: 'A', price: 33.33 }, { label: 'B', price: 66.67 }],
      now: new Date(2026, 9, 9),
      validDays: 500,
    })
    assert.equal(q.total, 100)
    assert.equal(q.recipient, undefined)
    assert.equal(q.validUntil.getTime(), new Date(2027, 0, 7).getTime())
  })

  it('cotización rápida: destinatario opcional y línea solo con el total del servicio', () => {
    const q = buildQuote({ ref: 'ZZZZ', recipient: '  ', lines: [{ label: 'Registro de LLC — FL', price: 579 }] })
    assert.equal(q.recipient, undefined)
    assert.deepEqual(Object.keys(q.lines[0]).sort(), ['label', 'price'])
    const named = buildQuote({ ref: 'ZZZZ', recipient: 'Juan Pérez', lines: [{ label: 'EIN', price: 150 }] })
    assert.equal(named.recipient, 'Juan Pérez')
  })

  it('línea de un proceso del cliente: etiqueta + estado y la LLC en registros', () => {
    const reg = proc({ id: 'r', type: 'registration', state: 'FL', llc_name: 'ACME LLC' })
    assert.deepEqual(processQuoteLine(client([reg]), reg, 579), { label: 'Registro de LLC — FL', detail: 'ACME LLC', price: 579 })
  })

  it('por defecto se cotizan los procesos vigentes', () => {
    assert.equal(isQuotableByDefault(proc({ stage: 'pendiente' })), true)
    assert.equal(isQuotableByDefault(proc({ stage: 'cancelado' })), false)
    assert.equal(isQuotableByDefault(proc({ stage: 'completado' })), false)
  })

  it('setMissingTotals solo fija procesos sin total y nunca pisa uno acordado', () => {
    const c = client([proc({ id: 'sin' }), proc({ id: 'con', total: 200 })])
    const after = clientMutations.setMissingTotals({ sin: 150.005, con: 999 })(c).processes
    assert.equal(after.find((p) => p.id === 'sin')!.total, 150.01)
    assert.equal(after.find((p) => p.id === 'con')!.total, 200)
  })
})
