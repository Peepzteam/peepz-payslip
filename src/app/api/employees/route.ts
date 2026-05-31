import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .order('employee_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

async function generateCode(type: string): Promise<string> {
  const prefix = type === 'freelance' ? 'F' : 'EMP'

  // ดึงรหัสล่าสุดของประเภทนั้น
  const { data } = await supabaseAdmin
    .from('employees')
    .select('employee_code')
    .like('employee_code', `${prefix}%`)
    .order('employee_code', { ascending: false })
    .limit(1)

  let nextNum = 1
  if (data && data.length > 0 && data[0].employee_code) {
    const last = data[0].employee_code.replace(prefix, '')
    const n = parseInt(last, 10)
    if (!isNaN(n)) nextNum = n + 1
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // auto-generate รหัสพนักงานถ้าไม่ได้กรอกมา
  if (!body.employee_code) {
    body.employee_code = await generateCode(body.type || 'fulltime')
  }

  const { data, error } = await supabaseAdmin
    .from('employees')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
