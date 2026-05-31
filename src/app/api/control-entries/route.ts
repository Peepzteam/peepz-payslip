import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')

  let query = supabaseAdmin.from('control_entries').select('*').order('month')
  if (year) query = query.eq('year', Number(year))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Upsert by year+month+category
  const { data: existing } = await supabaseAdmin
    .from('control_entries').select('id')
    .eq('year', body.year).eq('month', body.month).eq('category', body.category)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('control_entries').update({ amount: body.amount, note: body.note })
      .eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabaseAdmin.from('control_entries').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
