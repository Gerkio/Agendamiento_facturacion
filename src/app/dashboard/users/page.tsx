import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersTable, { type UserRow } from '@/components/users/UsersTable'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, role, cleaner_id, must_change_password, cleaners(full_name)')
    .order('role')
    .returns<UserRow[]>()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">👥 Usuarios</h1>
      <UsersTable users={users ?? []} currentUserId={user.id} />
    </div>
  )
}
