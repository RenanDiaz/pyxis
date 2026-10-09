import { useState } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { StateInfo, Workspace } from '@/types'
import { PROCESSES } from '@/data/processes'
import { getSuggestedPrice } from '@/lib/processUtils'
import { formatMoney } from '@/lib/format'
import { sumMoney } from '@/lib/money'
import { describeError } from '@/lib/errors'
import { buildQuote, DEFAULT_QUOTE_VALID_DAYS, MAX_QUOTE_VALID_DAYS, randomRef, type QuoteLine } from '@/lib/quote'

interface QuickQuoteDialogProps {
  state: StateInfo
  workspace: Workspace | null | undefined
  onOpenChange: (open: boolean) => void
}

interface CatalogRow {
  selected: boolean
  price: string
}

interface CustomRow {
  id: number
  label: string
  price: string
}

/**
 * Cotización rápida desde el detalle de un estado (spec 15): sin cliente
 * registrado, con el nombre del destinatario opcional. No guarda nada. Cada
 * línea es el precio total del servicio (sin desglose de fees).
 */
export default function QuickQuoteDialog({ state, workspace, onOpenChange }: QuickQuoteDialogProps) {
  const [recipient, setRecipient] = useState('')
  const [rows, setRows] = useState<Record<string, CatalogRow>>(() =>
    Object.fromEntries(
      PROCESSES.map((def) => {
        const price = getSuggestedPrice(def.id, state)
        return [def.id, { selected: def.id === 'registration', price: price != null ? String(price) : '' }]
      }),
    ),
  )
  const [custom, setCustom] = useState<CustomRow[]>([])
  const [validDays, setValidDays] = useState(String(DEFAULT_QUOTE_VALID_DAYS))
  const [generating, setGenerating] = useState(false)

  const lineLabel = (defId: string, label: string) =>
    PROCESSES.find((d) => d.id === defId)?.pricing.mode === 'state' ? `${label} — ${state.abbreviation}` : label

  const lines: Array<QuoteLine & { valid: boolean }> = [
    ...PROCESSES.filter((d) => rows[d.id].selected).map((d) => {
      const price = parseFloat(rows[d.id].price)
      return { label: lineLabel(d.id, d.label), price: price || 0, valid: price > 0 }
    }),
    ...custom.map((c) => {
      const price = parseFloat(c.price)
      return { label: c.label.trim(), price: price || 0, valid: price > 0 && !!c.label.trim() }
    }),
  ]
  const invalid = lines.some((l) => !l.valid)
  const days = parseInt(validDays, 10)
  const validDaysOk = days >= 1 && days <= MAX_QUOTE_VALID_DAYS
  const total = sumMoney(lines.map((l) => l.price))
  const canGenerate = !!workspace && lines.length > 0 && !invalid && validDaysOk && !generating

  const updateRow = (id: string, patch: Partial<CatalogRow>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  const updateCustom = (id: number, patch: Partial<CustomRow>) =>
    setCustom((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const handleGenerate = async () => {
    if (!canGenerate || !workspace) return
    setGenerating(true)
    try {
      const quote = buildQuote({
        ref: randomRef(),
        recipient,
        lines: lines.map(({ label, price }) => ({ label, price })),
        validDays: days,
      })
      const { downloadQuotePdf } = await import('@/lib/quotePdf')
      await downloadQuotePdf(quote, workspace)
      toast.success(`Cotización ${quote.number} generada`)
      onOpenChange(false)
    } catch (err) {
      toast.error(describeError(err, 'No se pudo generar la cotización'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cotización rápida — {state.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-quote-recipient">Para (opcional)</Label>
            <Input
              id="quick-quote-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Nombre del cliente"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            {PROCESSES.map((def) => {
              const row = rows[def.id]
              const bad = row.selected && !(parseFloat(row.price) > 0)
              return (
                <div key={def.id} className="flex items-center gap-3 rounded-md border p-2.5">
                  <input
                    type="checkbox"
                    id={`qq-${def.id}`}
                    className="h-4 w-4"
                    checked={row.selected}
                    onChange={(e) => updateRow(def.id, { selected: e.target.checked })}
                  />
                  <label htmlFor={`qq-${def.id}`} className="min-w-0 flex-1 cursor-pointer text-sm font-medium">
                    {lineLabel(def.id, def.label)}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label={`Precio de ${def.label}`}
                    aria-invalid={bad}
                    className={`w-28 shrink-0 ${bad ? 'border-destructive' : ''}`}
                    value={row.price}
                    disabled={!row.selected}
                    placeholder="Precio"
                    onChange={(e) => updateRow(def.id, { price: e.target.value })}
                  />
                </div>
              )
            })}

            {custom.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border p-2.5">
                <Input
                  aria-label="Nombre del servicio"
                  value={c.label}
                  placeholder="Otro servicio"
                  onChange={(e) => updateCustom(c.id, { label: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Precio del servicio"
                  className="w-28 shrink-0"
                  value={c.price}
                  placeholder="Precio"
                  onChange={(e) => updateCustom(c.id, { price: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Quitar servicio"
                  onClick={() => setCustom((prev) => prev.filter((x) => x.id !== c.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCustom((prev) => [...prev, { id: Date.now(), label: '', price: '' }])}
            >
              <Plus className="mr-1 h-3 w-3" /> Otro servicio
            </Button>
          </div>

          {invalid && (
            <p className="text-sm text-destructive">Completa el nombre y el precio de cada servicio seleccionado.</p>
          )}

          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total a pagar</span>
            <span className="text-lg font-bold">${formatMoney(total)}</span>
          </div>

          <div className="max-w-[160px] space-y-1.5">
            <Label htmlFor="quick-quote-days">Vigencia (días)</Label>
            <Input
              id="quick-quote-days"
              type="number"
              min={1}
              max={MAX_QUOTE_VALID_DAYS}
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              aria-invalid={!validDaysOk}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            No se guarda nada: es solo el PDF. Si el cliente acepta, regístralo en Clientes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            <FileText className="mr-2 h-4 w-4" />
            {generating ? 'Generando...' : 'Generar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
