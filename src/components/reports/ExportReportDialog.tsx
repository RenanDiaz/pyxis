import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { DEFAULT_TAX_RATE, type ExpenseConfig } from '@/lib/generateSalesReport'
import {
  DEFAULT_REGISTERED_AGENT_COST,
  type CancelledSale,
  type MissingCost,
  type ProjectedSale,
  type StripeFeeMode,
} from '@/lib/salesReportData'
import { formatMoney } from '@/lib/format'

/** Config completa de exportación: gastos + opciones de cálculo. */
export interface ExportSettings {
  expenses: ExpenseConfig
  stripeFeeMode: StripeFeeMode
  taxRate: number
  /** Costo del Registered Agent de las cuentas que lo incluyen. */
  registeredAgentCost: number
}

const STORAGE_KEY = 'pyxis.salesReport.exportSettings'
/**
 * Versión de lo guardado. v2: el Stripe fee pasa a ser el recargo del 4 % del
 * Excel manual (spec 04, P5); el modo guardado antes («estimar» 2.9 % + $0.30
 * era el default) ya no existe, así que no se arrastra.
 */
const SETTINGS_VERSION = 2

/** Valores por defecto (basados en el ejemplo de junio del SPEC). */
function defaultSettings(employeeName: string): ExportSettings {
  return {
    expenses: {
      employeeName,
      basePay: 500,
      commissionRate: 0.15,
      bonus: undefined,
      fixedExpenses: [
        { label: 'FaceBook Marketing', amount: 0 },
        { label: 'Zoom Phone', amount: 0 },
      ],
    },
    stripeFeeMode: 'surcharge',
    taxRate: DEFAULT_TAX_RATE,
    registeredAgentCost: DEFAULT_REGISTERED_AGENT_COST,
  }
}

function loadSettings(employeeName: string): ExportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExportSettings> & { version?: number }
      if (parsed.version !== SETTINGS_VERSION) delete parsed.stripeFeeMode
      // El nombre del empleado sigue al agente seleccionado, no al guardado.
      return {
        ...defaultSettings(employeeName),
        ...parsed,
        expenses: { ...defaultSettings(employeeName).expenses, ...parsed.expenses, employeeName },
      }
    }
  } catch {
    // Ignorar JSON corrupto.
  }
  return defaultSettings(employeeName)
}

const MISSING_COST_TEXT: Record<MissingCost['reason'], string> = {
  no_state: 'sin estado',
  no_state_value: 'el estado no tiene este costo',
  manual: 'costo sin capturar',
}

interface ExportReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre por defecto del empleado (agente seleccionado). */
  defaultEmployeeName: string
  /** Nº de cuentas y pagos que entran en el mes (para avisar si es 0). */
  accountCount: number
  /** Cuentas sin estado en el proceso (su state fee sale en 0). */
  /** Ventas sin costo estatal conocido (su STATE FEE sale en 0). */
  missingCost: MissingCost[]
  /** Ventas con saldo pendiente: su CHARGE incluye un monto proyectado. */
  projected: ProjectedSale[]
  /** Ventas canceladas: cuentan lo cobrado menos lo reembolsado. */
  cancelled: CancelledSale[]
  isExporting: boolean
  onExport: (settings: ExportSettings) => void
}

