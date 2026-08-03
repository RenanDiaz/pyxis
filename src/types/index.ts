import type { Timestamp } from 'firebase/firestore'

export type WorkspaceRole = 'owner' | 'supervisor' | 'agent'

export interface UserProfile {
  uid: string
  email: string
  display_name: string
  workspace_id: string | null
  created_at: Timestamp
}

export interface Workspace {
  id: string
  name: string
  owner_uid: string
  created_at: Timestamp
  receipt_company_name?: string
  receipt_logo_url?: string
  receipt_logo_path?: string
}

export interface WorkspaceMember {
  uid: string
  display_name: string
  email: string
  role: WorkspaceRole
  subteam_id: string | null
  joined_at: Timestamp
}

export interface Subteam {
  id: string
  name: string
  created_by: string
  created_at: Timestamp
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export interface WorkspaceInvitation {
  id: string
  email: string
  role: 'supervisor' | 'agent'
  subteam_id: string | null
  token: string
  status: InvitationStatus
  created_by_uid: string
  created_at: Timestamp
  expires_at: Timestamp
}

export interface StateInfo {
  abbreviation: string
  name: string
  sale_price: string
  state_fee: string
  processing_days: string
  annual_report: {
    fee: string
    due_date: string
  }
  dissolution: {
    fee: string
    processing_days: string
  }
  amendments: {
    available: string
    fee: string
  }
  business_purpose: {
    specific: string
    general: string
  }
  name_check_link: string
  zip_code_range: string
  area_codes: string[]
}

export interface Trade {
  id: number
  category: 'construction' | 'home_services' | 'exterior' | 'technical'
  category_es: string
  en: string
  es: string
  description_es: string
}

export type ClientStatus = 'nuevo' | 'contactado' | 'en_proceso' | 'cerrado' | 'perdido' | 'deuda_pendiente'

export type ProcessType =
  | 'registration'
  | 'annual_report'
  | 'dissolution'
  | 'amendment'
  | 'newspaper_research'
  | 'newspaper_publication'
  | 'sale_tax_license'
  | 'resale_certificate'
  | 'ein'
  | 'boi'
  | 'statement_of_formation'
  | 'custom'

export type ProcessStage = 'pendiente' | 'en_proceso' | 'completado' | 'cancelado'

export type PaymentMethod = 'efectivo' | 'zelle' | 'transferencia' | 'stripe' | 'otro'

export interface Payment {
  amount: number
  method: PaymentMethod
  // Fecha del pago. Nuevos: ISO datetime con hora (`2026-06-23T19:00:00.000Z`).
  // Legacy: `yyyy-MM-dd` (solo fecha). Los lectores toleran ambos vía
  // `parsePaymentDate` (src/lib/processUtils.ts).
  date: string
  note?: string
}

/** Un proceso/servicio contratado por el cliente, con su propio precio, pagos y seguimiento. */
export interface ClientProcess {
  id: string
  type: ProcessType
  /**
   * Solo para procesos de tipo `custom`: nombre libre del proceso extraordinario
   * que captura el agente (no queda registrado en el catálogo de procesos).
   */
  custom_label?: string
  state?: string
  total?: number
  payments: Payment[]
  stage: ProcessStage
  /**
   * Solo aplica a procesos de tipo `registration`. Indica si la LLC incluye
   * Registered Agent. `undefined` o `false` = no (valor por defecto); `true` = sí.
   */
  has_registered_agent?: boolean
  /**
   * Solo `registration`: nombre de la compañía de ESTE registro. Un cliente
   * puede registrar varias LLC, cada una con su propio documento Word.
   * Si está vacío, solo el PRIMER registro del cliente cae a `client.llc_name`
   * (datos previos a los registros múltiples); los demás quedan sin nombre.
   */
  llc_name?: string
  /** Solo `registration`: dirección comercial de esta compañía. Fallback (primer registro): `client.business_address`. */
  business_address?: string
  /** Solo `registration`: propósito de esta compañía. Fallback (primer registro): `client.business_purpose`. */
  business_purpose?: string
  notes?: string
  created_at: Timestamp
}

export type PhoneLabel = 'personal' | 'whatsapp' | 'trabajo' | 'otro'

export interface ClientPhone {
  number: string
  label: PhoneLabel
  is_primary: boolean
}

export interface Partner {
  first_name: string
  last_name: string
  ssn_itin?: string
  address?: string
  ownership_percentage?: number
}

export interface Client {
  id: string
  phone: string
  phones?: ClientPhone[]
  llc_name?: string
  state?: string
  /** @deprecated reemplazado por `processes`. Se mantiene solo para migración. */
  process?: ProcessType
  processes?: ClientProcess[]
  first_name?: string
  middle_name?: string
  last_name?: string
  ssn_itin?: string
  email?: string
  business_address?: string
  business_purpose?: string
  partners?: Partner[]
  /** @deprecated los pagos ahora viven por proceso en `processes`. Solo para migración. */
  payment_total?: number
  /** @deprecated los pagos ahora viven por proceso en `processes`. Solo para migración. */
  payments?: Payment[]
  status: ClientStatus
  archived: boolean
  notes: string
  owner_uid: string
  subteam_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type CallOutcome = 'pendiente' | 'completada' | 'no_contesto' | 'reagendada'

export interface Call {
  id: string
  client_id: string
  scheduled_at: Timestamp
  duration_minutes?: number
  notes: string
  outcome: CallOutcome
  owner_uid: string
  subteam_id: string | null
  created_at: Timestamp
}

export interface GlossaryTerm {
  term: string
  full_name: string
  translation: string
  definition: string
  category: 'business_structure' | 'tax' | 'legal' | 'compliance'
}

export interface ClientFormField {
  id: string
  label: string
  type: string
  required: boolean
  sensitive?: boolean
}

export type GoalType = 'daily' | 'monthly'

export interface Goal {
  id: string
  target_uid: string
  subteam_id: string | null
  type: GoalType
  value: number
  set_by_uid: string
  set_by_role: WorkspaceRole
  period: string // "2025-01" for monthly, "2025-01-15" for daily
  created_at: Timestamp
}

export type DocFileType = 'image' | 'pdf' | 'word' | 'excel' | 'other'

export interface ClientDocument {
  id: string
  name: string
  storage_path: string
  download_url: string
  type: DocFileType
  mime_type: string
  size_bytes: number
  uploaded_by_uid: string
  uploaded_by_name: string
  uploaded_at: Timestamp
}
