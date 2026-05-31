'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { resolveLoginEmail } from '@/lib/auth/cleaner-email'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    // Admins entran con email; limpiadores con su cédula (mapeada a email interno).
    const email = resolveLoginEmail(identifier)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales inválidas. Verifica tu usuario y contraseña.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🧹</div>
          <h1 className="text-2xl font-bold text-brand-700">CleanSched</h1>
          <p className="text-gray-500 text-sm mt-1">Agendamiento y Facturación</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-id" className="block text-base font-semibold text-gray-800 mb-1.5">Correo o cédula</label>
            <input
              id="login-id"
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              className="w-full border border-gray-400 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="correo@empresa.com o número de cédula"
            />
            <p className="text-sm text-gray-600 mt-1.5">Admin: tu correo. Limpiadores: tu número de cédula.</p>
          </div>
          <div>
            <label htmlFor="login-pass" className="block text-base font-semibold text-gray-800 mb-1.5">Contraseña</label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-400 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div role="alert" className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-base">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
