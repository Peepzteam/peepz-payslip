'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, X, Pencil, Check, Download, AlertTriangle, Upload, ShieldCheck } from 'lucide-react'

interface IncomeRecord {
  id: string; month: number; year: number
  amount: number; sources: string[]
  client_name: string | null; description: string | null; note: string | null
  document_url: string | null
  transaction_date: string | null
  is_paid: boolean; paid_at: string | null
  created_at: string; created_by: string | null
}
interface ExpenseRecord {
  id: string; month: number; year: number
  category: string; amount: number
  description: string | null; note: string | null
  document_url: string | null
  transaction_date: string | null
  is_paid: boolean; paid_at: string | null
  created_at: string; created_by: string | null
}

interface PayslipRecord {
  id: string
  period_month: number
  period_year: number
  net_pay: number
  base_salary: number
  ot_amount: number
  incentive: number
  other_income: number
  social_security: number
  withholding_tax: number
  other_deduction: number
  other_deduction_note: string | null
  other_income_note: string | null
  transfer_date: string | null
  is_paid: boolean
  document_url: string | null
  payment_doc_url: string | null
  wht_cert_email: string | null
  freelance_confirm_id_card_url: string | null
  freelance_confirm_bank_book_url: string | null
  project_name: string | null
  line_items: { description: string; quantity: number; unit: string; rate: number; total: number }[] | null
  ot_items: { date: string; start_time: string; end_time: string; hours: number; type: 'normal' | 'holiday'; rate: number; amount: number }[] | null
  incentive_items: { description: string; amount: number }[] | null
  incentive_note: string | null
  guest_name: string | null
  guest_type: string | null
  created_by: string | null
  employee: { id: string; name: string; employee_code: string; type: string; doc_id_card_url: string | null; doc_bank_book_url: string | null } | null
}

function UserBadge({ name }: { name: string | null }) {
  if (!name) return null
  const colors: Record<string, string> = {
    Prae: 'bg-pink-100 text-pink-500',
    Ploy: 'bg-gray-100 text-gray-500',
  }
  const cls = colors[name] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {name}
    </span>
  )
}

// ฟังก์ชันตรวจว่า payslip นี้เป็น freelance หรือไม่
// เช็คทั้ง employee.type (linked employee) และ guest_type (guest mode)
function isPayslipFreelance(p: PayslipRecord): boolean {
  if (p.employee) return p.employee.type === 'freelance'
  return p.guest_type === 'freelance'
}

// ชื่อพนักงานจาก payslip (รองรับทั้ง linked และ guest)
function payslipName(p: PayslipRecord): string {
  return p.employee?.name ?? p.guest_name ?? '—'
}

