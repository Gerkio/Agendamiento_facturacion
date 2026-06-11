import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { UIProvider } from '@/components/ui/UIProvider'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth compartida por request (React cache): la misma resolución que reutilizan
  // las páginas hijas, sin repetir getUser ni la lectura de user_profiles.
  const { supabase, user, role: rawRole } = await getAuth()

  if (!user) redirect('/auth/login')

  // Primer ingreso: obligar a cambiar la contraseña antes de entrar. El flag se
  // lee del JWT (misma fuente que el middleware) para no depender de la columna
  // y evitar divergencias que dejen al usuario atrapado.
  if (user.app_metadata?.must_change_password === true) redirect('/auth/change-password')

  const role = (rawRole ?? 'cleaner') as UserRole

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
