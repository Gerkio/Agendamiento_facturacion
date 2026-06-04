import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ServiceCatalogTable from '@/components/services/ServiceCatalogTable'
import type { ServiceCatalog } from '@/types/database'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: catalog } = await supabase
    .from('service_catalog')
    .select('*')
    .order('segment')
    .order('name')
    .returns<ServiceCatalog[]>()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">🧰 Servicios</h1>
      <ServiceCatalogTable items={catalog ?? []} />
    </div>
  )
}
