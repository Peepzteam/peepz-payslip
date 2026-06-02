import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  delete body.send_email

  // partial update (e.g. mark paid) — skip recalc if no salary fields
  const hasSalaryFields = 'base_salary' in body || 'ot_amount' in body || 'incentive' in body ||
    'other_income' in body || 'social_security' in body || 'withholding_tax' in body || 'other_deduction' in body

  if (hasSalaryFields) {
    if (body.line_items?.length) {
      body.base_salary = body.line_items.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0)
    }
    const gross = (body.base_salary || 0) + (body.ot_amount || 0) + (body.incentive || 0) + (body.other_income || 0)
    const deduct = (body.social_security || 0) + (body.withholding_tax || 0) + (body.other_deduction || 0)
    body.gross_income = gross
    body.total_deduction = deduct
    body.net_pay = gross - deduct
  }

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
