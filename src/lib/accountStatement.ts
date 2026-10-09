import { format } from 'date-fns'
import type { Client, ClientProcess, PaymentMethod } from '@/types'
import { getProcessBalance, getProcessPaid, parsePaymentDateParts } from '@/lib/processUtils'
import { getReceiptNumber } from '@/lib/processMutations'
import { fromCents, sumMoney, toCents } from '@/lib/money'
import { processQuoteLine } from '@/lib/quote'
import { getClientDisplayName } from '@/lib/clientUtils'

// Estado de cuenta (spec 16): cuánto debe el cliente de uno o varios
// procesos. Por proceso: total acordado, pagos (con su N° de recibo) y saldo.
// Sin desglose de fees: el total es el del proceso.

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
  total: number
  paid: number
  balance: number
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

/** Solo se puede incluir un proceso con total acordado (si no, no hay saldo). */
export function canStateAccount(process: ClientProcess): boolean {
  return !!process.total && process.total > 0
}

/** Marcados por defecto: los que tienen saldo pendiente. */
export function hasPendingBalance(process: ClientProcess): boolean {
  return canStateAccount(process) && getProcessBalance(process) > 0
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
    return {
      label,
      ...(detail && { detail }),
      total: process.total ?? 0,
      paid: getProcessPaid(process),
      balance: getProcessBalance(process),
      payments,
    }
  })
  const total = sumMoney(lines.map((l) => l.total))
  const paid = sumMoney(lines.map((l) => l.paid))
  return {
    number: statementNumber(client.id, now),
    issuedAt: now,
    recipient: getClientDisplayName(client),
    lines,
    total,
    paid,
    balance: fromCents(toCents(total) - toCents(paid)),
  }
}
