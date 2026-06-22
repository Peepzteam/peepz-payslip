import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { buildBackupData } from '@/lib/backup'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const role = cookieStore.get('admin_role')?.value
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const backup = await buildBackupData(cookieStore.get('admin_username')?.value ?? 'manual')
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="peepz-backup-${date}.json"`,
      },
    })
  } catch (err) {
    console.error('Backup error:', err)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
