import { useMemo, useState } from 'react'
import { AlertTriangle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Client, StateInfo, Workspace } from '@/types'
import { getProcessLabel, getProcessPaid } from '@/lib/processUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import { formatMoney } from '@/lib/format'
import { sumMoney } from '@/lib/money'
import { clientMutations, type RunClientMutation } from '@/lib/processMutations'
import { describeError } from '@/lib/errors'
import {
  buildQuote,
  defaultQuotePrice,
  DEFAULT_QUOTE_VALID_DAYS,
  isQuotableByDefault,
  MAX_QUOTE_VALID_DAYS,
} from '@/lib/quote'

interface QuoteDialogProps {
  client: Client
  workspace: Workspace | null | undefined
  states: StateInfo[] | undefined
  onOpenChange: (open: boolean) => void
  onMutate: RunClientMutation
}

interface Row {
  selected: boolean
  price: string
}

/** Diálogo de cotización (spec 15). Se monta solo cuando está abierto. */
export default function QuoteDialog({ client, workspace, states, onOpenChange, onMutate }: QuoteDialogProps) {
  const processes = useMemo(() => client.processes ?? [], [client.processes])
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      processes.map((p) => {
        const state = p.state ? states?.find((s) => s.abbreviation === p.state) : null
        const price = defaultQuotePrice(p, state)
        return [p.id, { selected: isQuotableByDefault(p), price: price != null ? String(price) : '' }]
      }),
    ),
  )
  const [validDays, setValidDays] = useState(String(DEFAULT_QUOTE_VALID_DAYS))
  const [saveTotals, setSaveTotals] = useState(true)
  const [generating, setGenerating] = useState(false)

  const selected = processes.filter((p) => rows[p.id]?.selected)
  const priceOf = (id: string) => parseFloat(rows[id]?.price ?? '')
  const missingPrice = selected.some((p) => !(priceOf(p.id) > 0))
  const days = parseInt(validDays, 10)
  const validDaysOk = days >= 1 && days <= MAX_QUOTE_VALID_DAYS
  const total = sumMoney(selected.map((p) => priceOf(p.id) || 0))
  const alreadyPaid = sumMoney(selected.map(getProcessPaid))
  const withoutTotal = selected.filter((p) => !(p.total && p.total > 0))

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const handleGenerate = async () => {
    if (!workspace || selected.length === 0 || missingPrice || !validDaysOk) return
    setGenerating(true)
    try {
      // Si el cliente acepta, el precio ya queda acordado en el proceso. Un
      // total existente nunca se cambia (el precio editado vale solo para el PDF).
      if (saveTotals && withoutTotal.length > 0) {
        const totals = Object.fromEntries(withoutTotal.map((p) => [p.id, priceOf(p.id)]))
        const ok = await onMutate(clientMutations.setMissingTotals(totals), 'Precios guardados en los procesos')
        if (!ok) return
      }
      const quote = buildQuote(
        client,
        selected.map((p) => ({ process: p, price: priceOf(p.id) })),
        { validDays: days },
      )
      // Carga diferida: jsPDF solo se necesita al generar.
      const { downloadQuotePdf } = await import('@/lib/quotePdf')
      await downloadQuotePdf(client, quote, workspace)
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
          <DialogTitle>Generar cotización</DialogTitle>
        </DialogHeader>

        {processes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este cliente no tiene procesos. Agrega los servicios que quiere contratar para cotizarlos.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {processes.map((p) => {
                const row = rows[p.id]
                const company = p.type === 'registration' ? getProcessCompanyName(client, p) : ''
                const invalid = row.selected && !(parseFloat(row.price) > 0)
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-md border p-3">
                    <input
                      type="checkbox"
                      id={`quote-${p.id}`}
                      className="h-4 w-4"
                      checked={row.selected}
                      onChange={(e) => update(p.id, { selected: e.target.checked })}
                    />
                    <label htmlFor={`quote-${p.id}`} className="min-w-0 flex-1 cursor-pointer text-sm">
                      <span className="font-medium">
                        {getProcessLabel(p)}
                        {p.state ? ` — ${p.state}` : ''}
                      </span>
                      {company && <span className="block text-xs text-muted-foreground">{company}</span>}
                      {!(p.total && p.total > 0) && (
                        <span className="block text-xs text-muted-foreground">Sin total acordado</span>
                      )}
                    </label>
                    <div className="w-28 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`Precio de ${getProcessLabel(p)}`}
                        aria-invalid={invalid}
                        className={invalid ? 'border-destructive' : undefined}
                        value={row.price}
                        disabled={!row.selected}
                        placeholder="Precio"
                        onChange={(e) => update(p.id, { price: e.target.value })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {missingPrice && (
              <p className="text-sm text-destructive">Completa el precio de cada servicio seleccionado.</p>
            )}

            {alreadyPaid > 0 && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  Este cliente ya abonó ${formatMoney(alreadyPaid)} en estos procesos. La cotización muestra el
                  precio completo, sin descontar lo pagado.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total a pagar</span>
              <span className="text-lg font-bold">${formatMoney(total)}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-days">Vigencia (días)</Label>
                <Input
                  id="quote-days"
                  type="number"
                  min={1}
                  max={MAX_QUOTE_VALID_DAYS}
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  aria-invalid={!validDaysOk}
                />
              </div>
            </div>

            {withoutTotal.length > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={saveTotals}
                  onChange={(e) => setSaveTotals(e.target.checked)}
                />
                <span>
                  Guardar estos precios como total de los procesos que aún no lo tienen
                  <span className="block text-xs text-muted-foreground">
                    Los procesos con total acordado no cambian.
                  </span>
                </span>
              </label>
            )}

            {!workspace?.payment_instructions?.trim() && (
              <p className="text-xs text-muted-foreground">
                Tip: el owner puede agregar las instrucciones de pago (Zelle, cuenta…) en la configuración del
                workspace para que aparezcan en la cotización.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!workspace || generating || selected.length === 0 || missingPrice || !validDaysOk}
          >
            <FileText className="mr-2 h-4 w-4" />
            {generating ? 'Generando...' : 'Generar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
