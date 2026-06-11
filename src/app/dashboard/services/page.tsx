import { requireAdmin } from '@/lib/auth'
import ServiceCatalogTable from '@/components/services/ServiceCatalogTable'
import type { ServiceCatalog } from '@/types/database'

export default async function ServicesPage() {
  const supabase = await requireAdmin()

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
