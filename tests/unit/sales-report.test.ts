import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess, StateInfo } from '@/types'
import { buildReportInput, previewReport } from '@/lib/salesReportData'
import { getProcessSaleDate, getProcessStateCost, localDateKey } from '@/lib/processUtils'
import realStates from '@/data/states.json'
import { buildWorkbook, type ExpenseConfig, type ReportInput } from '@/lib/generateSalesReport'

// Mediodía UTC: 1-oct en cualquier zona horaria del continente.
const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 12))
const proc = (over: Partial<ClientProcess>): ClientProcess => ({
  id: 'p', type: 'registration', payments: [], stage: 'en_proceso', created_at: now, ...over,
})
const client = (over: Partial<Client>, processes: ClientProcess[]) =>
  ({ id: 'c1', first_name: 'ANA', last_name: 'PÉREZ', status: 'en_proceso', processes, ...over } as unknown as Client)
const pay = (amount: number, date: string, method: 'zelle' | 'stripe' = 'zelle') => ({ amount, method, date })
const states = [
  { abbreviation: 'NY', state_fee: '210.0' },
  { abbreviation: 'TX', state_fee: '310.0' },
] as unknown as StateInfo[]

const expenses: ExpenseConfig = {
  employeeName: 'Isabel',
  basePay: 500,
  commissionRate: 0.15,
  fixedExpenses: [{ label: 'Zoom Phone', amount: 75 }],
}

function build(clients: Client[], monthKey = '2026-10', stripeFeeMode: 'none' | 'surcharge' = 'none') {
  return buildReportInput({
    clients, states, monthKey, monthLabel: 'October 2026',
    expenses, stripeFeeMode, taxRate: 0.39, registeredAgentCost: 45,
  })
}

/** Busca la celda K de la fila cuyo rótulo (columna D) empieza con `label`. */
function expenseFormula(ws: ReturnType<ReturnType<typeof buildWorkbook>['getWorksheet']>, label: string) {
  let found: string | undefined
  ws!.eachRow((row) => {
    const d = row.getCell('D').value
    if (typeof d === 'string' && d.trim().startsWith(label)) {
      const k = row.getCell('K').value as { formula?: string }
      found = k.formula
    }
  })
  return found
}

describe('reporte de ventas — datos', () => {
  it('el state fee sale del estado del proceso, sin caer a client.state', () => {
    const c = client({ state: 'TX' }, [
      proc({ id: 'a', state: 'NY', payments: [pay(300, '2026-10-02')] }),
      proc({ id: 'b', type: 'ein', payments: [pay(100, '2026-10-03')] }),
    ])
    const input = build([c])
    assert.deepEqual(input.accounts.map((a) => [a.state, a.stateFee]), [['NY', 210], ['', 0]])
    assert.equal(input.taxRate, 0.39)
  })

  it('la vista previa lista las ventas del mes sin costo estatal y el motivo', () => {
    const c = client({ state: 'TX' }, [
      proc({ id: 'a', state: 'NY', payments: [pay(300, '2026-10-02')] }),
      // EIN: costo fijo 0, no se advierte.
      proc({ id: 'b', type: 'ein', payments: [pay(100, '2026-10-03')] }),
      proc({ id: 'c', type: 'dissolution', payments: [pay(100, '2026-10-04')] }),
      proc({ id: 'd', type: 'custom', custom_label: 'Certificado de Autoridad', payments: [pay(270, '2026-10-05')] }),
      proc({ id: 'e', type: 'boi', payments: [pay(100, '2026-09-03')] }),
    ])
    assert.deepEqual(previewReport([c], '2026-10', states).missingCost, [
      { label: 'ANA PÉREZ — Dissolution', reason: 'no_state' },
      { label: 'ANA PÉREZ — Certificado de Autoridad', reason: 'manual' },
    ])
  })
})

