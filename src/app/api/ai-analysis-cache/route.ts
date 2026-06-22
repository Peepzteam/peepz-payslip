import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CRON_SECRET = process.env.CRON_SECRET ?? ''

const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const SOURCE_LABELS: Record<string,string> = { live:'📺 Live Commerce', influencer:'🌟 Influencer Review', content:'📝 Content Production', ads:'📢 Ads', seeding:'🌱 Seeding Marketing', event:'🎪 Event', other:'🔧 อื่นๆ' }
const EXPENSE_LABELS: Record<string,string> = { rent:'🏠 ค่าเช่าออฟฟิศ', utilities:'⚡ ค่าน้ำ/ไฟ/เน็ต', software:'💻 ค่า Software', domain:'🌐 Domain/Hosting', equipment:'🖥️ ค่าอุปกรณ์', team_food:'🍽️ เลี้ยงข้าวทีม', team_outing:'🏕️ Outing', team_party:'🎉 Party', team_snack:'🧃 Snack', team_birthday:'🎂 Birthday', team_welcome:'🤝 Welcome', team_activity:'🎯 Activity', ads:'📢 ค่าโฆษณา', marketing_ops:'🛠️ Marketing Ops', salary:'👥 เงินเดือน', freelance:'🎨 Freelance', tax:'🏛️ ภาษี', petty_cash:'💼 Petty Cash', other:'📦 อื่นๆ' }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '0')
  const year = parseInt(searchParams.get('year') ?? '0')
  if (!month || !year) return NextResponse.json({ error: 'missing month/year' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('ai_analysis_cache')
    .select('analysis, updated_at, trigger_type')
    .eq('month', month).eq('year', year).single()
  if (error || !data) return NextResponse.json({ analysis: null, updated_at: null })
  return NextResponse.json(data)
}

async function fetchFinancialData(month: number, year: number, siteUrl: string) {
  const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
  const [incR, expR, payR, pastIncR, pastExpR, pastPayR, allPayR] = await Promise.all([
    fetch(`${siteUrl}/api/income-records?month=${month}&year=${year}`),
    fetch(`${siteUrl}/api/expense-records?month=${month}&year=${year}`),
    fetch(`${siteUrl}/api/payslips?month=${month}&year=${year}`),
    fetch(`${siteUrl}/api/income-records`),
    fetch(`${siteUrl}/api/expense-records`),
    fetch(`${siteUrl}/api/payslips`),
    fetch(`${siteUrl}/api/payslips?year=${year}`),
  ])
  const [incomes, expenses, payslips, pastIncomes, pastExpenses, pastPayslips, allPayslips] = await Promise.all([
    safeJson(incR), safeJson(expR), safeJson(payR),
    safeJson(pastIncR), safeJson(pastExpR), safeJson(pastPayR), safeJson(allPayR),
  ])

  type Inc = { amount: number; is_paid: boolean; month: number; year: number; sources?: string[] }
  type Exp = { amount: number; is_paid: boolean; month: number; year: number; category: string }
  type Pay = { net_pay: number; is_paid: boolean; period_month: number; period_year: number; withholding_tax: number }

  const totalIncome = incomes.reduce((s: number, r: Inc) => s + Number(r.amount), 0)
  const totalPayroll = payslips.reduce((s: number, p: Pay) => s + Number(p.net_pay), 0)
  const totalExpenseManual = expenses.reduce((s: number, r: Exp) => s + Number(r.amount), 0)
  const totalExpense = totalExpenseManual + totalPayroll
  const netProfit = totalIncome - totalExpense

  const actualIncome = incomes.filter((r: Inc) => r.is_paid).reduce((s: number, r: Inc) => s + Number(r.amount), 0)
  const actualExpenseManual = expenses.filter((r: Exp) => r.is_paid).reduce((s: number, r: Exp) => s + Number(r.amount), 0)
  const actualPayroll = payslips.filter((p: Pay) => p.is_paid).reduce((s: number, p: Pay) => s + Number(p.net_pay), 0)
  const actualExpense = actualExpenseManual + actualPayroll

  const isBeforeNow = (m: number, y: number) => y < year || (y === year && m < month)
  const carryIncome = pastIncomes.filter((r: Inc) => r.is_paid && isBeforeNow(r.month, r.year)).reduce((s: number, r: Inc) => s + Number(r.amount), 0)
  const carryExpense = pastExpenses.filter((r: Exp) => r.is_paid && isBeforeNow(r.month, r.year)).reduce((s: number, r: Exp) => s + Number(r.amount), 0)
    + pastPayslips.filter((p: Pay) => p.is_paid && isBeforeNow(p.period_month, p.period_year)).reduce((s: number, p: Pay) => s + Number(p.net_pay), 0)
  const carryBalance = carryIncome - carryExpense
  const currentBalance = carryBalance + (actualIncome - actualExpense)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMonthWHT = pastPayslips
    .filter((p: Pay) => p.period_month === prevMonth && p.period_year === prevYear)
    .reduce((s: number, p: Pay) => s + Number(p.withholding_tax), 0)
  const currentMonthWHT = payslips.reduce((s: number, p: Pay) => s + Number(p.withholding_tax), 0)
  const whtFromPayslips = currentMonthWHT
  const taxPaidThisMonth = expenses.filter((e: Exp) => e.category === 'tax' && e.is_paid)
  const prevWHTSubmitted = prevMonthWHT > 0 &&
    (taxPaidThisMonth as Exp[]).some((e: Exp) => Math.abs(Number(e.amount) - prevMonthWHT) < 200)

  const expenseByCategory: Record<string,number> = {}
  for (const e of expenses as Exp[]) {
    const label = EXPENSE_LABELS[e.category] ?? e.category
    expenseByCategory[label] = (expenseByCategory[label] ?? 0) + Number(e.amount)
  }
  if (totalPayroll > 0) expenseByCategory['👥 เงินเดือน (payroll)'] = (expenseByCategory['👥 เงินเดือน (payroll)'] ?? 0) + totalPayroll

  const incomeBySource: Record<string,number> = {}
  for (const inc of incomes as Inc[]) {
    const srcs = Array.isArray(inc.sources) && inc.sources.length ? inc.sources : ['other']
    for (const s of srcs) {
      const label = SOURCE_LABELS[s] ?? s
      incomeBySource[label] = (incomeBySource[label] ?? 0) + Number(inc.amount) / srcs.length
    }
  }

  const ytdIncomes = (pastIncomes as Inc[]).filter(r => r.year === year && r.month <= month)
  const yearToDateIncome = ytdIncomes.reduce((s: number, r: Inc) => s + Number(r.amount), 0)
  const yearToDateExpense = (pastExpenses as Exp[]).filter(r => r.year === year && r.month <= month).reduce((s: number, r: Exp) => s + Number(r.amount), 0)
    + (allPayslips as Pay[]).filter(p => p.period_year === year && p.period_month <= month).reduce((s: number, p: Pay) => s + Number(p.net_pay), 0)
  const yearToDateProfit = yearToDateIncome - yearToDateExpense

  return {
    totalIncome, totalExpense, netProfit,
    actualIncome, actualExpense,
    carryBalance, currentBalance,
    prevMonthWHT, currentMonthWHT, prevWHTSubmitted,
    expenseByCategory, incomeBySource,
    totalPayroll, whtFromPayslips,
    yearToDateIncome, yearToDateProfit,
  }
}


function buildPrompt(month: number, year: number, d: {
  totalIncome: number; totalExpense: number; netProfit: number
  actualIncome: number; actualExpense: number
  carryBalance: number; currentBalance: number
  prevMonthWHT: number; currentMonthWHT: number; prevWHTSubmitted: boolean
  expenseByCategory: Record<string,number>; incomeBySource: Record<string,number>
  totalPayroll: number; whtFromPayslips: number
  yearToDateIncome: number; yearToDateProfit: number
}): string {
  const thb = (v: number) => Number(v).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })
  const monthName = MONTH_FULL[month - 1]
  const nextMonthName = MONTH_FULL[month % 12]
  return `คุณคือ CFO / หัวหน้าฝ่ายบัญชีของ SME ไทย (บริษัท Digital Marketing) ที่มีประสบการณ์สูง
สรุปรายงานภาษีและการเงินประจำเดือน ภาษาไทย เป็นกันเอง ชัดเจน

---
**เดือน ${monthName} ${year + 543}**
💰 รายรับ: ${thb(d.totalIncome)} | 💸 รายจ่าย: ${thb(d.totalExpense)} (เงินเดือน ${thb(d.totalPayroll)}) | 📊 กำไร: ${thb(d.netProfit)}
✅ รับจริง: ${thb(d.actualIncome)} | จ่ายจริง: ${thb(d.actualExpense)}
🏦 เงินสดคงเหลือ: ${thb(d.currentBalance)} (ยกมา ${thb(d.carryBalance)})

📈 รายรับ: ${Object.entries(d.incomeBySource).sort(([,a],[,b])=>b-a).map(([k,v])=>`${k} ${thb(v)}`).join(' | ')}
📦 รายจ่าย: ${Object.entries(d.expenseByCategory).sort(([,a],[,b])=>b-a).map(([k,v])=>`${k} ${thb(v)}`).join(' | ')}

🏛️ WHT เดือนที่แล้ว (ส่ง 7 ${monthName}): ${d.prevMonthWHT > 0 ? thb(d.prevMonthWHT) + (d.prevWHTSubmitted ? ' ✅ นำส่งแล้ว' : ' ⚠️ ยังไม่ส่ง') : 'ไม่มี'}
🏛️ WHT เดือนนี้ (ส่ง 7 ${nextMonthName}): ${d.currentMonthWHT > 0 ? thb(d.currentMonthWHT) : 'ไม่มี'}
🏛️ WHT จากเงินเดือนพนักงาน ภ.ง.ด.1: ${thb(d.whtFromPayslips)}
📅 YTD รายได้: ${thb(d.yearToDateIncome)} | กำไรสะสม: ${thb(d.yearToDateProfit)}

---
สรุป 3 หัวข้อนี้เท่านั้น ห้ามข้าม:

## 🧮 ภาษีที่ต้องจัดเตรียมเดือนนี้ (ครบกำหนดเมื่อไหร่ และยอดเท่าไหร่)
อธิบายหลักการคิดแต่ละประเภท พร้อมตัวเลขประมาณจากข้อมูลจริง:
1. **ภ.ง.ด.1** WHT เงินเดือนพนักงาน — ส่งวันที่ 7 ${nextMonthName}
2. **ภ.ง.ด.53** WHT ค่าบริการ/freelance — ส่งวันที่ 7 ${nextMonthName}
3. **ภ.พ.30** VAT — Output VAT ≈ ${thb(d.totalIncome * 0.07)} (ก่อนหัก Input VAT) — ส่งวันที่ 15 ${nextMonthName}
4. **ภ.ง.ด.51/50** ภาษีนิติบุคคล — คาดการณ์จาก YTD profit ${thb(d.yearToDateProfit)}

## 💡 คำแนะนำ CFO
2-3 ข้อ practical: cash flow, tax planning, ค่าใช้จ่ายลดหย่อนภาษีได้

## ⚠️ สิ่งที่ต้องระวัง
ประเด็นเร่งด่วน/ความเสี่ยงจากข้อมูลเดือนนี้

ใช้ภาษาไทยธรรมดา กระชับ ตรงประเด็น`
}

