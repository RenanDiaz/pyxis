import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Client, ClientProcess, StateInfo } from '@/types'
import { buildReportInput, previewReport } from '@/lib/salesReportData'
import { getProcessSaleDate, localDateKey } from '@/lib/processUtils'
import { buildWorkbook, type ExpenseConfig, type ReportInput } from '@/lib/generateSalesReport'

// Mediodía UTC: 1-oct en cualquier zona horaria del continente.
const now = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 12))
const proc = (over: Partial<ClientProcess>): ClientProcess => ({
  id: 'p', type: 'registration', payments: [], stage: 'en_proceso', created_at: now, ...over,
})
const client = (over: Partial<Client>, processes: ClientProcess[]) =>
  ({ id: 'c1', first_name: 'ANA', last_name: 'PÉREZ', status: 'en_proceso', processes, ...over } as unknown as Client)
const pay = (amount: number, date: string) => ({ amount, method: 'zelle' as const, date })
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

function build(clients: Client[], monthKey = '2026-10') {
  return buildReportInput({
    clients, states, monthKey, monthLabel: 'October 2026',
    expenses, stripeFeeMode: 'none', taxRate: 0.39,
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

  it('la vista previa lista los procesos del mes sin estado', () => {
    const c = client({ state: 'TX' }, [
      proc({ id: 'a', state: 'NY', payments: [pay(300, '2026-10-02')] }),
      proc({ id: 'b', type: 'ein', payments: [pay(100, '2026-10-03')] }),
      proc({ id: 'c', type: 'boi', payments: [pay(100, '2026-09-03')] }),
    ])
    assert.deepEqual(previewReport([c], '2026-10').missingState, ['ANA PÉREZ — EIN'])
  })
})

describe('reporte de ventas — fecha de venta', () => {
  const saleKey = (p: ClientProcess) => {
    const d = getProcessSaleDate(p)
    return d ? localDateKey(d) : null
  }

  it('sold_at manda; sin ella, la más temprana entre creación y primer pago', () => {
    const created = (y: number, m: number, d: number) => Timestamp.fromDate(new Date(y, m - 1, d, 12))
    assert.equal(saleKey(proc({ sold_at: '2026-08-28', payments: [pay(312, '2026-09-03')] })), '2026-08-28')
    assert.equal(saleKey(proc({ created_at: created(2026, 8, 28), payments: [pay(312, '2026-09-03')] })), '2026-08-28')
    // Proceso migrado: se creó después de que el cliente pagara.
    assert.equal(saleKey(proc({ created_at: created(2026, 10, 1), payments: [pay(312, '2026-07-15')] })), '2026-07-15')
    assert.equal(saleKey(proc({ sold_at: 'basura', created_at: created(2026, 9, 2) })), '2026-09-02')
  })

  it('una venta de agosto cobrada en septiembre sale en agosto con todos sus pagos', () => {
    const c = client({}, [
      proc({ state: 'NY', sold_at: '2026-08-28', payments: [pay(312, '2026-09-03'), pay(312, '2026-09-09')] }),
    ])
    const aug = build([c], '2026-08')
    assert.equal(aug.accounts.length, 1)
    assert.deepEqual(aug.accounts[0].payments.map((p) => p.charge), [312, 312])
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

describe('reporte de ventas — fórmulas', () => {
  const twoPayments: ReportInput = {
    monthLabel: 'October 2026',
    taxRate: 0.39,
    expenses: { ...expenses, bonus: 150 },
    accounts: [{
      company: 'ACME, LLC', purchase: 'Registro de LLC', state: 'NY', stateFee: 210,
      registeredAgent: 45, hasRegisteredAgent: true, owner: 'ANA PÉREZ',
      payments: [
        { date: new Date(2026, 9, 1), charge: 329.5, stripeFee: 0 },
        { date: new Date(2026, 9, 9), charge: 329.5, stripeFee: 0 },
      ],
    }],
  }
  const ws = buildWorkbook(twoPayments).worksheets[0]
  const f = (addr: string) => (ws.getCell(addr).value as { formula: string }).formula

  it('state fee y RA se restan una sola vez por cuenta, con la tasa configurada', () => {
    assert.equal(f('I2'), '(F2-G2-H2)*0.39')
    assert.equal(f('K2'), 'F2-G2-H2-I2-J2')
    assert.equal(f('I3'), '(F3)*0.39')
    assert.equal(f('K3'), 'F3-I3-J3')
  })

  it('TOTAL PAY suma el bonus y WHAT I TOOK HOME resta la base una sola vez', () => {
    // Totales en la fila 4. Gastos: 6 profit−base, 7 bonus, 8 comisión, 9 base,
    // 10 Zoom, 12 TOTAL PAY, 13 take-home.
    assert.equal(expenseFormula(ws, 'profit minus base pay'), 'K4-500')
    assert.equal(expenseFormula(ws, 'Commision de Isabel'), 'K6*0.15')
    assert.equal(expenseFormula(ws, 'ISABEL  TOTAL PAY'), 'K8+K9+K7')
    assert.equal(expenseFormula(ws, 'WHAT I TOOK HOME'), 'K4-(K12+K10)')
  })
})
