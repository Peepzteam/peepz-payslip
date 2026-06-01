'use client'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
  year: number
  totRevArr: number[]
  totProfArr: number[]
  totalExpArr: number[]
  staffTotArr: number[]
  kbizBalArr: number[]
  newRevArr: number[]
  exRevArr: number[]
  serviceRows: { val: string; label: string; revenueArr: number[]; countArr: number[] }[]
  newCamps: unknown[][]
  exCamps: unknown[][]
}

const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316']

function fmt(v: number) { return formatCurrency(v) }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(a / b * 1000) / 10 }
function sum(arr: number[]) { return arr.reduce((s, v) => s + v, 0) }

// ─── Insight engine ──────────────────────────────────────────────────────────
function buildInsights(p: Props) {
  const { totRevArr, totProfArr, totalExpArr, staffTotArr, kbizBalArr, newRevArr, exRevArr, serviceRows, newCamps, exCamps } = p

  const activeMonths = totRevArr.filter(v => v > 0).length
  const totalRev   = sum(totRevArr)
  const totalProfit = sum(totProfArr)
  const totalExp   = sum(totalExpArr)
  const avgRev     = activeMonths > 0 ? totalRev / activeMonths : 0
  const profitMargin = pct(totalProfit, totalRev)
  const staffRatio = totalExp > 0 ? pct(sum(staffTotArr), totalExp) : 0

  // Growth: compare H2 vs H1 revenue
  const h1Rev = sum(totRevArr.slice(0, 6))
  const h2Rev = sum(totRevArr.slice(6, 12))
  const growthH = h1Rev > 0 ? pct(h2Rev - h1Rev, h1Rev) : null

  // Best month
  const bestMonthIdx = totRevArr.indexOf(Math.max(...totRevArr))
  const worstProfitIdx = totProfArr.findIndex(v => v < 0)

  // New vs existing client ratio
  const totalNewRev = sum(newRevArr)
  const totalExRev  = sum(exRevArr)
  const newRatio    = pct(totalNewRev, totalRev)

  // Top service
  const topService = [...serviceRows].sort((a, b) => sum(b.revenueArr) - sum(a.revenueArr))[0]

  // Negative cash flow months
  const negativeCashMonths = kbizBalArr.filter(v => v < 0).length

  // Consecutive growth
  let consecutiveGrowth = 0
  for (let i = totRevArr.length - 1; i > 0; i--) {
    if (totRevArr[i] > 0 && totRevArr[i] > totRevArr[i - 1]) consecutiveGrowth++
    else break
  }

  // Total campaigns
  const totalCamps = newCamps.reduce((s, c) => s + c.length, 0) + exCamps.reduce((s, c) => s + c.length, 0)
  const avgRevenuePerCamp = totalCamps > 0 ? totalRev / totalCamps : 0

  const strengths: string[] = []
  const focus: string[] = []
  const warnings: string[] = []

  // ── Strengths ──
  if (profitMargin >= 30) strengths.push(`🏆 Profit margin สูง ${profitMargin}% — ธุรกิจมีประสิทธิภาพดีมาก`)
  else if (profitMargin >= 15) strengths.push(`✅ Profit margin ${profitMargin}% — อยู่ในระดับที่ดี`)

  if (consecutiveGrowth >= 2) strengths.push(`📈 ยอดขายเติบโตต่อเนื่อง ${consecutiveGrowth} เดือนล่าสุด — momentum ดี`)

  if (newRatio >= 40) strengths.push(`🆕 ลูกค้าใหม่ ${newRatio}% ของยอดขาย — ฐานลูกค้ากำลังขยาย`)
  if (totalExRev > totalNewRev) strengths.push(`🔄 ลูกค้าเก่า loyal — repeat business สูง (${pct(totalExRev, totalRev)}% ของรายได้)`)

  if (topService && sum(topService.revenueArr) > 0) strengths.push(`⭐ ${topService.label} เป็น service หลัก — คิดเป็น ${pct(sum(topService.revenueArr), totalRev)}% ของยอดขายทั้งหมด`)

  if (growthH !== null && growthH > 10) strengths.push(`📊 ครึ่งปีหลังเติบโต +${growthH}% เทียบครึ่งปีแรก`)

  if (negativeCashMonths === 0 && activeMonths > 0) strengths.push(`💰 Cash flow เป็นบวกทุกเดือนที่มีรายได้ — สภาพคล่องแข็งแกร่ง`)

  // ── Focus ──
  if (newRatio < 30 && activeMonths > 3) focus.push(`🎯 เพิ่ม New Client — ปัจจุบันลูกค้าใหม่คิดเป็นแค่ ${newRatio}% พยายามเพิ่มเป็น 40%+`)
  if (staffRatio > 60) focus.push(`👥 ค่าใช้จ่ายพนักงาน ${staffRatio}% ของ total cost — ควรดูว่าเพิ่มรายได้ได้อีกโดยไม่เพิ่มทีม`)
  if (profitMargin < 15 && profitMargin > 0) focus.push(`💹 พัฒนา Profit margin ปัจจุบัน ${profitMargin}% — ทบทวนต้นทุนต่องาน หรือขึ้นราคา`)
  if (avgRevenuePerCamp > 0) focus.push(`📋 Average revenue ต่อแคมเปญ ${fmt(avgRevenuePerCamp)} — หาทางเพิ่ม deal size หรือ upsell`)

  const secondService = [...serviceRows].filter(s => sum(s.revenueArr) > 0).sort((a, b) => sum(b.revenueArr) - sum(a.revenueArr))[1]
  if (secondService && sum(secondService.revenueArr) > 0) {
    const gap = pct(sum(topService?.revenueArr ?? []) - sum(secondService.revenueArr), sum(topService?.revenueArr ?? [1]))
    if (gap > 40) focus.push(`🌱 ขยาย ${secondService.label} — ยังห่างจาก service หลักมาก มีโอกาสเติบโต`)
  }

  if (growthH !== null && growthH < 0) focus.push(`📉 ยอดขายครึ่งปีหลังลด ${Math.abs(growthH)}% — วางแผน pipeline ให้แน่นขึ้น`)

  // ── Warnings ──
  if (profitMargin < 0) warnings.push(`🚨 Profit margin ติดลบ ${Math.abs(profitMargin)}% — รายจ่ายเกินรายรับ ต้องแก้ด่วน`)
  if (worstProfitIdx >= 0) warnings.push(`⚠️ ${MONTHS_SHORT[worstProfitIdx]} มีกำไรติดลบ ${fmt(totProfArr[worstProfitIdx])} — ตรวจสอบต้นทุนเดือนนั้น`)
  if (negativeCashMonths > 0) warnings.push(`💸 ${negativeCashMonths} เดือนที่ cash flow ติดลบ — ระวังสภาพคล่อง`)
  if (staffRatio > 70) warnings.push(`👤 ค่าพนักงาน ${staffRatio}% ของต้นทุนทั้งหมด — สูงเกินไป อาจกระทบ scalability`)

  const lastActiveIdx = totRevArr.reduce((last, v, i) => (v > 0 ? i : last), -1)
  if (lastActiveIdx >= 0 && lastActiveIdx < 9) {
    const emptyMonths = 11 - lastActiveIdx
    if (emptyMonths >= 2) warnings.push(`📭 ยังไม่มีข้อมูลอีก ${emptyMonths} เดือน — อย่าลืมบันทึกให้ครบ`)
  }

  if (newRatio > 80) warnings.push(`⚠️ ลูกค้าใหม่สูงมาก ${newRatio}% — ยังไม่มี recurring revenue ที่มั่นคง`)

  // fallbacks
  if (strengths.length === 0 && activeMonths > 0) strengths.push('📊 มีข้อมูลแล้ว — ยังต้องรอให้ครบรอบปีเพื่อวิเคราะห์ได้ชัดขึ้น')
  if (focus.length === 0) focus.push('💡 เพิ่มข้อมูลให้ครบขึ้น เพื่อให้ระบบวิเคราะห์ได้ละเอียดกว่านี้')
  if (warnings.length === 0 && activeMonths > 0) warnings.push('✅ ยังไม่พบสัญญาณเตือนที่น่ากังวล — คงเส้นคงวาต่อไป')

  return { strengths, focus, warnings, stats: { totalRev, totalProfit, profitMargin, activeMonths, totalCamps, avgRevenuePerCamp, newRatio, growthH } }
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ControlBoardAnalytics(props: Props) {
  const { year, totRevArr, totProfArr, totalExpArr, staffTotArr, kbizBalArr, newRevArr, exRevArr, serviceRows } = props

  const activeMonths = totRevArr.filter(v => v > 0).length
  if (activeMonths === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
        ยังไม่มีข้อมูลใน {year + 543} — เพิ่มแคมเปญหรือบันทึกรายได้ก่อนนะคะ 📊
      </div>
    )
  }

  const { strengths, focus, warnings, stats } = buildInsights(props)

  // ── Chart data ──
  const monthlyData = MONTHS_SHORT.map((m, i) => ({
    month: m,
    ยอดขาย: totRevArr[i],
    กำไร: totProfArr[i],
    รายจ่าย: totalExpArr[i],
    'Cash flow': kbizBalArr[i],
  }))

  const revenueSourceData = MONTHS_SHORT.map((m, i) => ({
    month: m,
    'ลูกค้าใหม่': newRevArr[i],
    'ลูกค้าเก่า': exRevArr[i],
  }))

  const servicePieData = serviceRows
    .map(s => ({ name: s.label.replace(/^[^\s]+\s/, ''), value: sum(s.revenueArr) }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)

  const expBreakdownData = [
    { name: 'เงินเดือน+ทีม', value: sum(staffTotArr) },
    { name: 'ค่าใช้จ่ายอื่นๆ', value: sum(totalExpArr) - sum(staffTotArr) },
  ].filter(d => d.value > 0)

  // Radar: month score (0-100 based on profitability)
  const radarData = MONTHS_SHORT.map((m, i) => {
    const rev = totRevArr[i]
    const prof = totProfArr[i]
    const margin = rev > 0 ? pct(prof, rev) : 0
    return { month: m, คะแนน: Math.max(0, Math.min(100, margin + 50)) }
  }).filter(d => totRevArr[MONTHS_SHORT.indexOf(d.month)] > 0)

  return (
    <div className="space-y-5">
      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ยอดขายรวม', value: fmt(stats.totalRev), sub: `${activeMonths} เดือนที่มีข้อมูล`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'กำไรสุทธิรวม', value: fmt(stats.totalProfit), sub: `Margin ${stats.profitMargin}%`, color: stats.totalProfit >= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200' },
          { label: 'แคมเปญทั้งหมด', value: `${stats.totalCamps} งาน`, sub: `เฉลี่ย ${fmt(stats.avgRevenuePerCamp)}/งาน`, color: 'bg-violet-50 text-violet-700 border-violet-200' },
          { label: 'ลูกค้าใหม่', value: `${stats.newRatio}%`, sub: stats.growthH !== null ? `H2 vs H1: ${stats.growthH > 0 ? '+' : ''}${stats.growthH}%` : 'ของยอดขายทั้งหมด', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <p className="text-xs font-medium opacity-70">{k.label}</p>
            <p className="text-lg font-bold mt-0.5">{k.value}</p>
            <p className="text-xs opacity-60 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Insights ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-emerald-800 mb-2">💪 จุดเด่น</h3>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => <li key={i} className="text-xs text-emerald-700">{s}</li>)}
          </ul>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-indigo-800 mb-2">🎯 จุดที่ควรโฟกัส</h3>
          <ul className="space-y-1.5">
            {focus.map((s, i) => <li key={i} className="text-xs text-indigo-700">{s}</li>)}
          </ul>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-rose-800 mb-2">⚠️ จุดที่ต้องระวัง</h3>
          <ul className="space-y-1.5">
            {warnings.map((s, i) => <li key={i} className="text-xs text-rose-700">{s}</li>)}
          </ul>
        </div>
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue & Profit trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 ยอดขาย & กำไร รายเดือน</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false}/>
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              <Area type="monotone" dataKey="ยอดขาย" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2}/>
              <Area type="monotone" dataKey="กำไร" stroke="#22c55e" fill="url(#profGrad)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* New vs Existing */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🆕 ลูกค้าใหม่ vs ลูกค้าเก่า</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueSourceData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false}/>
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              <Bar dataKey="ลูกค้าใหม่" stackId="a" fill="#22c55e" radius={[0,0,0,0]}/>
              <Bar dataKey="ลูกค้าเก่า" stackId="a" fill="#3b82f6" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Service pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🛒 สัดส่วนยอดขายตามประเภทงาน</h3>
          {servicePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={servicePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false}>
                  {servicePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>}
        </div>

        {/* Expense breakdown pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💸 สัดส่วนค่าใช้จ่าย</h3>
          {expBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expBreakdownData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false}>
                  {expBreakdownData.map((_, i) => <Cell key={i} fill={['#8b5cf6','#f59e0b'][i]}/>)}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>}
        </div>

        {/* Cash flow line */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Cash Flow รายเดือน</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false}/>
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="Cash flow" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}/>
              {/* zero line */}
              <CartesianGrid horizontal={false} strokeDasharray="" stroke="transparent"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Radar / Profit margin by month ── */}
      {radarData.length >= 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">🕸️ คะแนนความสามารถทำกำไร รายเดือน</h3>
          <p className="text-xs text-gray-400 mb-3">คะแนน 50 = break-even | สูงกว่า 50 = มีกำไร | ต่ำกว่า 50 = ขาดทุน</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid/>
              <PolarAngleAxis dataKey="month" tick={{ fontSize: 10 }}/>
              <Radar dataKey="คะแนน" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2}/>
              <Tooltip/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