// POST: รับแค่ {month, year} → ดึงข้อมูลเองแล้ว generate (manual trigger)
//       หรือรับข้อมูลครบ → generate เลย (จาก scheduled function)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? ''
  // อนุญาต admin login (ไม่มี secret) หรือ cron job (secret ถูก)
  const isAdmin = !CRON_SECRET || req.cookies.get('admin_username')?.value
  const isCron = CRON_SECRET && secret === CRON_SECRET
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { month, year, triggerType = 'manual' } = body

  if (!month || !year) return NextResponse.json({ error: 'missing month/year' }, { status: 400 })

  let data: Awaited<ReturnType<typeof fetchFinancialData>>
  if (body.totalIncome !== undefined) {
    // ข้อมูลส่งมาครบ (จาก scheduled function)
    data = body
  } else {
    // Manual trigger — ดึงข้อมูลเอง
    const siteUrl = process.env.URL ?? process.env.DEPLOY_URL ?? 'https://peepzfinance.netlify.app'
    data = await fetchFinancialData(month, year, siteUrl)
  }

  const prompt = buildPrompt(month, year, data)
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })
  const analysis = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  const { error } = await supabaseAdmin
    .from('ai_analysis_cache')
    .upsert({ month, year, analysis, updated_at: new Date().toISOString(), trigger_type: triggerType }, { onConflict: 'month,year' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, analysis })
}
