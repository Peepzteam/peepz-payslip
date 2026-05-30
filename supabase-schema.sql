-- Enable RLS
-- Run this in Supabase SQL Editor

-- Employees table
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  employee_code TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('fulltime', 'freelance')),
  department TEXT,
  position TEXT,
  base_salary NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payslips table
CREATE TABLE payslips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,

  -- Income
  base_salary NUMERIC(12,2) DEFAULT 0,
  ot_hours NUMERIC(6,2) DEFAULT 0,
  ot_rate NUMERIC(10,2) DEFAULT 0,
  ot_amount NUMERIC(12,2) DEFAULT 0,
  incentive NUMERIC(12,2) DEFAULT 0,
  incentive_note TEXT,
  other_income NUMERIC(12,2) DEFAULT 0,
  other_income_note TEXT,

  -- For freelance
  project_name TEXT,
  work_days INTEGER,
  daily_rate NUMERIC(10,2) DEFAULT 0,

  -- Deductions
  social_security NUMERIC(12,2) DEFAULT 0,
  withholding_tax NUMERIC(12,2) DEFAULT 0,
  other_deduction NUMERIC(12,2) DEFAULT 0,
  other_deduction_note TEXT,

  -- Totals (calculated)
  gross_income NUMERIC(12,2) GENERATED ALWAYS AS (
    base_salary + ot_amount + incentive + other_income
  ) STORED,
  total_deduction NUMERIC(12,2) GENERATED ALWAYS AS (
    social_security + withholding_tax + other_deduction
  ) STORED,
  net_pay NUMERIC(12,2) GENERATED ALWAYS AS (
    (base_salary + ot_amount + incentive + other_income) -
    (social_security + withholding_tax + other_deduction)
  ) STORED,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged')),
  acknowledged_at TIMESTAMPTZ,
  admin_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (employee_id, period_month, period_year)
);

-- RLS Policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Employees can see their own record
CREATE POLICY "employees_read_own" ON employees
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Service role can do everything
CREATE POLICY "service_role_employees" ON employees
  FOR ALL USING (auth.role() = 'service_role');

-- Employees can see their own payslips
CREATE POLICY "employees_read_own_payslips" ON payslips
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Employees can update status of their own payslips
CREATE POLICY "employees_update_own_payslips" ON payslips
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM employees WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Service role can do everything
CREATE POLICY "service_role_payslips" ON payslips
  FOR ALL USING (auth.role() = 'service_role');
