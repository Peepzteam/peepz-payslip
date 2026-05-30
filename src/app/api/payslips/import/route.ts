import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPayslipEmail } from '@/lib/email'
import * as XLSX from 'xlsx'
import { Payslip } from '@/types'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const sendEmails = formData.get('send_emails') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  const errors: string[] = []
  let imported = 0

  for (const row of rows) {
    const email = String(row['email'] || row['Email'] || '')
    if (!email) continue

    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('email', email)
      .single()

    if (!emp) {
      errors.push(`ไม่พบพนักงาน email: ${email}`)
      continue
    }

    const otHours = Number(row['ot_hours'] || 0)
    const otRate = Number(row['ot_rate'] || 0)
    const payload = {
      employee_id: emp.id,
      period_month: Number(row['month'] || row['เดือน']),
      period_year: Number(row['year'] || row['ปี']),
      base_salary: Number(row['base_salary'] || row['เงินเดือน'] || 0),
      ot_hours: otHours,
      ot_rate: otRate,
      ot_amount: otHours * otRate,
      incentive: Number(row['incentive'] || 0),
      incentive_note: String(row['incentive_note'] || ''),
      other_income: Number(row['other_income'] || 0),
      other_income_note: String(row['other_income_note'] || ''),
      project_name: String(row['project_name'] || ''),
      work_days: Number(row['work_days'] || 0) || null,
      daily_rate: Number(row['daily_rate'] || 0),
      social_security: Number(row['social_security'] || 0),
      withholding_tax: Number(row['withholding_tax'] || 0),
      other_deduction: Number(row['other_deduction'] || 0),
      other_deduction_note: String(row['other_deduction_note'] || ''),
      admin_note: String(row['admin_note'] || ''),
    }

    const { data, error } = await supabaseAdmin
      .from('payslips')
      .insert(payload)
      .select('*, employee:employees(*)')
      .single()

    if (error) {
      errors.push(`${email}: ${error.message}`)
      continue
    }

    imported++

    if (sendEmails && data) {
      try {
        await sendPayslipEmail(data as Payslip)
      } catch (e) {
        errors.push(`Email ${email}: send failed`)
      }
    }
  }

  return NextResponse.json({ imported, errors })
}