describe('reporte de ventas — costo estatal por proceso (P8)', () => {
  const real = realStates as unknown as StateInfo[]
  const cost = (p: Partial<ClientProcess>) =>
    getProcessStateCost(proc(p), real.find((s) => s.abbreviation === p.state)).cost

  it('cuadra con el Excel manual', () => {
    assert.equal(cost({ type: 'dissolution', state: 'NY' }), 90)
    assert.equal(cost({ type: 'amendment', state: 'NY' }), 90)
    assert.equal(cost({ type: 'amendment', state: 'TX' }), 155)
    assert.equal(cost({ type: 'registration', state: 'TN' }), 307.05)
    assert.equal(cost({ type: 'registration', state: 'GA' }), 110)
  })

  it('fijos, manuales y capturados', () => {
    assert.equal(cost({ type: 'itin' }), 250)
    assert.equal(cost({ type: 'ein' }), 0)
    assert.equal(cost({ type: 'custom' }), null)
    assert.equal(cost({ type: 'custom', state_cost: 175 }), 175)
    // Lo capturado manda sobre el estado.
    assert.equal(cost({ type: 'registration', state: 'CA', state_cost: 110 }), 110)
    // El estado no tiene ese costo (TX no admite dissolution en la tabla).
    assert.deepEqual(getProcessStateCost(proc({ type: 'dissolution', state: 'TX' }), real.find((s) => s.abbreviation === 'TX')), {
      cost: null, reason: 'no_state_value',
    })
  })

  it('el reporte resta el costo de cada tipo de proceso, no el de registro', () => {
    const c = client({}, [
      proc({ id: 'r', state: 'TX', payments: [pay(759, '2026-10-01')] }),
      proc({ id: 'a', type: 'amendment', state: 'TX', payments: [pay(300, '2026-10-02')] }),
      proc({ id: 'e', type: 'ein', state: 'TX', payments: [pay(200, '2026-10-03')] }),
      proc({ id: 'i', type: 'itin', payments: [pay(700, '2026-10-04')] }),
    ])
    const input = buildReportInput({
      clients: [c], states: real, monthKey: '2026-10', monthLabel: 'October 2026',
      expenses, stripeFeeMode: 'none', taxRate: 0.39, registeredAgentCost: 45,
    })
    assert.deepEqual(input.accounts.map((a) => [a.purchase, a.stateFee]), [
      ['Registro de LLC', 310], ['Amendment', 155], ['EIN', 0], ['ITIN', 250],
    ])
  })
})

describe('reporte de ventas — fecha de venta', () => {
  const saleKey = (p: ClientProcess) => {
    const d = getProcessSaleDate(p)
    return d ? localDateKey(d) : null
  }

  it('sold_at manda; sin ella, el primer pago (no la creación del proceso)', () => {
    const created = (y: number, m: number, d: number) => Timestamp.fromDate(new Date(y, m - 1, d, 12))
    assert.equal(saleKey(proc({ sold_at: '2026-08-28', payments: [pay(312, '2026-09-03')] })), '2026-08-28')
    // Prospecto cotizado en septiembre que pagó en octubre: venta de octubre.
    assert.equal(
      saleKey(proc({ created_at: created(2026, 9, 20), payments: [pay(400, '2026-10-09'), pay(329.5, '2026-10-03')] })),
      '2026-10-03',
    )
    assert.equal(saleKey(proc({ sold_at: 'basura', payments: [pay(100, '2026-09-02')] })), '2026-09-02')
    assert.equal(saleKey(proc({ created_at: created(2026, 9, 2) })), null)
  })

  it('una venta de agosto cobrada en septiembre sale en agosto, en una sola fila', () => {
    const c = client({}, [
      proc({ state: 'NY', total: 624, sold_at: '2026-08-28', payments: [pay(312, '2026-09-03'), pay(312, '2026-09-09')] }),
    ])
    const aug = build([c], '2026-08')
    assert.deepEqual(aug.accounts.map((a) => [localDateKey(a.date), a.charge]), [['2026-08-28', 624]])
    assert.equal(build([c], '2026-09').accounts.length, 0)
    assert.equal(previewReport([c], '2026-08').accountCount, 1)
    assert.equal(previewReport([c], '2026-09').accountCount, 0)
  })

  it('las cuentas se ordenan por fecha de venta', () => {
    const c = client({}, [
      proc({ id: 'tarde', state: 'NY', sold_at: '2026-10-20', payments: [pay(100, '2026-10-02')] }),
      proc({ id: 'temprano', state: 'TX', sold_at: '2026-10-05', payments: [pay(100, '2026-10-25')] }),
    ])
    assert.deepEqual(build([c]).accounts.map((a) => a.state), ['TX', 'NY'])
  })
})

