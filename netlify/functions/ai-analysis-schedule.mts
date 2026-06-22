import type { Config } from '@netlify/functions'

// รันทุกวัน เช็คว่าเป็นวันที่ 1, 15 หรือวันสุดท้ายของเดือน
export const config: Config = {
  schedule: '0 1 * * *', // 08:00 น. ไทย (01:00 UTC) ทุกวัน
}

export default async () => {
  const now = new Date()
  const bangkokOffset = 7 * 60 * 60 * 1000
  const bkk = new Date(now.getTime() + bangkokOffset)

  const day = bkk.getUTCDate()
  const month = bkk.getUTCMonth() + 1
  const year = bkk.getUTCFullYear()

  // หาวันสุดท้ายของเดือน
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const isScheduledDay = day === 1 || day === 15 || day === lastDay

  if (!isScheduledDay) {
    console.log(`[ai-analysis] Not a scheduled day (${day}/${month}/${year}), skipping.`)
    return
  }

  const triggerType = day === 1 ? 'month_start' : day === 15 ? 'mid_month' : 'month_end'
  console.log(`[ai-analysis] Running for ${month}/${year} — trigger: ${triggerType}`)

  const siteUrl = process.env.URL ?? 'https://peepzfinance.netlify.app'
  const secret = process.env.CRON_SECRET ?? ''

  try {
    // ดึงข้อมูลการเงินเดือนปัจจุบัน
    const [incRes, expRes, payRes, pastIncRes, pastExpRes, pastPayRes, allPayRes] = await Promise.all([
      fetch(`${siteUrl}/api/income-records?month=${month}&year=${year - 543}`),
      fetch(`${siteUrl}/api/expense-records?month=${month}&year=${year - 543}`),
      fetch(`${siteUrl}/api/payslips?month=${month}&year=${year - 543}`),
      fetch(`${siteUrl}/api/income-records`),
      fetch(`${siteUrl}/api/expense-records`),
      fetch(`${siteUrl}/api/payslips`),
      fetch(`${siteUrl}/api/payslips?year=${year - 543}`),
    ])

    const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
    const [incomes, expenses, payslips, pastIncomes, pastExpenses, pastPayslips, allPayslips] = await Promise.all([
      safeJson(incRes), safeJson(expRes), safeJson(payRes),
      safeJson(pastIncRes), safeJson(pastExpRes), safeJson(pastPayRes), safeJson(allPayRes),
    ])

    const gregYear = year - 543

    const totalIncome = incomes.reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0)
    const totalPayroll = payslips.reduce((s: number, p: {net_pay: number}) => s + Number(p.net_pay), 0)
    const totalExpenseManual = expenses.reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0)
    const totalExpense = totalExpenseManual + totalPayroll
    const netProfit = totalIncome - totalExpense

    const actualIncome = incomes.filter((r: {is_paid: boolean}) => r.is_paid).reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0)
    const actualExpenseManual = expenses.filter((r: {is_paid: boolean}) => r.is_paid).reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0)
    const actualPayroll = payslips.filter((p: {is_paid: boolean}) => p.is_paid).reduce((s: number, p: {net_pay: number}) => s + Number(p.net_pay), 0)
    const actualExpense = actualExpenseManual + actualPayroll

    const isBeforeNow = (m: number, y: number) => y < gregYear || (y === gregYear && m < month)
    const carryIncome = pastIncomes.filter((r: {is_paid:boolean;month:number;year:number}) => r.is_paid && isBeforeNow(r.month, r.year)).reduce((s: number, r: {amount:number}) => s + Number(r.amount), 0)
    const carryExpense = pastExpenses.filter((r: {is_paid:boolean;month:number;year:number}) => r.is_paid && isBeforeNow(r.month, r.year)).reduce((s: number, r: {amount:number}) => s + Number(r.amount), 0)
      + pastPayslips.filter((p: {is_paid:boolean;period_month:number;period_year:number}) => p.is_paid && isBeforeNow(p.period_month, p.period_year)).reduce((s: number, p: {net_pay:number}) => s + Number(p.net_pay), 0)
    const carryBalance = carryIncome - carryExpense
    const currentBalance = carryBalance + (actualIncome - actualExpense)

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? gregYear - 1 : gregYear
    const prevMonthWHT = pastPayslips
      .filter((p: {period_month:number;period_year:number}) => p.period_month === prevMonth && p.period_year === prevYear)
      .reduce((s: number, p: {withholding_tax:number}) => s + Number(p.withholding_tax), 0)
    const currentMonthWHT = payslips.reduce((s: number, p: {withholding_tax:number}) => s + Number(p.withholding_tax), 0)
    const whtFromPayslips = payslips.reduce((s: number, p: {withholding_tax:number}) => s + Number(p.withholding_tax), 0)
    const taxPaidThisMonth = expenses.filter((e: {category:string;is_paid:boolean}) => e.category === 'tax' && e.is_paid)
    const prevWHTSubmitted = prevMonthWHT > 0 &&
      taxPaidThisMonth.some((e: {amount:number}) => Math.abs(Number(e.amount) - prevMonthWHT) < 200)

    const INCOME_SOURCES = ['live','influencer','content','ads','seeding','event','other']
    const SOURCE_LABELS: Record<string,string> = { live:'📺 Live Commerce', influencer:'🌟 Influencer Review', content:'📝 Content Production', ads:'📢 Ads', seeding:'🌱 Seeding Marketing', event:'🎪 Event', other:'🔧 อื่นๆ' }
    const EXPENSE_CATEGORIES: Record<string,string> = { rent:'🏠 ค่าเช่าออฟฟิศ', utilities:'⚡ ค่าน้ำ/ไฟ/เน็ต', software:'💻 ค่า Software', domain:'🌐 Domain/Hosting', equipment:'🖥️ ค่าอุปกรณ์', team_food:'🍽️ เลี้ยงข้าวทีม', team_outing:'🏕️ Outing', team_party:'🎉 Party', team_snack:'🧃 Snack', team_birthday:'🎂 Birthday', team_welcome:'🤝 Welcome', team_activity:'🎯 Activity', ads:'📢 ค่าโฆษณา', marketing_ops:'🛠️ Marketing Ops', salary:'👥 เงินเดือน', freelance:'🎨 Freelance', tax:'🏛️ ภาษี', petty_cash:'💼 Petty Cash', other:'📦 อื่นๆ' }

    const expenseByCategory: Record<string,number> = {}
    for (const e of expenses) {
      const label = EXPENSE_CATEGORIES[e.category] ?? e.category
      expenseByCategory[label] = (expenseByCategory[label] ?? 0) + Number(e.amount)
    }
    if (totalPayroll > 0) expenseByCategory['👥 เงินเดือน (payroll)'] = (expenseByCategory['👥 เงินเดือน (payroll)'] ?? 0) + totalPayroll

    const incomeBySource: Record<string,number> = {}
    for (const inc of incomes) {
      const srcs = Array.isArray(inc.sources) && inc.sources.length ? inc.sources : ['other']
      for (const s of srcs) {
        const label = SOURCE_LABELS[s] ?? s
        incomeBySource[label] = (incomeBySource[label] ?? 0) + Number(inc.amount) / srcs.length
      }
    }

    const yearToDateIncome = pastIncomes.filter((r: {year:number;month:number}) => r.year === gregYear && r.month <= month).reduce((s: number, r: {amount:number}) => s + Number(r.amount), 0)
    const yearToDateExpense = pastExpenses.filter((r: {year:number;month:number}) => r.year === gregYear && r.month <= month).reduce((s: number, r: {amount:number}) => s + Number(r.amount), 0)
      + allPayslips.filter((p: {period_year:number;period_month:number}) => p.period_year === gregYear && p.period_month <= month).reduce((s: number, p: {net_pay:number}) => s + Number(p.net_pay), 0)
    const yearToDateProfit = yearToDateIncome - yearToDateExpense

    const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

    const res = await fetch(`${siteUrl}/api/ai-analysis-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({
        month, year,
        monthName: MONTH_FULL[month - 1],
        totalIncome, totalExpense, netProfit,
        actualIncome, actualExpense,
        carryBalance, currentBalance,
        prevMonthWHT, currentMonthWHT, prevWHTSubmitted,
        expenseByCategory, incomeBySource,
        totalPayroll, whtFromPayslips,
        yearToDateIncome, yearToDateProfit,
        triggerType,
      }),
    })

    const result = await res.json()
    if (!res.ok) {
      console.error('[ai-analysis] Failed:', result)
    } else {
      console.log(`[ai-analysis] Done for ${month}/${year}`)
    }
  } catch (err) {
    console.error('[ai-analysis] Error:', err)
  }
}
