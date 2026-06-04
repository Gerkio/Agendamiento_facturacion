import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Rutas accesibles sin sesión.
  const isOpen = pathname.startsWith('/auth/login')

  if (!user && !isOpen) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Un usuario ya autenticado no debería ver el login.
  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Forzar cambio de contraseña inicial ANTES de acceder a cualquier otra ruta
  // (defensa en profundidad: la contraseña inicial = cédula es conocible). El flag
  // vive en app_metadata del JWT, que `getUser()` ya trae validado del servidor de
  // auth: no se hace consulta extra a la base en cada request.
  if (user) {
    const allowedDuringChange =
      pathname.startsWith('/auth/change-password') ||
      pathname.startsWith('/api/auth/change-password') ||
      pathname.startsWith('/auth/logout')
    if (!allowedDuringChange && user.app_metadata?.must_change_password === true) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Debes cambiar tu contraseña antes de continuar.' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
