import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientsTable from '@/components/clients/ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase.from('clients').select('*').order('company_name')

  const photoUrls: Record<string, string> = {}
  for (const c of clients ?? []) {
    if (c.photo_url) {
      const { data } = await supabase.storage.from('client-photos').createSignedUrl(c.photo_url, 3600)
      if (data?.signedUrl) photoUrls[c.id] = data.signedUrl
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
      </div>
      <ClientsTable clients={clients ?? []} photoUrls={photoUrls} />
    </div>
  )
}
