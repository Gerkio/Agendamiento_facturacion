export type BillingStatus = 'draft' | 'processing' | 'signed' | 'sent_dian' | 'rejected'
export type ServiceStatus = 'scheduled' | 'completed' | 'canceled'

export interface Cleaner {
  id: string
  full_name: string
  document_id: string
  phone: string | null
  is_active: boolean
  /** Hoja de vida (AMARU). */
  photo_url?: string | null
  emergency_phone?: string | null
  emergency_contact_name?: string | null
  birth_date?: string | null
  address?: string | null
  eps?: string | null
  arl?: string | null
  hire_date?: string | null
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
  /** Forma de pago del cliente (p.ej. "Crédito 30 días"). */
  forma_pago?: string | null
  /** Campos AMARU. */
  photo_url?: string | null
  naturaleza?: string
  first_name?: string | null
  second_name?: string | null
  first_surname?: string | null
  second_surname?: string | null
  sucursal?: string | null
  customer_type?: string | null
  origen?: string | null
  observaciones?: string | null
  phone2?: string | null
  is_active?: boolean
  created_at: string
}

export interface ClientAddress {
  id: string
  client_id: string
  label: string | null
  address: string
  city_code: string
  indicaciones: string | null
  is_primary: boolean
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
  /** Campos AMARU. */
  service_type?: string | null
  obs_auxiliar?: string | null
  obs_internas?: string | null
  /** Ítem del catálogo de servicios usado al agendar (opcional). */
  catalog_id?: string | null
  /** Clasificación operativa: Normal/Garantía/Obsequio/Reinducción/Dominical. */
  service_class?: string | null
  /** Turno: manana | tarde | dia_completo. */
  turno?: string | null
  /** Recargo dominical o festivo. */
  recargo_dominical?: boolean | null
  /** Forma de pago de este servicio (default tomado del cliente). */
  forma_pago?: string | null
  created_at: string
  clients?: Client
  cleaners?: Cleaner
}

export type ServiceSegment = 'hogar' | 'empresa'
export type ServiceTipo = 'dia_completo' | 'medio_dia_manana' | 'medio_dia_tarde'

/** Catálogo de servicios: tipos predefinidos con sus parámetros (jornada,
 *  hora de inicio, duración, precio…) para no reingresarlos en cada agenda. */
export interface ServiceCatalog {
  id: string
  name: string
  segment: ServiceSegment
  tipo: ServiceTipo
  /** Hora de inicio por defecto, formato "HH:mm[:ss]". */
  start_time: string
  duration_minutes: number
  price_cop: number
  bono_cop: number
  is_active: boolean
  created_at: string
}

export type NovedadType = 'permiso' | 'vacaciones' | 'incapacidad' | 'otro'
export type NovedadStatus = 'pendiente' | 'resuelta'

export interface Novedad {
  id: string
  cleaner_id: string
  cod: string | null
  type: NovedadType
  subject: string
  description: string | null
  status: NovedadStatus
  responsible: string | null
  last_observation: string | null
  start_date: string
  due_date: string | null
  resolved_at: string | null
  created_by: string | null
  created_at: string
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