// ตรงกับ SERVICE_TYPES ใน Control Board ทุกอย่าง
const INCOME_SOURCES = [
  { val: 'live',       label: '📺 Live Commerce',       color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { val: 'influencer', label: '🌟 Influencer Review',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { val: 'content',    label: '📝 Content Production',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { val: 'ads',        label: '📢 Ads',                 color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { val: 'seeding',    label: '🌱 Seeding Marketing',    color: 'bg-green-100 text-green-700 border-green-200' },
  { val: 'event',      label: '🎪 Event',               color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { val: 'other',      label: '🔧 อื่นๆ',              color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

const EXPENSE_CATEGORIES = [
  // 🏢 Office & System — ตรงกับ Control Board
  { val: 'rent',           label: '🏠 ค่าเช่าออฟฟิศ',        color: 'text-teal-600',   bg: 'bg-teal-50',   group: 'Office' },
  { val: 'utilities',      label: '⚡ ค่าน้ำ/ไฟ/เน็ต',        color: 'text-cyan-600',   bg: 'bg-cyan-50',   group: 'Office' },
  { val: 'software',       label: '💻 ค่า Software',           color: 'text-violet-600', bg: 'bg-violet-50', group: 'Office' },
  { val: 'domain',         label: '🌐 Domain/Hosting',         color: 'text-blue-600',   bg: 'bg-blue-50',   group: 'Office' },
  { val: 'equipment',      label: '🖥️ ค่าอุปกรณ์',            color: 'text-sky-600',    bg: 'bg-sky-50',    group: 'Office' },
  // 🎉 Team & Culture — ตรงกับ Control Board
  { val: 'team_food',      label: '🍽️ เลี้ยงข้าวทีม',         color: 'text-pink-600',   bg: 'bg-pink-50',   group: 'Team' },
  { val: 'team_outing',    label: '🏕️ Outing/Team building',  color: 'text-rose-600',   bg: 'bg-rose-50',   group: 'Team' },
  { val: 'team_party',     label: '🎉 Party บริษัท',           color: 'text-fuchsia-600',bg: 'bg-fuchsia-50',group: 'Team' },
  { val: 'team_snack',     label: '🧃 Snack/เครื่องดื่ม',     color: 'text-orange-500', bg: 'bg-orange-50', group: 'Team' },
  { val: 'team_birthday',  label: '🎂 Birthday/Gift',          color: 'text-pink-500',   bg: 'bg-pink-50',   group: 'Team' },
  { val: 'team_welcome',   label: '🤝 Welcome/Farewell',       color: 'text-emerald-600',bg: 'bg-emerald-50',group: 'Team' },
  { val: 'team_activity',  label: '🎯 Internal Activity',      color: 'text-lime-600',   bg: 'bg-lime-50',   group: 'Team' },
  // 📢 Marketing
  { val: 'ads',            label: '📢 ค่าโฆษณา',              color: 'text-orange-600', bg: 'bg-orange-50', group: 'Marketing' },
  { val: 'marketing_ops',  label: '🛠️ Marketing Ops',          color: 'text-yellow-600', bg: 'bg-yellow-50', group: 'Marketing' },
  // 💼 เงินเดือน / ภาษี / อื่น
  { val: 'salary',         label: '👥 เงินเดือน',              color: 'text-indigo-600', bg: 'bg-indigo-50', group: 'HR' },
  { val: 'freelance',      label: '🎨 Freelance',              color: 'text-amber-600',  bg: 'bg-amber-50',  group: 'HR' },
  { val: 'tax',            label: '🏛️ ภาษี VAT/WHT',          color: 'text-red-600',    bg: 'bg-red-50',    group: 'Tax' },
  { val: 'petty_cash',     label: '💼 Petty Cash',             color: 'text-orange-600', bg: 'bg-orange-50', group: 'Other' },
  { val: 'other',          label: '📦 อื่นๆ',                  color: 'text-gray-600',   bg: 'bg-gray-50',   group: 'Other' },
]

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

const EMPTY_INCOME = { amount: '', sources: [] as string[], client_name: '', description: '', note: '', document_url: '', transaction_date: todayISO() }
const EMPTY_EXPENSE = { category: 'rent', amount: '', description: '', note: '', document_url: '', transaction_date: todayISO() }

export default function FinanceTab({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<'month' | 'year'>('month')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())
  const monthPickerRef = useRef<HTMLDivElement>(null)
  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    if (!showMonthPicker) return
    const handler = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMonthPicker])

  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [allIncomes, setAllIncomes] = useState<IncomeRecord[]>([])
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([])
  const [payslips, setPayslips] = useState<PayslipRecord[]>([])
  const [allPayslips, setAllPayslips] = useState<PayslipRecord[]>([])
  const [pastIncomes, setPastIncomes] = useState<IncomeRecord[]>([])
  const [pastExpenses, setPastExpenses] = useState<ExpenseRecord[]>([])
  const [pastPayslips, setPastPayslips] = useState<PayslipRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null)
  const [incomeForm, setIncomeForm] = useState({...EMPTY_INCOME})
  const [expenseForm, setExpenseForm] = useState({...EMPTY_EXPENSE})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState<'income' | 'expense' | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({...EMPTY_INCOME})
  const [editExpenseForm, setEditExpenseForm] = useState({...EMPTY_EXPENSE})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState<{ existing: ExpenseRecord[]; pending: typeof expenseForm } | null>(null)
  const [bankImportOpen, setBankImportOpen] = useState(false)
  const [bankImportText, setBankImportText] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState<string>('')
  const [aiUpdatedAt, setAiUpdatedAt] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [bankImportRows, setBankImportRows] = useState<{ txn: BankTxn; matches: LedgerRow[] }[]>([])
  const [bankImportAnalyzed, setBankImportAnalyzed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [incRes, expRes, allIncRes, allExpRes, payRes, allPayRes, pastIncRes, pastExpRes, pastPayRes] = await Promise.all([
        fetch(`/api/income-records?month=${month}&year=${year}`),
        fetch(`/api/expense-records?month=${month}&year=${year}`),
        fetch(`/api/income-records?year=${year}`),
        fetch(`/api/expense-records?year=${year}`),
        fetch(`/api/payslips?month=${month}&year=${year}`),
        fetch(`/api/payslips?year=${year}`),
        fetch(`/api/income-records`),
        fetch(`/api/expense-records`),
        fetch(`/api/payslips`),
      ])
      const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
      const [inc, exp, allInc, allExp, pays, allPays, pastInc, pastExp, pastPays] = await Promise.all([
        safeJson(incRes), safeJson(expRes), safeJson(allIncRes), safeJson(allExpRes), safeJson(payRes), safeJson(allPayRes),
        safeJson(pastIncRes), safeJson(pastExpRes), safeJson(pastPayRes)
      ])
      setIncomes(Array.isArray(inc) ? inc : [])
      setExpenses(Array.isArray(exp) ? exp : [])
      setAllIncomes(Array.isArray(allInc) ? allInc : [])
      setAllExpenses(Array.isArray(allExp) ? allExp : [])
      setPayslips(Array.isArray(pays) ? pays : [])
      setAllPayslips(Array.isArray(allPays) ? allPays : [])
      setPastIncomes(Array.isArray(pastInc) ? pastInc : [])
      setPastExpenses(Array.isArray(pastExp) ? pastExp : [])
      setPastPayslips(Array.isArray(pastPays) ? pastPays : [])
    } catch (err) {
      console.error('FinanceTab load error:', err)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Load cached AI analysis for this month/year
  useEffect(() => {
    setAiAnalysis('')
    setAiUpdatedAt(null)
    setAiOpen(false)
    fetch(`/api/ai-analysis-cache?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(d => {
        if (d?.analysis) { setAiAnalysis(d.analysis); setAiUpdatedAt(d.updated_at) }
      })
      .catch(() => {})
  }, [month, year])

  const totalIncome = incomes.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenseManual = expenses.reduce((s, r) => s + Number(r.amount), 0)
  const totalPayroll = payslips.reduce((s, p) => s + Number(p.net_pay), 0)
  const totalExpense = totalExpenseManual + totalPayroll
  const netProfit = totalIncome - totalExpense

  // ณ วันนี้ — รายการที่เกิดขึ้นจริงแล้ว (is_paid)
  const actualIncome = incomes.filter(r => r.is_paid).reduce((s, r) => s + Number(r.amount), 0)
  const actualExpenseManual = expenses.filter(r => r.is_paid).reduce((s, r) => s + Number(r.amount), 0)
  const actualPayroll = payslips.filter(p => p.is_paid).reduce((s, p) => s + Number(p.net_pay), 0)
  const actualExpense = actualExpenseManual + actualPayroll
  const actualProfit = actualIncome - actualExpense
  const actualIncomeCount = incomes.filter(r => r.is_paid).length
  const actualExpenseCount = expenses.filter(r => r.is_paid).length + payslips.filter(p => p.is_paid).length

  // ยอดยกมา — สะสมรายรับ-จ่ายที่เกิดขึ้นแล้วของเดือนก่อนหน้าทั้งหมด
  const isBeforeCurrentMonth = (m: number, y: number) => y < year || (y === year && m < month)
  const carryIncome = pastIncomes.filter(r => r.is_paid && isBeforeCurrentMonth(r.month, r.year)).reduce((s, r) => s + Number(r.amount), 0)
  const carryExpense = pastExpenses.filter(r => r.is_paid && isBeforeCurrentMonth(r.month, r.year)).reduce((s, r) => s + Number(r.amount), 0)
    + pastPayslips.filter(p => p.is_paid && isBeforeCurrentMonth(p.period_month, p.period_year)).reduce((s, p) => s + Number(p.net_pay), 0)
  const carryBalance = carryIncome - carryExpense
  const currentBalance = carryBalance + actualProfit

  // WHT tracking
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year
  const prevMonthWHT = pastPayslips
    .filter(p => p.period_month === prevMonth && p.period_year === prevYear)
    .reduce((s, p) => s + Number(p.withholding_tax), 0)
  const currentMonthWHT = payslips.reduce((s, p) => s + Number(p.withholding_tax), 0)
  const taxPaidThisMonth = expenses.filter(e => e.category === 'tax' && e.is_paid)
  const prevWHTSubmitted = prevMonthWHT > 0 &&
    taxPaidThisMonth.some(e => Math.abs(Number(e.amount) - prevMonthWHT) < 200)

  async function addIncome() {
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) {
      setFormError('กรุณาใส่ยอดเงิน')
      return
    }
    setFormError(null)
    try {
      const res = await fetch('/api/income-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...incomeForm, amount: Number(incomeForm.amount), month, year }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setFormError('บันทึกไม่สำเร็จ: ' + (e.error || res.status)); return }
      const created: IncomeRecord = await res.json()
      setIncomes(prev => [created, ...prev])
      setAllIncomes(prev => [created, ...prev])
      setIncomeForm({...EMPTY_INCOME, transaction_date: todayISO()})
      setShowForm(null); setFormError(null)
    } catch { setFormError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง') }
  }

  async function addExpense(force = false) {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      setFormError('กรุณาใส่ยอดเงิน')
      return
    }
    // Duplicate detection
    if (!force) {
      const amt = Number(expenseForm.amount)
      const desc = (expenseForm.description || '').toLowerCase().trim()
      const dups = expenses.filter(e => {
        const amtMatch = Math.abs(Number(e.amount) - amt) < 1
        const d2 = (e.description || '').toLowerCase().trim()
        const nameMatch = desc.length > 3 && d2.length > 3 &&
          (desc.slice(0, 12) === d2.slice(0, 12) || d2.includes(desc.slice(0, 8)) || desc.includes(d2.slice(0, 8)))
        return amtMatch && nameMatch
      })
      if (dups.length > 0) {
        setDupWarning({ existing: dups, pending: { ...expenseForm } })
        setShowForm(null)
        return
      }
    }
    setFormError(null)
    try {
      const res = await fetch('/api/expense-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount), month, year }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setFormError('บันทึกไม่สำเร็จ: ' + (e.error || res.status)); return }
      const created: ExpenseRecord = await res.json()
      setExpenses(prev => [created, ...prev])
      setAllExpenses(prev => [created, ...prev])
      setExpenseForm({...EMPTY_EXPENSE, transaction_date: todayISO()})
      setShowForm(null); setFormError(null)
    } catch { setFormError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง') }
  }

  async function confirmDupExpense() {
    if (!dupWarning) return
    const pendingForm = dupWarning.pending
    setDupWarning(null)
    try {
      const res = await fetch('/api/expense-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingForm, amount: Number(pendingForm.amount), month, year }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('บันทึกไม่สำเร็จ: ' + (e.error || res.status)); return }
      const created: ExpenseRecord = await res.json()
      setExpenses(prev => [created, ...prev])
      setAllExpenses(prev => [created, ...prev])
      setExpenseForm({...EMPTY_EXPENSE, transaction_date: todayISO()})
    } catch { alert('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง') }
  }

  function startEditIncome(r: IncomeRecord) {
    setEditingId(r.id); setEditType('income');
    setEditIncomeForm({ amount: r.amount.toString(), sources: Array.isArray(r.sources) ? r.sources : [], client_name: r.client_name || '', description: r.description || '', note: r.note || '', document_url: r.document_url || '', transaction_date: r.transaction_date || todayISO() })
  }

  async function saveIncome() {
    if (!editingId) return
    setSaving(true)
    try {
      const d = new Date(editIncomeForm.transaction_date + 'T00:00:00')
      const res = await fetch(`/api/income-records/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editIncomeForm, amount: Number(editIncomeForm.amount), month: d.getMonth()+1, year: d.getFullYear() }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('แก้ไขรายรับไม่สำเร็จ: ' + (e.error || res.status)); return }
      const updated: IncomeRecord = await res.json()
      const upsert = (prev: IncomeRecord[]) => prev.map(x => x.id === updated.id ? updated : x)
      setIncomes(upsert)
      setAllIncomes(upsert)
      setEditingId(null); setEditType(null)
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถแก้ไขรายรับได้') } finally { setSaving(false) }
  }

  function startEditExpense(r: ExpenseRecord) {
    setEditingId(r.id); setEditType('expense');
    setEditExpenseForm({ category: r.category, amount: r.amount.toString(), description: r.description || '', note: r.note || '', document_url: r.document_url || '', transaction_date: r.transaction_date || todayISO() })
  }

  async function saveExpense() {
    if (!editingId) return
    setSaving(true)
    try {
      const d = new Date(editExpenseForm.transaction_date + 'T00:00:00')
      const res = await fetch(`/api/expense-records/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editExpenseForm, amount: Number(editExpenseForm.amount), month: d.getMonth()+1, year: d.getFullYear() }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('แก้ไขรายจ่ายไม่สำเร็จ: ' + (e.error || res.status)); return }
      const updated: ExpenseRecord = await res.json()
      const upsert = (prev: ExpenseRecord[]) => prev.map(x => x.id === updated.id ? updated : x)
      setExpenses(upsert)
      setAllExpenses(upsert)
      setEditingId(null); setEditType(null)
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถแก้ไขรายจ่ายได้') } finally { setSaving(false) }
  }

  async function deleteIncome(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    setIncomes(prev => prev.filter(x => x.id !== id))
    setAllIncomes(prev => prev.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/income-records/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('ลบรายรับไม่สำเร็จ: ' + (e.error || res.status)); load(); return }
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถลบรายรับได้'); load() }
  }
  async function deleteExpense(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    setExpenses(prev => prev.filter(x => x.id !== id))
    setAllExpenses(prev => prev.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/expense-records/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('ลบรายจ่ายไม่สำเร็จ: ' + (e.error || res.status)); load(); return }
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถลบรายจ่ายได้'); load() }
  }

  async function togglePaidPayslip(p: PayslipRecord) {
    const nowPaid = !p.is_paid
    const name = p.employee?.name ?? p.guest_name ?? 'สลิปนี้'
    const msg = nowPaid
      ? `ยืนยันโอนเงินแล้ว?\n\n💸 ${name}\n฿${Number(p.net_pay).toLocaleString()}`
      : `ยืนยันเปลี่ยนกลับเป็น "รอจ่าย"?\n\n💸 ${name}`
    if (!confirm(msg)) return
    const today = new Date().toISOString().slice(0, 10)
    setPayslips(prev => prev.map(x => x.id === p.id ? { ...x, is_paid: nowPaid, transfer_date: nowPaid ? (x.transfer_date || today) : x.transfer_date } : x))
    await fetch(`/api/payslips/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: nowPaid, transfer_date: nowPaid ? (p.transfer_date || today) : undefined }),
    })
  }

  async function togglePaidIncome(r: IncomeRecord) {
    const nowPaid = !r.is_paid
    const label = [r.client_name, r.description].filter(Boolean).join(' – ') || 'รายรับนี้'
    const msg = nowPaid
      ? `ยืนยันรับเงินแล้ว?\n\n💰 ${label}\n฿${Number(r.amount).toLocaleString()}`
      : `ยืนยันเปลี่ยนกลับเป็น "รอรับ"?\n\n💰 ${label}`
    if (!confirm(msg)) return
    const today = new Date().toISOString().slice(0, 10)
    setIncomes(prev => prev.map(x => x.id === r.id ? { ...x, is_paid: nowPaid, paid_at: nowPaid ? today : null } : x))
    await fetch(`/api/income-records/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: nowPaid, paid_at: nowPaid ? today : null }),
    })
  }

  async function togglePaidExpense(r: ExpenseRecord) {
    const nowPaid = !r.is_paid
    const cat = catMeta(r.category).label
    const label = r.description || cat
    const msg = nowPaid
      ? `ยืนยันจ่ายเงินแล้ว?\n\n💸 ${label}\n฿${Number(r.amount).toLocaleString()}`
      : `ยืนยันเปลี่ยนกลับเป็น "รอจ่าย"?\n\n💸 ${label}`
    if (!confirm(msg)) return
    const today = new Date().toISOString().slice(0, 10)
    setExpenses(prev => prev.map(x => x.id === r.id ? { ...x, is_paid: nowPaid, paid_at: nowPaid ? today : null } : x))
    await fetch(`/api/expense-records/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: nowPaid, paid_at: nowPaid ? today : null }),
    })
  }

  async function runAiAnalysis() {
    setAiLoading(true)
    setAiAnalysis('')
    setAiOpen(true)
    try {
      const expenseByCategory: Record<string, number> = {}
      for (const e of expenses) {
        const label = EXPENSE_CATEGORIES.find(c => c.val === e.category)?.label ?? e.category
        expenseByCategory[label] = (expenseByCategory[label] ?? 0) + Number(e.amount)
      }
      if (totalPayroll > 0) expenseByCategory['👥 เงินเดือน (payroll)'] = (expenseByCategory['👥 เงินเดือน (payroll)'] ?? 0) + totalPayroll

      const incomeBySource: Record<string, number> = {}
      for (const inc of incomes) {
        const srcs = inc.sources?.length ? inc.sources : ['other']
        for (const s of srcs) {
          const label = INCOME_SOURCES.find(x => x.val === s)?.label ?? s
          incomeBySource[label] = (incomeBySource[label] ?? 0) + Number(inc.amount) / srcs.length
        }
      }

      // WHT from employee payslips (ภ.ง.ด.1)
      const whtFromPayslips = payslips.reduce((s, p) => s + Number(p.withholding_tax), 0)
      // Year-to-date totals
      const yearToDateIncome = allIncomes.filter(r => r.year === year && r.month <= month).reduce((s, r) => s + Number(r.amount), 0)
      const yearToDateExpense = allExpenses.filter(r => r.year === year && r.month <= month).reduce((s, r) => s + Number(r.amount), 0)
        + allPayslips.filter(p => p.period_year === year && p.period_month <= month).reduce((s, p) => s + Number(p.net_pay), 0)
      const yearToDateProfit = yearToDateIncome - yearToDateExpense

      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month, year, monthName: MONTH_FULL[month - 1],
          totalIncome, totalExpense, netProfit,
          actualIncome, actualExpense, actualProfit,
          carryBalance, currentBalance,
          prevMonthWHT, currentMonthWHT, prevWHTSubmitted,
          expenseByCategory, incomeBySource, totalPayroll,
          whtFromPayslips, yearToDateIncome, yearToDateProfit,
        }),
      })
      if (!res.ok || !res.body) { setAiAnalysis('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); setAiLoading(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAiAnalysis(text)
      }
    } catch {
      setAiAnalysis('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setAiLoading(false)
    }
  }

  function navigate(dir: number) {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  function toggleSource(s: string, form: typeof editIncomeForm, setForm: (v: typeof editIncomeForm) => void) {
    setForm({ ...form, sources: form.sources.includes(s) ? form.sources.filter(x => x !== s) : [...form.sources, s] })
  }

  function sourceLabel(val: string) {
    return INCOME_SOURCES.find(s => s.val === val) ?? { label: val, color: 'bg-gray-100 text-gray-600 border-gray-200' }
  }
  function catMeta(val: string) {
    return EXPENSE_CATEGORIES.find(c => c.val === val) ?? { label: val, color: 'text-gray-600', bg: 'bg-gray-50' }
  }

  // Combined ledger rows sorted by date
  type LedgerRow =
    | { kind: 'income'; rec: IncomeRecord; sortKey: string }
    | { kind: 'expense'; rec: ExpenseRecord; sortKey: string }
    | { kind: 'payroll'; rec: PayslipRecord; sortKey: string }

  const ledger: LedgerRow[] = [
    ...incomes.map(r => ({ kind: 'income' as const, rec: r, sortKey: (r.transaction_date ?? r.created_at) + r.id })),
    ...expenses.map(r => ({ kind: 'expense' as const, rec: r, sortKey: (r.transaction_date ?? r.created_at) + r.id })),
    ...payslips.map(p => ({
      kind: 'payroll' as const, rec: p,
      sortKey: (p.transfer_date ?? `${p.period_year}-${String(p.period_month).padStart(2,'0')}-28`) + p.id
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  // Running balance
  let running = 0
  const ledgerWithBalance = ledger.map(row => {
    if (row.kind === 'income') running += Number(row.rec.amount)
    else if (row.kind === 'expense') running -= Number((row.rec as ExpenseRecord).amount)
    else running -= Number((row.rec as PayslipRecord).net_pay)
    return { ...row, balance: running }
  })

  function exportCSV() {
    const fmt = (n: number) => n === 0 ? '' : n.toLocaleString('th-TH')
    const rows: string[][] = [
      ['#', 'วันที่ทำรายการ', 'รายการ / ลูกค้า', 'ประเภท', 'หมวดหมู่', 'รายละเอียด / Breakdown', 'ยอดรับ (บาท)', 'ยอดจ่าย (บาท)', 'คงเหลือ (บาท)', 'สถานะ', 'วันที่รับ/จ่ายจริง', 'ลิงก์เอกสารประกอบ', 'สำเนาบัตรประชาชน', 'สำเนา Book Bank', 'ลิงก์เอกสารทำจ่าย', 'อีเมลใบ 50 ทวิ']
    ]
    ledgerWithBalance.forEach((row, idx) => {
      if (row.kind === 'payroll') {
        const p = row.rec as PayslipRecord
        const name = payslipName(p)
        const isFl = isPayslipFreelance(p)
        const type = isFl ? 'รายจ่าย' : 'รายจ่าย'
        const cat = isFl ? 'Freelance (สลิป)' : 'เงินเดือนพนักงาน (สลิป)'
        const gross = Number(p.base_salary||0) + Number(p.ot_amount||0) + Number(p.incentive||0) + Number(p.other_income||0)
        const deduct = Number(p.social_security||0) + Number(p.withholding_tax||0) + Number(p.other_deduction||0)
        const lines: string[] = []
        if (isFl) {
          // Freelance: ไม่ใช้คำว่า "เงินเดือน" — แจกแจงเป็นรายการงานแต่ละรายการ
          if (p.line_items?.length) {
            p.line_items.forEach(it => {
              const qty = it.quantity ? `${it.quantity.toLocaleString('th-TH')} ${it.unit || ''}`.trim() : ''
              const rate = it.rate ? ` x ${Number(it.rate).toLocaleString('th-TH')}` : ''
              lines.push(`${it.description || '(ไม่ระบุรายการ)'}${qty ? ` (${qty}${rate})` : ''} = ${Number(it.total).toLocaleString('th-TH')} บาท`)
            })
          } else if (Number(p.base_salary) > 0) {
            lines.push(`ค่าจ้าง ${Number(p.base_salary).toLocaleString('th-TH')} บาท`)
          }
        } else {
          // พนักงานประจำ: แจกแจงที่มาของเงินเดือนก้อนนี้
          if (Number(p.base_salary) > 0) lines.push(`เงินเดือน ${Number(p.base_salary).toLocaleString('th-TH')} บาท`)
          if (p.ot_items?.length) {
            p.ot_items.forEach(o => {
              lines.push(`OT ${o.date} ${o.start_time}-${o.end_time} (${o.hours} ชม. x ${Number(o.rate).toLocaleString('th-TH')}) = ${Number(o.amount).toLocaleString('th-TH')} บาท`)
            })
          } else if (Number(p.ot_amount) > 0) {
            lines.push(`OT ${Number(p.ot_amount).toLocaleString('th-TH')} บาท`)
          }
          if (p.incentive_items?.length) {
            p.incentive_items.forEach(it => {
              lines.push(`Incentive: ${it.description || '(ไม่ระบุ)'} = ${Number(it.amount).toLocaleString('th-TH')} บาท`)
            })
          } else if (Number(p.incentive) > 0) {
            lines.push(`Incentive${p.incentive_note ? ` (${p.incentive_note})` : ''} ${Number(p.incentive).toLocaleString('th-TH')} บาท`)
          }
        }
        if (Number(p.other_income) > 0) lines.push(`รายได้อื่นๆ${p.other_income_note ? ` (${p.other_income_note})` : ''} ${Number(p.other_income).toLocaleString('th-TH')} บาท`)
        if (gross > 0) lines.push(`รวมรายได้ ${gross.toLocaleString('th-TH')} บาท`)
        if (Number(p.social_security) > 0) lines.push(`หัก ปกส. ${Number(p.social_security).toLocaleString('th-TH')} บาท`)
        if (Number(p.withholding_tax) > 0) lines.push(`หัก ภาษีหัก ณ ที่จ่าย ${Number(p.withholding_tax).toLocaleString('th-TH')} บาท`)
        if (Number(p.other_deduction) > 0) lines.push(`หักอื่นๆ${p.other_deduction_note ? ` (${p.other_deduction_note})` : ''} ${Number(p.other_deduction).toLocaleString('th-TH')} บาท`)
        if (deduct > 0) lines.push(`รวมหัก ${deduct.toLocaleString('th-TH')} บาท`)
        lines.push(`ยอดสุทธิ ${Number(p.net_pay).toLocaleString('th-TH')} บาท`)
        const breakdown = lines.join('\n')
        const status = p.is_paid ? 'จ่ายแล้ว' : 'รอจ่าย'
        const paidDate = p.transfer_date ?? ''
        rows.push([String(idx+1), paidDate, name, type, cat, breakdown, '', fmt(Number(p.net_pay)), fmt(Number(row.balance)), status, paidDate, p.document_url ?? '', p.freelance_confirm_id_card_url ?? p.employee?.doc_id_card_url ?? '', p.freelance_confirm_bank_book_url ?? p.employee?.doc_bank_book_url ?? '', p.payment_doc_url ?? '', p.wht_cert_email ?? ''])

      } else if (row.kind === 'income') {
        const r = row.rec as IncomeRecord
        const sourcesLabel = r.sources?.length
          ? r.sources.map(s => INCOME_SOURCES.find(x => x.val === s)?.label.replace(/^[^\s]+\s/,'') ?? s).join(', ')
          : ''
        const detail = [sourcesLabel, r.description, r.note].filter(Boolean).join(' | ')
        const status = r.is_paid ? 'รับแล้ว' : 'รอรับ'
        const paidDate = r.paid_at ?? ''
        rows.push([String(idx+1), r.transaction_date ?? '',
          [r.client_name, r.description].filter(Boolean).join(' — '),
          'รายรับ', 'รายรับ', detail,
          fmt(Number(r.amount)), '', fmt(Number(row.balance)),
          status, paidDate, r.document_url ?? '', '', '', '', ''])

      } else {
        const r = row.rec as ExpenseRecord
        const detail = [r.description, r.note].filter(Boolean).join(' | ')
        const status = r.is_paid ? 'จ่ายแล้ว' : 'รอจ่าย'
        const paidDate = r.paid_at ?? ''
        rows.push([String(idx+1), r.transaction_date ?? '',
          r.description ?? '',
          'รายจ่าย', catMeta(r.category).label.replace(/^[^\s]+\s/,''),
          detail, '', fmt(Number(r.amount)), fmt(Number(row.balance)),
          status, paidDate, r.document_url ?? '', '', '', '', ''])
      }
    })

    // Summary row
    rows.push([])
    rows.push(['', '', '', '', '', 'รวมรายรับ', fmt(totalIncome), '', '', '', '', '', '', '', '', ''])
    rows.push(['', '', '', '', '', 'รวมรายจ่าย', '', fmt(totalExpense), '', '', '', '', '', '', '', ''])
    rows.push(['', '', '', '', '', 'กำไร / ขาดทุน', fmt(Math.max(0, netProfit)), fmt(Math.max(0, -netProfit)), '', '', '', '', '', '', '', ''])

    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `การเงิน_${MONTHS[month-1]}_${year+543}.csv`
    })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const yearlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const manualExp = allExpenses.filter(r => r.month === m).reduce((s, r) => s + Number(r.amount), 0)
    const payrollExp = allPayslips.filter(p => p.period_month === m).reduce((s, p) => s + Number(p.net_pay), 0)
    return {
      month: m,
      inc: allIncomes.filter(r => r.month === m).reduce((s, r) => s + Number(r.amount), 0),
      exp: manualExp + payrollExp,
      payroll: payrollExp,
      net: 0,
    }
  }).map(d => ({ ...d, net: d.inc - d.exp }))
  const yearTotal = { inc: yearlyData.reduce((s, r) => s + r.inc, 0), exp: yearlyData.reduce((s, r) => s + r.exp, 0) }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">💰 การเงิน</h2>
            <p className="text-xs text-gray-400 hidden sm:block">Peepz Team by Haus of Mumu</p>
          </div>
          {view === 'month' && (
            <div className="relative" ref={monthPickerRef}>
              <div className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-1">
                <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronLeft size={15} /></button>
                <button
                  onClick={() => { setPickerYear(year); setShowMonthPicker(p => !p) }}
                  className="text-sm font-semibold px-2 min-w-[120px] text-center text-orange-700 hover:bg-orange-50 rounded py-1.5 transition"
                >
                  {MONTH_FULL[month-1]} {year+543}
                </button>
                <button onClick={() => navigate(1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={15} /></button>
              </div>
              {/* Month Picker Dropdown */}
              {showMonthPicker && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white border border-orange-200 rounded-xl shadow-lg p-3 w-64">
                  {/* Year selector */}
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setPickerYear(y => y - 1)} className="p-1 hover:bg-orange-50 rounded text-orange-500"><ChevronLeft size={14}/></button>
                    <span className="text-sm font-bold text-gray-700">{pickerYear + 543}</span>
                    <button onClick={() => setPickerYear(y => y + 1)} className="p-1 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={14}/></button>
                  </div>
                  {/* Month grid */}
                  <div className="grid grid-cols-4 gap-1">
                    {MONTH_FULL.map((m, i) => {
                      const isSelected = (i + 1) === month && pickerYear === year
                      return (
                        <button
                          key={i}
                          onClick={() => { setMonth(i + 1); setYear(pickerYear); setShowMonthPicker(false) }}
                          className={`py-1.5 rounded-lg text-xs font-medium transition ${
                            isSelected
                              ? 'bg-orange-500 text-white'
                              : 'hover:bg-orange-50 text-gray-600 hover:text-orange-700'
                          }`}
                        >
                          {['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][i]}
                        </button>
                      )
                    })}
                  </div>
                  {/* Today shortcut */}
                  <button
                    onClick={() => { setMonth(now.getMonth()+1); setYear(now.getFullYear()); setShowMonthPicker(false) }}
                    className="mt-2 w-full text-xs text-orange-600 hover:bg-orange-50 py-1 rounded-lg transition font-medium"
                  >
                    📅 เดือนปัจจุบัน
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-orange-50 rounded-lg p-0.5 border border-orange-100">
            {(['month','year'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition ${view===v ? 'bg-white shadow-sm text-orange-700' : 'text-orange-400 hover:text-orange-600'}`}>
                {v === 'month' ? '📋 รายเดือน' : '📊 สรุปรายปี'}
              </button>
            ))}
          </div>
          {view === 'month' && (
            <>
              {!isReadOnly && (
                <>
                  <button onClick={() => { setShowForm(showForm === 'income' ? null : 'income'); setFormError(null) }}
                    className="flex items-center gap-1 bg-emerald-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-600 shadow-sm">
                    <Plus size={13} /> รายรับ
                  </button>
                  <button onClick={() => { setShowForm(showForm === 'expense' ? null : 'expense'); setFormError(null) }}
                    className="flex items-center gap-1 bg-rose-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-600 shadow-sm">
                    <Plus size={13} /> รายจ่าย
                  </button>
                </>
              )}
              <button onClick={() => setBankImportOpen(true)}
                className="flex items-center gap-1 border border-blue-300 text-blue-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50">
                <Upload size={13} /> <span className="hidden sm:inline">เทียบ</span>ธนาคาร
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1 border border-gray-300 text-gray-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
                <Download size={13} /> <span className="hidden sm:inline">Export </span>CSV
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      ) : view === 'year' ? (
        <YearView data={yearlyData} year={year} yearTotal={yearTotal}
          allIncomes={allIncomes} allExpenses={allExpenses} allPayslips={allPayslips}
          setYear={setYear} onClickMonth={(m) => { setMonth(m); setView('month') }} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white border border-emerald-200 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">รายรับ (ทั้งเดือน)</p>
                <p className="text-sm sm:text-xl font-bold text-emerald-600 truncate">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-gray-400 hidden sm:block">{incomes.length} รายการ</p>
                <div className="mt-1.5 pt-1.5 border-t border-emerald-50">
                  <p className="text-[10px] text-emerald-500 truncate">✅ ณ วันนี้ {formatCurrency(actualIncome)}</p>
                  <p className="text-xs text-gray-400 hidden sm:block">{actualIncomeCount} รายการรับแล้ว</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingDown size={16} className="text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">รายจ่าย (ทั้งเดือน)</p>
                <p className="text-sm sm:text-xl font-bold text-rose-600 truncate">{formatCurrency(totalExpense)}</p>
                <p className="text-xs text-gray-400 hidden sm:block">{expenses.length + payslips.length} รายการ</p>
                <div className="mt-1.5 pt-1.5 border-t border-rose-50">
                  <p className="text-[10px] text-rose-500 truncate">✅ ณ วันนี้ {formatCurrency(actualExpense)}</p>
                  <p className="text-xs text-gray-400 hidden sm:block">{actualExpenseCount} รายการจ่ายแล้ว</p>
                </div>
              </div>
            </div>
            <div className={`bg-white rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 border ${netProfit >= 0 ? 'border-indigo-200' : 'border-gray-200'}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${netProfit >= 0 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <Wallet size={16} className={netProfit >= 0 ? 'text-indigo-600' : 'text-gray-500'} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">กำไร/ขาดทุน (ทั้งเดือน)</p>
                <p className={`text-sm sm:text-xl font-bold truncate ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{formatCurrency(netProfit)}</p>
                <p className="text-xs text-gray-400 hidden sm:block">{netProfit >= 0 ? '✅ บวก' : '⚠️ ลบ'}</p>
                <div className="mt-1.5 pt-1.5 border-t border-indigo-50">
                  <p className={`text-[10px] truncate ${actualProfit >= 0 ? 'text-indigo-500' : 'text-red-400'}`}>✅ ณ วันนี้ {formatCurrency(actualProfit)}</p>
                  <p className="text-xs text-gray-400 hidden sm:block">{actualProfit >= 0 ? 'บวก' : 'ลบ'} จากรายการที่เกิดขึ้นแล้ว</p>
                </div>
              </div>
            </div>
            <div className={`bg-white rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 border ${currentBalance >= 0 ? 'border-violet-200' : 'border-gray-200'}`}>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${currentBalance >= 0 ? 'bg-violet-100' : 'bg-gray-100'}`}>
                <Wallet size={16} className={currentBalance >= 0 ? 'text-violet-600' : 'text-gray-500'} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">ยอดเงินคงเหลือ</p>
                <p className={`text-sm sm:text-xl font-bold truncate ${currentBalance >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{formatCurrency(currentBalance)}</p>
                <p className="text-xs text-gray-400 hidden sm:block">ยกมา {formatCurrency(carryBalance)}</p>
                <div className="mt-1.5 pt-1.5 border-t border-violet-50">
                  <p className="text-[10px] text-violet-500 truncate">+ ณ วันนี้เดือนนี้ {formatCurrency(actualProfit)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* WHT Tracker — compact inline strip */}
          {(prevMonthWHT > 0 || currentMonthWHT > 0) && (
            <div className="flex flex-wrap gap-2">
              {prevMonthWHT > 0 && (
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border ${prevWHTSubmitted ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {prevWHTSubmitted
                    ? <><ShieldCheck size={12} /> WHT {MONTHS[prevMonth-1]} {formatCurrency(prevMonthWHT)} — นำส่งแล้ว</>
                    : <><AlertTriangle size={12} /> WHT {MONTHS[prevMonth-1]} {formatCurrency(prevMonthWHT)} — ยังไม่ส่ง (ครบ 7 {MONTH_FULL[month-1]})</>
                  }
                </div>
              )}
              {currentMonthWHT > 0 && (
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border bg-amber-50 border-amber-200 text-amber-700">
                  🏛️ WHT {MONTHS[month-1]} {formatCurrency(currentMonthWHT)} — ส่งเดือนหน้า (7 {MONTH_FULL[nextMonth-1]})
                </div>
              )}
            </div>
          )}

          {/* AI Tax & Finance Summary — auto-updated 1st, 15th, last day of month */}
          {aiAnalysis ? (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-indigo-700">🧮 สรุปภาษีและการเงิน โดย AI CFO</p>
                  {aiUpdatedAt && (
                    <p className="text-[10px] text-indigo-400 mt-0.5">
                      อัปเดตล่าสุด: {new Date(aiUpdatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setAiOpen(o => !o)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors shrink-0"
                >
                  {aiOpen ? '▲ ซ่อน' : '▼ ดูรายละเอียด'}
                </button>
              </div>
              {aiOpen && (
                <div className="mt-3 pt-3 border-t border-indigo-200">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                </div>
              )}
            </div>
          ) : null}

          {/* Duplicate expense warning */}
          {dupWarning && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-yellow-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-800 text-sm">พบรายการที่อาจซ้ำกัน</p>
                  <p className="text-xs text-yellow-700 mt-0.5">มีรายการยอดและชื่อใกล้เคียงกันอยู่แล้วในเดือนนี้:</p>
                  <div className="mt-2 space-y-1">
                    {dupWarning.existing.map(e => (
                      <div key={e.id} className="bg-white rounded-lg px-3 py-2 border border-yellow-200 text-xs flex items-center gap-3">
                        <span className="font-medium text-gray-700">{e.description || '(ไม่มีชื่อ)'}</span>
                        <span className="text-rose-600 font-semibold">{formatCurrency(Number(e.amount))}</span>
                        {e.transaction_date && <span className="text-gray-400">{formatDateShort(e.transaction_date)}</span>}
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${e.is_paid ? 'bg-green-100 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                          {e.is_paid ? 'จ่ายแล้ว' : 'รอจ่าย'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={confirmDupExpense}
                      className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 font-medium">
                      ✅ บันทึกต่อ (ตั้งใจเพิ่ม)
                    </button>
                    <button onClick={() => {
                      setExpenseForm({ ...dupWarning.pending })
                      setDupWarning(null)
                      setShowForm('expense')
                    }} className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                      ✏️ แก้ไขรายการ
                    </button>
                    <button onClick={() => setDupWarning(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add forms */}
          {showForm === 'income' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-emerald-800 text-sm">+ เพิ่มรายรับ</p>
                <button onClick={() => { setShowForm(null); setFormError(null) }}><X size={15} className="text-gray-400" /></button>
              </div>
              <IncomeFormFields form={incomeForm} setForm={setIncomeForm} toggleSource={(s) => toggleSource(s, incomeForm, setIncomeForm)} />
              {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {formError}</p>}
              <button onClick={addIncome} className="bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600">💾 บันทึกรายรับ</button>
            </div>
          )}
          {showForm === 'expense' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-rose-800 text-sm">+ เพิ่มรายจ่าย</p>
                <button onClick={() => { setShowForm(null); setFormError(null) }}><X size={15} className="text-gray-400" /></button>
              </div>
              <ExpenseFormFields form={expenseForm} setForm={setExpenseForm} />
              {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {formError}</p>}
              <button onClick={() => addExpense()} className="bg-rose-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-rose-600">💾 บันทึกรายจ่าย</button>
            </div>
          )}

          {/* Combined Ledger Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            {ledgerWithBalance.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-300 text-4xl mb-3">📒</p>
                <p className="text-gray-400 text-sm">ยังไม่มีรายการเดือนนี้</p>
                <p className="text-xs text-gray-400 mt-1">กดปุ่ม "รายรับ" หรือ "รายจ่าย" ด้านบนเพื่อเพิ่ม</p>
              </div>
            ) : (
              <table className="w-full text-sm" style={{minWidth:'640px'}}>
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 text-left w-20">วันที่</th>
                    <th className="px-4 py-3 text-left">รายการ / ลูกค้า</th>
                    <th className="px-4 py-3 text-left w-28 max-w-[7rem]">หมวด</th>
                    <th className="px-4 py-3 text-center w-28">สถานะ</th>
                    <th className="px-4 py-3 text-right w-32 text-emerald-600">ยอดรับ</th>
                    <th className="px-4 py-3 text-right w-32 text-rose-600">ยอดจ่าย</th>
                    <th className="px-4 py-3 text-right w-24 text-gray-400 font-normal text-xs normal-case tracking-normal">คงเหลือ</th>
                    <th className="px-2 py-3 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ledgerWithBalance.map((row, idx) => {
                    const isEditingThis = editingId === row.rec.id && editType === row.kind
                    if (isEditingThis) {
                      return (
                        <tr key={row.rec.id} className={`${row.kind === 'income' ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
                          <td colSpan={9} className="px-4 py-3">
                            {row.kind === 'income' ? (
                              <IncomeFormFields form={editIncomeForm} setForm={setEditIncomeForm}
                                toggleSource={(s) => toggleSource(s, editIncomeForm, setEditIncomeForm)} />
                            ) : (
                              <ExpenseFormFields form={editExpenseForm} setForm={setEditExpenseForm} />
                            )}
                            <div className="flex gap-2 mt-3">
                              <button onClick={row.kind === 'income' ? saveIncome : saveExpense} disabled={saving}
                                className="flex items-center gap-1 bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-600 disabled:opacity-60">
                                <Check size={12} /> {saving ? 'บันทึก...' : 'บันทึก'}
                              </button>
                              <button onClick={() => { setEditingId(null); setEditType(null) }}
                                className="flex items-center gap-1 border border-gray-300 px-4 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                                <X size={12} /> ยกเลิก
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    // Payroll row (read-only)
                    if (row.kind === 'payroll') {
                      const p = row.rec as PayslipRecord
                      const isFreelance = isPayslipFreelance(p)
                      const dateStr = p.transfer_date
                      const borderColor = isFreelance ? 'border-l-amber-400' : 'border-l-indigo-400'
                      const hoverBg = isFreelance ? 'hover:bg-amber-50/30' : 'hover:bg-indigo-50/20'
                      const badgeCls = isFreelance
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      const amtColor = isFreelance ? 'text-amber-600' : 'text-indigo-600'
                      return (
                        <tr key={p.id} className={`border-l-2 ${borderColor} ${hoverBg} group transition`}>
                          <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                            {dateStr ? formatDateShort(dateStr) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-gray-800 leading-tight">{p.employee?.name ?? p.guest_name ?? '—'}</p>
                              <UserBadge name={p.created_by} />
                            </div>
                            {p.document_url && (
                              <a href={p.document_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
                                📎 เอกสารประกอบ
                              </a>
                            )}
                            {/* เอกสารถาวรของพนักงาน */}
                            {(p.employee?.doc_id_card_url || p.employee?.doc_bank_book_url) && (
                              <div className="flex gap-2 mt-0.5 flex-wrap">
                                {p.employee?.doc_id_card_url && (
                                  <a href={p.employee.doc_id_card_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 hover:underline">
                                    🪪 บัตรประชาชน
                                  </a>
                                )}
                                {p.employee?.doc_bank_book_url && (
                                  <a href={p.employee.doc_bank_book_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 hover:underline">
                                    🏦 Book Bank
                                  </a>
                                )}
                              </div>
                            )}
                            {isFreelance ? (
                              // Freelance: แสดง line_items breakdown
                              <div className="mt-1 space-y-0.5">
                                {p.project_name && (
                                  <p className="text-xs text-amber-600 font-medium">📋 {p.project_name}</p>
                                )}
                                {(p.line_items && p.line_items.length > 0) ? (
                                  p.line_items.filter(li => li.total > 0).map((li, i) => (
                                    <p key={i} className="text-xs text-gray-500">
                                      • {li.description}{li.quantity > 1 ? ` ×${li.quantity} ${li.unit}` : ''} = <span className="text-amber-600 font-medium">{formatCurrency(li.total)}</span>
                                    </p>
                                  ))
                                ) : p.base_salary > 0 ? (
                                  <p className="text-xs text-gray-500">• ค่าบริการ <span className="text-amber-600 font-medium">{formatCurrency(p.base_salary)}</span></p>
                                ) : null}
                                {p.withholding_tax > 0 && (
                                  <p className="text-xs text-red-400">−ภาษีหัก ณ ที่จ่าย {formatCurrency(p.withholding_tax)}</p>
                                )}
                              </div>
                            ) : (
                              // พนักงานประจำ: badges เดิม
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.base_salary > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    เงินเดือน {formatCurrency(p.base_salary)}
                                  </span>
                                )}
                                {p.ot_amount > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                    OT {formatCurrency(p.ot_amount)}
                                  </span>
                                )}
                                {p.incentive > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                    Incentive {p.incentive_note ? `(${p.incentive_note}) ` : ''}{formatCurrency(p.incentive)}
                                  </span>
                                )}
                                {p.social_security > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                                    −ประกันสังคม {formatCurrency(p.social_security)}
                                  </span>
                                )}
                                {p.withholding_tax > 0 && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                                    −ภาษี {formatCurrency(p.withholding_tax)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 max-w-[7rem]">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap inline-block truncate max-w-full ${badgeCls}`}>
                              {isFreelance ? '🎨 Freelance' : '👤 พนักงานประจำ'}
                            </span>
                            <p className="text-xs text-gray-300 mt-0.5 whitespace-nowrap">จากสลิป</p>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => togglePaidPayslip(p)} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap cursor-pointer hover:opacity-75 transition-opacity ${
                              p.is_paid
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              {p.is_paid ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${amtColor}`}>
                            {formatCurrency(Number(p.net_pay))}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-xs whitespace-nowrap ${row.balance >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                            {formatCurrency(row.balance)}
                          </td>
                          <td className="px-2 py-2.5" />
                        </tr>
                      )
                    }

                    const isIncome = row.kind === 'income'
                    const irec = isIncome ? (row.rec as IncomeRecord) : null
                    const erec = !isIncome ? (row.rec as ExpenseRecord) : null
                    const dateStr = row.rec.transaction_date
                    return (
                      <tr key={row.rec.id} className={`hover:bg-gray-50/60 group transition ${isIncome ? 'border-l-2 border-l-emerald-200' : 'border-l-2 border-l-rose-200'}`}>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {dateStr ? formatDateShort(dateStr) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {irec && (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {irec.client_name && <p className="font-medium text-gray-800 leading-tight">{irec.client_name}</p>}
                                <UserBadge name={irec.created_by} />
                              </div>
                              {irec.description && <p className="text-xs text-gray-500">{irec.description}</p>}
                              {irec.note && <p className="text-xs text-gray-400 italic">{irec.note}</p>}
                              {irec.document_url && (
                                <a href={irec.document_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
                                  📎 เอกสารประกอบ
                                </a>
                              )}
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {(Array.isArray(irec.sources) ? irec.sources : []).map((s: string) => (
                                  <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full border ${sourceLabel(s).color}`}>{sourceLabel(s).label}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {erec && (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {erec.description && <p className="font-medium text-gray-800 leading-tight">{erec.description}</p>}
                                <UserBadge name={erec.created_by} />
                              </div>
                              {erec.note && <p className="text-xs text-gray-400 italic">{erec.note}</p>}
                              {erec.document_url && (
                                <a href={erec.document_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
                                  📎 เอกสารประกอบ
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-[7rem]">
                          {erec ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block truncate max-w-full ${catMeta(erec.category).bg} ${catMeta(erec.category).color}`}
                              title={catMeta(erec.category).label}>
                              {catMeta(erec.category).label}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">รายรับ</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {irec && (
                            <div className="flex flex-col items-center gap-0.5">
                              {isReadOnly ? (
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border whitespace-nowrap ${irec.is_paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                  {irec.is_paid ? '✅ รับแล้ว' : '⏳ รอรับ'}
                                </span>
                              ) : (
                                <button onClick={() => togglePaidIncome(irec)}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border transition whitespace-nowrap ${
                                    irec.is_paid
                                      ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                      : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                  }`}>
                                  {irec.is_paid ? '✅ รับแล้ว' : '⏳ รอรับ'}
                                </button>
                              )}
                              {irec.is_paid && irec.paid_at && (
                                <span className="text-[10px] text-gray-400">{formatDateShort(irec.paid_at)}</span>
                              )}
                            </div>
                          )}
                          {erec && (
                            <div className="flex flex-col items-center gap-0.5">
                              {isReadOnly ? (
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border whitespace-nowrap ${erec.is_paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                                  {erec.is_paid ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}
                                </span>
                              ) : (
                                <button onClick={() => togglePaidExpense(erec)}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border transition whitespace-nowrap ${
                                    erec.is_paid
                                      ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                      : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                  }`}>
                                  {erec.is_paid ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}
                                </button>
                              )}
                              {erec.is_paid && erec.paid_at && (
                                <span className="text-[10px] text-gray-400">{formatDateShort(erec.paid_at)}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          {isIncome ? formatCurrency(Number(row.rec.amount)) : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-600 whitespace-nowrap">
                          {!isIncome ? formatCurrency(Number(row.rec.amount)) : ''}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs whitespace-nowrap ${row.balance >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="px-2 py-2.5">
                          {!isReadOnly && (
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => isIncome ? startEditIncome(row.rec as IncomeRecord) : startEditExpense(row.rec as ExpenseRecord)}
                                className="text-gray-400 hover:text-indigo-600 p-1"><Pencil size={12} /></button>
                              <button onClick={() => isIncome ? deleteIncome(row.rec.id) : deleteExpense(row.rec.id)}
                                className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  {payslips.length > 0 && (() => {
                    const ftSlips = payslips.filter(p => !isPayslipFreelance(p))
                    const flSlips = payslips.filter(p => isPayslipFreelance(p))
                    const ftTotal = ftSlips.reduce((s, p) => s + Number(p.net_pay), 0)
                    const flTotal = flSlips.reduce((s, p) => s + Number(p.net_pay), 0)
                    return (
                      <>
                        {ftSlips.length > 0 && (
                          <tr className="bg-indigo-50/40 text-xs">
                            <td colSpan={4} className="px-4 py-1.5 text-indigo-600 font-medium">👤 พนักงานประจำ ({ftSlips.length} คน) — จากสลิป</td>
                            <td></td><td></td>
                            <td className="px-4 py-1.5 text-right font-semibold text-indigo-600">{formatCurrency(ftTotal)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                        {flSlips.length > 0 && (
                          <tr className="bg-amber-50/40 text-xs">
                            <td colSpan={4} className="px-4 py-1.5 text-amber-600 font-medium">🎨 Freelance ({flSlips.length} คน) — จากสลิป</td>
                            <td></td><td></td>
                            <td className="px-4 py-1.5 text-right font-semibold text-amber-600">{formatCurrency(flTotal)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                      </>
                    )
                  })()}
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td colSpan={4} className="px-4 py-3 text-gray-600">รวมทั้งหมด</td>
                    <td></td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(totalExpense)}</td>
                    <td className={`px-4 py-3 text-right text-xs ${netProfit >= 0 ? 'text-gray-400' : 'text-red-400'}`}>{formatCurrency(netProfit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {/* Bank Import Modal */}
      {bankImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-8 px-4" onClick={() => setBankImportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800">🏦 เทียบรายการธนาคาร (K-BIZ)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Paste CSV จาก K-BIZ แล้วกด "วิเคราะห์" เพื่อดูรายการที่หายไปจากระบบ</p>
              </div>
              <button onClick={() => setBankImportOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">วาง CSV จาก K-BIZ (Download → ไฟล์ CSV)</label>
                <textarea
                  value={bankImportText}
                  onChange={e => setBankImportText(e.target.value)}
                  placeholder="วางเนื้อหา CSV ที่นี่..."
                  className="w-full h-32 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <button
                onClick={() => {
                  const txns = parseKBankCSV(bankImportText)
                  const results = txns.map(txn => ({
                    txn,
                    matches: ledger.filter(row => {
                      const rowAmt = row.kind === 'income' ? Number((row.rec as IncomeRecord).amount) :
                                     row.kind === 'expense' ? Number((row.rec as ExpenseRecord).amount) :
                                     Number((row.rec as PayslipRecord).net_pay)
                      if (Math.abs(rowAmt - (txn.withdrawal > 0 ? txn.withdrawal : txn.deposit)) > 0.5) return false
                      if (txn.withdrawal > 0 && row.kind === 'income') return false
                      if (txn.deposit > 0 && row.kind !== 'income') return false
                      return true
                    }),
                  }))
                  setBankImportRows(results)
                  setBankImportAnalyzed(true)
                }}
                className="self-start flex items-center gap-1.5 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600"
              >
                <Upload size={14} /> วิเคราะห์
              </button>

              {bankImportAnalyzed && bankImportRows.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">ไม่พบรายการ</p>
                  <p className="text-xs mt-1 text-amber-700">ระบบอ่านรูปแบบข้อมูลไม่ได้ ลองวิธีนี้:<br />ใน K-BIZ → ดาวน์โหลด Statement → เลือก CSV → เปิดไฟล์ด้วย Notepad/TextEdit แล้ว copy ข้อความทั้งหมดมาวาง</p>
                </div>
              )}
              {bankImportRows.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600">{bankImportRows.length} รายการ</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600 font-medium">✅ ตรงกัน: {bankImportRows.filter(r => r.matches.length > 0).length}</span>
                      <span className="text-red-500 font-medium">❌ ไม่มีในระบบ: {bankImportRows.filter(r => r.matches.length === 0).length}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                    {bankImportRows.map((r, i) => {
                      const isExp = r.txn.withdrawal > 0
                      const amt = isExp ? r.txn.withdrawal : r.txn.deposit
                      const matched = r.matches.length > 0
                      return (
                        <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${matched ? 'bg-white' : 'bg-red-50'}`}>
                          <div className={`mt-0.5 shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${matched ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                            {matched ? '✓' : '!'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-400">{r.txn.date.slice(5).replace('-','/')}</span>
                              <span className={`text-sm font-semibold ${isExp ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isExp ? '-' : '+'}{formatCurrency(amt)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{r.txn.detail || '—'}</p>
                            {matched && (
                              <p className="text-xs text-green-600 mt-0.5">
                                ✅ {r.matches.map(m =>
                                  m.kind === 'income' ? (m.rec as IncomeRecord).client_name || (m.rec as IncomeRecord).description :
                                  m.kind === 'expense' ? (m.rec as ExpenseRecord).description :
                                  payslipName(m.rec as PayslipRecord)
                                ).join(', ')}
                              </p>
                            )}
                            {!matched && (
                              <p className="text-xs text-red-500 font-medium mt-0.5">⚠️ ไม่พบในระบบ — ต้องเพิ่มรายการ</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── KBank CSV Parser ─────────────────────────────────────────────────────────
interface BankTxn { date: string; withdrawal: number; deposit: number; detail: string }

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { fields.push(cur); cur = '' }
    else cur += c
  }
  fields.push(cur)
  return fields
}

function parseKBankCSV(text: string): BankTxn[] {
  const rows: BankTxn[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Try comma-separated (CSV download) first, then tab, then multi-space
    let cols: string[]
    if (line.includes(',') && line.includes('"')) {
      cols = parseCSVLine(line) // quoted CSV
    } else if (line.includes('\t')) {
      cols = line.split('\t').map(s => s.trim())
    } else if (line.includes(',')) {
      cols = parseCSVLine(line) // plain CSV
    } else {
      cols = line.split(/\s{2,}/).map(s => s.trim()) // web copy (multi-space)
    }

    // Find date (DD-MM-YY) — could be col[0] (web copy) or col[1] (CSV download)
    let dateIdx = -1
    let isoDate = ''
    for (let i = 0; i < Math.min(cols.length, 3); i++) {
      const c = (cols[i] || '').trim()
      if (/^\d{2}-\d{2}-\d{2}$/.test(c)) {
        dateIdx = i
        const [dd, mm, yy] = c.split('-').map(Number)
        isoDate = `20${String(yy).padStart(2,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
        break
      }
    }
    if (dateIdx < 0 || !isoDate) continue

    // CSV download format: date at col[1], withdrawal at col[4], deposit at col[5], detail at col[12]
    if (dateIdx === 1 && cols.length >= 7) {
      const withdrawal = parseFloat((cols[4] || '').replace(/,/g, '')) || 0
      const deposit = parseFloat((cols[5] || '').replace(/,/g, '')) || 0
      if (withdrawal === 0 && deposit === 0) continue
      const detail = (cols[12] || cols[7] || '').trim()
      rows.push({ date: isoDate, withdrawal, deposit, detail })
      continue
    }

    // Web copy format: date at col[0], cols = [date, time, description, amount, balance, channel?, detail?]
    if (dateIdx === 0 && cols.length >= 4) {
      const desc = (cols[2] || '').trim()
      const rawAmt = (cols[3] || '').trim()
      const hasNegative = rawAmt.startsWith('_') || rawAmt.startsWith('-')
      const amt = parseFloat(rawAmt.replace(/^[_-]/, '').replace(/,/g, '')) || 0
      if (amt === 0) continue

      const detail = cols.slice(5).join(' ').trim() || (cols[6] || '').trim() || desc
      // Determine direction from description keywords
      const depositKW = /รับ|ฝาก|ดอกเบี้ย|เข้า|income/i
      const withdrawKW = /โอนเงิน(?!เข้า)|ถอน|ภาษีหัก|transfer out/i
      const isDeposit = depositKW.test(desc) && !withdrawKW.test(desc) && !hasNegative
      const withdrawal = (!isDeposit || hasNegative) ? amt : 0
      const deposit = isDeposit && !hasNegative ? amt : 0
      if (withdrawal === 0 && deposit === 0) continue
      rows.push({ date: isoDate, withdrawal, deposit, detail })
    }
  }
  return rows
}

// ─── Form fields ──────────────────────────────────────────────────────────────
function IncomeFormFields({ form, setForm, toggleSource }: {
  form: { amount: string; sources: string[]; client_name: string; description: string; note: string; document_url: string; transaction_date: string }
  setForm: (v: typeof form) => void
  toggleSource: (s: string) => void
}) {
  const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400'
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">วันที่ *</label>
        <input type="date" value={form.transaction_date} onChange={e => setForm({...form, transaction_date: e.target.value})} className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ยอดเงิน (บาท) *</label>
        <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">ประเภทรายรับ</label>
        <div className="flex flex-wrap gap-1.5">
          {INCOME_SOURCES.map(s => (
            <button key={s.val} type="button" onClick={() => toggleSource(s.val)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${form.sources.includes(s.val) ? s.color + ' border-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อลูกค้า / งาน</label>
        <input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="เช่น Brand XYZ" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียด</label>
        <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="เช่น Live สด 3 ชม." className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
        <input value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="(ถ้ามี)" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">📎 ลิงก์เอกสารประกอบ</label>
        <input type="url" value={form.document_url} onChange={e => setForm({...form, document_url: e.target.value})}
          placeholder="https://drive.google.com/... หรือ Dropbox, OneDrive ฯลฯ" className={cls} />
        <p className="text-xs text-gray-400 mt-0.5">เช่น ใบแจ้งหนี้, Statement, เอกสารสัญญา</p>
      </div>
    </div>
  )
}

function ExpenseFormFields({ form, setForm }: {
  form: { category: string; amount: string; description: string; note: string; document_url: string; transaction_date: string }
  setForm: (v: typeof form) => void
}) {
  const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400'
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">วันที่ *</label>
        <input type="date" value={form.transaction_date} onChange={e => setForm({...form, transaction_date: e.target.value})} className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">หมวดหมู่ *</label>
        <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={cls}>
          {(['Office','Team','Marketing','HR','Tax','Other'] as const).map(grp => {
            const items = EXPENSE_CATEGORIES.filter(c => c.group === grp)
            if (!items.length) return null
            const grpLabel: Record<string,string> = { Office:'🏢 Office & System', Team:'🎉 Team & Culture', Marketing:'📢 Marketing', HR:'👥 เงินเดือน / HR', Tax:'🏛️ ภาษี', Other:'📦 อื่นๆ' }
            return (
              <optgroup key={grp} label={grpLabel[grp]}>
                {items.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
              </optgroup>
            )
          })}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ยอดเงิน (บาท) *</label>
        <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียด</label>
        <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="เช่น ค่าเช่าออฟฟิศ" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
        <input value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="(ถ้ามี)" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">📎 ลิงก์เอกสารประกอบ</label>
        <input type="url" value={form.document_url} onChange={e => setForm({...form, document_url: e.target.value})}
          placeholder="https://drive.google.com/... หรือ Dropbox, OneDrive ฯลฯ" className={cls} />
        <p className="text-xs text-gray-400 mt-0.5">เช่น ใบแจ้งหนี้, สำเนาบัตรประชาชน, Book Bank Freelance</p>
      </div>
    </div>
  )
}

// ─── Year Charts ──────────────────────────────────────────────────────────────
const INC_COLORS: Record<string, string> = {
  live: '#f97316', influencer: '#a855f7', content: '#3b82f6',
  ads: '#eab308', seeding: '#22c55e', event: '#ec4899', other: '#9ca3af',
}
const EXP_COLORS: Record<string, string> = {
  Office: '#0891b2', Team: '#f472b6', Marketing: '#f97316',
  HR: '#6366f1', Tax: '#ef4444', Other: '#9ca3af',
}

function DonutChart({ slices, size = 130 }: {
  slices: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <div className="text-xs text-gray-400 text-center py-8">ไม่มีข้อมูล</div>
  const cx = size / 2, cy = size / 2, r = size * 0.40, ir = size * 0.24
  let angle = -Math.PI / 2
  const paths = slices.map(sl => {
    const a = (sl.value / total) * 2 * Math.PI
    const sa = angle, ea = angle + a
    angle = ea
    const large = a > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa)
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea)
    const ix1 = cx + ir * Math.cos(sa), iy1 = cy + ir * Math.sin(sa)
    const ix2 = cx + ir * Math.cos(ea), iy2 = cy + ir * Math.sin(ea)
    return { d: `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1}Z`, color: sl.color, pct: Math.round(sl.value / total * 100), label: sl.label }
  })
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={1.5} />)}
    </svg>
  )
}

function YearCharts({ data, incBySource, expByCat, totalPayrollYear }: {
  data: { month: number; inc: number; exp: number; net: number }[]
  incBySource: { val: string; label: string; total: number }[]
  expByCat: { val: string; label: string; group: string; total: number }[]
  totalPayrollYear: number
}) {
  const maxVal = Math.max(...data.map(d => Math.max(d.inc, d.exp)), 1)

  // Income donut slices
  const incSlices = incBySource.map(s => ({ label: s.label, value: s.total, color: INC_COLORS[s.val] ?? '#9ca3af' }))

  // Expense donut slices — group by category group + payroll
  const expGroupMap: Record<string, number> = {}
  for (const cat of expByCat) {
    const g = cat.group ?? 'Other'
    expGroupMap[g] = (expGroupMap[g] ?? 0) + cat.total
  }
  if (totalPayrollYear > 0) expGroupMap['HR'] = (expGroupMap['HR'] ?? 0) + totalPayrollYear
  const expSlices = Object.entries(expGroupMap).sort(([,a],[,b]) => b - a)
    .map(([g, v]) => ({ label: g === 'Office' ? '🏢 Office' : g === 'Team' ? '🎉 Team' : g === 'Marketing' ? '📢 Marketing' : g === 'HR' ? '👥 HR/เงินเดือน' : g === 'Tax' ? '🏛️ ภาษี' : '📦 อื่นๆ', value: v, color: EXP_COLORS[g] ?? '#9ca3af' }))

  const fmt = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)

  return (
    <div className="space-y-3">
      {/* Bar chart — monthly income vs expense */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600">รายรับ vs รายจ่าย รายเดือน</p>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> รายรับ</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> รายจ่าย</span>
          </div>
        </div>
        <div className="flex items-end gap-1" style={{ height: 120 }}>
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              <div className="w-full flex gap-[2px] items-end" style={{ height: 100 }}>
                <div className="flex-1 bg-emerald-400 rounded-t-sm min-h-[1px] transition-all"
                  style={{ height: `${Math.max((d.inc / maxVal) * 100, d.inc > 0 ? 1 : 0)}%` }} />
                <div className="flex-1 bg-rose-400 rounded-t-sm min-h-[1px] transition-all"
                  style={{ height: `${Math.max((d.exp / maxVal) * 100, d.exp > 0 ? 1 : 0)}%` }} />
              </div>
              <span className="text-[8px] text-gray-400 truncate w-full text-center">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
        {/* Net profit line indicators */}
        <div className="flex gap-1 mt-2">
          {data.map((d, i) => (
            <div key={i} className="flex-1 min-w-0">
              <div className={`h-0.5 rounded-full ${d.net > 0 ? 'bg-indigo-400' : d.net < 0 ? 'bg-red-400' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 mt-1">— สีม่วง = กำไร / สีแดง = ขาดทุน</p>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-2 gap-3">
        {/* Income by source */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">รายรับแยกประเภท</p>
          <div className="flex gap-3 items-start">
            <DonutChart slices={incSlices} size={110} />
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {incSlices.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[10px] text-gray-600 truncate flex-1">{s.label}</span>
                  <span className="text-[10px] font-semibold text-gray-700 shrink-0">{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense by group */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">รายจ่ายแยกหมวด</p>
          <div className="flex gap-3 items-start">
            <DonutChart slices={expSlices} size={110} />
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {expSlices.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[10px] text-gray-600 truncate flex-1">{s.label}</span>
                  <span className="text-[10px] font-semibold text-gray-700 shrink-0">{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Yearly P&L View ─────────────────────────────────────────────────────────
function YearView({ data, year, yearTotal, allIncomes, allExpenses, allPayslips, setYear, onClickMonth }: {
  data: { month: number; inc: number; exp: number; payroll: number; net: number }[]
  year: number
  yearTotal: { inc: number; exp: number }
  allIncomes: IncomeRecord[]
  allExpenses: ExpenseRecord[]
  allPayslips: PayslipRecord[]
  setYear: (y: number) => void
  onClickMonth: (m: number) => void
}) {
  // Payroll by month — split by type
  const fulltimeByMonth = Array.from({ length: 12 }, (_, i) =>
    allPayslips.filter(p => p.period_month === i+1 && !isPayslipFreelance(p)).reduce((s, p) => s + Number(p.net_pay), 0)
  )
  const freelanceByMonth = Array.from({ length: 12 }, (_, i) =>
    allPayslips.filter(p => p.period_month === i+1 && isPayslipFreelance(p)).reduce((s, p) => s + Number(p.net_pay), 0)
  )
  const totalFtYear = fulltimeByMonth.reduce((s, v) => s + v, 0)
  const totalFlYear = freelanceByMonth.reduce((s, v) => s + v, 0)
  const totalPayrollYear = totalFtYear + totalFlYear
  // Income by source × month
  const incBySource = INCOME_SOURCES.map(src => ({
    ...src,
    monthly: Array.from({ length: 12 }, (_, i) =>
      allIncomes.filter(r => r.month === i+1 && (Array.isArray(r.sources) ? r.sources.includes(src.val) : false))
        .reduce((s, r) => s + Number(r.amount), 0)
    ),
    total: allIncomes.filter(r => Array.isArray(r.sources) && r.sources.includes(src.val))
      .reduce((s, r) => s + Number(r.amount), 0),
  })).filter(src => src.total > 0)

  // Expense by category × month
  const expByCat = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    monthly: Array.from({ length: 12 }, (_, i) =>
      allExpenses.filter(r => r.month === i+1 && r.category === cat.val)
        .reduce((s, r) => s + Number(r.amount), 0)
    ),
    total: allExpenses.filter(r => r.category === cat.val)
      .reduce((s, r) => s + Number(r.amount), 0),
  })).filter(cat => cat.total > 0)

  const fmt = (v: number) => v === 0 ? '—' : formatCurrency(v)

  return (
    <div className="space-y-4">
      {/* Year nav + summary */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">สรุปรายปี {year + 543}</h3>
        <div className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-1">
          <button onClick={() => setYear(year - 1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold px-2 text-orange-700">{year + 543}</span>
          <button onClick={() => setYear(year + 1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-600 mb-1">รายรับรวมปี</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(yearTotal.inc)}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
          <p className="text-xs text-rose-600 mb-1">รายจ่ายรวมปี</p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(yearTotal.exp)}</p>
        </div>
        <div className={`${yearTotal.inc-yearTotal.exp >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'} border rounded-xl p-4 text-center`}>
          <p className={`text-xs mb-1 ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-indigo-600' : 'text-gray-500'}`}>กำไร / ขาดทุนรวมปี</p>
          <p className={`text-2xl font-bold ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{formatCurrency(yearTotal.inc-yearTotal.exp)}</p>
        </div>
      </div>

      {/* Charts */}
      <YearCharts data={data} incBySource={incBySource} expByCat={expByCat} totalPayrollYear={totalPayrollYear} />

      {/* P&L Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-auto">
        <table className="text-xs w-full border-collapse" style={{minWidth:'900px'}}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 border-r border-gray-200 min-w-[160px]">รายการ</th>
              {MONTHS.map((m, i) => (
                <th key={i} onClick={() => onClickMonth(i+1)}
                  className="px-3 py-3 text-center font-semibold text-gray-500 cursor-pointer hover:text-orange-600 hover:bg-orange-50 transition min-w-[80px]">
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-bold text-gray-700 min-w-[90px]">รวม</th>
            </tr>
          </thead>
          <tbody>
            {/* ── Income section ── */}
            <tr className="bg-emerald-50 border-y border-emerald-100">
              <td colSpan={14} className="sticky left-0 px-4 py-2 font-bold text-emerald-700 text-xs uppercase tracking-wide">💵 รายรับ</td>
            </tr>
            {incBySource.map(src => (
              <tr key={src.val} className="hover:bg-emerald-50/30 border-b border-gray-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 text-gray-700 font-medium border-r border-gray-100">{src.label}</td>
                {src.monthly.map((v, i) => (
                  <td key={i} className={`px-3 py-2.5 text-right ${v > 0 ? 'text-emerald-600 font-medium' : 'text-gray-300'}`}>{fmt(v)}</td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{formatCurrency(src.total)}</td>
              </tr>
            ))}
            {/* Income total row */}
            <tr className="bg-emerald-50 border-y border-emerald-200 font-bold">
              <td className="sticky left-0 bg-emerald-50 px-4 py-2.5 text-emerald-700 border-r border-emerald-200">รวมรายรับ</td>
              {data.map((d, i) => (
                <td key={i} className={`px-3 py-2.5 text-right ${d.inc > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>{fmt(d.inc)}</td>
              ))}
              <td className="px-4 py-2.5 text-right text-emerald-700">{formatCurrency(yearTotal.inc)}</td>
            </tr>

            {/* ── Expense section ── */}
            <tr className="bg-rose-50 border-y border-rose-100">
              <td colSpan={14} className="sticky left-0 px-4 py-2 font-bold text-rose-700 text-xs uppercase tracking-wide">💸 รายจ่าย</td>
            </tr>
            {expByCat.map(cat => (
              <tr key={cat.val} className="hover:bg-rose-50/30 border-b border-gray-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 border-r border-gray-100">
                  <span className={`font-medium ${cat.color}`}>{cat.label}</span>
                </td>
                {cat.monthly.map((v, i) => (
                  <td key={i} className={`px-3 py-2.5 text-right ${v > 0 ? 'text-rose-600 font-medium' : 'text-gray-300'}`}>{fmt(v)}</td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold text-rose-600">{formatCurrency(cat.total)}</td>
              </tr>
            ))}
            {/* Payroll auto rows — split by type */}
            {totalFtYear > 0 && (
              <tr className="hover:bg-indigo-50/30 border-b border-gray-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 border-r border-gray-100">
                  <span className="font-medium text-indigo-600">👤 พนักงานประจำ (สลิป)</span>
                  <span className="text-xs text-gray-400 ml-1">auto</span>
                </td>
                {fulltimeByMonth.map((v, i) => (
                  <td key={i} className={`px-3 py-2.5 text-right ${v > 0 ? 'text-indigo-600 font-medium' : 'text-gray-300'}`}>{fmt(v)}</td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold text-indigo-600">{formatCurrency(totalFtYear)}</td>
              </tr>
            )}
            {totalFlYear > 0 && (
              <tr className="hover:bg-amber-50/30 border-b border-gray-50">
                <td className="sticky left-0 bg-white px-4 py-2.5 border-r border-gray-100">
                  <span className="font-medium text-amber-600">🎨 Freelance (สลิป)</span>
                  <span className="text-xs text-gray-400 ml-1">auto</span>
                </td>
                {freelanceByMonth.map((v, i) => (
                  <td key={i} className={`px-3 py-2.5 text-right ${v > 0 ? 'text-amber-600 font-medium' : 'text-gray-300'}`}>{fmt(v)}</td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold text-amber-600">{formatCurrency(totalFlYear)}</td>
              </tr>
            )}

            {/* Expense total row */}
            <tr className="bg-rose-50 border-y border-rose-200 font-bold">
              <td className="sticky left-0 bg-rose-50 px-4 py-2.5 text-rose-700 border-r border-rose-200">รวมรายจ่าย</td>
              {data.map((d, i) => (
                <td key={i} className={`px-3 py-2.5 text-right ${d.exp > 0 ? 'text-rose-700' : 'text-gray-300'}`}>{fmt(d.exp)}</td>
              ))}
              <td className="px-4 py-2.5 text-right text-rose-700">{formatCurrency(yearTotal.exp)}</td>
            </tr>

            {/* ── Net row ── */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="sticky left-0 bg-gray-50 px-4 py-3 text-gray-800 border-r border-gray-200">กำไร / ขาดทุน</td>
              {data.map((d, i) => (
                <td key={i} className={`px-3 py-3 text-right ${d.net > 0 ? 'text-indigo-600' : d.net < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                  {d.inc > 0 || d.exp > 0 ? fmt(d.net) : '—'}
                </td>
              ))}
              <td className={`px-4 py-3 text-right text-base ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                {formatCurrency(yearTotal.inc - yearTotal.exp)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
