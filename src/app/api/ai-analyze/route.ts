import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    month, year, monthName,
    totalIncome, totalExpense, netProfit,
    actualIncome, actualExpense, actualProfit,
    carryBalance, currentBalance,
    prevMonthWHT, currentMonthWHT, prevWHTSubmitted,
    expenseByCategory,
    incomeBySource,
    totalPayroll,
    whtFromPayslips,
    yearToDateIncome,
    yearToDateProfit,
  } = body

  const thb = (v: number) => v.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })

  const prompt = `คุณคือ CFO / หัวหน้าฝ่ายบัญชีของ SME ไทย (บริษัท Digital Marketing) ที่มีประสบการณ์สูง
ให้วิเคราะห์ข้อมูลการเงินด้านล่าง และสรุปเป็น **รายงานภาษีและการเงินประจำเดือน** ภาษาไทย เป็นกันเอง ชัดเจน

---
**ข้อมูลเดือน ${monthName} ${year + 543}**

💰 รายรับ: ${thb(totalIncome)}
💸 รายจ่าย: ${thb(totalExpense)} (รวมเงินเดือน ${thb(totalPayroll)})
📊 กำไรสุทธิ: ${thb(netProfit)}
🏦 เงินสดคงเหลือ (ยกมา + เดือนนี้): ${thb(currentBalance)}

📈 รายรับแยกประเภท:
${Object.entries(incomeBySource as Record<string, number>).sort(([,a],[,b]) => b - a).map(([k,v]) => `- ${k}: ${thb(v as number)}`).join('\n')}

📦 รายจ่ายแยกหมวด:
${Object.entries(expenseByCategory as Record<string, number>).sort(([,a],[,b]) => b - a).map(([k,v]) => `- ${k}: ${thb(v as number)}`).join('\n')}

🏛️ WHT ที่หักจากการจ่าย freelance:
- เดือนที่แล้ว (ต้องนำส่งเดือนนี้ วันที่ 7): ${prevMonthWHT > 0 ? thb(prevMonthWHT) + (prevWHTSubmitted ? ' ✅ นำส่งแล้ว' : ' ⚠️ ยังไม่ส่ง') : 'ไม่มี'}
- เดือนนี้ (นำส่งเดือนหน้า วันที่ 7): ${currentMonthWHT > 0 ? thb(currentMonthWHT) : 'ไม่มี'}

📅 รายได้สะสมตั้งแต่ต้นปี: ${thb(yearToDateIncome ?? 0)}
💹 กำไรสะสมตั้งแต่ต้นปี: ${thb(yearToDateProfit ?? 0)}

---
กรุณาสรุปเป็นหัวข้อดังนี้ (ห้ามข้ามหัวข้อใด):

## 🧮 ภาษีที่ต้องจ่ายเดือนนี้ (กำหนดส่ง)
แสดงภาษีแต่ละประเภทที่เกี่ยวข้องกับข้อมูลนี้ พร้อมหลักการคิดและยอดประมาณ:

1. **ภ.ง.ด.1** (ภาษีหัก ณ ที่จ่าย จากเงินเดือนพนักงาน) — ครบกำหนด 7 ${monthName === 'มิถุนายน' ? 'กรกฎาคม' : 'เดือนถัดไป'}
   - หลักการ: หักจากเงินเดือนพนักงาน อัตราขึ้นกับรายได้รวมทั้งปี
   - WHT จากระบบ payslip: ${thb(whtFromPayslips ?? 0)}

2. **ภ.ง.ด.53** (WHT ค่าบริการ/freelance จากบริษัท) — ครบกำหนด 7 ${monthName === 'มิถุนายน' ? 'กรกฎาคม' : 'เดือนถัดไป'}
   - หลักการ: หัก 3% จากค่าจ้างที่จ่ายให้นิติบุคคล/บุคคลธรรมดา
   - ยอดจาก freelance payslip: ${thb(currentMonthWHT)}

3. **ภ.พ.30** (ภาษีมูลค่าเพิ่ม VAT) — ครบกำหนด 15 ${monthName === 'มิถุนายน' ? 'กรกฎาคม' : 'เดือนถัดไป'}
   - หลักการ: ภาษีขาย (Output VAT) = รายรับ × 7% หักด้วยภาษีซื้อ (Input VAT) จากค่าใช้จ่ายที่มีใบกำกับภาษี
   - ประมาณ Output VAT: ${thb(totalIncome * 0.07)}
   - *หมายเหตุ: ต้องหัก Input VAT จากใบกำกับภาษีที่ได้รับจริงด้วย

4. **ภ.ง.ด.51** (ภาษีเงินได้นิติบุคคลครึ่งปี) — ยื่นภายใน 2 เดือนหลังสิ้นรอบ 6 เดือน
   - หลักการ: SME อัตราภาษี 15% (กำไร 300K-3M) หรือ 20% (เกิน 3M) — ต้องประมาณกำไรทั้งปีก่อน
   - กำไรสะสม YTD: ${thb(yearToDateProfit ?? 0)} — คาดการณ์ทั้งปีและเตรียมจ่ายล่วงหน้า

## 💡 คำแนะนำจาก CFO
ให้ 2-3 ข้อที่ practical และทำได้จริงสำหรับ SME ขนาดนี้ เช่น เรื่อง cash flow, tax planning, ค่าใช้จ่ายที่ลดหย่อนได้

## ⚠️ สิ่งที่ต้องระวัง
ประเด็นเร่งด่วนหรือความเสี่ยงที่เห็นจากข้อมูลนี้

---
ใช้ภาษาไทยธรรมดา เป็นกันเอง ไม่ทางการ ตรงประเด็น ห้ามพูดสิ่งที่ไม่มีข้อมูลรองรับ`

  const stream = await client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
