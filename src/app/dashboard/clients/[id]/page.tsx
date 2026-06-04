import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ClientDetail from '@/components/clients/ClientDetail'
import { isUuid } from '@/lib/validate'
import type { ClientAddress, Service, Invoice } from '@/types/database'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const [{ data: addresses }, { data: services }, { data: invoices }] = await Promise.all([
    supabase.from('client_addresses').select('*').eq('client_id', id).order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('services').select('*, cleaners(full_name)').eq('client_id', id).order('start_time', { ascending: false }).limit(50),
    supabase.from('invoices').select('id, invoice_number, issue_date, total_amount, billing_status, client_id, created_at').eq('client_id', id).order('issue_date', { ascending: false }).limit(50),
  ])

  let photoUrl: string | null = null
  if (client.photo_url) {
    const { data } = await supabase.storage.from('client-photos').createSignedUrl(client.photo_url, 3600)
    photoUrl = data?.signedUrl ?? null
  }

  return (
    <ClientDetail
      client={client}
      addresses={(addresses ?? []) as ClientAddress[]}
      services={(services ?? []) as Service[]}
      invoices={(invoices ?? []) as Invoice[]}
      photoUrl={photoUrl}
    />
  )
}
