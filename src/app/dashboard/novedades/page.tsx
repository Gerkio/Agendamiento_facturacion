import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NovedadesTable from '@/components/novedades/NovedadesTable'
import type { Cleaner } from '@/types/database'

export default async function NovedadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: novedades }, { data: cleaners }] = await Promise.all([
    supabase.from('novedades').select('*, cleaners(full_name)').order('start_date', { ascending: false }).limit(100),
    supabase.from('cleaners').select('id, full_name, is_active').eq('is_active', true).order('full_name').returns<Cleaner[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">📋 Novedades</h1>
      <NovedadesTable novedades={novedades ?? []} cleaners={cleaners ?? []} />
    </div>
  )
}
