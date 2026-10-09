import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarPlus, Link2, MessageCircle, Phone, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPhoneForWhatsApp } from '@/lib/phoneUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import { findClientByPhone } from '@/lib/leads'
import { convertLeadCalls } from '@/lib/leadConversion'
import { db } from '@/lib/firebase'
import { useUserProfile } from '@/hooks/useUserProfile'
import type { Call, CallLead, Client } from '@/types'

interface Props {
  call: Call & { lead: CallLead }
  /** Clientes visibles: si el teléfono ya es de uno, se ofrece vincular. */
  clients: Client[]
  onScheduleAnother: () => void
  onOpenChange: (open: boolean) => void
}

/** Datos y acciones de un lead sin registrar (spec 19). */
export default function LeadPanel({ call, clients, onScheduleAnother, onOpenChange }: Props) {
  const { lead } = call
  const whatsapp = formatPhoneForWhatsApp(lead.phone)
  const { wsCtx } = useUserProfile()
  const queryClient = useQueryClient()
  // Ya es cliente (o la conversión creó el cliente pero no vinculó): vincular
  // en vez de crear un duplicado.
  const existingClient = findClientByPhone(clients, lead.phone)
  const link = useMutation({
    meta: { errorMessage: 'No se pudieron vincular las llamadas' },
    mutationFn: (clientId: string) => convertLeadCalls(db!, wsCtx!, lead.phone_digits, clientId),
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
      toast.success(`${n} llamada(s) vinculada(s) al cliente`)
      onOpenChange(false)
    },
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>Lead sin registrar: todavía no es cliente.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Teléfono</dt>
          <dd>{lead.phone}</dd>
          {lead.state && (
            <>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{lead.state}</dd>
            </>
          )}
          {lead.notes && (
            <>
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="whitespace-pre-wrap">{lead.notes}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${lead.phone}`}>
              <Phone className="mr-1 h-4 w-4" /> Llamar
            </a>
          </Button>
          {whatsapp && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onScheduleAnother}>
            <CalendarPlus className="mr-1 h-4 w-4" /> Agendar otra
          </Button>
        </div>
        {existingClient ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p>
              Este teléfono ya es de <strong>{getClientDisplayName(existingClient)}</strong>.
            </p>
            <Button
              className="w-full"
              onClick={() => link.mutate(existingClient.id)}
              disabled={link.isPending || !wsCtx}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {link.isPending ? 'Vinculando…' : 'Vincular llamadas a este cliente'}
            </Button>
          </div>
        ) : (
          <Button asChild className="w-full">
            <Link to={`/clientes/nuevo?fromCall=${call.id}`}>
              <UserPlus className="mr-2 h-4 w-4" /> Convertir en cliente
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
