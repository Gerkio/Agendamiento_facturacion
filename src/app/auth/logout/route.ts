import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function handleLogout(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Redirect relative to the incoming request origin (works in dev and prod).
  return NextResponse.redirect(new URL('/auth/login', req.url), { status: 303 })
}

export const POST = handleLogout
export const GET = handleLogout
