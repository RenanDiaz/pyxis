import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Client, Workspace } from '@/types'
import { getProcessBalance, getProcessLabel, getProcessPaid } from '@/lib/processUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import { formatMoney } from '@/lib/format'
import { fromCents, sumMoney, toCents } from '@/lib/money'
import { describeError } from '@/lib/errors'
import { buildAccountStatement, canStateAccount, hasPendingBalance } from '@/lib/accountStatement'

interface StatementDialogProps {
  client: Client
  workspace: Workspace | null | undefined
  onOpenChange: (open: boolean) => void
}

/** Estado de cuenta de uno o varios procesos (spec 16). Se monta solo abierto. */
export default function StatementDialog({ client, workspace, onOpenChange }: StatementDialogProps) {
  const processes = useMemo(() => client.processes ?? [], [client.processes])
  const [selected, setSelected] = useState<Set<string>>(() => {
    const pending = processes.filter(hasPendingBalance)
    // Si nada debe, se marcan todos los que tienen total (estado "al día").
    return new Set((pending.length ? pending : processes.filter(canStateAccount)).map((p) => p.id))
  })
  const [generating, setGenerating] = useState(false)

  const chosen = processes.filter((p) => selected.has(p.id) && canStateAccount(p))
  const total = sumMoney(chosen.map((p) => p.total))
  const paid = sumMoney(chosen.map(getProcessPaid))
  const balance = fromCents(toCents(total) - toCents(paid))

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const handleGenerate = async () => {
    if (!workspace || chosen.length === 0) return
    setGenerating(true)
    try {
      const statement = buildAccountStatement(client, chosen)
      const { downloadStatementPdf } = await import('@/lib/statementPdf')
      await downloadStatementPdf(statement, workspace)
      toast.success(`Estado de cuenta ${statement.number} generado`)
      onOpenChange(false)
    } catch (err) {
      toast.error(describeError(err, 'No se pudo generar el estado de cuenta'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estado de cuenta</DialogTitle>
        </DialogHeader>

        {processes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este cliente no tiene procesos.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {processes.map((p) => {
                const enabled = canStateAccount(p)
                const company = getProcessCompanyName(client, p)
                const pBalance = enabled ? getProcessBalance(p) : 0
                return (
                  <label
                    key={p.id}
                    htmlFor={`stmt-${p.id}`}
                    className={`flex items-center gap-3 rounded-md border p-3 text-sm ${enabled ? 'cursor-pointer' : 'opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      id={`stmt-${p.id}`}
                      className="h-4 w-4"
                      disabled={!enabled}
                      checked={enabled && selected.has(p.id)}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {getProcessLabel(p)}
                        {p.state ? ` — ${p.state}` : ''}
                      </span>
                      {company && <span className="block text-xs text-muted-foreground">{company}</span>}
                      {!enabled && (
                        <span className="block text-xs text-muted-foreground">
                          Sin total acordado: defínelo en el proceso para incluirlo
                        </span>
                      )}
                    </span>
                    {enabled && (
                      <span className={`shrink-0 text-right text-xs ${pBalance > 0 ? 'font-semibold text-orange-600' : 'text-muted-foreground'}`}>
                        {pBalance > 0 ? `Debe $${formatMoney(pBalance)}` : pBalance < 0 ? 'Saldo a favor' : 'Pagado'}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Total de servicios</span>
                <span>${formatMoney(total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pagado</span>
                <span>${formatMoney(paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}
                </span>
                <span className="text-lg font-bold">${formatMoney(Math.abs(balance))}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={!workspace || generating || chosen.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            {generating ? 'Generando...' : 'Generar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
