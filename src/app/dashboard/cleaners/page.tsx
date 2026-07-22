import { requireAdmin } from '@/lib/auth'
import { signedPhotoUrls } from '@/lib/storage'
import CleanersTable from '@/components/cleaners/CleanersTable'

export default async function CleanersPage() {
  const supabase = await requireAdmin()

  // La tabla edita en línea (form + hoja de vida) con el objeto completo, por eso
  // se traen todas las columnas.
  const { data: cleaners } = await supabase.from('cleaners').select('*').order('full_name')

  // URLs firmadas de las fotos (bucket privado) en UNA sola llamada (evita N+1).
  const photoUrls = await signedPhotoUrls(supabase, 'cleaner-photos', cleaners ?? [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Auxiliares</h1>
      </div>
      <CleanersTable cleaners={cleaners ?? []} photoUrls={photoUrls} />
    </div>
  )
}
