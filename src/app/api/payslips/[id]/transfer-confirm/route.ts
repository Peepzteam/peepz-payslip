import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTransferConfirmationEmail } from '@/lib/email'
import { Payslip } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // อัปเดต transfer_date ถ้าส่งมา
  if (body.transfer_date) {
    await supabaseAdmin.from('payslips').update({ transfer_date: body.transfer_date }).eq('id', id)
  }

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .select('*, employee:employees(*)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await sendTransferConfirmationEmail(data as Payslip)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
