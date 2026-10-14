import { format } from 'date-fns'
import type { Client, ClientProcess, PaymentMethod } from '@/types'
import { getProcessAccount, getProcessPaid, parsePaymentDateParts } from '@/lib/processUtils'
import { getReceiptNumber } from '@/lib/processMutations'
import { fromCents, sumMoney, toCents } from '@/lib/money'
import { processQuoteLine } from '@/lib/quote'
import { getClientDisplayName } from '@/lib/clientUtils'

// Estado de cuenta (spec 16): cuánto debe el cliente de uno o varios
// procesos. Por proceso: total acordado, pagos (con su N° de recibo) y saldo.
// Sin desglose de fees: el total es el del proceso. Un proceso cancelado no
// debe nada (spec 23): sale con lo cobrado, lo reembolsado y saldo 0.

export interface StatementPayment {
  date: Date | null
  dateOnly: boolean
  amount: number
  method: PaymentMethod
  receiptNumber: number
}

export interface StatementLine {
  label: string
  detail?: string
  /** Total acordado; en un cancelado, lo cobrado neto. */
  total: number
  /** Lo pagado (bruto, sin descontar reembolsos). */
  paid: number
  /** Solo cancelados: lo devuelto al cliente. */
  refunded: number
  balance: number
  cancelled: boolean
  payments: StatementPayment[]
}

export interface AccountStatement {
  number: string
  issuedAt: Date
  recipient: string
  lines: StatementLine[]
  total: number
  paid: number
  /** Positivo: lo que falta pagar. Negativo: saldo a favor del cliente. */
  balance: number
}

/**
 * Se puede incluir un proceso con total acordado (si no, no hay saldo). Un
 * cancelado, solo si tiene pagos: sin ellos no hay nada que informar.
 */
export function canStateAccount(process: ClientProcess): boolean {
  if (process.stage === 'cancelado') return getProcessPaid(process) > 0
  return !!process.total && process.total > 0
}

/** Por qué no se puede incluir un proceso; `null` si se puede. */
export function statementDisabledReason(process: ClientProcess): string | null {
  if (canStateAccount(process)) return null
  return process.stage === 'cancelado'
    ? 'Cancelado sin pagos'
    : 'Sin total acordado: defínelo en el proceso para incluirlo'
}

/** Los que tienen saldo pendiente (un cancelado nunca). */
export function hasPendingBalance(process: ClientProcess): boolean {
  return canStateAccount(process) && getProcessAccount(process).balance > 0
}

/**
 * Marcados por defecto: los que deben. Si ninguno debe, todos los que se pueden
 * incluir salvo los cancelados, para emitir un estado "al día".
 */
export function defaultStatementSelection(processes: ClientProcess[]): ClientProcess[] {
  const pending = processes.filter(hasPendingBalance)
  if (pending.length) return pending
  return processes.filter((p) => canStateAccount(p) && p.stage !== 'cancelado')
}

/** Total / pagado / saldo de los procesos elegidos, con montos efectivos. */
export function summarizeStatement(processes: ClientProcess[]): { total: number; paid: number; balance: number } {
  const accounts = processes.map(getProcessAccount)
  const total = sumMoney(accounts.map((a) => a.total))
  const paid = sumMoney(accounts.map((a) => a.paid))
  return { total, paid, balance: fromCents(toCents(total) - toCents(paid)) }
}

export function statementNumber(clientId: string, at: Date): string {
  return `EC-${format(at, 'yyMMdd')}-${clientId.slice(-4).toUpperCase()}-${format(at, 'HHmm')}`
}

export function buildAccountStatement(
  client: Client,
  processes: ClientProcess[],
  now: Date = new Date(),
): AccountStatement {
  const included = processes.filter(canStateAccount)
  if (included.length === 0) throw new Error('El estado de cuenta necesita al menos un proceso con total')
  const lines: StatementLine[] = included.map((process) => {
    const { label, detail } = processQuoteLine(client, process, 0)
    const payments = [...(process.payments ?? [])]
      .map((p) => {
        const parts = parsePaymentDateParts(p.date)
        return {
          date: parts?.date ?? null,
          dateOnly: parts?.dateOnly ?? true,
          amount: p.amount,
          method: p.method,
          receiptNumber: getReceiptNumber(process, p),
        }
      })
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    const account = getProcessAccount(process)
    return {
      label,
      ...(detail && { detail }),
      total: account.cancelled ? account.total : (process.total ?? 0),
      paid: getProcessPaid(process),
      refunded: account.refunded,
      balance: account.balance,
      cancelled: account.cancelled,
      payments,
    }
  })
  return {
    number: statementNumber(client.id, now),
    issuedAt: now,
    recipient: getClientDisplayName(client),
    lines,
    ...summarizeStatement(included),
  }
}
