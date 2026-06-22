import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const auth = req.cookies.get('admin_auth')?.value
  if (auth !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = req.cookies.get('admin_role')?.value ?? 'admin'
  const username = req.cookies.get('admin_username')?.value ?? null
  return NextResponse.json({ role, username }, { headers: { 'Cache-Control': 'no-store' } })
}
