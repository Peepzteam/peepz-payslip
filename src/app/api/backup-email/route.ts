import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildBackupData } from '@/lib/backup'

// Secret token to protect this endpoint (called by Netlify Cron)
const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Verify secret header
  const authHeader = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const backup = await buildBackupData('auto-backup')
    const json = JSON.stringify(backup, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const filename = `peepz-backup-${date}.json`

    // Total rows summary
    const rowSummary = Object.entries(backup.row_counts)
      .map(([k, v]) => `• ${k}: ${v} rows`)
      .join('\n')

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER!,
        pass: process.env.BREVO_SMTP_KEY!,
      },
    })

    const recipients = process.env.BACKUP_EMAIL_TO ?? process.env.BREVO_SENDER_EMAIL!

    await transporter.sendMail({
      from: `"Peepz Backup 🔒" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: recipients,
      subject: `📦 Peepz Auto-Backup — ${date}`,
      text: `Peepz Auto-Backup ประจำวันที่ ${date}\n\nข้อมูลที่ backup:\n${rowSummary}\n\nไฟล์ backup แนบมาด้วยค่ะ เก็บไว้ใน Google Drive นะคะ 🙏`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;">
          <h2 style="color:#4f46e5;margin-top:0;">📦 Peepz Auto-Backup</h2>
          <p style="color:#374151;">Backup อัตโนมัติประจำวันที่ <strong>${date}</strong></p>
          <div style="background:white;border-radius:8px;padding:16px;border:1px solid #e5e7eb;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:600;color:#374151;">ข้อมูลที่ backup:</p>
            ${Object.entries(backup.row_counts).map(([k, v]) => `
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">
                <span>${k}</span><span style="font-weight:600;color:#374151;">${v} rows</span>
              </div>`).join('')}
          </div>
          <p style="color:#6b7280;font-size:13px;">📎 ไฟล์ <strong>${filename}</strong> แนบมาด้วยค่ะ<br/>เก็บไว้ใน Google Drive folder "Peepz Backup" นะคะ 🙏</p>
          <p style="color:#9ca3af;font-size:11px;margin-bottom:0;">ส่งอัตโนมัติโดย Peepz Admin System ทุกวันที่ 1 ของเดือน</p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: Buffer.from(json, 'utf-8'),
          contentType: 'application/json',
        },
      ],
    })

    return NextResponse.json({
      success: true,
      date,
      rows: backup.row_counts,
      sent_to: recipients,
    })
  } catch (err) {
    console.error('Backup email error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
