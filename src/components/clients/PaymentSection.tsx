import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { DollarSign, Plus, CircleCheck, CircleAlert, Clock } from 'lucide-react'
import type { Client, Payment, PaymentMethod } from '@/types'

const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

interface PaymentSectionProps {
  client: Client
  onUpdate: (data: { payment_total?: number; payments?: Payment[] }) => Promise<void>
  isPending: boolean
  suggestedTotal?: number | null
}

export default function PaymentSection({ client, onUpdate, isPending, suggestedTotal }: PaymentSectionProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [showTotalDialog, setShowTotalDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('zelle')
  const [paymentNote, setPaymentNote] = useState('')
  const [totalInput, setTotalInput] = useState('')

  const payments = client.payments ?? []
  const total = client.payment_total ?? 0
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const balance = total - amountPaid

  const getPaymentStatus = () => {
    if (total === 0) return 'sin_precio'
    if (amountPaid === 0) return 'pendiente'
    if (balance <= 0) return 'pagado'
    return 'parcial'
  }

  const status = getPaymentStatus()

  const handleRegisterPayment = async () => {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return

    const newPayment: Payment = {
      amount,
      method: paymentMethod,
      date: new Date().toISOString().split('T')[0],
      ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
    }

    await onUpdate({ payments: [...payments, newPayment] })
    setPaymentAmount('')
    setPaymentNote('')
    setShowDialog(false)
  }

  const handlePayFull = async () => {
    if (total <= 0 || balance <= 0) return

    const newPayment: Payment = {
      amount: balance,
      method: paymentMethod,
      date: new Date().toISOString().split('T')[0],
      ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
    }

    await onUpdate({ payments: [...payments, newPayment] })
    setPaymentNote('')
    setShowDialog(false)
  }

  const handleSetTotal = async () => {
    const num = parseFloat(totalInput)
    if (isNaN(num) || num < 0) return
    await onUpdate({ payment_total: num })
    setShowTotalDialog(false)
    setTotalInput('')
  }

  const handleDeletePayment = async (index: number) => {
    const updated = payments.filter((_, i) => i !== index)
    await onUpdate({ payments: updated })
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
            <PaymentStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{total > 0 ? `$${total.toLocaleString()}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="text-lg font-bold text-green-600">{amountPaid > 0 ? `$${amountPaid.toLocaleString()}` : '$0'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {total > 0 ? `$${balance.toLocaleString()}` : '—'}
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
            {total > 0 && balance > 0 && (
              <Button size="sm" onClick={() => setShowDialog(true)}>
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
                <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">${p.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.date} · {METHOD_LABELS[p.method] ?? p.method}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeletePayment(i)}
                    disabled={isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              step="1"
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
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Saldo pendiente: <span className="font-semibold text-foreground">${balance.toLocaleString()}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto ($)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Monto del pago"
              />
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handlePayFull} disabled={isPending}>
              Pago completo (${balance.toLocaleString()})
            </Button>
            <Button onClick={handleRegisterPayment} disabled={isPending || !paymentAmount}>
              Registrar parcial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
