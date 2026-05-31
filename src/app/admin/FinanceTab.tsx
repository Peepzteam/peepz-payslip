'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, X, Calendar, Pencil, Check } from 'lucide-react'

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

const INCOME_SOURCES = [
  { val: 'live',    label: '📺 Live',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { val: 'event',   label: '🎪 Event',    color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { val: 'content', label: '📝 Content',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { val: 'ads',     label: '📢 Ads',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { val: 'review',  label: '⭐ Review',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { val: 'other',   label: '🔧 อื่นๆ',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

const EXPENSE_CATEGORIES = [
  { val: 'salary',     label: '👥 เงินเดือนพนักงาน',   color: 'text-indigo-600' },
  { val: 'freelance',  label: '🎨 ค่าจ้าง Freelance',  color: 'text-amber-600' },
  { val: 'petty_cash', label: '💼 Petty Cash',          color: 'text-orange-600' },
  { val: 'tax',        label: '🏛️ ภาษี',               color: 'text-red-600' },
  { val: 'rent',       label: '🏠 ค่าเช่า',             color: 'text-teal-600' },
  { val: 'utilities',  label: '⚡ ค่าสาธารณูปโภค',     color: 'text-cyan-600' },
  { val: 'software',   label: '💻 Software/Tools',      color: 'text-violet-600' },
  { val: 'other',      label: '📦 อื่นๆ',              color: 'text-gray-600' },
]

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
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
  const [loading, setLoading] = useState(true)

  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [incomeForm, setIncomeForm] = useState({...EMPTY_INCOME})
  const [expenseForm, setExpenseForm] = useState({...EMPTY_EXPENSE})

  // Edit states
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({...EMPTY_INCOME})
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editExpenseForm, setEditExpenseForm] = useState({...EMPTY_EXPENSE})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [incRes, expRes, allIncRes, allExpRes] = await Promise.all([
      fetch(`/api/income-records?month=${month}&year=${year}`),
      fetch(`/api/expense-records?month=${month}&year=${year}`),
      fetch(`/api/income-records?year=${year}`),
      fetch(`/api/expense-records?year=${year}`),
    ])
    const [inc, exp, allInc, allExp] = await Promise.all([incRes.json(), expRes.json(), allIncRes.json(), allExpRes.json()])
    setIncomes(Array.isArray(inc) ? inc : [])
    setExpenses(Array.isArray(exp) ? exp : [])
    setAllIncomes(Array.isArray(allInc) ? allInc : [])
    setAllExpenses(Array.isArray(allExp) ? allExp : [])
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const totalIncome = incomes.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpense = expenses.reduce((s, r) => s + Number(r.amount), 0)
  const netProfit = totalIncome - totalExpense

  async function addIncome() {
    if (!incomeForm.amount) return
    await fetch('/api/income-records', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...incomeForm, amount: Number(incomeForm.amount), month, year }),
    })
    setIncomeForm({...EMPTY_INCOME, transaction_date: todayISO()})
    setShowIncomeForm(false); load()
  }

  async function addExpense() {
    if (!expenseForm.amount) return
    await fetch('/api/expense-records', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount), month, year }),
    })
    setExpenseForm({...EMPTY_EXPENSE, transaction_date: todayISO()})
    setShowExpenseForm(false); load()
  }

  function startEditIncome(r: IncomeRecord) {
    setEditingIncomeId(r.id)
    setEditingExpenseId(null)
    setEditIncomeForm({
      amount: r.amount.toString(),
      sources: Array.isArray(r.sources) ? r.sources : [],
      client_name: r.client_name || '',
      description: r.description || '',
      note: r.note || '',
      transaction_date: r.transaction_date || todayISO(),
    })
  }

  async function saveIncome() {
    if (!editingIncomeId) return
    setSaving(true)
    // derive month/year from transaction_date if changed
    const d = new Date(editIncomeForm.transaction_date)
    const newMonth = d.getMonth() + 1
    const newYear = d.getFullYear()
    await fetch(`/api/income-records/${editingIncomeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editIncomeForm,
        amount: Number(editIncomeForm.amount),
        month: newMonth,
        year: newYear,
      }),
    })
    setSaving(false); setEditingIncomeId(null); load()
  }

  function startEditExpense(r: ExpenseRecord) {
    setEditingExpenseId(r.id)
    setEditingIncomeId(null)
    setEditExpenseForm({
      category: r.category,
      amount: r.amount.toString(),
      description: r.description || '',
      note: r.note || '',
      transaction_date: r.transaction_date || todayISO(),
    })
  }

  async function saveExpense() {
    if (!editingExpenseId) return
    setSaving(true)
    const d = new Date(editExpenseForm.transaction_date)
    const newMonth = d.getMonth() + 1
    const newYear = d.getFullYear()
    await fetch(`/api/expense-records/${editingExpenseId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editExpenseForm,
        amount: Number(editExpenseForm.amount),
        month: newMonth,
        year: newYear,
      }),
    })
    setSaving(false); setEditingExpenseId(null); load()
  }

  async function deleteIncome(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    await fetch(`/api/income-records/${id}`, { method: 'DELETE' }); load()
  }
  async function deleteExpense(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    await fetch(`/api/expense-records/${id}`, { method: 'DELETE' }); load()
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
    return EXPENSE_CATEGORIES.find(c => c.val === val) ?? { label: val, color: 'text-gray-600' }
  }

  const sortedIncomes = [...incomes].sort((a, b) => (a.transaction_date ?? a.created_at).localeCompare(b.transaction_date ?? b.created_at))
  const sortedExpenses = [...expenses].sort((a, b) => (a.transaction_date ?? a.created_at).localeCompare(b.transaction_date ?? b.created_at))

  const yearlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return {
      month: m,
      inc: allIncomes.filter(r => r.month === m).reduce((s, r) => s + Number(r.amount), 0),
      exp: allExpenses.filter(r => r.month === m).reduce((s, r) => s + Number(r.amount), 0),
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
              <span className="text-sm font-semibold px-2 min-w-[100px] text-center text-orange-700">{MONTH_FULL[month-1]} {year+543}</span>
              <button onClick={() => navigate(1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
        <div className="flex bg-orange-50 rounded-lg p-0.5 border border-orange-100">
          {(['month','year'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view===v ? 'bg-white shadow-sm text-orange-700' : 'text-orange-400 hover:text-orange-600'}`}>
              {v === 'month' ? 'รายเดือน' : 'ภาพรวมปี'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-orange-300 py-8">กำลังโหลด...</p>
      ) : view === 'year' ? (
        <YearView data={yearlyData} year={year} yearTotal={yearTotal} setYear={setYear} onClickMonth={(m) => { setMonth(m); setView('month') }} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} /><span className="text-sm font-medium opacity-90">รายได้เดือนนี้</span></div>
              <p className="text-3xl font-bold">{formatCurrency(totalIncome)}</p>
              <p className="text-xs opacity-75 mt-1">{incomes.length} รายการ</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} /><span className="text-sm font-medium opacity-90">รายจ่ายเดือนนี้</span></div>
              <p className="text-3xl font-bold">{formatCurrency(totalExpense)}</p>
              <p className="text-xs opacity-75 mt-1">{expenses.length} รายการ</p>
            </div>
            <div className={`rounded-2xl p-5 text-white shadow-lg ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
              <div className="flex items-center gap-2 mb-2"><Wallet size={18} /><span className="text-sm font-medium opacity-90">กำไร/ขาดทุน</span></div>
              <p className="text-3xl font-bold">{formatCurrency(netProfit)}</p>
              <p className="text-xs opacity-75 mt-1">{netProfit >= 0 ? '✅ บวก' : '⚠️ ลบ'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Income ── */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                <div>
                  <h3 className="font-bold text-orange-800">💵 เงินเข้ารายเดือน</h3>
                  <p className="text-xs text-orange-400">{MONTH_FULL[month-1]} {year+543}</p>
                </div>
                <button onClick={() => { setShowIncomeForm(v => !v); setShowExpenseForm(false); setEditingIncomeId(null) }}
                  className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-orange-600 shadow-sm">
                  <Plus size={13} /> เพิ่มรายได้
                </button>
              </div>

              {/* Add income form */}
              {showIncomeForm && (
                <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-orange-700">+ รายได้ใหม่</p>
                    <button onClick={() => setShowIncomeForm(false)}><X size={15} className="text-gray-400" /></button>
                  </div>
                  <IncomeFormFields form={incomeForm} setForm={setIncomeForm} toggleSource={(s) => toggleSource(s, incomeForm, setIncomeForm)} borderColor="orange" />
                  <button onClick={addIncome} className="w-full bg-orange-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-orange-600">💾 บันทึกรายได้</button>
                </div>
              )}

              {/* Income table */}
              <div className="overflow-x-auto">
                {sortedIncomes.length === 0 ? (
                  <p className="px-5 py-8 text-center text-gray-300 text-sm">ยังไม่มีรายได้เดือนนี้</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 text-orange-600 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">วันที่</th>
                        <th className="px-4 py-2 text-left font-semibold">ลูกค้า / รายละเอียด</th>
                        <th className="px-4 py-2 text-left font-semibold">ประเภท</th>
                        <th className="px-4 py-2 text-right font-semibold">ยอด</th>
                        <th className="px-2 py-2 w-14"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-50">
                      {sortedIncomes.map(r => (
                        editingIncomeId === r.id ? (
                          /* ─── Edit row ─── */
                          <tr key={r.id} className="bg-orange-50/60">
                            <td colSpan={5} className="px-4 py-3">
                              <IncomeFormFields form={editIncomeForm} setForm={setEditIncomeForm}
                                toggleSource={(s) => toggleSource(s, editIncomeForm, setEditIncomeForm)} borderColor="orange" />
                              <div className="flex gap-2 mt-3">
                                <button onClick={saveIncome} disabled={saving}
                                  className="flex items-center gap-1 bg-orange-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-60">
                                  <Check size={12} /> {saving ? 'บันทึก...' : 'บันทึก'}
                                </button>
                                <button onClick={() => setEditingIncomeId(null)}
                                  className="flex items-center gap-1 border border-gray-300 px-4 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                                  <X size={12} /> ยกเลิก
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          /* ─── Normal row ─── */
                          <tr key={r.id} className="hover:bg-orange-50/40 group">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-gray-500 text-xs">
                                <Calendar size={11} className="text-orange-400" />
                                {r.transaction_date ? formatDate(r.transaction_date) : <span className="text-gray-300">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {r.client_name && <p className="font-medium text-gray-800">{r.client_name}</p>}
                              {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
                              {r.note && <p className="text-xs text-gray-400 italic">{r.note}</p>}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(r.sources) ? r.sources : []).map((s: string) => (
                                  <span key={s} className={`text-xs px-2 py-0.5 rounded-full border ${sourceLabel(s).color}`}>{sourceLabel(s).label}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-orange-600 whitespace-nowrap">
                              {formatCurrency(Number(r.amount))}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => startEditIncome(r)} className="text-gray-400 hover:text-orange-600 p-1"><Pencil size={12} /></button>
                                <button onClick={() => deleteIncome(r.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 border-t border-orange-200">
                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-orange-700">รวมรายได้</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-orange-600">{formatCurrency(totalIncome)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* ── Expense ── */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100">
                <div>
                  <h3 className="font-bold text-rose-800">💸 ซื้อของในบริษัท / รายจ่าย</h3>
                  <p className="text-xs text-rose-400">{MONTH_FULL[month-1]} {year+543}</p>
                </div>
                <button onClick={() => { setShowExpenseForm(v => !v); setShowIncomeForm(false); setEditingExpenseId(null) }}
                  className="flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-rose-600 shadow-sm">
                  <Plus size={13} /> เพิ่มรายจ่าย
                </button>
              </div>

              {/* Add expense form */}
              {showExpenseForm && (
                <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-rose-700">+ รายจ่ายใหม่</p>
                    <button onClick={() => setShowExpenseForm(false)}><X size={15} className="text-gray-400" /></button>
                  </div>
                  <ExpenseFormFields form={expenseForm} setForm={setExpenseForm} />
                  <button onClick={addExpense} className="w-full bg-rose-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-rose-600">💾 บันทึกรายจ่าย</button>
                </div>
              )}

              {/* Expense table */}
              <div className="overflow-x-auto">
                {sortedExpenses.length === 0 ? (
                  <p className="px-5 py-8 text-center text-gray-300 text-sm">ยังไม่มีรายจ่ายเดือนนี้</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-rose-50 text-rose-600 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">วันที่</th>
                        <th className="px-4 py-2 text-left font-semibold">หมวดหมู่</th>
                        <th className="px-4 py-2 text-left font-semibold">รายละเอียด</th>
                        <th className="px-4 py-2 text-right font-semibold">ยอด</th>
                        <th className="px-2 py-2 w-14"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {sortedExpenses.map(r => (
                        editingExpenseId === r.id ? (
                          /* ─── Edit row ─── */
                          <tr key={r.id} className="bg-rose-50/60">
                            <td colSpan={5} className="px-4 py-3">
                              <ExpenseFormFields form={editExpenseForm} setForm={setEditExpenseForm} />
                              <div className="flex gap-2 mt-3">
                                <button onClick={saveExpense} disabled={saving}
                                  className="flex items-center gap-1 bg-rose-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-600 disabled:opacity-60">
                                  <Check size={12} /> {saving ? 'บันทึก...' : 'บันทึก'}
                                </button>
                                <button onClick={() => setEditingExpenseId(null)}
                                  className="flex items-center gap-1 border border-gray-300 px-4 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                                  <X size={12} /> ยกเลิก
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          /* ─── Normal row ─── */
                          <tr key={r.id} className="hover:bg-rose-50/40 group">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-gray-500 text-xs">
                                <Calendar size={11} className="text-rose-400" />
                                {r.transaction_date ? formatDate(r.transaction_date) : <span className="text-gray-300">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-semibold ${catMeta(r.category).color}`}>{catMeta(r.category).label}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {r.description && <p className="text-gray-700">{r.description}</p>}
                              {r.note && <p className="text-xs text-gray-400 italic">{r.note}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-rose-600 whitespace-nowrap">
                              {formatCurrency(Number(r.amount))}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => startEditExpense(r)} className="text-gray-400 hover:text-rose-600 p-1"><Pencil size={12} /></button>
                                <button onClick={() => deleteExpense(r.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-rose-50 border-t border-rose-200">
                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-rose-700">รวมรายจ่าย</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-rose-600">{formatCurrency(totalExpense)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Reusable form fields ──────────────────────────────────────────────────────
function IncomeFormFields({ form, setForm, toggleSource, borderColor = 'orange' }: {
  form: { amount: string; sources: string[]; client_name: string; description: string; note: string; transaction_date: string }
  setForm: (v: typeof form) => void
  toggleSource: (s: string) => void
  borderColor?: string
}) {
  const ring = `focus:ring-${borderColor}-400`
  const border = `border-${borderColor}-200`
  const cls = `w-full border ${border} rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">📅 วันที่ *</label>
        <input type="date" value={form.transaction_date} onChange={e => setForm({...form, transaction_date: e.target.value})} className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ยอดเงิน (บาท) *</label>
        <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">แหล่งรายได้</label>
        <div className="flex flex-wrap gap-2">
          {INCOME_SOURCES.map(s => (
            <button key={s.val} type="button" onClick={() => toggleSource(s.val)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${form.sources.includes(s.val) ? s.color + ' border-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
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
  const cls = 'w-full border border-rose-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400'
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">📅 วันที่ *</label>
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

// ─── Yearly View ──────────────────────────────────────────────────────────────
function YearView({ data, year, yearTotal, setYear, onClickMonth }: {
  data: { month: number; inc: number; exp: number; net: number }[]
  year: number
  yearTotal: { inc: number; exp: number }
  setYear: (y: number) => void
  onClickMonth: (m: number) => void
}) {
  const maxVal = Math.max(...data.map(d => Math.max(d.inc, d.exp)), 1)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">ภาพรวมปี {year + 543}</h3>
        <div className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-1">
          <button onClick={() => setYear(year - 1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold px-2 text-orange-700">{year + 543}</span>
          <button onClick={() => setYear(year + 1)} className="p-1.5 hover:bg-orange-50 rounded text-orange-500"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-orange-500 mb-1">รายได้รวมปี</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(yearTotal.inc)}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-rose-500 mb-1">รายจ่ายรวมปี</p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(yearTotal.exp)}</p>
        </div>
        <div className={`${yearTotal.inc-yearTotal.exp >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'} border rounded-2xl p-4 text-center`}>
          <p className={`text-xs mb-1 ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-emerald-500' : 'text-gray-400'}`}>กำไร/ขาดทุนรวมปี</p>
          <p className={`text-2xl font-bold ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{formatCurrency(yearTotal.inc-yearTotal.exp)}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex gap-4 text-xs text-gray-400 mb-4">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />รายได้</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" />รายจ่าย</span>
        </div>
        <div className="flex items-end gap-1 h-36">
          {data.map(d => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 cursor-pointer group" onClick={() => onClickMonth(d.month)}>
              <div className="w-full flex gap-0.5 items-end" style={{ height: '112px' }}>
                <div className="flex-1 bg-orange-400 rounded-t group-hover:bg-orange-500 transition-all" style={{ height: `${(d.inc/maxVal)*100}%`, minHeight: d.inc > 0 ? '4px' : '0' }} />
                <div className="flex-1 bg-rose-400 rounded-t group-hover:bg-rose-500 transition-all" style={{ height: `${(d.exp/maxVal)*100}%`, minHeight: d.exp > 0 ? '4px' : '0' }} />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-orange-600">{MONTHS[d.month-1]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-orange-50 text-orange-700 text-xs">
            <tr>
              <th className="px-4 py-3 text-left">เดือน</th>
              <th className="px-4 py-3 text-right">รายได้</th>
              <th className="px-4 py-3 text-right">รายจ่าย</th>
              <th className="px-4 py-3 text-right">กำไร/ขาดทุน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(d => (
              <tr key={d.month} onClick={() => onClickMonth(d.month)}
                className={`hover:bg-orange-50 cursor-pointer transition ${d.inc === 0 && d.exp === 0 ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2.5 font-medium text-gray-700">{MONTHS[d.month-1]}</td>
                <td className="px-4 py-2.5 text-right text-orange-600 font-medium">{d.inc > 0 ? formatCurrency(d.inc) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-rose-600 font-medium">{d.exp > 0 ? formatCurrency(d.exp) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${d.net > 0 ? 'text-emerald-600' : d.net < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                  {d.inc > 0 || d.exp > 0 ? formatCurrency(d.net) : '—'}
                </td>
              </tr>
            ))}
            <tr className="bg-orange-50 font-bold">
              <td className="px-4 py-3 text-orange-700">รวมทั้งปี</td>
              <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(yearTotal.inc)}</td>
              <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(yearTotal.exp)}</td>
              <td className={`px-4 py-3 text-right ${yearTotal.inc-yearTotal.exp >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(yearTotal.inc-yearTotal.exp)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
