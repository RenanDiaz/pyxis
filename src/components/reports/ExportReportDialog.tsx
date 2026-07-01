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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { ExpenseConfig } from '@/lib/generateSalesReport'
import type { StripeFeeMode } from '@/lib/salesReportData'

/** Config completa de exportación: gastos + opciones de cálculo. */
export interface ExportSettings {
  expenses: ExpenseConfig
  subtractRegisteredAgent: boolean
  stripeFeeMode: StripeFeeMode
}

const STORAGE_KEY = 'pyxis.salesReport.exportSettings'

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
    subtractRegisteredAgent: true,
    stripeFeeMode: 'estimate',
  }
}

function loadSettings(employeeName: string): ExportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ExportSettings
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

interface ExportReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre por defecto del empleado (agente seleccionado). */
  defaultEmployeeName: string
  /** Nº de cuentas y pagos que entran en el mes (para avisar si es 0). */
  accountCount: number
  isExporting: boolean
  onExport: (settings: ExportSettings) => void
}

export default function ExportReportDialog({
  open,
  onOpenChange,
  defaultEmployeeName,
  accountCount,
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
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
            La tabla de cuentas se genera desde los pagos del mes. Estos valores completan
            la sección de gastos y pagos del reporte.
          </DialogDescription>
        </DialogHeader>

        {accountCount === 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            No hay pagos registrados en el mes seleccionado. El reporte saldrá sin cuentas.
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del empleado</Label>
            <Input
              value={expenses.employeeName}
              onChange={(e) => patchExpenses({ employeeName: e.target.value })}
              placeholder="Ej: isabel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Base pay ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={expenses.basePay}
                onChange={(e) => patchExpenses({ basePay: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Comisión (%)</Label>
              <Input
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

          <div className="space-y-2">
            <Label>Bonus ($) — opcional</Label>
            <Input
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
            <Label>Stripe fee por pago</Label>
            <Select
              value={settings.stripeFeeMode}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, stripeFeeMode: v as StripeFeeMode }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estimate">Estimar (2.9% + $0.30)</SelectItem>
                <SelectItem value="none">Sin comisión ($0.00)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El CRM no registra la comisión real de Stripe; se estima o se deja en cero.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label className="cursor-pointer" htmlFor="subtract-ra">
                Restar Registered Agent
              </Label>
              <p className="text-xs text-muted-foreground">
                Descuenta el costo del agente registrado en el impuesto y la utilidad neta.
              </p>
            </div>
            <Switch
              id="subtract-ra"
              checked={settings.subtractRegisteredAgent}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, subtractRegisteredAgent: checked }))
              }
            />
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
