import { useMemo, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { toast } from 'sonner'
import { FileSpreadsheet, Users } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { useStates } from '@/hooks/useStates'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useWorkspaceMembers } from '@/hooks/useWorkspace'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ExportReportDialog, {
  type ExportSettings,
} from '@/components/reports/ExportReportDialog'
import { buildReportInput, previewReport } from '@/lib/salesReportData'
import { formatMoney } from '@/lib/format'
import type { Client } from '@/types'
import { es } from 'date-fns/locale'
import { describeError } from '@/lib/errors'

const ALL_AGENTS = 'all'
/** Meses que ofrece el selector, contando el actual. */
const MONTH_OPTIONS = 24

/**
 * Últimos meses como `{ key: 'yyyy-MM', label }`, del actual hacia atrás. Un
 * selector y no `<input type="month">`: Safari de escritorio no lo soporta y lo
 * muestra como texto libre; un valor tecleado como "2026-9" daba Invalid Date y
 * tumbaba la página (spec 04, #17).
 */
function recentMonths(now: Date): Array<{ key: string; label: string }> {
  return Array.from({ length: MONTH_OPTIONS }, (_, i) => {
    const d = subMonths(now, i)
    return { key: format(d, 'yyyy-MM'), label: format(d, "MMMM 'de' yyyy", { locale: es }) }
  })
}

function fmtCurrency(value: number): string {
  return `$${formatMoney(value)}`
}

export default function Reports() {
  const { role, workspaceId, profile } = useUserProfile()
  const monthOptions = useMemo(() => recentMonths(new Date()), [])
  const [month, setMonth] = useState(() => monthOptions[0].key)
  const [agentUid, setAgentUid] = useState<string>(ALL_AGENTS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const showAgentFilter = role === 'owner' || role === 'supervisor'

  // Traer clientes activos y archivados: un pago del mes puede pertenecer a un
  // cliente archivado y no debe perderse en el reporte.
  const { data: activeClients, isLoading: loadingActive } = useClients()
  const { data: archivedClients, isLoading: loadingArchived } = useClients({ archived: true })
  const { data: states } = useStates()
  const { data: members } = useWorkspaceMembers(showAgentFilter ? workspaceId : null)

  const isLoading = loadingActive || loadingArchived

  const allClients = useMemo<Client[]>(
    () => [...(activeClients ?? []), ...(archivedClients ?? [])],
    [activeClients, archivedClients]
  )

  const filteredClients = useMemo(() => {
    if (agentUid === ALL_AGENTS) return allClients
    return allClients.filter((c) => c.owner_uid === agentUid)
  }, [allClients, agentUid])

  const preview = useMemo(
    () => previewReport(filteredClients, month, states ?? []),
    [filteredClients, month, states]
  )

  const monthDate = useMemo(() => new Date(`${month}-01T00:00:00`), [month])
  // El Excel replica el formato original, en inglés ("October 2026 Sales
  // Report"); la interfaz va en español.
  const monthLabel = format(monthDate, 'MMMM yyyy')
  const monthLabelEs = format(monthDate, "MMMM 'de' yyyy", { locale: es })

  const selectedAgentName =
    agentUid === ALL_AGENTS
      ? undefined
      : members?.find((m) => m.uid === agentUid)?.display_name
  const defaultEmployeeName = selectedAgentName ?? profile?.display_name ?? ''

  async function handleExport(settings: ExportSettings) {
    setIsExporting(true)
    try {
      const input = buildReportInput({
        clients: filteredClients,
        states: states ?? [],
        monthKey: month,
        monthLabel,
        expenses: settings.expenses,
        stripeFeeMode: settings.stripeFeeMode,
        taxRate: settings.taxRate,
        registeredAgentCost: settings.registeredAgentCost,
      })
      // Carga diferida: ExcelJS es pesado y solo se necesita al exportar.
      const { downloadSalesReport } = await import('@/lib/generateSalesReport')
      await downloadSalesReport(input)
      toast.success('Reporte generado', {
        description: `${input.accounts.length} cuenta(s) exportada(s) para ${monthLabelEs}.`,
      })
      setDialogOpen(false)
    } catch (err) {
      console.error(err)
      toast.error(describeError(err, 'No se pudo generar el reporte. Intenta de nuevo.'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exporta el reporte mensual de ventas en Excel (.xlsx).
        </p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-month">Mes</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="report-month" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.key} value={m.key} className="capitalize">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showAgentFilter && (
              <div className="space-y-2">
                <Label>Agente</Label>
                <Select value={agentUid} onValueChange={setAgentUid}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_AGENTS}>Todo el equipo</SelectItem>
                    {(members ?? []).map((m) => (
                      <SelectItem key={m.uid} value={m.uid}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Resumen del mes */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Ventas" value={String(preview.accountCount)} />
            <StatBox label="Total vendido" value={fmtCurrency(preview.totalCharge)} />
            <StatBox label="Por cobrar" value={fmtCurrency(preview.totalPending)} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Cargando clientes…'
                : preview.accountCount === 0
                  ? 'No hay ventas registradas en este mes.'
                  : `Reporte para ${monthLabelEs}.`}
            </p>
            <Button onClick={() => setDialogOpen(true)} disabled={isLoading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar a Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.accountCount === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            Una venta aparece en el mes de su fecha de venta cuando tiene al menos un pago.
          </p>
        </div>
      )}

      <ExportReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultEmployeeName={defaultEmployeeName}
        accountCount={preview.accountCount}
        missingCost={preview.missingCost}
        projected={preview.projected}
        isExporting={isExporting}
        onExport={handleExport}
      />
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5 truncate">{value}</p>
    </div>
  )
}
