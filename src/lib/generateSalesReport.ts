/**
 * generateSalesReport.ts
 * -----------------------------------------------------------------------------
 * Genera el "Sales Report" mensual en .xlsx replicando el formato original.
 * Frontend React + TypeScript, usando ExcelJS.
 *
 * Uso:
 *   import { downloadSalesReport } from "@/lib/generateSalesReport"
 *   await downloadSalesReport(input)   // input: ReportInput (ver SPEC §2)
 *
 * El modelo de entrada (ReportInput) se construye desde los datos del CRM en
 * `src/lib/salesReportData.ts`.
 * -----------------------------------------------------------------------------
 */

import ExcelJS from 'exceljs'

/* ============================ Tipos de entrada ============================= */

export interface ReportPayment {
  date: Date
  charge: number
  stripeFee: number
}

export interface ReportAccount {
  company: string
  purchase: string
  state: string
  stateFee: number
  registeredAgent: number
  owner: string
  payments: ReportPayment[] // 1 o 2 (el algoritmo soporta N)
}

export interface ExpenseConfig {
  employeeName: string
  basePay: number
  commissionRate: number
  bonus?: number
  fixedExpenses: { label: string; amount: number }[]
}

export interface ReportInput {
  monthLabel: string
  accounts: ReportAccount[]
  expenses: ExpenseConfig
  /** true = TAX y NET restan el Registered Agent (H). Ver SPEC §4. */
  subtractRegisteredAgent: boolean
}

/* ============================== Constantes ================================= */

const TAX_RATE = 0.34

const FONT_HEADER_BIG = { name: 'Arial Black', size: 12, color: { argb: 'FFFF0000' } }
const FONT_HEADER_SM = { name: 'Arial Black', size: 8, color: { argb: 'FFFF0000' } }
const FONT_DATA = { name: 'Aptos Narrow', size: 11 }
const FONT_LABEL_RED = { name: 'Aptos Narrow', size: 11, bold: true, color: { argb: 'FFFF0000' } }
const FONT_LABEL_BLACK = { name: 'Aptos Narrow', size: 11, bold: true }
const FONT_TOTAL = { name: 'Aptos Narrow', size: 11, color: { argb: 'FFFF0000' } }

const FILL_BLUE = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFD0DFE6' }, // accent1 tint .8
}
const FILL_GREEN = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFB8DCAB' }, // accent6 tint .6
}

const THIN = { style: 'thin' as const }
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN }

const FMT_DATE = 'mm-dd-yy'
const FMT_NUM = '0.00'

const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const }
const LEFT = { horizontal: 'left' as const, vertical: 'middle' as const }

const COL_WIDTHS: Record<string, number> = {
  A: 9.14, B: 10.43, C: 48.29, D: 33.14, E: 9.14, F: 9.14,
  G: 11.29, H: 12.57, I: 9.14, J: 12.43, K: 13.43, L: 51.29,
}

/** Todas las columnas de la tabla (A→L). */
const ALL_COLS = 'ABCDEFGHIJKL'.split('')
/** Columnas "por cuenta" que se fusionan verticalmente cuando hay 2 pagos. */
const ACCOUNT_COLS = ['A', 'C', 'D', 'E', 'G', 'H', 'L']

/* ============================ Construcción ================================= */

export function buildWorkbook(input: ReportInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sanitizeSheetName(input.monthLabel))

  Object.entries(COL_WIDTHS).forEach(([col, width]) => {
    ws.getColumn(col).width = width
  })

  writeHeader(ws)
  const totalsRow = writeAccounts(ws, input)
  writeTotals(ws, totalsRow)
  writeExpenses(ws, input, totalsRow)

  return wb
}

/** Excel limita nombres de hoja a 31 caracteres y prohíbe : \ / ? * [ ] */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim()
  return (cleaned || 'Reporte').slice(0, 31)
}

/* ------------------------------- Encabezado ------------------------------- */

function writeHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1)
  row.height = 77.25

  const headers: Record<string, string> = {
    B: 'NEW ACCOUNTS', D: ' PURCHASE', E: 'STATE', F: 'CHARGE',
    G: 'STATE FEE', H: 'REGISTERED AGENT', I: 'TAX', J: 'STRIPE FEE',
    K: 'NET PROFIT ', L: 'OWNER NAME',
  }

  ALL_COLS.forEach((col) => {
    const cell = ws.getCell(`${col}1`)
    cell.value = headers[col] ?? null
    cell.font = col === 'B' ? FONT_HEADER_BIG : FONT_HEADER_SM
    cell.fill = FILL_BLUE
    cell.alignment = CENTER
    cell.border = BORDER_ALL
  })
}

/* ----------------------------- Tabla de cuentas --------------------------- */

/** Devuelve el número de la primera fila libre (fila de totales). */
function writeAccounts(ws: ExcelJS.Worksheet, input: ReportInput): number {
  let row = 2

  input.accounts.forEach((account, i) => {
    const n = Math.max(1, account.payments.length)
    const startRow = row
    const endRow = row + n - 1

    // Columnas por pago (una fila por pago)
    account.payments.forEach((p, k) => {
      const r = startRow + k
      setCell(ws, `B${r}`, normalizeDate(p.date), { font: FONT_DATA, numFmt: FMT_DATE })
      setCell(ws, `F${r}`, p.charge, { font: FONT_DATA, numFmt: FMT_NUM })
      setCell(ws, `I${r}`, { formula: taxFormula(r, startRow, input.subtractRegisteredAgent) },
        { font: FONT_DATA, numFmt: FMT_NUM })
      setCell(ws, `J${r}`, p.stripeFee, { font: FONT_DATA, numFmt: FMT_NUM })
      setCell(ws, `K${r}`, { formula: netFormula(r, startRow, input.subtractRegisteredAgent) },
        { font: FONT_DATA, numFmt: FMT_NUM })
    })

    // Columnas por cuenta (valor en startRow)
    setCell(ws, `A${startRow}`, i + 1, { font: FONT_DATA })
    setCell(ws, `C${startRow}`, account.company, { font: FONT_DATA, align: LEFT })
    setCell(ws, `D${startRow}`, account.purchase, { font: FONT_DATA, align: LEFT })
    setCell(ws, `E${startRow}`, account.state, { font: FONT_DATA })
    setCell(ws, `G${startRow}`, account.stateFee, { font: FONT_DATA, numFmt: FMT_NUM })
    setCell(ws, `H${startRow}`, account.registeredAgent, { font: FONT_DATA, numFmt: FMT_NUM })
    setCell(ws, `L${startRow}`, account.owner, { font: FONT_DATA, align: LEFT })

    // Merges verticales de las columnas por cuenta cuando hay más de un pago
    if (n > 1) {
      ACCOUNT_COLS.forEach((col) => {
        ws.mergeCells(`${col}${startRow}:${col}${endRow}`)
      })
    }

    // Bordes en todas las celdas del bloque
    for (let r = startRow; r <= endRow; r++) {
      ALL_COLS.forEach((col) => {
        ws.getCell(`${col}${r}`).border = BORDER_ALL
      })
    }

    row = endRow + 1
  })

  return row
}

/**
 * Fija la fecha a mediodía UTC usando sus componentes locales. Evita que ExcelJS
 * (que serializa en UTC) corra el día ±1 según la zona horaria del navegador.
 */
function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0))
}

function taxFormula(r: number, s: number, subH: boolean): string {
  return subH ? `(F${r}-G${s}-H${s})*${TAX_RATE}` : `(F${r}-G${s})*${TAX_RATE}`
}

function netFormula(r: number, s: number, subH: boolean): string {
  return subH ? `F${r}-G${s}-H${s}-I${r}-J${r}` : `F${r}-G${s}-I${r}-J${r}`
}

/* ------------------------------- Totales ---------------------------------- */

