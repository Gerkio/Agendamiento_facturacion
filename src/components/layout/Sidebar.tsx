'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Logo from '@/components/ui/Logo'
import type { UserRole } from '@/types/database'

interface SidebarProps {
  role: UserRole
  userEmail: string
  pendingNovedades?: number
}

const adminLinks = [
  { href: '/dashboard', label: 'Agenda', icon: '📅' },
  { href: '/dashboard/cleaners', label: 'Auxiliares', icon: '🧹' },
  { href: '/dashboard/clients', label: 'Clientes', icon: '🏢' },
  { href: '/dashboard/services', label: 'Servicios', icon: '🧰' },
  { href: '/dashboard/novedades', label: 'Novedades', icon: '📋' },
  { href: '/dashboard/invoices', label: 'Facturación', icon: '🧾' },
  { href: '/dashboard/history', label: 'Historial', icon: '🗂️' },
  { href: '/dashboard/users', label: 'Usuarios', icon: '👥' },
  { href: '/dashboard/debug', label: 'Debug DIAN', icon: '🔧' },
]

const cleanerLinks = [
  { href: '/dashboard', label: 'Mi Calendario', icon: '📅' },
]

export default function Sidebar({ role, userEmail, pendingNovedades = 0 }: SidebarProps) {
  const pathname = usePathname()
  const links = role === 'admin' ? adminLinks : cleanerLinks
  const [open, setOpen] = useState(false)

  // Cerrar el menú al navegar (en móvil).
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      {/* Barra superior (solo móvil) */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2">
        <Logo className="h-10 w-auto" />
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú"
          className="p-2 -mr-2 rounded-lg text-gray-700 hover:bg-gray-100 text-2xl leading-none">☰</button>
      </div>

      {/* Fondo oscuro al abrir el menú (solo móvil) */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar: fijo (drawer) en móvil, estático en escritorio */}
      <aside className={`
        bg-white border-r border-gray-200 flex flex-col
        fixed inset-y-0 left-0 z-50 w-72 max-w-[80%] transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:static md:translate-x-0 md:w-56 md:z-auto md:max-w-none
      `}>
        <div className="p-4 border-b border-gray-100">
          <div className="relative flex items-center justify-center">
            <Logo className="h-20 w-auto" />
            {/* Cerrar (solo móvil) */}
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú"
              className="md:hidden absolute right-0 top-0 p-1 rounded text-gray-600 hover:text-gray-800 text-xl leading-none">✕</button>
          </div>
          <div className="text-sm text-gray-600 mt-2 truncate text-center">{userEmail}</div>
          <div className="text-center mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full inline-block font-medium ${role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
              {role === 'admin' ? 'Administrador' : 'Limpiador'}
            </span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Menú principal">
          {links.map(link => {
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base transition ${active ? 'bg-brand-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <span className="text-lg" aria-hidden="true">{link.icon}</span>
                <span className="flex-1">{link.label}</span>
                {link.href === '/dashboard/novedades' && pendingNovedades > 0 && (
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${active ? 'bg-white text-brand-700' : 'bg-red-600 text-white'}`}>{pendingNovedades}</span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <Link
            href="/auth/change-password"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base text-gray-700 hover:bg-gray-100 transition w-full"
          >
            <span className="text-lg" aria-hidden="true">🔑</span> Cambiar contraseña
          </Link>
          <a
            href="/auth/logout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base text-gray-700 hover:bg-red-50 hover:text-red-700 transition w-full"
          >
            <span className="text-lg" aria-hidden="true">🚪</span> Cerrar sesión
          </a>
        </div>
      </aside>
    </>
  )
}
