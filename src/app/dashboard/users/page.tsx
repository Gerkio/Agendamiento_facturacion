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
    .select('id, email, role, cleaner_id, must_change_password, full_name, photo_url, cleaners(full_name)')
    .order('role')
    .returns<UserRow[]>()

  // URLs firmadas de las fotos de administradores (bucket privado), en paralelo.
  const photoUrls: Record<string, string> = {}
  await Promise.all(
    (users ?? [])
      .filter(u => u.role === 'admin' && u.photo_url)
      .map(async u => {
        const { data } = await supabase.storage.from('admin-photos').createSignedUrl(u.photo_url!, 3600)
        if (data?.signedUrl) photoUrls[u.id] = data.signedUrl
      })
  )

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">👥 Usuarios</h1>
      <UsersTable users={users ?? []} currentUserId={user.id} photoUrls={photoUrls} />
    </div>
  )
}
