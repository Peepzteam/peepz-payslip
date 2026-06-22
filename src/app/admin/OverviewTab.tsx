'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Payslip, Employee } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  Wallet, Receipt, PiggyBank, Users, Briefcase, Megaphone, CalendarDays,
  ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight, CheckCircle2, Clock,
  TrendingUp, TrendingDown, LayoutDashboard,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

interface IncomeRecord { month: number; year: number; amount: number; is_paid: boolean }
interface ExpenseRecord { month: number; year: number; amount: number; is_paid: boolean; category: string }
interface Campaign { month: number; year: number; revenue: number; cost: number; client_type: 'new' | 'existing' }
interface LeaveRecord { employee_id: string; start_date: string; days: number; year: number; leave_type: string }

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const LEAVE_LABELS: Record<string, string> = { sick: 'ลาป่วย', vacation: 'ลาพักร้อน', personal: 'ลากิจ', other: 'อื่นๆ' }

const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }

export default function OverviewTab() {
  const now = new Date()
  const [view, setView] = useState<'month' | 'year'>('month')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)

  const [incomes, setIncomes] = useState<IncomeRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const years = Array.from(new Set([year, year - 1]))
      const results = await Promise.all(years.flatMap(y => [
        fetch(`/api/income-records?year=${y}`).then(safeJson),
        fetch(`/api/expense-records?year=${y}`).then(safeJson),
        fetch(`/api/payslips?year=${y}`).then(safeJson),
        fetch(`/api/campaigns?year=${y}`).then(safeJson),
        fetch(`/api/leave-records?year=${y}`).then(safeJson),
      ]))
      let inc: IncomeRecord[] = [], exp: ExpenseRecord[] = [], pay: Payslip[] = [], camp: Campaign[] = [], lv: LeaveRecord[] = []
      for (let i = 0; i < years.length; i++) {
        const [a, b, c, d, e] = results.slice(i * 5, i * 5 + 5)
        if (Array.isArray(a)) inc = inc.concat(a)
        if (Array.isArray(b)) exp = exp.concat(b)
        if (Array.isArray(c)) pay = pay.concat(c)
        if (Array.isArray(d)) camp = camp.concat(d)
        if (Array.isArray(e)) lv = lv.concat(e)
      }
      setIncomes(inc); setExpenses(exp); setPayslips(pay); setCampaigns(camp); setLeaves(lv)
      const empRes = await fetch('/api/employees').then(safeJson)
      setEmployees(Array.isArray(empRes) ? empRes : [])
    } catch (err) {
      console.error('OverviewTab load error:', err)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  // ─── helpers ───
  const sumIncome = useCallback((m: number, y: number) => incomes.filter(r => r.month === m && r.year === y).reduce((s, r) => s + r.amount, 0), [incomes])
  const sumExpenseManual = useCallback((m: number, y: number) => expenses.filter(r => r.month === m && r.year === y).reduce((s, r) => s + r.amount, 0), [expenses])
  const sumPayroll = useCallback((m: number, y: number) => payslips.filter(p => p.period_month === m && p.period_year === y).reduce((s, p) => s + p.net_pay, 0), [payslips])
  const sumExpenseTotal = useCallback((m: number, y: number) => sumExpenseManual(m, y) + sumPayroll(m, y), [sumExpenseManual, sumPayroll])
  const sumProfit = useCallback((m: number, y: number) => sumIncome(m, y) - sumExpenseTotal(m, y), [sumIncome, sumExpenseTotal])
  const slipsFor = useCallback((m: number, y: number) => payslips.filter(p => p.period_month === m && p.period_year === y), [payslips])
  const campaignsFor = useCallback((m: number, y: number) => campaigns.filter(c => c.month === m && c.year === y), [campaigns])
  const leaveDaysFor = useCallback((m: number, y: number) => leaves.filter(l => new Date(l.start_date).getMonth() + 1 === m && new Date(l.start_date).getFullYear() === y), [leaves])

  // ─── period navigation ───
  function navigate(dir: number) {
    if (view === 'year') { setYear(y => y + dir); return }
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m); setYear(y)
  }
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthYear = month === 1 ? year - 1 : year

  // ─── current period figures ───
  const curIncome = sumIncome(month, year)
  const curExpense = sumExpenseTotal(month, year)
  const curProfit = sumProfit(month, year)
  const prevIncome = sumIncome(prevMonth, prevMonthYear)
  const prevExpense = sumExpenseTotal(prevMonth, prevMonthYear)
  const prevProfit = sumProfit(prevMonth, prevMonthYear)

  const curSlips = slipsFor(month, year)
  const paidSlips = curSlips.filter(p => p.is_paid)
  const pendingSlips = curSlips.filter(p => !p.is_paid)
  const paidAmount = paidSlips.reduce((s, p) => s + p.net_pay, 0)
  const pendingAmount = pendingSlips.reduce((s, p) => s + p.net_pay, 0)

  const curCampaigns = campaignsFor(month, year)
  const prevCampaigns = campaignsFor(prevMonth, prevMonthYear)
  const curSalesRevenue = curCampaigns.reduce((s, c) => s + c.revenue, 0)
  const curSalesProfit = curCampaigns.reduce((s, c) => s + (c.revenue - c.cost), 0)
  const prevSalesRevenue = prevCampaigns.reduce((s, c) => s + c.revenue, 0)
  const newClients = curCampaigns.filter(c => c.client_type === 'new').length
  const existingClients = curCampaigns.filter(c => c.client_type === 'existing').length

  const curLeaveDays = leaveDaysFor(month, year).reduce((s, l) => s + l.days, 0)
  const prevLeaveDays = leaveDaysFor(prevMonth, prevMonthYear).reduce((s, l) => s + l.days, 0)
  const leaveByType = useMemo(() => {
    const map: Record<string, number> = {}
    leaveDaysFor(month, year).forEach(l => { map[l.leave_type] = (map[l.leave_type] || 0) + l.days })
    return map
  }, [leaveDaysFor, month, year])

  const fulltimeCount = employees.filter(e => e.type === 'fulltime').length
  const freelanceCount = employees.filter(e => e.type === 'freelance').length

  // ─── yearly aggregates ───
  const m12 = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearIncome = m12.reduce((s, m) => s + sumIncome(m, year), 0)
  const yearExpense = m12.reduce((s, m) => s + sumExpenseTotal(m, year), 0)
  const yearProfit = yearIncome - yearExpense
  const prevYearIncome = m12.reduce((s, m) => s + sumIncome(m, year - 1), 0)
  const prevYearExpense = m12.reduce((s, m) => s + sumExpenseTotal(m, year - 1), 0)
  const prevYearProfit = prevYearIncome - prevYearExpense
  const yearCampaigns = campaigns.filter(c => c.year === year)
  const yearSalesRevenue = yearCampaigns.reduce((s, c) => s + c.revenue, 0)
  const yearSalesProfit = yearCampaigns.reduce((s, c) => s + (c.revenue - c.cost), 0)
  const prevYearCampaigns = campaigns.filter(c => c.year === year - 1)
  const prevYearSalesRevenue = prevYearCampaigns.reduce((s, c) => s + c.revenue, 0)
  const yearLeaveDays = leaves.filter(l => l.year === year).reduce((s, l) => s + l.days, 0)
  const prevYearLeaveDays = leaves.filter(l => l.year === year - 1).reduce((s, l) => s + l.days, 0)

  const chartData = m12.map(m => ({
    name: MONTHS_SHORT[m - 1],
    รายรับ: sumIncome(m, year),
    รายจ่าย: sumExpenseTotal(m, year),
    กำไร: sumProfit(m, year),
  }))

  const heroProfit = view === 'month' ? curProfit : yearProfit
  const heroPrevProfit = view === 'month' ? prevProfit : prevYearProfit
  const heroIncome = view === 'month' ? curIncome : yearIncome
  const heroExpense = view === 'month' ? curExpense : yearExpense
  const heroDiff = heroProfit - heroPrevProfit
  const heroPct = heroPrevProfit !== 0 ? (heroDiff / Math.abs(heroPrevProfit)) * 100 : (heroProfit !== 0 ? 100 : 0)
  const heroUp = heroDiff >= 0

  return (
    <div className="space-y-6">
      {/* Header / period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">ภาพรวมธุรกิจ</h2>
            <p className="text-xs text-gray-400">สรุปการเงิน ยอดขาย เงินเดือน และ HR ของทั้งบริษัท</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-full p-1">
            {(['month', 'year'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${view === v ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {v === 'month' ? 'รายเดือน' : 'รายปี'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-1 shadow-sm">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-50 rounded-full text-gray-500"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold px-2 min-w-[110px] text-center text-gray-700">
              {view === 'month' ? `${MONTHS_FULL[month - 1]} ${year + 543}` : `ปี ${year + 543}`}
            </span>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-50 rounded-full text-gray-500"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">กำลังโหลด...</p>
      ) : (
        <>
          {/* HERO: กำไร/ขาดทุน */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-lg p-5 sm:p-6 text-white">
            <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
            <div className="absolute -right-4 bottom-0 w-28 h-28 bg-white/10 rounded-full" />
            <div className="relative z-10">
              <p className="text-xs font-medium text-indigo-100/80 uppercase tracking-wide">
                {view === 'month' ? 'กำไร / ขาดทุน เดือนนี้' : `กำไร / ขาดทุน รวมทั้งปี ${year + 543}`}
              </p>
              <p className={`text-3xl sm:text-4xl font-extrabold mt-1 ${heroProfit < 0 ? 'text-rose-200' : 'text-white'}`}>
                {formatCurrency(heroProfit)}
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${heroUp ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                  {heroUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(heroPct).toFixed(1)}%
                </span>
                <span className="text-indigo-100/70">{view === 'month' ? 'เทียบเดือนก่อน' : 'เทียบปีก่อน'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-emerald-200 text-xs font-medium">
                    <Wallet size={13} /> รายรับรวม
                  </div>
                  <p className="text-lg sm:text-xl font-bold mt-0.5">{formatCurrency(heroIncome)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-rose-200 text-xs font-medium">
                    <Receipt size={13} /> รายจ่ายรวม
                  </div>
                  <p className="text-lg sm:text-xl font-bold mt-0.5">{formatCurrency(heroExpense)}</p>
                </div>
              </div>
            </div>
          </div>

          {view === 'month' ? (
            <>
              {/* เงินเดือน/ค่าจ้าง */}
              <Section title="เงินเดือน / ค่าจ้าง" emoji="🧾" accent="from-slate-400 to-slate-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SimpleCard label="สลิปทั้งหมดเดือนนี้" value={`${curSlips.length} รายการ`} icon={Users} color="text-slate-600" bg="from-slate-400 to-slate-600" />
                  <SimpleCard label="จ่ายแล้ว" value={formatCurrency(paidAmount)} sub={`${paidSlips.length} รายการ`} icon={CheckCircle2} color="text-green-600" bg="from-emerald-400 to-green-600" />
                  <SimpleCard label="รอจ่าย" value={formatCurrency(pendingAmount)} sub={`${pendingSlips.length} รายการ`} icon={Clock} color="text-amber-600" bg="from-amber-400 to-orange-500" />
                </div>
              </Section>

              {/* SALES */}
              <Section title="ยอดขาย (Sales)" emoji="📣" accent="from-blue-400 to-blue-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="ยอดขายรวม" value={curSalesRevenue} prev={prevSalesRevenue} icon={Megaphone} color="text-blue-600" bg="from-blue-400 to-blue-600" />
                  <SimpleCard label="แคมเปญใหม่ / เก่า" value={`${newClients} ใหม่ · ${existingClients} เก่า`} icon={Briefcase} color="text-purple-600" bg="from-purple-400 to-purple-600" />
                  <SimpleCard label="Profit จากแคมเปญ" value={formatCurrency(curSalesProfit)} icon={PiggyBank} color="text-teal-600" bg="from-teal-400 to-teal-600" />
                </div>
              </Section>

              {/* HR */}
              <Section title="HR" emoji="👥" accent="from-indigo-400 to-indigo-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SimpleCard label="พนักงานทั้งหมด" value={`${fulltimeCount + freelanceCount} คน`} sub={`ประจำ ${fulltimeCount} · Freelance ${freelanceCount}`} icon={Users} color="text-indigo-600" bg="from-indigo-400 to-indigo-600" />
                  <StatCard label="วันลารวมเดือนนี้" value={curLeaveDays} prev={prevLeaveDays} icon={CalendarDays} color="text-amber-600" bg="from-amber-400 to-orange-500" invert unit=" วัน" />
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-2 font-medium">แยกตามประเภทการลา</p>
                    {Object.keys(leaveByType).length === 0 ? (
                      <p className="text-sm text-gray-400">ไม่มีการลาเดือนนี้</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(leaveByType).map(([type, days]) => (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">{LEAVE_LABELS[type] || type}</span>
                            <span className="font-semibold text-gray-800">{days} วัน</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            </>
          ) : (
            <>
              <Section title="แนวโน้มรายเดือน" emoji="📈" accent="from-indigo-400 to-purple-600">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000).toLocaleString() + 'k'} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Bar dataKey="รายรับ" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="รายจ่าย" fill="#fb7185" radius={[4, 4, 0, 0]} />
                      <Line dataKey="กำไร" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="ยอดขาย (Sales) รวมทั้งปี" emoji="📣" accent="from-blue-400 to-blue-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="ยอดขายรวมทั้งปี" value={yearSalesRevenue} prev={prevYearSalesRevenue} icon={Megaphone} color="text-blue-600" bg="from-blue-400 to-blue-600" />
                  <SimpleCard label="แคมเปญทั้งหมด" value={`${yearCampaigns.length} แคมเปญ`} icon={Briefcase} color="text-purple-600" bg="from-purple-400 to-purple-600" />
                  <SimpleCard label="Profit จากแคมเปญ" value={formatCurrency(yearSalesProfit)} icon={PiggyBank} color="text-teal-600" bg="from-teal-400 to-teal-600" />
                </div>
              </Section>

              <Section title="HR รวมทั้งปี" emoji="👥" accent="from-indigo-400 to-indigo-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SimpleCard label="พนักงานทั้งหมด (ปัจจุบัน)" value={`${fulltimeCount + freelanceCount} คน`} sub={`ประจำ ${fulltimeCount} · Freelance ${freelanceCount}`} icon={Users} color="text-indigo-600" bg="from-indigo-400 to-indigo-600" />
                  <StatCard label="วันลารวมทั้งปี" value={yearLeaveDays} prev={prevYearLeaveDays} icon={CalendarDays} color="text-amber-600" bg="from-amber-400 to-orange-500" invert unit=" วัน" />
                </div>
              </Section>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, emoji, accent, children }: { title: string; emoji: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center text-sm shadow-sm`}>
          <span>{emoji}</span>
        </div>
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function SimpleCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className={`font-extrabold text-base sm:text-lg truncate ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function StatCard({ label, value, prev, icon: Icon, color, bg, invert, unit }: {
  label: string; value: number; prev: number
  icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string
  invert?: boolean; unit?: string
}) {
  const diff = value - prev
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : (value !== 0 ? 100 : 0)
  const isUp = diff > 0
  const isFlat = diff === 0
  // ขึ้น = ดี ปกติ, แต่ถ้า invert (เช่นรายจ่าย/วันลา) ขึ้น = แย่
  const goodDirection = invert ? !isUp : isUp
  const deltaColor = isFlat ? 'text-gray-400 bg-gray-50' : goodDirection ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'
  const display = unit ? `${value.toLocaleString('th-TH')}${unit}` : formatCurrency(value)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className={`font-extrabold text-base sm:text-lg truncate ${color}`}>{display}</p>
        <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full ${deltaColor}`}>
          {isFlat ? <Minus size={10} /> : isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          <span>{Math.abs(pct).toFixed(1)}% จากเดือนก่อน</span>
        </div>
      </div>
    </div>
  )
}
