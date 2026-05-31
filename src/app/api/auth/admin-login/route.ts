import { NextRequest, NextResponse } from 'next/server'

const USERS = [
  { username: 'Prae', password: 'Pim@195063' },
  { username: 'Ploy', password: 'Ploypeepz' },
  { username: 'Nattanan.pr18', password: 'Nattanan.pr18' },
]

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}))

  const valid = USERS.some((u) => u.username === username && u.password === password)

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_auth', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return res
}
