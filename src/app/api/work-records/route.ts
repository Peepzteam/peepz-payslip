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
  // Check if record exists first (avoids needing unique constraint for upsert)
  const { data: existing } = await supabaseAdmin
    .from('work_records')
    .select('id')
    .eq('employee_id', body.employee_id)
    .eq('date', body.date)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('work_records')
      .update(body)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabaseAdmin
    .from('work_records')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
