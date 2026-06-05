import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalesReport from '@/components/reports/SalesReport'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Reporte de ventas</h1>
      <SalesReport />
    </div>
  )
}
