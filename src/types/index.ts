import type { Timestamp } from 'firebase/firestore'

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
}

export interface Trade {
  id: number
  category: 'construction' | 'home_services' | 'exterior' | 'technical'
  category_es: string
  en: string
  es: string
  description_es: string
}

export type ClientStatus = 'nuevo' | 'contactado' | 'en_proceso' | 'cerrado' | 'perdido'

export interface Client {
  id: string
  llc_name: string
  state: string
  first_name: string
  middle_name?: string
  last_name: string
  ssn_itin: string
  phone: string
  email: string
  business_address: string
  business_purpose: string
  status: ClientStatus
  notes: string
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
  created_at: Timestamp
}

export interface ClientFormField {
  id: string
  label: string
  type: string
  required: boolean
  sensitive?: boolean
}
