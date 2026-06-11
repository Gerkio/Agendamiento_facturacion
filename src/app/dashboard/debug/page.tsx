import { requireAdmin } from '@/lib/auth'
import DebugDianPanel from '@/components/debug/DebugDianPanel'

export default async function DebugPage() {
  await requireAdmin()

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
