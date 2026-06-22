import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '0')
  const year = parseInt(searchParams.get('year') ?? '0')
  if (!month || !year) return NextResponse.json({ error: 'missing month/year' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('ai_analysis_cache')
    .select('analysis, updated_at, trigger_type')
    .eq('month', month)
    .eq('year', year)
    .single()

  if (error || !data) return NextResponse.json({ analysis: null, updated_at: null })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    month, year, monthName,
    totalIncome, totalExpense, netProfit,
    actualIncome, actualExpense,
    carryBalance, currentBalance,
    prevMonthWHT, currentMonthWHT, prevWHTSubmitted,
    expenseByCategory, incomeBySource,
    totalPayroll, whtFromPayslips,
    yearToDateIncome, yearToDateProfit,
    triggerType = 'auto',
  } = body

  const thb = (v: number) => Number(v).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })
  const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
  const nextMonthName = MONTH_FULL[month % 12]

  const prompt = `คุณคือ CFO / หัวหน้าฝ่ายบัญชีของ SME ไทย (บริษัท Digital Marketing) ที่มีประสบการณ์สูง
ให้วิเคราะห์ข้อมูลการเงินด้านล่าง และสรุปเป็น **รายงานภาษีและการเงินประจำเดือน** ภาษาไทย เป็นกันเอง ชัดเจน

---
**ข้อมูลเดือน ${monthName} ${year + 543}**

💰 รายรับ: ${thb(totalIncome)}
💸 รายจ่าย: ${thb(totalExpense)} (รวมเงินเดือน ${thb(totalPayroll)})
📊 กำไรสุทธิ: ${thb(netProfit)}
✅ รับจริงแล้ว: ${thb(actualIncome)} | จ่ายจริงแล้ว: ${thb(actualExpense)}
🏦 เงินสดคงเหลือ: ${thb(currentBalance)} (ยกมา ${thb(carryBalance)})

📈 รายรับแยกประเภท:
${Object.entries(incomeBySource as Record<string,number>).sort(([,a],[,b])=>b-a).map(([k,v])=>`- ${k}: ${thb(v)}`).join('\n')}

📦 รายจ่ายแยกหมวด:
${Object.entries(expenseByCategory as Record<string,number>).sort(([,a],[,b])=>b-a).map(([k,v])=>`- ${k}: ${thb(v)}`).join('\n')}

🏛️ WHT จาก payslip เดือนที่แล้ว (ต้องส่งวันที่ 7 ${monthName}): ${prevMonthWHT > 0 ? thb(prevMonthWHT) + (prevWHTSubmitted ? ' ✅ นำส่งแล้ว' : ' ⚠️ ยังไม่ส่ง') : 'ไม่มี'}
🏛️ WHT เดือนนี้ (นำส่ง 7 ${nextMonthName}): ${currentMonthWHT > 0 ? thb(currentMonthWHT) : 'ไม่มี'}
🏛️ WHT จากเงินเดือนพนักงาน (ภ.ง.ด.1): ${thb(whtFromPayslips ?? 0)}

📅 รายได้สะสม YTD: ${thb(yearToDateIncome ?? 0)}
💹 กำไรสะสม YTD: ${thb(yearToDateProfit ?? 0)}

---
สรุปเป็น 3 หัวข้อ:

## 🧮 ภาษีที่ต้องจัดเตรียมเดือนนี้
แสดงทุกประเภทที่เกี่ยวข้อง พร้อมหลักการคิดและยอดประมาณ:
1. ภ.ง.ด.1 (WHT เงินเดือนพนักงาน) — ครบกำหนด 7 ${nextMonthName}
2. ภ.ง.ด.53 (WHT ค่าบริการ/freelance) — ครบกำหนด 7 ${nextMonthName}
3. ภ.พ.30 (VAT 7%) — ครบกำหนด 15 ${nextMonthName} — Output VAT ≈ ${thb(totalIncome * 0.07)} (ก่อนหัก Input VAT)
4. ภ.ง.ด.51 หรือ ภ.ง.ด.50 (ถ้าถึงรอบ) — ประมาณจาก YTD profit ${thb(yearToDateProfit ?? 0)}

## 💡 คำแนะนำ CFO
2-3 ข้อที่ทำได้จริง เรื่อง cash flow / tax planning / ค่าใช้จ่ายลดหย่อน

## ⚠️ สิ่งที่ต้องระวัง
ประเด็นเร่งด่วนหรือความเสี่ยงจากข้อมูลเดือนนี้

ใช้ภาษาไทยเป็นกันเอง กระชับ ตรงประเด็น ห้ามพูดสิ่งที่ไม่มีข้อมูล`

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