export default function ExportReportDialog({
  open,
  onOpenChange,
  defaultEmployeeName,
  accountCount,
  missingCost,
  projected,
  cancelled,
  isExporting,
  onExport,
}: ExportReportDialogProps) {
  const [settings, setSettings] = useState<ExportSettings>(() =>
    loadSettings(defaultEmployeeName)
  )

  // Al abrir, refrescar con lo guardado y sincronizar el nombre del empleado.
  // Patrón recomendado por React para reiniciar estado al cambiar una prop:
  // ajustar el estado durante el render, sin useEffect.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSettings(loadSettings(defaultEmployeeName))
  }

  const { expenses } = settings

  function patchExpenses(patch: Partial<ExpenseConfig>) {
    setSettings((s) => ({ ...s, expenses: { ...s.expenses, ...patch } }))
  }

  function updateFixed(index: number, patch: Partial<{ label: string; amount: number }>) {
    patchExpenses({
      fixedExpenses: expenses.fixedExpenses.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      ),
    })
  }

  function addFixed() {
    patchExpenses({ fixedExpenses: [...expenses.fixedExpenses, { label: '', amount: 0 }] })
  }

  function removeFixed(index: number) {
    patchExpenses({ fixedExpenses: expenses.fixedExpenses.filter((_, i) => i !== index) })
  }

  function handleExport() {
    // Limpiar gastos fijos sin rótulo antes de exportar y persistir.
    const cleaned: ExportSettings = {
      ...settings,
      expenses: {
        ...expenses,
        fixedExpenses: expenses.fixedExpenses.filter((e) => e.label.trim().length > 0),
      },
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cleaned, version: SETTINGS_VERSION }))
    } catch {
      // Ignorar si localStorage no está disponible.
    }
    onExport(cleaned)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar reporte de ventas</DialogTitle>
          <DialogDescription>
            Una fila por cada venta del mes (según su fecha de venta). Estos valores completan
            la sección de gastos y pagos del reporte.
          </DialogDescription>
        </DialogHeader>

        {accountCount === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            No hay ventas en el mes seleccionado. El reporte saldrá sin cuentas.
          </div>
        )}

        {missingCost.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-medium">
              {missingCost.length === 1
                ? '1 venta no tiene costo estatal: su STATE FEE saldrá en 0.'
                : `${missingCost.length} ventas no tienen costo estatal: su STATE FEE saldrá en 0.`}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {missingCost.map((item, i) => (
                <li key={i}>
                  {item.label}: {MISSING_COST_TEXT[item.reason]}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Se corrige en el proceso del cliente («Costo estatal»).</p>
          </div>
        )}

        {cancelled.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-medium">
              {cancelled.length === 1
                ? '1 venta cancelada: cuenta lo cobrado menos lo reembolsado.'
                : `${cancelled.length} ventas canceladas: cuentan lo cobrado menos lo reembolsado.`}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {cancelled.map((c, i) => (
                <li key={i}>
                  {c.label}: ${formatMoney(c.charge)}
                  {c.refundMissing ? ' (reembolso sin capturar: se toma como $0)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {projected.length > 0 && (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            <p className="font-medium">
              {projected.length === 1
                ? '1 venta tiene saldo pendiente: su CHARGE incluye lo que falta cobrar.'
                : `${projected.length} ventas tienen saldo pendiente: su CHARGE incluye lo que falta cobrar.`}
            </p>
            {settings.stripeFeeMode === 'surcharge' && projected.some((p) => p.stripe) && (
              <p className="mt-0.5">
                Si el primer pago fue con Stripe, el saldo también lleva el recargo del 4 %.
              </p>
            )}
            <ul className="mt-1 list-disc pl-5">
              {projected.map((p, i) => (
                <li key={i}>
                  {p.label}: ${formatMoney(p.pending)} por cobrar
                  {settings.stripeFeeMode === 'surcharge' && p.stripe ? ' (Stripe)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-nombre-del-empleado">Nombre del empleado</Label>
            <Input
              id="report-nombre-del-empleado"
              value={expenses.employeeName}
              onChange={(e) => patchExpenses({ employeeName: e.target.value })}
              placeholder="Ej: isabel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="report-base-pay">Base pay ($)</Label>
              <Input
                id="report-base-pay"
                type="number"
                min={0}
                step="0.01"
                value={expenses.basePay}
                onChange={(e) => patchExpenses({ basePay: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-commission">Comisión (%)</Label>
              <Input
                id="report-commission"
                type="number"
                min={0}
                step="0.1"
                value={Math.round(expenses.commissionRate * 1000) / 10}
                onChange={(e) =>
                  patchExpenses({ commissionRate: (parseFloat(e.target.value) || 0) / 100 })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="report-bonus-opcional">Bonus ($) — opcional</Label>
              <Input
                id="report-bonus-opcional"
                type="number"
                min={0}
                step="0.01"
                value={expenses.bonus ?? ''}
                placeholder="Sin bonus"
                onChange={(e) => {
                  const v = e.target.value
                  patchExpenses({ bonus: v === '' ? undefined : parseFloat(v) || 0 })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-tax-rate">TAX (%)</Label>
              <Input
                id="report-tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={Math.round(settings.taxRate * 1000) / 10}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, taxRate: (parseFloat(e.target.value) || 0) / 100 }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-registered-agent">Registered Agent ($)</Label>
            <Input
              id="report-registered-agent"
              type="number"
              min={0}
              step="0.01"
              className="w-32"
              value={settings.registeredAgentCost}
              onChange={(e) =>
                setSettings((s) => ({ ...s, registeredAgentCost: parseFloat(e.target.value) || 0 }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Costo por cada registro marcado con Registered Agent.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Gastos fijos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFixed}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {expenses.fixedExpenses.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin gastos fijos.</p>
              )}
              {expenses.fixedExpenses.map((exp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Concepto (ej: FaceBook Marketing)"
                    value={exp.label}
                    onChange={(e) => updateFixed(i, { label: e.target.value })}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    step="0.01"
                    value={exp.amount}
                    onChange={(e) => updateFixed(i, { amount: parseFloat(e.target.value) || 0 })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFixed(i)}
                    aria-label="Quitar gasto"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-stripe-fee-por-pago">Stripe fee</Label>
            <Select
              value={settings.stripeFeeMode}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, stripeFeeMode: v as StripeFeeMode }))
              }
            >
              <SelectTrigger id="report-stripe-fee-por-pago" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="surcharge">Recargo del 4 % (como el Excel manual)</SelectItem>
                <SelectItem value="none">Sin recargo ($0.00)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El cliente paga un 4 % extra por pagar con Stripe y Pyxis guarda el pago sin él.
              El recargo se suma a CHARGE y se resta como STRIPE FEE, así que no cambia el NET.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !expenses.employeeName.trim()}>
            {isExporting ? 'Generando...' : 'Exportar a Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
