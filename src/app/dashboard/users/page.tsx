import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import UsersTable, { type UserRow } from '@/components/users/UsersTable'

export default async function UsersPage() {
  // getAuth (no requireAdmin) porque además del guard se necesita user.id.
  const { supabase, user, role } = await getAuth()
  if (!user) redirect('/auth/login')
  if (role !== 'admin') redirect('/dashboard')

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
