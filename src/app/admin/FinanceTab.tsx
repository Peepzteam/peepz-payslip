'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, X, Pencil, Check } from 'lucide-react'

interface IncomeRecord {
  id: string; month: number; year: number
  amount: number; sources: string[]
  client_name: string | null; description: string | null; note: string | null
  transaction_date: string | null
  created_at: string
}
interface ExpenseRecord {
  id: string; month: number; year: number
  category: string; amount: number
  description: string | null; note: string | null
  transaction_date: string | null
  created_at: string
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
  transfer_date: string | null
  employee: { id: string; name: string; employee_code: string; type: string } | null
}

const INCOME_SOURCES = [
  { val: 'live',    label: '📺 Live',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { val: 'event',   label: '🎪 Event',    color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { val: 'content', label: '📝 Content',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { val: 'ads',     label: '📢 Ads',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { val: 'review',  label: '⭐ Review',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { val: 'other',   label: '🔧 อื่นๆ',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

const EXPENSE_CATEGORIES = [
  { val: 'salary',     label: '👥 เงินเดือน',         color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { val: 'freelance',  label: '🎨 Freelance',          color: 'text-amber-600',  bg: 'bg-amber-50' },
  { val: 'petty_cash', label: '💼 Petty Cash',         color: 'text-orange-600', bg: 'bg-orange-50' },
  { val: 'tax',        label: '🏛️ ภาษี',              color: 'text-red-600',    bg: 'bg-red-50' },
  { val: 'rent',       label: '🏠 ค่าเช่า',            color: 'text-teal-600',   bg: 'bg-teal-50' },
  { val: 'utilities',  label: '⚡ สาธารณูปโภค',        color: 'text-cyan-600',   bg: 'bg-cyan-50' },
  { val: 'software',   label: '💻 Software',           color: 'text-violet-600', bg: 'bg-violet-50' },
  { val: 'other',      label: '📦 อื่นๆ',             color: 'text-gray-600',   bg: 'bg-gray-50' },
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

const EMPTY_INCOME = { amount: '', sources: [] as string[], client_name: '', description: '', note: '', transaction_date: todayISO() }
const EMPTY_EXPENSE = { category: 'petty_cash', amount: '', description: '', note: '', transaction_date: todayISO() }

export default function FinanceTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [view, setView] = useState<'month' | 'year'>('month')

  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [allIncomes, setAllIncomes] = useState<IncomeRecord[]>([])
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([])
  const [payslips, setPayslips] = useState<PayslipRecord[]>([])
  const [allPayslips, setAllPayslips] = useState<PayslipRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState<'income' | 'expense' | null>(null)
  const [incomeForm, setIncomeForm] = useState({...EMPTY_INCOME})
  const [expenseForm, setExpenseForm] = useState({...EMPTY_EXPENSE})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState<'income' | 'expense' | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({...EMPTY_INCOME})
  const [editExpenseForm, setEditExpenseForm] = useState({...EMPTY_EXPENSE})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [incRes, expRes, allIncRes, allExpRes, payRes, allPayRes] = await Promise.all([
        fetch(`/api/income-records?month=${month}&year=${year}`),
        fetch(`/api/expense-records?month=${month}&year=${year}`),
        fetch(`/api/income-records?year=${year}`),
        fetch(`/api/expense-records?year=${year}`),
        fetch(`/api/payslips?month=${month}&year=${year}`),
        fetch(`/api/payslips?year=${year}`),
      ])
      const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
      const [inc, exp, allInc, allExp, pays, allPays] = await Promise.all([
        safeJson(incRes), safeJson(expRes), safeJson(allIncRes), safeJson(allExpRes), safeJson(payRes), safeJson(allPayRes)
      ])
      setIncomes(Array.isArray(inc) ? inc : [])
      setExpenses(Array.isArray(exp) ? exp : [])
      setAllIncomes(Array.isArray(allInc) ? allInc : [])
      setAllExpenses(Array.isArray(allExp) ? allExp : [])
      setPayslips(Array.isArray(pays) ? pays : [])
      setAllPayslips(Array.isArray(allPays) ? allPays : [])
    } catch (err) {
      console.error('FinanceTab load error:', err)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { load() }, [load])

  const totalIncome = incomes.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenseManual = expenses.reduce((s, r) => s + Number(r.amount), 0)
  const totalPayroll = payslips.reduce((s, p) => s + Number(p.net_pay), 0)
  const totalExpense = totalExpenseManual + totalPayroll
  const netProfit = totalIncome - totalExpense

  async function addIncome() {
    if (!incomeForm.amount) return
    try {
      const res = await fetch('/api/income-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...incomeForm, amount: Number(incomeForm.amount), month, year }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('บันทึกรายรับไม่สำเร็จ: ' + (e.error || res.status)); return }
      setIncomeForm({...EMPTY_INCOME, transaction_date: todayISO()})
      setShowForm(null); load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถบันทึกรายรับได้') }
  }

  async function addExpense() {
    if (!expenseForm.amount) return
    try {
      const res = await fetch('/api/expense-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount), month, year }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('บันทึกรายจ่ายไม่สำเร็จ: ' + (e.error || res.status)); return }
      setExpenseForm({...EMPTY_EXPENSE, transaction_date: todayISO()})
      setShowForm(null); load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถบันทึกรายจ่ายได้') }
  }

  function startEditIncome(r: IncomeRecord) {
    setEditingId(r.id); setEditType('income');
    setEditIncomeForm({ amount: r.amount.toString(), sources: Array.isArray(r.sources) ? r.sources : [], client_name: r.client_name || '', description: r.description || '', note: r.note || '', transaction_date: r.transaction_date || todayISO() })
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
      setEditingId(null); setEditType(null); load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถแก้ไขรายรับได้') } finally { setSaving(false) }
  }

  function startEditExpense(r: ExpenseRecord) {
    setEditingId(r.id); setEditType('expense');
    setEditExpenseForm({ category: r.category, amount: r.amount.toString(), description: r.description || '', note: r.note || '', transaction_date: r.transaction_date || todayISO() })
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
      setEditingId(null); setEditType(null); load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถแก้ไขรายจ่ายได้') } finally { setSaving(false) }
  }

  async function deleteIncome(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try {
      const res = await fetch(`/api/income-records/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('ลบรายรับไม่สำเร็จ: ' + (e.error || res.status)); return }
      load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถลบรายรับได้') }
  }
  async function deleteExpense(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try {
      const res = await fetch(`/api/expense-records/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('ลบรายจ่ายไม่สำเร็จ: ' + (e.error || res.status)); return }
      load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถลบรายจ่ายได้') }
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">💰 การเงิน</h2>
            <p className="text-xs text-gray-400">Peepz Team by Haus of Mumu</p>
          </div>
          {view === 'month' && (
            <div className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-1">
              <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronLeft size={15} /></button>
              <span className="text-sm font-semibold px-2 min-w-[120px] text-center text-orange-700">{MONTH_FULL[month-1]} {year+543}</span>
              <button onClick={() => navigate(1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-orange-50 rounded-lg p-0.5 border border-orange-100">
            {(['month','year'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view===v ? 'bg-white shadow-sm text-orange-700' : 'text-orange-400 hover:text-orange-600'}`}>
                {v === 'month' ? '📋 รายเดือน' : '📊 สรุปรายปี'}
              </button>
            ))}
          </div>
          {view === 'month' && (
            <>
              <button onClick={() => setShowForm(showForm === 'income' ? null : 'income')}
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-600 shadow-sm">
                <Plus size={13} /> รายรับ
              </button>
              <button onClick={() => setShowForm(showForm === 'expense' ? null : 'expense')}
                className="flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-600 shadow-sm">
                <Plus size={13} /> รายจ่าย
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-orange-300 py-8">กำลังโหลด...</p>
      ) : view === 'year' ? (
        <YearView data={yearlyData} year={year} yearTotal={yearTotal}
          allIncomes={allIncomes} allExpenses={allExpenses} allPayslips={allPayslips}
          setYear={setYear} onClickMonth={(m) => { setMonth(m); setView('month') }} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">รายรับเดือนนี้</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-gray-400">{incomes.length} รายการ</p>
              </div>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingDown size={18} className="text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">รายจ่ายเดือนนี้</p>
                <p className="text-xl font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
                <p className="text-xs text-gray-400">{expenses.length + payslips.length} รายการ {payslips.length > 0 && <span className="text-indigo-400">(สลิป {payslips.length})</span>}</p>
              </div>
            </div>
            <div className={`bg-white rounded-xl p-4 flex items-center gap-3 border ${netProfit >= 0 ? 'border-indigo-200' : 'border-gray-200'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${netProfit >= 0 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <Wallet size={18} className={netProfit >= 0 ? 'text-indigo-600' : 'text-gray-500'} />
              </div>
              <div>
                <p className="text-xs text-gray-500">กำไร / ขาดทุน</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{formatCurrency(netProfit)}</p>
                <p className="text-xs text-gray-400">{netProfit >= 0 ? '✅ บวก' : '⚠️ ลบ'}</p>
              </div>
            </div>
          </div>

          {/* Add forms */}
          {showForm === 'income' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-emerald-800 text-sm">+ เพิ่มรายรับ</p>
                <button onClick={() => setShowForm(null)}><X size={15} className="text-gray-400" /></button>
              </div>
              <IncomeFormFields form={incomeForm} setForm={setIncomeForm} toggleSource={(s) => toggleSource(s, incomeForm, setIncomeForm)} />
              <button onClick={addIncome} className="bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600">💾 บันทึกรายรับ</button>
            </div>
          )}
          {showForm === 'expense' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-rose-800 text-sm">+ เพิ่มรายจ่าย</p>
                <button onClick={() => setShowForm(null)}><X size={15} className="text-gray-400" /></button>
              </div>
              <ExpenseFormFields form={expenseForm} setForm={setExpenseForm} />
              <button onClick={addExpense} className="bg-rose-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-rose-600">💾 บันทึกรายจ่าย</button>
            </div>
          )}

          {/* Combined Ledger Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {ledgerWithBalance.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-300 text-4xl mb-3">📒</p>
                <p className="text-gray-400 text-sm">ยังไม่มีรายการเดือนนี้</p>
                <p className="text-xs text-gray-400 mt-1">กดปุ่ม "รายรับ" หรือ "รายจ่าย" ด้านบนเพื่อเพิ่ม</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 text-left w-20">วันที่</th>
                    <th className="px-4 py-3 text-left">รายการ / ลูกค้า</th>
                    <th className="px-4 py-3 text-left w-32">หมวด</th>
                    <th className="px-4 py-3 text-right w-32 text-emerald-600">ยอดรับ</th>
                    <th className="px-4 py-3 text-right w-32 text-rose-600">ยอดจ่าย</th>
                    <th className="px-4 py-3 text-right w-32 text-indigo-600">คงเหลือ</th>
                    <th className="px-2 py-3 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ledgerWithBalance.map((row, idx) => {
                    const isEditingThis = editingId === row.rec.id && editType === row.kind
                    if (isEditingThis) {
                      return (
                        <tr key={row.rec.id} className={`${row.kind === 'income' ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
                          <td colSpan={8} className="px-4 py-3">
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
                      const isFreelance = p.employee?.type === 'freelance'
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
                            <p className="font-medium text-gray-800 leading-tight">{p.employee?.name ?? '—'}</p>
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
                                  Incentive {formatCurrency(p.incentive)}
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
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                              {isFreelance ? '🎨 Freelance' : '👤 พนักงานประจำ'}
                            </span>
                            <p className="text-xs text-gray-300 mt-0.5">จากสลิป</p>
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${amtColor}`}>
                            {formatCurrency(Number(p.net_pay))}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${row.balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
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
                              {irec.client_name && <p className="font-medium text-gray-800 leading-tight">{irec.client_name}</p>}
                              {irec.description && <p className="text-xs text-gray-500">{irec.description}</p>}
                              {irec.note && <p className="text-xs text-gray-400 italic">{irec.note}</p>}
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {(Array.isArray(irec.sources) ? irec.sources : []).map((s: string) => (
                                  <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full border ${sourceLabel(s).color}`}>{sourceLabel(s).label}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {erec && (
                            <div>
                              {erec.description && <p className="font-medium text-gray-800 leading-tight">{erec.description}</p>}
                              {erec.note && <p className="text-xs text-gray-400 italic">{erec.note}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {erec ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catMeta(erec.category).bg} ${catMeta(erec.category).color}`}>
                              {catMeta(erec.category).label}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">รายรับ</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          {isIncome ? formatCurrency(Number(row.rec.amount)) : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-600 whitespace-nowrap">
                          {!isIncome ? formatCurrency(Number(row.rec.amount)) : ''}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${row.balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => isIncome ? startEditIncome(row.rec as IncomeRecord) : startEditExpense(row.rec as ExpenseRecord)}
                              className="text-gray-400 hover:text-indigo-600 p-1"><Pencil size={12} /></button>
                            <button onClick={() => isIncome ? deleteIncome(row.rec.id) : deleteExpense(row.rec.id)}
                              className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  {payslips.length > 0 && (() => {
                    const ftSlips = payslips.filter(p => p.employee?.type !== 'freelance')
                    const flSlips = payslips.filter(p => p.employee?.type === 'freelance')
                    const ftTotal = ftSlips.reduce((s, p) => s + Number(p.net_pay), 0)
                    const flTotal = flSlips.reduce((s, p) => s + Number(p.net_pay), 0)
                    return (
                      <>
                        {ftSlips.length > 0 && (
                          <tr className="bg-indigo-50/40 text-xs">
                            <td colSpan={4} className="px-4 py-1.5 text-indigo-600 font-medium">👤 พนักงานประจำ ({ftSlips.length} คน) — จากสลิป</td>
                            <td></td>
                            <td className="px-4 py-1.5 text-right font-semibold text-indigo-600">{formatCurrency(ftTotal)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                        {flSlips.length > 0 && (
                          <tr className="bg-amber-50/40 text-xs">
                            <td colSpan={4} className="px-4 py-1.5 text-amber-600 font-medium">🎨 Freelance ({flSlips.length} คน) — จากสลิป</td>
                            <td></td>
                            <td className="px-4 py-1.5 text-right font-semibold text-amber-600">{formatCurrency(flTotal)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        )}
                      </>
                    )
                  })()}
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td colSpan={4} className="px-4 py-3 text-gray-600">รวมทั้งหมด</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(totalExpense)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>{formatCurrency(netProfit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Form fields ──────────────────────────────────────────────────────────────
function IncomeFormFields({ form, setForm, toggleSource }: {
  form: { amount: string; sources: string[]; client_name: string; description: string; note: string; transaction_date: string }
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
    </div>
  )
}

function ExpenseFormFields({ form, setForm }: {
  form: { category: string; amount: string; description: string; note: string; transaction_date: string }
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
          {EXPENSE_CATEGORIES.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
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
    allPayslips.filter(p => p.period_month === i+1 && p.employee?.type !== 'freelance').reduce((s, p) => s + Number(p.net_pay), 0)
  )
  const freelanceByMonth = Array.from({ length: 12 }, (_, i) =>
    allPayslips.filter(p => p.period_month === i+1 && p.employee?.type === 'freelance').reduce((s, p) => s + Number(p.net_pay), 0)
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