describe('reporte de ventas — una fila por venta (P6)', () => {
  it('CHARGE es el total vendido aunque falte cobrar; sin total, lo cobrado', () => {
    const c = client({}, [
      proc({ id: 'a', state: 'NY', total: 609, payments: [pay(304.5, '2026-10-02')] }),
      proc({ id: 'b', state: 'TX', payments: [pay(200, '2026-10-03')] }),
      // Se cobró de más: CHARGE no queda por debajo de lo cobrado.
      proc({ id: 'c', state: 'NY', total: 100, payments: [pay(120, '2026-10-04')] }),
    ])
    assert.deepEqual(build([c]).accounts.map((a) => a.charge), [609, 200, 120])
  })

  it('un proceso sin pagos no es una venta', () => {
    const c = client({}, [proc({ state: 'NY', total: 659, sold_at: '2026-10-02' })])
    assert.equal(build([c]).accounts.length, 0)
    assert.equal(previewReport([c], '2026-10').accountCount, 0)
  })

  it('recargo de Stripe del 4 %: se suma a CHARGE y se resta como STRIPE FEE', () => {
    const c = client({}, [
      // Como el manual (TX, sept): 759 con Stripe → CHARGE 789.36, J 30.36.
      proc({ id: 'tx', state: 'TX', total: 759, payments: [pay(759, '2026-10-01', 'stripe')] }),
      // 1er pago con Stripe: lo pagado y el saldo llevan recargo (600 × 4 %).
      proc({ id: 'a', state: 'NY', total: 600, payments: [pay(300, '2026-10-02', 'stripe')] }),
      // 1er pago con Zelle: solo el pago con Stripe lleva recargo (200 × 4 %).
      proc({ id: 'b', state: 'NY', total: 600, payments: [pay(100, '2026-10-03'), pay(200, '2026-10-05', 'stripe')] }),
    ])
    assert.deepEqual(
      build([c], '2026-10', 'surcharge').accounts.map((a) => [a.charge, a.stripeFee]),
      [[789.36, 30.36], [624, 24], [608, 8]],
    )
    assert.deepEqual(
      build([c]).accounts.map((a) => [a.charge, a.stripeFee]),
      [[759, 0], [600, 0], [600, 0]],
    )
  })

  it('Registered Agent: H = costo configurado solo si el registro lo incluye', () => {
    const c = client({}, [
      proc({ id: 'ra', state: 'TN', has_registered_agent: true, payments: [pay(402, '2026-10-01')] }),
      proc({ id: 'sin', state: 'NY', payments: [pay(300, '2026-10-02')] }),
    ])
    assert.deepEqual(build([c]).accounts.map((a) => a.registeredAgent), [45, 0])
  })

  it('la vista previa resume lo vendido y lista los saldos proyectados', () => {
    const c = client({}, [
      proc({ id: 'a', state: 'NY', total: 609, payments: [pay(304.5, '2026-10-02', 'stripe')] }),
      proc({ id: 'b', type: 'ein', total: 150, payments: [pay(150, '2026-10-03')] }),
    ])
    const preview = previewReport([c], '2026-10')
    assert.equal(preview.totalCharge, 759)
    assert.equal(preview.totalPending, 304.5)
    assert.deepEqual(preview.projected, [{ label: 'ANA PÉREZ — Registro de LLC', pending: 304.5, stripe: true }])
  })
})

describe('reporte de ventas — fórmulas', () => {
  const input: ReportInput = {
    monthLabel: 'October 2026',
    taxRate: 0.39,
    expenses: { ...expenses, bonus: 150 },
    accounts: [
      {
        date: new Date(2026, 9, 1), company: 'ACME, LLC', purchase: 'Registro de LLC', state: 'NY',
        charge: 659, stateFee: 210, registeredAgent: 45, stripeFee: 0,
        owner: 'ANA PÉREZ',
      },
      {
        date: new Date(2026, 9, 2), company: 'ANA PÉREZ', purchase: 'EIN', state: '',
        charge: 150, stateFee: 0, registeredAgent: 0, stripeFee: 4.65,
        owner: 'ANA PÉREZ',
      },
    ],
  }
  const ws = buildWorkbook(input).worksheets[0]
  const f = (addr: string) => (ws.getCell(addr).value as { formula: string }).formula

  it('una fila por cuenta, sin celdas combinadas; TAX resta el Stripe fee antes de la tasa', () => {
    assert.equal(ws.getCell('F2').value, 659)
    assert.equal(f('I2'), '(F2-G2-H2-J2)*0.39')
    assert.equal(f('K2'), 'F2-G2-H2-J2-I2')
    // Sin RA, H vale 0: la fórmula es la misma para todas las filas.
    assert.equal(f('I3'), '(F3-G3-H3-J3)*0.39')
    assert.equal(f('K3'), 'F3-G3-H3-J3-I3')
    assert.equal(ws.getCell('H3').value, 0)
    assert.equal(ws.getCell('A3').value, 2)
    assert.equal(f('K4'), 'SUM(K2:K3)')
    assert.equal(ws.getCell('C2').isMerged, false)
  })

  it('comisión = NET × tasa; TOTAL PAY suma el bonus; WHAT I TOOK HOME resta la base una vez', () => {
    // Totales en la fila 4. Gastos: 6 base, 7 bonus, 8 comisión, 9 Zoom,
    // 11 TOTAL PAY, 12 take-home.
    assert.equal(expenseFormula(ws, 'profit minus base pay'), undefined)
    assert.equal(ws.getCell('D6').value, 'base pay ')
    assert.equal(ws.getCell('K6').value, 500)
    assert.equal(expenseFormula(ws, 'Commision de Isabel'), 'K4*0.15')
    assert.equal(expenseFormula(ws, 'ISABEL  TOTAL PAY'), 'K8+K6+K7')
    assert.equal(expenseFormula(ws, 'WHAT I TOOK HOME'), 'K4-(K11+K9)')
  })
})
