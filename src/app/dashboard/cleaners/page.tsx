import { requireAdmin } from '@/lib/auth'
import CleanersTable from '@/components/cleaners/CleanersTable'

export default async function CleanersPage() {
  const supabase = await requireAdmin()

  // La tabla edita en línea (form + hoja de vida) con el objeto completo, por eso
  // se traen todas las columnas.
  const { data: cleaners } = await supabase.from('cleaners').select('*').order('full_name')

  // URLs firmadas para las fotos (bucket privado), en paralelo en vez de secuencial.
  const photoUrls: Record<string, string> = {}
  await Promise.all(
    (cleaners ?? [])
      .filter(c => c.photo_url)
      .map(async c => {
        const { data } = await supabase.storage.from('cleaner-photos').createSignedUrl(c.photo_url!, 3600)
        if (data?.signedUrl) photoUrls[c.id] = data.signedUrl
      })
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Auxiliares</h1>
      </div>
      <CleanersTable cleaners={cleaners ?? []} photoUrls={photoUrls} />
    </div>
  )
}
