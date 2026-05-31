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
    .select('*')
    .eq('id', user.id)
    .single()

  // Primer ingreso: obligar a cambiar la contraseña antes de entrar.
  if (profile?.must_change_password) redirect('/auth/change-password')

  const role = profile?.role ?? 'cleaner'

  return (
    <UIProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar role={role} userEmail={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </UIProvider>
  )
}
