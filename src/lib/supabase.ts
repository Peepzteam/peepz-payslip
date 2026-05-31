import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.placeholder'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9.placeholder'

const DB_OPTIONS = {
  db: { schema: 'public' },
  global: { headers: { 'Connection': 'keep-alive' } },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, DB_OPTIONS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, DB_OPTIONS)
