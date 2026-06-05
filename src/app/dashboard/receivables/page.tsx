import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReceivablesView from '@/components/receivables/ReceivablesView'

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Cartera (cuentas por cobrar)</h1>
      <p className="text-sm text-gray-500 mb-6">Facturas validadas con su saldo y mora. Registra abonos para llevar el control de pagos.</p>
      <ReceivablesView />
    </div>
  )
}
