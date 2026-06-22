import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Public endpoint — freelancer reviews their pay and submits doc links via a shared link, no login required.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .select('id, employee_id, guest_name, guest_email, guest_type, period_month, period_year, gross_income, withholding_tax, net_pay, line_items, base_salary, other_income, is_paid, wht_cert_email, freelance_confirmed_at, freelance_confirm_id_card_url, freelance_confirm_bank_book_url, employee:employees(id, name, email, type, doc_id_card_url, doc_bank_book_url)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const idCardUrl = String(body.id_card_url || '').trim()
  const bankBookUrl = String(body.bank_book_url || '').trim()
  const email = String(body.email || '').trim()

  if (!idCardUrl || !bankBookUrl || !email) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' }, { status: 400 })
  }

  const { data: payslip, error: fetchError } = await supabaseAdmin
    .from('payslips')
    .select('employee_id, guest_name')
    .eq('id', id)
    .single()
  if (fetchError || !payslip) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  if (payslip.employee_id) {
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .update({ doc_id_card_url: idCardUrl, doc_bank_book_url: bankBookUrl, email })
      .eq('id', payslip.employee_id)
    if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })
  } else if (payslip.guest_name) {
    // จำอีเมลนี้ไว้กับ freelance รายนี้ทุกรอบ (รวมสลิปก่อนหน้าที่ยังไม่มีอีเมล)
    const { error: guestError } = await supabaseAdmin
      .from('payslips')
      .update({ guest_email: email })
      .eq('guest_name', payslip.guest_name)
      .is('employee_id', null)
      .is('guest_email', null)
    if (guestError) return NextResponse.json({ error: guestError.message }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .update({
      freelance_confirmed_at: new Date().toISOString(),
      freelance_confirm_id_card_url: idCardUrl,
      freelance_confirm_bank_book_url: bankBookUrl,
      wht_cert_email: email,
      guest_email: payslip.employee_id ? undefined : email,
    })
    .eq('id', id)
    .select('id, freelance_confirmed_at, wht_cert_email, guest_email')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
