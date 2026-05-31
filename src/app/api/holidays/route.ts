import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  let query = supabaseAdmin.from('company_holidays').select('*').order('date', { ascending: true })
  if (year) query = query.eq('year', parseInt(year))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' }
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // support bulk insert (array) or single
  if (Array.isArray(body)) {
    const { data, error } = await supabaseAdmin.from('company_holidays').upsert(body, { onConflict: 'date' }).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }
  const { data, error } = await supabaseAdmin.from('company_holidays').upsert(body, { onConflict: 'date' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
