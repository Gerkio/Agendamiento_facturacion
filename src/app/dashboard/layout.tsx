import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { UIProvider } from '@/components/ui/UIProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .single()

  // Primer ingreso: obligar a cambiar la contraseña antes de entrar.
  if (profile?.must_change_password) redirect('/auth/change-password')

  const role = profile?.role ?? 'cleaner'

  // Conteo de novedades pendientes para el badge del menú (solo admin).
  let pendingNovedades = 0
  if (role === 'admin') {
    const { count } = await supabase.from('novedades').select('id', { count: 'exact', head: true }).eq('status', 'pendiente')
    pendingNovedades = count ?? 0
  }

  return (
    <UIProvider>
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-canvas">
        <Sidebar role={role} userEmail={user.email ?? ''} pendingNovedades={pendingNovedades} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </UIProvider>
  )
}
