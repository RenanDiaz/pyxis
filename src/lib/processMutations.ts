import type { Client, ClientProcess, ClientStatus, Payment } from '@/types'
import { backfillFirstRegistrationCompany } from '@/lib/companyUtils'
import { getProcessPaid, parsePaymentDate } from '@/lib/processUtils'
import { fromCents, roundMoney, sumMoney, toCents } from '@/lib/money'
import { inferStatus } from '@/lib/statusUtils'
import { UserFacingError } from '@/lib/errors'

// Mutaciones de los procesos (y sus pagos) de un cliente, como funciones puras
// sobre el estado FRESCO del documento. Se aplican dentro de una transacción
// (`runClientMutation`): así dos cambios concurrentes (dos pestañas, dos
// agentes, o un pago y un cambio de etapa seguidos) no se pisan.

export type PaymentInput = Omit<Payment, 'id' | 'receipt_number'>

/** Cambios a un proceso. Una clave con `undefined` se elimina del proceso. */
export type ProcessPatch = Partial<Omit<ClientProcess, 'id' | 'payments' | 'created_at'>>

export interface ClientChange {
  processes: ClientProcess[]
  status?: ClientStatus
}

export type ClientMutation = (client: Client) => ClientChange

// ── Identidad de pagos y recibos ──

/** Clave estable de un pago: su `id`, o una huella para pagos legacy sin id. */
export function paymentKey(payment: Payment): string {
  return payment.id ?? `legacy:${payment.date}|${payment.amount}|${payment.method}|${payment.note ?? ''}`
}

/**
 * Número de recibo de un pago dentro de su proceso. Los pagos nuevos lo traen
 * fijo; los legacy usan su posición original (lo que se imprimía antes).
 */
export function getReceiptNumber(process: ClientProcess, payment: Payment): number {
  if (payment.receipt_number) return payment.receipt_number
  const key = paymentKey(payment)
  return (process.payments ?? []).findIndex((p) => paymentKey(p) === key) + 1
}

function nextReceiptNumber(process: ClientProcess): number {
  const payments = process.payments ?? []
  return payments.reduce((max, p, i) => Math.max(max, p.receipt_number ?? i + 1), 0) + 1
}

/**
 * Saldo del proceso justo después de un pago, contando los pagos con fecha
 * anterior (o igual fecha y menor número de recibo). No depende del orden del
 * array: un pago cargado tarde con fecha vieja no altera recibos ya emitidos
 * con fecha posterior… salvo que realmente haya ocurrido antes.
 */
export function getBalanceAfterPayment(process: ClientProcess, payment: Payment): number {
  const time = (p: Payment) => parsePaymentDate(p.date)?.getTime() ?? 0
  const target = { time: time(payment), seq: getReceiptNumber(process, payment) }
  const upToThis = (process.payments ?? []).filter((p) => {
    const t = time(p)
    return t < target.time || (t === target.time && getReceiptNumber(process, p) <= target.seq)
  })
  return Math.max(0, fromCents(toCents(process.total) - toCents(sumMoney(upToThis.map((p) => p.amount)))))
}

// ── Mutadores puros sobre el array de procesos ──

function indexOfProcess(processes: ClientProcess[], processId: string): number {
  const index = processes.findIndex((p) => p.id === processId)
  if (index < 0) throw new UserFacingError('El proceso ya no existe. Recarga la página.')
  return index
}

function replaceAt(processes: ClientProcess[], index: number, next: ClientProcess): ClientProcess[] {
  return processes.map((p, i) => (i === index ? next : p))
}

export function addPaymentTo(
  processes: ClientProcess[],
  processId: string,
  input: PaymentInput,
  id: string = crypto.randomUUID(),
): ClientProcess[] {
  const index = indexOfProcess(processes, processId)
  const process = processes[index]
  const payment: Payment = {
    ...input,
    id,
    receipt_number: nextReceiptNumber(process),
    amount: roundMoney(input.amount),
  }
  return replaceAt(processes, index, { ...process, payments: [...(process.payments ?? []), payment] })
}

export function removePaymentFrom(
  processes: ClientProcess[],
  processId: string,
  key: string,
): ClientProcess[] {
  const index = indexOfProcess(processes, processId)
  const process = processes[index]
  const payments = process.payments ?? []
  // Solo el primero que coincide: dos pagos legacy idénticos comparten huella.
  const target = payments.findIndex((p) => paymentKey(p) === key)
  if (target < 0) throw new UserFacingError('El pago ya no existe. Recarga la página.')
  // Los demás pagos conservan su número de recibo: se fija el de los legacy
  // antes de quitar uno, para que no se renumeren.
  const kept = payments
    .map((p, i) => (p.receipt_number ? p : { ...p, receipt_number: i + 1 }))
    .filter((_, i) => i !== target)
  return replaceAt(processes, index, { ...process, payments: kept })
}

/**
 * Corrige un pago ya registrado (monto, fecha, método, nota). Conserva su `id`
 * y su número de recibo: el recibo reimpreso sale con el mismo número. A un
 * pago legacy se le fija el número que tenía y se le asigna `id`.
 */
