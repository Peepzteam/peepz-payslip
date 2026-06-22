import { NextRequest, NextResponse } from 'next/server'

const USERS = [
  { username: 'Prae', password: 'Pim@195063', role: 'admin' },
  { username: 'Ploy', password: 'Ploypeepz', role: 'admin' },
  { username: 'Nattanan.pr18', password: 'Nattanan.pr18', role: 'readonly' },
]

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}))

  const user = USERS.find((u) => u.username === username && u.password === password)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set('admin_auth', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  res.cookies.set('admin_role', user.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  res.cookies.set('admin_username', user.username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
