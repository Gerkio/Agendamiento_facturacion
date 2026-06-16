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
  pendingPqr?: number
  pendingPeticiones?: number
}

interface NavLink { href: string; label: string; icon: string }
interface NavGroup { id: string; label: string; links: NavLink[] }

/** Acceso directo principal (fuera de los grupos): la herramienta más usada. */
const AGENDA: NavLink = { href: '/dashboard', label: 'Agenda', icon: '📅' }

/** Menú admin agrupado por segmentos (colapsables). */
const ADMIN_GROUPS: NavGroup[] = [
  {
    id: 'operacion', label: 'Operación', links: [
      { href: '/dashboard/clients', label: 'Clientes', icon: '🏢' },
      { href: '/dashboard/services', label: 'Servicios', icon: '🧰' },
      { href: '/dashboard/history', label: 'Historial', icon: '🗂️' },
      { href: '/dashboard/warranties', label: 'Garantías', icon: '🛡️' },
      { href: '/dashboard/pqr', label: 'PQR', icon: '📨' },
    ],
  },
  {
    id: 'equipo', label: 'Equipo', links: [
      { href: '/dashboard/cleaners', label: 'Auxiliares', icon: '🧹' },
      { href: '/dashboard/novedades', label: 'Novedades', icon: '📋' },
      { href: '/dashboard/peticiones', label: 'Peticiones', icon: '🙋' },
      { href: '/dashboard/payroll', label: 'Liquidación', icon: '💵' },
    ],
  },
  {
    id: 'finanzas', label: 'Finanzas', links: [
      { href: '/dashboard/invoices', label: 'Facturación', icon: '🧾' },
      { href: '/dashboard/receivables', label: 'Cartera', icon: '💳' },
      { href: '/dashboard/receipts', label: 'Recibos', icon: '🪙' },
      { href: '/dashboard/expenses', label: 'Gastos', icon: '💸' },
      { href: '/dashboard/reports', label: 'Reportes', icon: '📊' },
    ],
  },
  {
    id: 'sistema', label: 'Sistema', links: [
      { href: '/dashboard/users', label: 'Usuarios', icon: '👥' },
      { href: '/dashboard/audit', label: 'Auditoría', icon: '🔒' },
      { href: '/dashboard/debug', label: 'Debug DIAN', icon: '🔧' },
    ],
  },
]

const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

/** Grupo que contiene la ruta actual (para abrirlo por defecto). */
const groupOf = (pathname: string) =>
  ADMIN_GROUPS.find(g => g.links.some(l => isActive(pathname, l.href)))?.id ?? null

function NavItem({ link, pathname, badge = 0, nested = false }: {
  link: NavLink; pathname: string; badge?: number; nested?: boolean
}) {
  const active = isActive(pathname, link.href)
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-base transition ${nested ? 'ml-3' : ''} ${active ? 'bg-brand-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      <span className="text-lg" aria-hidden="true">{link.icon}</span>
      <span className="flex-1">{link.label}</span>
      {badge > 0 && (
        <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${active ? 'bg-white text-brand-700' : 'bg-red-600 text-white'}`}>{badge}</span>
      )}
    </Link>
  )
}

export default function Sidebar({ role, userEmail, pendingNovedades = 0, pendingPqr = 0, pendingPeticiones = 0 }: SidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Abierto por defecto: el grupo de la ruta activa (estable entre SSR y cliente).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const g = groupOf(pathname)
    return g ? { [g]: true } : {}
  })

  // Al navegar: cerrar el drawer (móvil) y asegurar visible el grupo activo.
  useEffect(() => {
    setOpen(false)
    const g = groupOf(pathname)
    if (g) setOpenGroups(prev => (prev[g] ? prev : { ...prev, [g]: true }))
  }, [pathname])

  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  const badgeOf = (href: string) =>
    href === '/dashboard/novedades' ? pendingNovedades
      : href === '/dashboard/pqr' ? pendingPqr
        : href === '/dashboard/peticiones' ? pendingPeticiones : 0

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
          {role !== 'admin' ? (
            <>
              <NavItem link={{ href: '/dashboard', label: 'Mi Calendario', icon: '📅' }} pathname={pathname} />
              <NavItem link={{ href: '/dashboard/peticiones', label: 'Mis peticiones', icon: '🙋' }} pathname={pathname} />
            </>
          ) : (
            <>
              <NavItem link={AGENDA} pathname={pathname} />

              {ADMIN_GROUPS.map(group => {
                const expanded = !!openGroups[group.id]
                const containsActive = group.links.some(l => isActive(pathname, l.href))
                const groupBadge = expanded ? 0 : group.links.reduce((s, l) => s + badgeOf(l.href), 0)
                return (
                  <div key={group.id} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={expanded ? 'true' : 'false'}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${containsActive && !expanded ? 'text-brand-700 bg-brand-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                      <span className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true">▶</span>
                      <span className="flex-1 text-left">{group.label}</span>
                      {groupBadge > 0 && (
                        <span className="text-xs font-bold rounded-full px-1.5 py-0.5 bg-red-600 text-white normal-case">{groupBadge}</span>
                      )}
                    </button>
                    {expanded && (
                      <div className="mt-0.5 space-y-0.5 border-l border-gray-200 ml-4">
                        {group.links.map(link => (
                          <NavItem key={link.href} link={link} pathname={pathname} badge={badgeOf(link.href)} nested />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
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
