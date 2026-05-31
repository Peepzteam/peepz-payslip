import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Bulk upsert: manual check-then-insert/update to avoid needing unique constraint
export async function POST(req: NextRequest) {
  const body = await req.json()
  const records: { employee_id: string; date: string; [key: string]: unknown }[] = Array.isArray(body) ? body : [body]

  const results = []
  const errors = []

  for (const rec of records) {
    // Check if record exists for this employee_id + date
    const { data: existing } = await supabaseAdmin
      .from('work_records')
      .select('id')
      .eq('employee_id', rec.employee_id)
      .eq('date', rec.date)
      .maybeSingle()

    if (existing?.id) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('work_records')
        .update(rec)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) errors.push({ rec, error: error.message })
      else results.push(data)
    } else {
      // Insert new
      const { data, error } = await supabaseAdmin
        .from('work_records')
        .insert(rec)
        .select()
        .single()
      if (error) errors.push({ rec, error: error.message })
      else results.push(data)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].error, details: errors }, { status: 500 })
  }

  return NextResponse.json(results)
}
