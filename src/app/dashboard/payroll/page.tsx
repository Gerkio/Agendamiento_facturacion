import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PayrollReport from '@/components/payroll/PayrollReport'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Liquidación de auxiliares</h1>
      <p className="text-sm text-gray-500 mb-6">Cuenta los servicios completados por turno y los valora con las tarifas que definas.</p>
      <PayrollReport />
    </div>
  )
}
