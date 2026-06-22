import { supabaseAdmin } from '@/lib/supabase'

export async function buildBackupData(exportedBy = 'system') {
  const [
    { data: employees },
    { data: payslips },
    { data: incomeRecords },
    { data: expenseRecords },
    { data: campaigns },
    { data: controlEntries },
    { data: holidays },
    { data: leaveRecords },
    { data: workRecords },
    { data: salaryHistory },
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('*').order('created_at'),
    supabaseAdmin.from('payslips').select('*').order('created_at'),
    supabaseAdmin.from('income_records').select('*').order('created_at'),
    supabaseAdmin.from('expense_records').select('*').order('created_at'),
    supabaseAdmin.from('campaigns').select('*').order('created_at'),
    supabaseAdmin.from('control_entries').select('*').order('created_at'),
    supabaseAdmin.from('company_holidays').select('*').order('date'),
    supabaseAdmin.from('leave_records').select('*').order('created_at'),
    supabaseAdmin.from('work_records').select('*').order('created_at'),
    supabaseAdmin.from('salary_history').select('*').order('created_at'),
  ])

  const tables = {
    employees:        employees        ?? [],
    payslips:         payslips         ?? [],
    income_records:   incomeRecords    ?? [],
    expense_records:  expenseRecords   ?? [],
    campaigns:        campaigns        ?? [],
    control_entries:  controlEntries   ?? [],
    company_holidays: holidays         ?? [],
    leave_records:    leaveRecords     ?? [],
    work_records:     workRecords      ?? [],
    salary_history:   salaryHistory    ?? [],
  }

  return {
    exported_at: new Date().toISOString(),
    exported_by: exportedBy,
    version: '1.0',
    tables,
    row_counts: Object.fromEntries(
      Object.entries(tables).map(([k, v]) => [k, (v as unknown[]).length])
    ),
  }
}
