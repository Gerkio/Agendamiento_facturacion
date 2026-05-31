import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DebugDianPanel from '@/components/debug/DebugDianPanel'

export default async function DebugPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Debug — DIAN Test Set</h1>
      <p className="text-sm text-gray-500 mb-6">
        Envía el conjunto de pruebas requerido por la DIAN (2 facturas + 1 nota de crédito) para validar tu habilitación en el ambiente de pruebas y transicionar a producción.
      </p>
      <DebugDianPanel />
    </div>
  )
}
