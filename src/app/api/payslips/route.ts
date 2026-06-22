import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPayslipEmail } from '@/lib/email'
import { Payslip } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  const slim = searchParams.get('slim') === '1'
  const selectFields = slim
    ? 'id,period_month,period_year,base_salary,ot_amount,incentive,social_security,withholding_tax,net_pay,guest_type,employee:employees(type,is_owner)'
    : '*, employee:employees(*)'

  let query = supabaseAdmin
    .from('payslips')
    .select(selectFields)
    .order('created_at', { ascending: false })

  if (month) query = query.eq('period_month', parseInt(month))
  if (year) query = query.eq('period_year', parseInt(year))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sendEmail = body.send_email === true
  delete body.send_email
  delete body.overwrite

  // ถ้า freelance มี line_items ให้รวมเป็น base_salary
  if (body.line_items?.length) {
    body.base_salary = body.line_items.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0)
  }

  // Calculate totals
  const gross = (body.base_salary || 0) + (body.ot_amount || 0) + (body.incentive || 0) + (body.other_income || 0)
  const deduct = (body.social_security || 0) + (body.withholding_tax || 0) + (body.other_deduction || 0)
  body.gross_income = gross
  body.total_deduction = deduct
  body.net_pay = gross - deduct

  const username = req.cookies.get('admin_username')?.value ?? null
  if (username) body.created_by = username

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .insert(body)
    .select('*, employee:employees(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (sendEmail) {
    try {
      const emailResult = await sendPayslipEmail(data as Payslip)
      console.log('[email] sent OK', emailResult)
    } catch (e) {
      console.error('[email] FAILED:', e)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
