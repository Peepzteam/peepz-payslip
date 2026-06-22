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
  } = body

  const prompt = `คุณเป็นที่ปรึกษาการเงินสำหรับ SME ไทย วิเคราะห์ข้อมูลการเงินของบริษัทด้านล่างนี้ แล้วให้คำแนะนำที่เป็นประโยชน์จริงๆ สั้นกระชับ ตรงประเด็น ภาษาไทยเป็นกันเอง

**ข้อมูลเดือน ${monthName} ${year + 543}**

💰 ภาพรวม:
- รายรับตามแผน: ${totalIncome.toLocaleString('th-TH', {style:'currency', currency:'THB'})}
- รายจ่ายตามแผน: ${totalExpense.toLocaleString('th-TH', {style:'currency', currency:'THB'})} (เงินเดือน+ค่าใช้จ่าย)
- กำไรสุทธิตามแผน: ${netProfit.toLocaleString('th-TH', {style:'currency', currency:'THB'})}

✅ เกิดขึ้นจริงแล้ว (ณ ปัจจุบัน):
- รายรับจริง: ${actualIncome.toLocaleString('th-TH', {style:'currency', currency:'THB'})}
- รายจ่ายจริง: ${actualExpense.toLocaleString('th-TH', {style:'currency', currency:'THB'})}
- กำไรจริง: ${actualProfit.toLocaleString('th-TH', {style:'currency', currency:'THB'})}

🏦 สถานะเงินสด:
- ยอดยกมา: ${carryBalance.toLocaleString('th-TH', {style:'currency', currency:'THB'})}
- ยอดเงินสดปัจจุบัน (ยกมา + เกิดจริงเดือนนี้): ${currentBalance.toLocaleString('th-TH', {style:'currency', currency:'THB'})}

👥 เงินเดือนพนักงาน: ${totalPayroll.toLocaleString('th-TH', {style:'currency', currency:'THB'})}

📊 รายจ่ายแยกตามหมวด:
${Object.entries(expenseByCategory as Record<string, number>)
  .sort(([,a],[,b]) => b - a)
  .map(([k, v]) => `- ${k}: ${(v as number).toLocaleString('th-TH', {style:'currency', currency:'THB'})}`)
  .join('\n')}

📈 รายรับแยกตามประเภท:
${Object.entries(incomeBySource as Record<string, number>)
  .sort(([,a],[,b]) => b - a)
  .map(([k, v]) => `- ${k}: ${(v as number).toLocaleString('th-TH', {style:'currency', currency:'THB'})}`)
  .join('\n')}

🏛️ WHT:
- เดือนที่แล้ว: ${prevMonthWHT > 0 ? prevMonthWHT.toLocaleString('th-TH', {style:'currency', currency:'THB'}) + (prevWHTSubmitted ? ' (นำส่งแล้ว ✅)' : ' (ยังไม่นำส่ง ⚠️)') : 'ไม่มี'}
- เดือนนี้: ${currentMonthWHT > 0 ? currentMonthWHT.toLocaleString('th-TH', {style:'currency', currency:'THB'}) + ' (นำส่งเดือนหน้า)' : 'ไม่มี'}

---
วิเคราะห์ใน 3-4 ประเด็นสั้นๆ:
1. **สุขภาพกระแสเงินสด** — ดีหรือน่าเป็นห่วง?
2. **สัดส่วนค่าใช้จ่าย** — หมวดไหนหนักเกินไปหรือน่าสังเกต?
3. **รายรับ** — แหล่งรายได้ดูเป็นยังไง? มีความเสี่ยงไหม?
4. **ข้อแนะนำ** — 1-2 อย่างที่ทำได้จริงเดือนนี้

ห้ามยาวเกินไป ห้ามพูดสิ่งที่ไม่มีข้อมูล ใช้ภาษาไทยธรรมดา เป็นกันเอง ไม่ต้องทางการ`

  const stream = await client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
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
