import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InvoicesView from '@/components/invoices/InvoicesView'
import { getEmisorConfig } from '@/lib/dian/emisor-config'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: clients }, { data: invoices }, { data: creditNotes }] = await Promise.all([
    supabase.from('clients').select('*').order('company_name'),
    supabase.from('invoices').select('*, clients(company_name, nit_cedula, dv)').order('created_at', { ascending: false }),
    supabase.from('credit_notes').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Facturación Electrónica DIAN</h1>
      <InvoicesView clients={clients ?? []} invoices={invoices ?? []} creditNotes={creditNotes ?? []} emisor={getEmisorConfig()} />
    </div>
  )
}
