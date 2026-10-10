import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DollarSign, Plus, CircleCheck, CircleAlert, Clock, FileDown } from 'lucide-react'
import type { Client, ClientProcess, Payment, PaymentMethod, Workspace } from '@/types'
import { getProcessBalance, getProcessPaid, parsePaymentDateParts, paymentInputToISO } from '@/lib/processUtils'
import {
  clientMutations,
  getReceiptNumber,
  paymentKey,
  type PaymentInput,
  type RunClientMutation,
} from '@/lib/processMutations'
import { roundMoney, toCents } from '@/lib/money'
import { formatMoney } from '@/lib/format'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  stripe: 'Stripe',
  otro: 'Otro',
}

/**
 * Formatea la fecha de un pago para el historial. Los pagos nuevos guardan
 * fecha+hora (ISO) → se muestra la hora; los legacy (`yyyy-MM-dd`) solo la fecha.
 */
function formatPaymentDate(value: string): string {
  const parts = parsePaymentDateParts(value)
  if (!parts) return value
  return parts.dateOnly
    ? format(parts.date, "d 'de' MMM yyyy", { locale: es })
    : format(parts.date, "d 'de' MMM yyyy, h:mm a", { locale: es })
}

interface PaymentSectionProps {
  client: Client
  process: ClientProcess
  onMutate: RunClientMutation
  isPending: boolean
  suggestedTotal?: number | null
  workspace?: Workspace | null
}

