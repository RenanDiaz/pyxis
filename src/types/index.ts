import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'agent' | 'supervisor' | 'admin'
export type TeamRole = 'admin' | 'member'

export interface UserProfile {
  uid: string
  email: string
  display_name: string
  role: UserRole
  team_ids: string[]
  created_at: Timestamp
}

export interface Team {
  id: string
  name: string
  created_by: string
  created_at: Timestamp
}

export interface TeamMembership {
  uid: string
  team_id: string
  role: TeamRole
  display_name: string
  email: string
  joined_at: Timestamp
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined'

export interface TeamInvitation {
  id: string
  team_id: string
  team_name: string
  email: string
  role: TeamRole
  status: InvitationStatus
  invited_by_uid: string
  invited_by_name: string
  created_at: Timestamp
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

export type ProcessType = 'registration' | 'annual_report' | 'dissolution' | 'amendment'

export type PaymentMethod = 'efectivo' | 'zelle' | 'transferencia' | 'otro'

export interface Payment {
  amount: number
  method: PaymentMethod
  date: string // ISO date string
  note?: string
}

export type PhoneLabel = 'personal' | 'whatsapp' | 'trabajo' | 'otro'

export interface ClientPhone {
  number: string
  label: PhoneLabel
  is_primary: boolean
}

export interface Client {
  id: string
  phone: string
  phones?: ClientPhone[]
  llc_name?: string
  state?: string
  process?: ProcessType
  first_name?: string
  middle_name?: string
  last_name?: string
  ssn_itin?: string
  email?: string
  business_address?: string
  business_purpose?: string
  payment_total?: number
  payments?: Payment[]
  status: ClientStatus
  notes: string
  owner_uid: string
  team_id: string | null
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
  team_id: string | null
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
