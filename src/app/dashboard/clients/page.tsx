import { requireAdmin } from '@/lib/auth'
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

  // URLs firmadas en paralelo (una sola tanda) en vez de secuencial por fila.
  const photoUrls: Record<string, string> = {}
  await Promise.all(
    (clients ?? [])
      .filter(c => c.photo_url)
      .map(async c => {
        const { data } = await supabase.storage.from('client-photos').createSignedUrl(c.photo_url!, 3600)
        if (data?.signedUrl) photoUrls[c.id] = data.signedUrl
      })
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
      </div>
      <ClientsTable clients={clients ?? []} photoUrls={photoUrls} />
    </div>
  )
}
