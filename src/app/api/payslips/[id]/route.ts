import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  delete body.send_email

  const gross = (body.base_salary || 0) + (body.ot_amount || 0) + (body.incentive || 0) + (body.other_income || 0)
  const deduct = (body.social_security || 0) + (body.withholding_tax || 0) + (body.other_deduction || 0)
  body.gross_income = gross
  body.total_deduction = deduct
  body.net_pay = gross - deduct

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .update(body)
    .eq('id', id)
    .select('*, employee:employees(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('payslips').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
