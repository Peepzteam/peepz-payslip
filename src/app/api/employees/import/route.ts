import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  const employees = rows.map((row) => ({
    email: String(row['email'] || row['Email'] || ''),
    name: String(row['name'] || row['ชื่อ'] || ''),
    employee_code: String(row['employee_code'] || row['รหัส'] || '') || null,
    type: String(row['type'] || row['ประเภท'] || 'fulltime'),
    department: String(row['department'] || row['แผนก'] || '') || null,
    position: String(row['position'] || row['ตำแหน่ง'] || '') || null,
    base_salary: Number(row['base_salary'] || row['เงินเดือน'] || 0) || null,
  })).filter((e) => e.email && e.name)

  const { data, error } = await supabaseAdmin
    .from('employees')
    .upsert(employees, { onConflict: 'email' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0 })
}