export function updatePaymentIn(
  processes: ClientProcess[],
  processId: string,
  key: string,
  patch: Partial<PaymentInput>,
  newId: string = crypto.randomUUID(),
): ClientProcess[] {
  const index = indexOfProcess(processes, processId)
  const process = processes[index]
  const payments = process.payments ?? []
  // Solo el primero que coincide: dos pagos legacy idénticos comparten huella.
  const target = payments.findIndex((p) => paymentKey(p) === key)
  if (target < 0) throw new UserFacingError('El pago ya no existe. Recarga la página.')
  const current = payments[target]
  const next: Payment = {
    ...current,
    ...patch,
    id: current.id ?? newId,
    receipt_number: getReceiptNumber(process, current),
    amount: roundMoney(patch.amount ?? current.amount),
  }
  // La nota vacía se quita (Firestore rechaza `undefined`).
  if (!next.note) delete next.note
  return replaceAt(processes, index, {
    ...process,
    payments: payments.map((p, i) => (i === target ? next : p)),
  })
}

export function patchProcess(
  processes: ClientProcess[],
  processId: string,
  patch: ProcessPatch,
): ClientProcess[] {
  const index = indexOfProcess(processes, processId)
  const next: Record<string, unknown> = { ...processes[index] }
  for (const [key, value] of Object.entries(patch)) {
    // Firestore rechaza `undefined`: la clave se quita (p. ej. volver a heredar).
    if (value === undefined) delete next[key]
    else next[key] = key === 'total' && typeof value === 'number' ? roundMoney(value) : value
  }
  return replaceAt(processes, index, next as unknown as ClientProcess)
}

// ── Status del cliente según saldos ──

function summarize(processes: ClientProcess[]) {
  const total = toCents(sumMoney(processes.map((p) => p.total)))
  const paid = toCents(sumMoney(processes.map(getProcessPaid)))
  return { total, paid, balance: total - paid, paidOff: total > 0 && paid >= total }
}

/**
 * Status tras un cambio que mueve saldos (pago, total, quitar proceso):
 * - saldo total en 0 → `full_payment` (cerrado);
 * - un cliente `cerrado` que estaba saldado y vuelve a deber (se borró un pago
 *   o subió el total) → `en_proceso`;
 * - entra dinero → `partial_payment`.
 */
export function statusAfterBalanceChange(
  client: Client,
  before: ClientProcess[],
  after: ClientProcess[],
): ClientStatus | null {
  const prev = summarize(before)
  const next = summarize(after)
  if (next.paidOff) return inferStatus(client.status, 'full_payment')
  if (client.status === 'cerrado' && prev.paidOff && next.balance > 0) return 'en_proceso'
  if (next.paid > prev.paid) return inferStatus(client.status, 'partial_payment')
  return null
}

function balanceChange(client: Client, after: ClientProcess[]): ClientChange {
  const status = statusAfterBalanceChange(client, client.processes ?? [], after)
  return status ? { processes: after, status } : { processes: after }
}

// ── Mutaciones de cliente (lo que corre dentro de la transacción) ──

export const clientMutations = {
  addPayment:
    (processId: string, input: PaymentInput): ClientMutation =>
    (client) =>
      balanceChange(client, addPaymentTo(client.processes ?? [], processId, input)),

  removePayment:
    (processId: string, key: string): ClientMutation =>
    (client) =>
      balanceChange(client, removePaymentFrom(client.processes ?? [], processId, key)),

  updatePayment:
    (processId: string, key: string, patch: Partial<PaymentInput>): ClientMutation =>
    (client) =>
      balanceChange(client, updatePaymentIn(client.processes ?? [], processId, key, patch)),

  /** Cambiar el total recalcula el status; etapa, notas o compañía no. */
  updateProcess:
    (processId: string, patch: ProcessPatch): ClientMutation =>
    (client) => {
      const after = patchProcess(client.processes ?? [], processId, patch)
      return 'total' in patch ? balanceChange(client, after) : { processes: after }
    },

  /**
   * Fija el total de los procesos que aún no tienen uno (cotización, spec 15).
   * Un total ya acordado nunca se pisa, aunque venga en `totals`.
   */
  setMissingTotals:
    (totals: Record<string, number>): ClientMutation =>
    (client) => {
      let after = client.processes ?? []
      for (const [processId, total] of Object.entries(totals)) {
        const process = after.find((p) => p.id === processId)
        if (!process || (process.total && process.total > 0) || !(total > 0)) continue
        after = patchProcess(after, processId, { total })
      }
      return balanceChange(client, after)
    },

  addProcess:
    (process: ClientProcess): ClientMutation =>
    (client) => ({
      // Al pasar a más de un registro, el primero deja de heredar los datos de
      // compañía del cliente: se los copiamos para que conserve su identidad.
      processes: backfillFirstRegistrationCompany(client, [...(client.processes ?? []), process]),
    }),

  removeProcess:
    (processId: string): ClientMutation =>
    (client) => {
      const processes = client.processes ?? []
      indexOfProcess(processes, processId)
      return balanceChange(client, processes.filter((p) => p.id !== processId))
    },
}

/** Corre una mutación y avisa al usuario; `true` si se guardó. */
export type RunClientMutation = (mutation: ClientMutation, successMessage: string) => Promise<boolean>
