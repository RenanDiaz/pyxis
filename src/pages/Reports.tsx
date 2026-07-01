import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { FileSpreadsheet, Users } from 'lucide-react'
import { useClients } from '@/hooks/useClients'
import { useStates } from '@/hooks/useStates'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useWorkspaceMembers } from '@/hooks/useWorkspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const ALL_AGENTS = 'all'

function fmtCurrency(value: number): string {
  return `$${formatMoney(value)}`
}

export default function Reports() {
  const { role, workspaceId, profile } = useUserProfile()
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
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
    () => previewReport(filteredClients, month),
    [filteredClients, month]
  )

  const monthDate = useMemo(() => new Date(`${month}-01T00:00:00`), [month])
  const monthLabel = format(monthDate, 'MMMM yyyy')

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
        subtractRegisteredAgent: settings.subtractRegisteredAgent,
        stripeFeeMode: settings.stripeFeeMode,
      })
      // Carga diferida: ExcelJS es pesado y solo se necesita al exportar.
      const { downloadSalesReport } = await import('@/lib/generateSalesReport')
      await downloadSalesReport(input)
      toast.success('Reporte generado', {
        description: `${input.accounts.length} cuenta(s) exportada(s) para ${monthLabel}.`,
      })
      setDialogOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo generar el reporte', {
        description: err instanceof Error ? err.message : undefined,
      })
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
              <Input
                id="report-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
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
            <StatBox label="Cuentas" value={String(preview.accountCount)} />
            <StatBox label="Pagos" value={String(preview.paymentCount)} />
            <StatBox label="Total cobrado" value={fmtCurrency(preview.totalCharge)} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Cargando clientes…'
                : preview.accountCount === 0
                  ? 'No hay pagos registrados en este mes.'
                  : `Reporte para ${monthLabel}.`}
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
            Registra pagos en los procesos de tus clientes para que aparezcan aquí.
          </p>
        </div>
      )}

      <ExportReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultEmployeeName={defaultEmployeeName}
        accountCount={preview.accountCount}
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
