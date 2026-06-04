import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CleanersTable from '@/components/cleaners/CleanersTable'

export default async function CleanersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: cleaners } = await supabase.from('cleaners').select('*').order('full_name')

  // URLs firmadas para las fotos (bucket privado).
  const photoUrls: Record<string, string> = {}
  for (const c of cleaners ?? []) {
    if (c.photo_url) {
      const { data } = await supabase.storage.from('cleaner-photos').createSignedUrl(c.photo_url, 3600)
      if (data?.signedUrl) photoUrls[c.id] = data.signedUrl
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Auxiliares</h1>
      </div>
      <CleanersTable cleaners={cleaners ?? []} photoUrls={photoUrls} />
    </div>
  )
}
