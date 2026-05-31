import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Bulk upsert multiple records at once
export async function POST(req: NextRequest) {
  const body = await req.json()
  const records: object[] = Array.isArray(body) ? body : [body]
  const { data, error } = await supabaseAdmin
    .from('work_records')
    .upsert(records, { onConflict: 'employee_id,date' })
    .select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
