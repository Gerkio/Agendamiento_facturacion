import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import PqrTable from '@/components/pqr/PqrTable'
import type { Pqr } from '@/types/database'

export default async function PqrPage() {
  // getAuth (no requireAdmin) porque se necesita el email para la bitácora.
  const { supabase, user, role } = await getAuth()
  if (!user) redirect('/auth/login')
  if (role !== 'admin') redirect('/dashboard')

  const [{ data: pqr }, { data: clients }] = await Promise.all([
    supabase.from('pqr').select('*, clients(company_name), pqr_events(id, pqr_id, action, note, actor_email, created_at)').order('received_at', { ascending: false }).limit(200).returns<Pqr[]>(),
    supabase.from('clients').select('id, company_name').order('company_name'),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">PQR</h1>
      <p className="text-sm text-gray-500 mb-6">Peticiones, quejas, reclamos y sugerencias de clientes, con radicado, bitácora y semáforo de respuesta.</p>
      <PqrTable initialPqr={pqr ?? []} clients={clients ?? []} currentUserEmail={user.email ?? ''} />
    </div>
  )
}
