import type { Config } from '@netlify/functions'

// รันทุกวันที่ 1 ของเดือน เวลา 08:00 (UTC+7 = 01:00 UTC)
export const config: Config = {
  schedule: '0 1 1 * *',
}

export default async () => {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_URL ?? 'https://peepzfinance.netlify.app'
  const secret  = process.env.CRON_SECRET ?? ''

  console.log(`[monthly-backup] Starting backup — ${new Date().toISOString()}`)

  try {
    const res = await fetch(`${siteUrl}/api/backup-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': secret,
      },
    })

    const body = await res.json()
    if (!res.ok) {
      console.error('[monthly-backup] Failed:', body)
      return
    }

    console.log('[monthly-backup] Success:', body)
  } catch (err) {
    console.error('[monthly-backup] Error:', err)
  }
}
