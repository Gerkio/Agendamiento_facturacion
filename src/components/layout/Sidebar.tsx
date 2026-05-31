'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/database'

interface SidebarProps {
  role: UserRole
  userEmail: string
}

const adminLinks = [
  { href: '/dashboard', label: 'Calendario', icon: '📅' },
  { href: '/dashboard/clients', label: 'Clientes', icon: '🏢' },
  { href: '/dashboard/cleaners', label: 'Limpiadores', icon: '🧹' },
  { href: '/dashboard/invoices', label: 'Facturación', icon: '🧾' },
  { href: '/dashboard/debug', label: 'Debug DIAN', icon: '🔧' },
]

const cleanerLinks = [
  { href: '/dashboard', label: 'Mi Calendario', icon: '📅' },
]

export default function Sidebar({ role, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const links = role === 'admin' ? adminLinks : cleanerLinks

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="text-lg font-bold text-brand-700">🧹 CleanSched</div>
        <div className="text-xs text-gray-600 mt-1 truncate">{userEmail}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
          {role === 'admin' ? 'Administrador' : 'Limpiador'}
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1" aria-label="Menú principal">
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
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <a
          href="/auth/logout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base text-gray-700 hover:bg-red-50 hover:text-red-700 transition w-full"
        >
          <span className="text-lg" aria-hidden="true">🚪</span> Cerrar sesión
        </a>
      </div>
    </aside>
  )
}
