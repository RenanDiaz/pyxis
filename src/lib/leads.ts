import type { Call, CallLead, Client } from '@/types'
import { formatPhoneForDisplay } from '@/lib/phoneUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import { phoneDigits } from '@/lib/phoneDigits'

export { phoneDigits }

// Leads (spec 19): prospectos sin registrar que viven dentro de la llamada.

export interface LeadInput {
  name: string
  phone: string
  state?: string
  notes?: string
}

/** Datos del lead listos para guardar; `null` si falta nombre o teléfono válido. */
export function buildLead(input: LeadInput): CallLead | null {
  const name = input.name.trim()
  const digits = phoneDigits(input.phone)
  if (!name || !digits) return null
  const lead: CallLead = { name, phone: formatPhoneForDisplay(digits), phone_digits: digits }
  if (input.state?.trim()) lead.state = input.state.trim()
  if (input.notes?.trim()) lead.notes = input.notes.trim()
  return lead
}

export function isLeadCall(call: Call): call is Call & { client_id: null; lead: CallLead } {
  return call.client_id == null && !!call.lead
}

/** Nombre a mostrar de una llamada, sea a cliente o a lead. */
export function getCallDisplayName(call: Call, clientsById: Map<string, Client>): string {
  if (isLeadCall(call)) return call.lead.name
  const client = call.client_id ? clientsById.get(call.client_id) : undefined
  return client ? getClientDisplayName(client) : 'Cliente no disponible'
}

/** Reparte el nombre libre del lead en nombre y apellidos para el formulario. */
export function splitLeadName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first_name: parts[0] ?? '', last_name: '' }
  if (parts.length === 2) return { first_name: parts[0], last_name: parts[1] }
  // Nombres hispanos: con 3 o más palabras, lo usual son 2 apellidos.
  const lastCount = 2
  return {
    first_name: parts.slice(0, parts.length - lastCount).join(' '),
    last_name: parts.slice(parts.length - lastCount).join(' '),
  }
}

/** Busca entre los clientes visibles uno con ese teléfono (aviso de duplicado). */
export function findClientByPhone(clients: Client[], phone: string): Client | undefined {
  const digits = phoneDigits(phone)
  if (!digits) return undefined
  return clients.find((c) =>
    [c.phone, ...(c.phones ?? []).map((p) => p.number)].some((p) => p && phoneDigits(p) === digits)
  )
}
