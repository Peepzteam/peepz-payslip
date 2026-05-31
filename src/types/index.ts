export type EmployeeType = 'fulltime' | 'freelance'
export type PayslipStatus = 'pending' | 'acknowledged'

export interface Employee {
  id: string
  email: string
  name: string
  employee_code: string | null
  type: EmployeeType
  department: string | null
  position: string | null
  base_salary: number | null
  start_date: string | null
  is_active: boolean
  is_owner: boolean
  created_at: string
}

export interface SalaryHistory {
  id: string
  employee_id: string
  effective_date: string
  salary: number
  note: string | null
  created_at: string
}

export interface CompanyHoliday {
  id: string
  date: string
  name: string
  year: number
  created_at: string
}

export interface LineItem {
  description: string
  quantity: number
  unit: string
  rate: number
  total: number
}

export interface IncentiveItem {
  description: string   // ชื่องาน/แหล่งที่มา
  amount: number        // ยอดเงิน
}

export interface OtItem {
  date: string        // YYYY-MM-DD
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  hours: number       // auto-calc
  type: 'normal' | 'holiday'
  rate: number        // per hour
  amount: number      // hours * rate
}

export interface Payslip {
  id: string
  employee_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_type: string | null
  period_month: number
  period_year: number
  base_salary: number
  ot_hours: number
  ot_rate: number
  ot_amount: number
  incentive: number
  incentive_note: string | null
  other_income: number
  other_income_note: string | null
  project_name: string | null
  work_days: number | null
  daily_rate: number
  social_security: number
  withholding_tax: number
  other_deduction: number
  other_deduction_note: string | null
  gross_income: number
  total_deduction: number
  net_pay: number
  status: PayslipStatus
  acknowledged_at: string | null
  admin_note: string | null
  transfer_date: string | null
  line_items: LineItem[] | null
  ot_items: OtItem[] | null
  incentive_items: IncentiveItem[] | null
  created_at: string
  employee?: Employee
}

export interface PayslipFormData {
  employee_id: string
  period_month: number
  period_year: number
  base_salary: number
  ot_hours: number
  ot_rate: number
  ot_amount: number
  incentive: number
  incentive_note: string
  other_income: number
  other_income_note: string
  project_name: string
  work_days: number
  daily_rate: number
  social_security: number
  withholding_tax: number
  other_deduction: number
  other_deduction_note: string
  admin_note: string
}
