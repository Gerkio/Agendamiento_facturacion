import { requireAdmin } from '@/lib/auth'
import { signedPhotoUrls } from '@/lib/storage'
import ClientsTable from '@/components/clients/ClientsTable'
import type { Client } from '@/types/database'

export default async function ClientsPage() {
  const supabase = await requireAdmin()

  // La lista solo muestra estas columnas; la ficha de detalle recarga el cliente
  // completo. Evita traer los campos pesados/AMARU de cada fila.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, company_name, nit_cedula, dv, email, city_code, is_active, photo_url, indicaciones')
    .order('company_name')
    .returns<Client[]>()

  // URLs firmadas de las fotos (bucket privado) en UNA sola llamada (evita N+1).
  const photoUrls = await signedPhotoUrls(supabase, 'client-photos', clients ?? [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
      </div>
      <ClientsTable clients={clients ?? []} photoUrls={photoUrls} />
    </div>
  )
}
