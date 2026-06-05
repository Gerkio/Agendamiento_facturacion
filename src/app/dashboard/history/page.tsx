import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ServicesHistory from '@/components/history/ServicesHistory'
import type { Service } from '@/types/database'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Historial global de servicios + listas para los filtros. Se acota a los 2000
  // más recientes (suficiente para el histórico operativo; el filtro por fecha
  // permite acotar más). El join a `invoices` trae el estado de facturación.
  const [{ data: services }, { data: cleaners }, { data: clients }] = await Promise.all([
    supabase
      .from('services')
      .select('id, client_id, cleaner_id, start_time, end_time, status, price_cop, service_type, service_class, invoice_id, clients(company_name), cleaners(full_name), invoices(invoice_number, billing_status)')
      .order('start_time', { ascending: false })
      .limit(2000)
      .returns<Service[]>(),
    supabase.from('cleaners').select('id, full_name').order('full_name'),
    supabase.from('clients').select('id, company_name').order('company_name'),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Historial de servicios</h1>
      <ServicesHistory services={services ?? []} cleaners={cleaners ?? []} clients={clients ?? []} />
    </div>
  )
}
