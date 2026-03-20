import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import StatusBadge from '@/components/clients/StatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Plus } from 'lucide-react'
import type { ClientStatus } from '@/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'perdido', label: 'Perdido' },
]

export default function Clients() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: clients, isLoading } = useClients({
    status: statusFilter !== 'all' ? (statusFilter as ClientStatus) : undefined,
    search: search || undefined,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <Button asChild>
          <Link to="/clientes/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, LLC o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando clientes...</p>
      ) : !clients || clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay clientes aún.</p>
          <Button asChild variant="link" className="mt-2">
            <Link to="/clientes/nuevo">Crear el primero</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre / Teléfono</TableHead>
                <TableHead>LLC</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/clientes/${client.id}`} className="font-medium hover:underline">
                      {client.first_name || client.last_name
                        ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                        : client.phone}
                    </Link>
                  </TableCell>
                  <TableCell>{client.llc_name || '—'}</TableCell>
                  <TableCell>{client.state || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
