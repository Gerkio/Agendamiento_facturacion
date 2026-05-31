export type BillingStatus = 'draft' | 'processing' | 'signed' | 'sent_dian' | 'rejected'
export type ServiceStatus = 'scheduled' | 'completed' | 'canceled'

export interface Cleaner {
  id: string
  full_name: string
  document_id: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Client {
  id: string
  company_name: string
  nit_cedula: string
  dv: string
  email: string
  phone: string | null
  address: string
  city_code: string
  tax_scheme: string
  fiscal_regimen: string
  /** Indicaciones de llegada (texto libre) para que el aseador encuentre la casa. */
  indicaciones?: string | null
  created_at: string
}

export interface Invoice {
  id: string
  client_id: string
  invoice_number: string | null
  cufe: string | null
  issue_date: string
  xml_content: string | null
  dian_response_code: string | null
  dian_response_description: string | null
  qr_content: string | null
  total_amount: number
  billing_status: BillingStatus
  created_at: string
  clients?: Client
}

export interface CreditNote {
  id: string
  invoice_id: string
  note_number: string | null
  cude: string | null
  issue_date: string
  concept_code: string
  reason: string | null
  xml_content: string | null
  dian_response_code: string | null
  dian_response_description: string | null
  qr_content: string | null
  total_amount: number
  billing_status: BillingStatus
  created_at: string
}

export interface Service {
  id: string
  client_id: string
  cleaner_id: string
  start_time: string
  end_time: string
  status: ServiceStatus
  is_recurring: boolean
  recurrence_group_id: string | null
  invoice_id: string | null
  price_cop: number
  created_at: string
  clients?: Client
  cleaners?: Cleaner
}

export type UserRole = 'admin' | 'cleaner'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  cleaner_id: string | null
  must_change_password: boolean
}
