import type { Client, ClientProcess } from '@/types'

/**
 * Datos de la compañía (LLC) de un registro: lo que se imprime en el documento
 * Word y lo que identifica al proceso en la UI.
 */
export interface CompanyInfo {
  llc_name?: string
  state?: string
  business_address?: string
  business_purpose?: string
}

/** Campos de compañía que un registro de LLC puede tener propios. */
export const COMPANY_KEYS = ['llc_name', 'business_address', 'business_purpose'] as const

export type CompanyKey = (typeof COMPANY_KEYS)[number]

/**
 * Lo mínimo que se necesita de un cliente para resolver la compañía de sus
 * registros. El formulario de cliente trabaja con datos en borrador (todavía sin
 * documento en Firestore), por eso no se pide un `Client` completo.
 */
export type CompanyClient = Partial<Pick<Client, CompanyKey | 'state'>> & {
  processes?: ClientProcess[]
}

/** Los procesos de registro de LLC del cliente: una compañía por proceso. */
export function getRegistrationProcesses(client: CompanyClient): ClientProcess[] {
  return (client.processes ?? []).filter((p) => p.type === 'registration')
}

/**
 * Si un registro hereda los datos de compañía del cliente (`llc_name`,
 * dirección, propósito, estado).
 *
 * Solo hereda el PRIMER registro: los campos del cliente son los que se
 * capturaban cuando un cliente tenía una sola compañía. Si heredaran todos, la
 * misma compañía se vería repetida en cada registro del cliente.
 */
export function inheritsClientCompany(client: CompanyClient, process: ClientProcess): boolean {
  if (process.type !== 'registration') return false
  return getRegistrationProcesses(client)[0]?.id === process.id
}

/** Datos de la compañía de un registro, con la herencia ya resuelta. */
export function getProcessCompany(client: CompanyClient, process: ClientProcess): CompanyInfo {
  const inherits = inheritsClientCompany(client, process)
  const resolve = (own?: string, inherited?: string): string | undefined => {
    const value = (own || '').trim()
    if (value) return value
    if (!inherits) return undefined
    return (inherited || '').trim() || undefined
  }
  return {
    llc_name: resolve(process.llc_name, client.llc_name),
    state: resolve(process.state, client.state),
    business_address: resolve(process.business_address, client.business_address),
    business_purpose: resolve(process.business_purpose, client.business_purpose),
  }
}

/**
 * Nombre de la compañía de un registro (cadena vacía si todavía no tiene).
 * Para procesos que no son registros devuelve cadena vacía: no representan una
 * compañía.
 */
export function getProcessCompanyName(client: CompanyClient, process: ClientProcess): string {
  return getProcessCompany(client, process).llc_name ?? ''
}

/**
 * Baja los datos de compañía del cliente al primer registro cuando el cliente
 * pasa a tener más de uno.
 *
 * Se llama al agregar un registro: desde ese momento la herencia deja de
 * aplicarse en cascada, así que el primer registro necesita sus propios datos
 * para no perder la identidad de la compañía original (y para que un cambio
 * posterior en los campos del cliente no la reescriba).
 */
export function backfillFirstRegistrationCompany(
  client: CompanyClient,
  processes: ClientProcess[],
): ClientProcess[] {
  const registrations = processes.filter((p) => p.type === 'registration')
  if (registrations.length < 2) return processes

  const first = registrations[0]
  const patch: Partial<Record<CompanyKey | 'state', string>> = {}
  for (const key of COMPANY_KEYS) {
    if ((first[key] || '').trim()) continue
    const inherited = (client[key] || '').trim()
    if (inherited) patch[key] = inherited
  }
  if (!(first.state || '').trim()) {
    const inheritedState = (client.state || '').trim()
    if (inheritedState) patch.state = inheritedState
  }

  if (Object.keys(patch).length === 0) return processes
  return processes.map((p) => (p.id === first.id ? { ...p, ...patch } : p))
}
