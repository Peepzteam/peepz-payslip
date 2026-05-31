import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const employee_id = searchParams.get('employee_id')

  let query = supabaseAdmin
    .from('work_records')
    .select('*')
    .order('date', { ascending: true })

  if (month && year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('date', start).lte('date', end)
  }
  if (employee_id) query = query.eq('employee_id', employee_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('work_records')
    .upsert(body, { onConflict: 'employee_id,date' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
