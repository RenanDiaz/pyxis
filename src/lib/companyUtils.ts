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
/** Una compañía del cliente: un registro (`id` = proceso) o la legacy del cliente (`id: null`). */
export interface ClientCompany {
  id: string | null
  name: string
}

/**
 * Las compañías del cliente: una por registro (con su nombre resuelto, puede
 * ser '' si el registro aún no lo tiene). Sin registros, la del cliente legacy
 * (`client.llc_name`) si existe: una LLC registrada en otro lado.
 */
export function getClientCompanies(client: CompanyClient): ClientCompany[] {
  const registrations = getRegistrationProcesses(client)
  if (registrations.length > 0) {
    return registrations.map((p) => ({ id: p.id, name: getProcessCompany(client, p).llc_name ?? '' }))
  }
  const legacy = (client.llc_name || '').trim()
  return legacy ? [{ id: null, name: legacy }] : []
}

/**
 * Nombre de la compañía de un proceso.
 * - Registro: la suya (ver `getProcessCompany`; solo el primero hereda la del cliente).
 * - Otro servicio (EIN, amendment…): la del registro vinculado (`company_id`); si
 *   no, la escrita a mano (`llc_name`); si no, la única compañía del cliente.
 *   Con varias compañías y nada elegido devuelve '' (ver `hasUnassignedCompany`).
 */
export function getProcessCompanyName(client: CompanyClient, process: ClientProcess): string {
  if (process.type === 'registration') return getProcessCompany(client, process).llc_name ?? ''
  if (process.company_id) {
    const linked = getRegistrationProcesses(client).find((p) => p.id === process.company_id)
    if (linked) return getProcessCompany(client, linked).llc_name ?? ''
  }
  const own = (process.llc_name || '').trim()
  if (own) return own
  const companies = getClientCompanies(client)
  return companies.length === 1 ? companies[0].name : ''
}

/**
 * Servicio (no registro) de un cliente con varias compañías al que no se le
 * eligió ninguna: no se sabe de qué LLC es.
 */
export function hasUnassignedCompany(client: CompanyClient, process: ClientProcess): boolean {
  if (process.type === 'registration') return false
  const linked =
    !!process.company_id && getRegistrationProcesses(client).some((p) => p.id === process.company_id)
  if (linked || (process.llc_name || '').trim()) return false
  return getClientCompanies(client).length > 1
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