function writeTotals(ws: ExcelJS.Worksheet, totalsRow: number): void {
  const last = totalsRow - 1
  const cols = ['F', 'G', 'H', 'I', 'J', 'K']
  cols.forEach((col) => {
    // Si no hay cuentas, `last` < 2: dejar la fila de totales en blanco.
    const value = last >= 2 ? { formula: `SUM(${col}2:${col}${last})` } : 0
    setCell(ws, `${col}${totalsRow}`, value, {
      font: FONT_TOTAL,
      numFmt: FMT_NUM,
      fill: FILL_GREEN,
    })
  })
  ALL_COLS.forEach((col) => {
    ws.getCell(`${col}${totalsRow}`).border = BORDER_ALL
  })
}

/* --------------------------- Sección de gastos ---------------------------- */

function writeExpenses(ws: ExcelJS.Worksheet, input: ReportInput, totalsRow: number): void {
  const T = totalsRow
  const emp = input.expenses.employeeName
  const { basePay, commissionRate, bonus, fixedExpenses } = input.expenses

  let r = totalsRow + 2 // deja una fila en blanco

  const profitMinusBaseRow = r
  putLabel(ws, r, 'profit minus base pay', { formula: `K${T}-${basePay}` }, FONT_LABEL_BLACK)
  r++

  if (bonus != null) {
    putLabel(ws, r, `Bonus de ${emp} `, bonus, FONT_LABEL_BLACK)
    r++
  }

  const commissionRow = r
  putLabel(ws, r, `Commision de ${emp}`,
    { formula: `K${profitMinusBaseRow}*${commissionRate}` }, FONT_LABEL_BLACK)
  r++

  const basePayRow = r
  putLabel(ws, r, 'base pay ', basePay, FONT_LABEL_BLACK)
  r++

  const fixedRows: number[] = []
  fixedExpenses.forEach((e) => {
    putLabel(ws, r, e.label, e.amount, FONT_LABEL_BLACK)
    fixedRows.push(r)
    r++
  })

  r++ // fila en blanco

  putLabel(ws, r, `${emp.toUpperCase()}  TOTAL PAY `,
    { formula: `K${commissionRow}+K${basePayRow}` }, FONT_LABEL_RED)
  r++

  const sumParts = [`K${commissionRow}`, `K${basePayRow}`, ...fixedRows.map((fr) => `K${fr}`)].join('+')
  putLabel(ws, r, 'WHAT I TOOK HOME',
    { formula: `K${profitMinusBaseRow}-(${sumParts})` }, FONT_LABEL_RED)
}

function putLabel(
  ws: ExcelJS.Worksheet,
  r: number,
  label: string,
  value: ExcelJS.CellValue,
  font: Partial<ExcelJS.Font>,
): void {
  setCell(ws, `D${r}`, label, { font, align: LEFT, fill: FILL_GREEN })
  setCell(ws, `K${r}`, value, { font: FONT_DATA, numFmt: FMT_NUM, fill: FILL_GREEN })
  ws.getCell(`D${r}`).border = BORDER_ALL
  ws.getCell(`K${r}`).border = BORDER_ALL
}

/* ------------------------------- Helpers ---------------------------------- */

interface CellOpts {
  font?: Partial<ExcelJS.Font>
  numFmt?: string
  align?: Partial<ExcelJS.Alignment>
  fill?: ExcelJS.Fill
}

function setCell(ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, opts: CellOpts = {}): void {
  const cell = ws.getCell(addr)
  cell.value = value
  cell.font = opts.font ?? FONT_DATA
  cell.alignment = opts.align ?? CENTER
  if (opts.numFmt) cell.numFmt = opts.numFmt
  if (opts.fill) cell.fill = opts.fill
}

/* --------------------------- Descarga (browser) --------------------------- */

export async function downloadSalesReport(input: ReportInput): Promise<void> {
  const { saveAs } = await import('file-saver')
  const wb = buildWorkbook(input)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `${sanitizeSheetName(input.monthLabel)} Sales Report.xlsx`)
}