export default function PaymentSection({
  client,
  process,
  onMutate,
  isPending,
  suggestedTotal,
  workspace,
}: PaymentSectionProps) {
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)

  const handleDownloadReceipt = async (payment: Payment) => {
    if (!workspace) return
    setGeneratingKey(paymentKey(payment))
    try {
      const { generatePaymentReceipt } = await import('@/lib/receiptUtils')
      await generatePaymentReceipt({ client, process, payment, workspace })
    } catch {
      toast.error('Error al generar el recibo')
    } finally {
      setGeneratingKey(null)
    }
  }

  const [showDialog, setShowDialog] = useState(false)
  const [showTotalDialog, setShowTotalDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('zelle')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [paymentTime, setPaymentTime] = useState(() => format(new Date(), 'HH:mm'))
  const [totalInput, setTotalInput] = useState('')
  // Pago que se está editando (su `paymentKey`); `null` = registrar uno nuevo.
  const [editing, setEditing] = useState<Payment | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  const payments = process.payments ?? []
  const total = process.total ?? 0
  const amountPaid = getProcessPaid(process)
  const balance = getProcessBalance(process)
  const isPaidOff = total > 0 && balance <= 0

  const getPaymentStatus = () => {
    if (total === 0) return amountPaid > 0 ? 'anticipo' : 'sin_precio'
    if (amountPaid === 0) return 'pendiente'
    if (balance <= 0) return 'pagado'
    return 'parcial'
  }

  const status = getPaymentStatus()

  const resetPaymentForm = () => {
    setPaymentAmount('')
    setPaymentNote('')
    setPaymentDate(today)
    setEditing(null)
    setShowDialog(false)
  }

  const openEditPayment = (payment: Payment) => {
    const parts = parsePaymentDateParts(payment.date)
    setEditing(payment)
    setPaymentAmount(String(payment.amount))
    setPaymentMethod(payment.method)
    setPaymentNote(payment.note ?? '')
    setPaymentDate(parts ? format(parts.date, 'yyyy-MM-dd') : today)
    // Los pagos legacy solo tienen fecha: sin hora, se guarda a mediodía.
    setPaymentTime(parts && !parts.dateOnly ? format(parts.date, 'HH:mm') : '')
    setShowDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const amount = roundMoney(parseFloat(paymentAmount))
    if (isNaN(amount) || amount <= 0) return
    // Saldo sin contar este pago: el nuevo monto no debería pasarse de ahí.
    const available = roundMoney(balance + editing.amount)
    if (
      total > 0 &&
      toCents(amount) > toCents(available) &&
      !confirm(
        `El monto ($${formatMoney(amount)}) supera el saldo pendiente ($${formatMoney(available)}). ¿Guardarlo de todos modos?`,
      )
    ) {
      return
    }
    const ok = await onMutate(
      clientMutations.updatePayment(process.id, paymentKey(editing), {
        amount,
        method: paymentMethod,
        date: paymentInputToISO(paymentDate || today, paymentTime),
        note: paymentNote.trim(),
      }),
      'Pago actualizado',
    )
    if (ok) resetPaymentForm()
  }

  const registerPayment = async (amount: number) => {
    const input: PaymentInput = {
      amount,
      method: paymentMethod,
      date: paymentInputToISO(paymentDate || today, paymentTime),
      ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
    }
    const ok = await onMutate(clientMutations.addPayment(process.id, input), 'Pago registrado')
    if (ok) resetPaymentForm()
  }

  const handleRegisterPayment = async () => {
    const amount = roundMoney(parseFloat(paymentAmount))
    if (isNaN(amount) || amount <= 0) return
    if (
      total > 0 &&
      toCents(amount) > toCents(balance) &&
      !confirm(
        `El monto ($${formatMoney(amount)}) supera el saldo pendiente ($${formatMoney(balance)}). ¿Registrarlo de todos modos?`,
      )
    ) {
      return
    }
    await registerPayment(amount)
  }

  const handlePayFull = async () => {
    if (total <= 0 || balance <= 0) return
    await registerPayment(balance)
  }

  const handleSetTotal = async () => {
    const num = roundMoney(parseFloat(totalInput))
    if (isNaN(num) || num < 0) return
    const ok = await onMutate(clientMutations.updateProcess(process.id, { total: num }), 'Total actualizado')
    if (ok) {
      setShowTotalDialog(false)
      setTotalInput('')
    }
  }

  const handleDeletePayment = async (payment: Payment) => {
    const receipt = getReceiptNumber(process, payment)
    const message =
      `Se eliminará el pago de $${formatMoney(payment.amount)} del ${formatPaymentDate(payment.date)}. ` +
      `Si ya entregaste el recibo N° ${receipt}, queda sin respaldo. ¿Eliminar el pago?`
    if (!confirm(message)) return
    await onMutate(clientMutations.removePayment(process.id, paymentKey(payment)), 'Pago eliminado')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Pagos</p>
        <PaymentStatusBadge status={status} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{total > 0 ? `$${formatMoney(total)}` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="text-lg font-bold text-green-600">{amountPaid > 0 ? `$${formatMoney(amountPaid)}` : '$0'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-lg font-bold ${balance > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
            {total > 0 ? `$${formatMoney(balance)}` : '—'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setTotalInput(total > 0 ? String(total) : (suggestedTotal ? String(suggestedTotal) : ''))
            setShowTotalDialog(true)
          }}
        >
          <DollarSign className="mr-1 h-3 w-3" />
          {total > 0 ? 'Editar total' : 'Definir total'}
        </Button>
        {/* Sin total definido también se puede cobrar (anticipo). */}
        {!isPaidOff && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setPaymentAmount('')
              setPaymentNote('')
              setPaymentDate(today)
              setPaymentTime(format(new Date(), 'HH:mm'))
              setShowDialog(true)
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            Registrar pago
          </Button>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Historial de pagos</p>
          {payments.map((p, i) => (
            <div key={`${paymentKey(p)}#${i}`} className="flex items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
              <div className="min-w-0">
                <p className="font-medium">
                  ${formatMoney(p.amount)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Recibo N° {getReceiptNumber(process, p)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPaymentDate(p.date)} · {METHOD_LABELS[p.method] ?? p.method}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleDownloadReceipt(p)}
                  disabled={!workspace || generatingKey !== null}
                  title={workspace ? 'Generar recibo PDF' : 'Configura el emisor en el workspace'}
                >
                  <FileDown className="mr-1 h-3 w-3" />
                  {generatingKey === paymentKey(p) ? 'Generando...' : 'Recibo'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => openEditPayment(p)}
                  disabled={isPending}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDeletePayment(p)}
                  disabled={isPending}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
          {workspace && !workspace.receipt_company_name && !workspace.receipt_logo_url && (
            <p className="text-xs text-muted-foreground pt-1">
              Tip: configura el logo y nombre del emisor en{' '}
              <Link to="/workspace" className="underline hover:text-foreground">
                ajustes del workspace
              </Link>{' '}
              para personalizar los recibos.
            </p>
          )}
        </div>
      )}

      {/* Set total dialog */}
      <Dialog open={showTotalDialog} onOpenChange={setShowTotalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monto total a cobrar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="payment-total">Total ($)</Label>
            <Input
              id="payment-total"
              type="number"
              min="0"
              step="0.01"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder="Ej: 699"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTotalDialog(false)}>Cancelar</Button>
            <Button onClick={handleSetTotal} disabled={isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register payment dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => (open ? setShowDialog(true) : resetPaymentForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar pago — Recibo N° ${getReceiptNumber(process, editing)}` : 'Registrar pago'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              {editing ? (
                <>
                  El pago conserva su número de recibo. Si ya entregaste el recibo, genera uno
                  nuevo con los datos corregidos y reemplázalo.
                </>
              ) : total > 0 ? (
                <>
                  Saldo pendiente: <span className="font-semibold text-foreground">${formatMoney(balance)}</span>
                </>
              ) : (
                'Este proceso aún no tiene total: el pago se registra como anticipo.'
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto ($)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Monto del pago"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Fecha del pago</Label>
                <Input
                  id="pay-date"
                  type="date"
                  max={today}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-time">Hora del pago</Label>
                <Input
                  id="pay-time"
                  type="time"
                  value={paymentTime}
                  onChange={(e) => setPaymentTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Nota (opcional)</Label>
              <Textarea
                id="pay-note"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                rows={2}
                placeholder="Nota sobre el pago..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={resetPaymentForm}>Cancelar</Button>
            {editing ? (
              <Button onClick={handleSaveEdit} disabled={isPending || !paymentAmount}>
                Guardar cambios
              </Button>
            ) : (
              <>
                {total > 0 && balance > 0 && (
                  <Button variant="secondary" onClick={handlePayFull} disabled={isPending}>
                    Pago completo (${formatMoney(balance)})
                  </Button>
                )}
                <Button onClick={handleRegisterPayment} disabled={isPending || !paymentAmount}>
                  {total > 0 ? 'Registrar parcial' : 'Registrar anticipo'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pagado':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <CircleCheck className="mr-1 h-3 w-3" /> Pagado
        </Badge>
      )
    case 'parcial':
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
          <CircleAlert className="mr-1 h-3 w-3" /> Parcial
        </Badge>
      )
    case 'anticipo':
      return (
        <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
          <CircleAlert className="mr-1 h-3 w-3" /> Anticipo
        </Badge>
      )
    case 'pendiente':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <Clock className="mr-1 h-3 w-3" /> Pendiente
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400">
          Sin precio
        </Badge>
      )
  }
}
