import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import PeticionesView from '@/components/peticiones/PeticionesView'
import type { Peticion } from '@/types/database'

export default async function PeticionesPage() {
  // Accesible para admin y auxiliar: la RLS filtra a sus propias peticiones.
  const { supabase, user, role, cleanerId } = await getAuth()
  if (!user) redirect('/auth/login')
  const isAdmin = role === 'admin'

  const [{ data: peticiones }, { data: cleaners }] = await Promise.all([
    supabase.from('peticiones').select('*, cleaners(full_name)').order('created_at', { ascending: false }).limit(200).returns<Peticion[]>(),
    isAdmin
      ? supabase.from('cleaners').select('id, full_name').eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">{isAdmin ? 'Peticiones' : 'Mis peticiones'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isAdmin
          ? 'Solicitudes del personal (permiso, dotación, anticipo, certificado). Apruébalas, recházalas o márcalas resueltas.'
          : 'Radica tus solicitudes y consulta su estado.'}
      </p>
      <PeticionesView initialPeticiones={peticiones ?? []} cleaners={cleaners ?? []} isAdmin={isAdmin} cleanerId={cleanerId} />
    </div>
  )
}
