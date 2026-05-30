import nodemailer from 'nodemailer'
import { Payslip } from '@/types'
import { formatCurrency, formatPeriod } from './utils'

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_KEY!,
    },
  })
}

function buildPayslipEmailHtml(payslip: Payslip): string {
  const emp = payslip.employee!
  const period = formatPeriod(payslip.period_month, payslip.period_year)
  const isFreelance = emp.type === 'freelance'

  const incomeRows = isFreelance
    ? (payslip.line_items?.length
        ? payslip.line_items.map((item) =>
            `<tr><td>${item.description || 'งาน'} <span style="color:#666;font-size:12px">(${item.quantity} ${item.unit} × ${formatCurrency(item.rate)})</span></td><td align="right">${formatCurrency(item.total)}</td></tr>`
          ).join('')
        : `<tr><td>ค่าจ้าง${payslip.project_name ? ` (${payslip.project_name})` : ''}</td><td align="right">${formatCurrency(payslip.base_salary)}</td></tr>`
      )
    : `
      <tr><td>เงินเดือน</td><td align="right">${formatCurrency(payslip.base_salary)}</td></tr>
      ${payslip.ot_amount > 0 ? `<tr><td>ค่า OT (${payslip.ot_hours} ชม. × ${formatCurrency(payslip.ot_rate)})</td><td align="right">${formatCurrency(payslip.ot_amount)}</td></tr>` : ''}
      ${payslip.incentive > 0 ? `<tr><td>Incentive${payslip.incentive_note ? ` <span style="color:#666;font-size:13px">(${payslip.incentive_note})</span>` : ''}</td><td align="right">${formatCurrency(payslip.incentive)}</td></tr>` : ''}
    `

  const otherIncomeRow = payslip.other_income > 0
    ? `<tr><td>รายได้อื่นๆ${payslip.other_income_note ? ` (${payslip.other_income_note})` : ''}</td><td align="right">${formatCurrency(payslip.other_income)}</td></tr>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Sarabun', Arial, sans-serif; background:#f5f5f5; margin:0; padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="background:#4f46e5; color:white; padding:24px 32px;">
          <h1 style="margin:0; font-size:22px">สลิปเงินเดือน / ใบจ่ายค่าจ้าง</h1>
          <p style="margin:8px 0 0; opacity:0.85">${period}</p>
        </div>
        <div style="padding:24px 32px;">
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
            <tr><td style="color:#666">ชื่อ</td><td><strong>${emp.name}</strong></td></tr>
            ${emp.employee_code ? `<tr><td style="color:#666">รหัสพนักงาน</td><td>${emp.employee_code}</td></tr>` : ''}
            <tr><td style="color:#666">ประเภท</td><td>${isFreelance ? 'Freelance' : 'พนักงานประจำ'}</td></tr>
            ${emp.department ? `<tr><td style="color:#666">แผนก</td><td>${emp.department}</td></tr>` : ''}
          </table>

          <h3 style="color:#4f46e5; border-bottom:2px solid #e0e7ff; padding-bottom:8px">รายได้</h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:16px">
            ${incomeRows}
            ${otherIncomeRow}
            <tr style="font-weight:bold; border-top:1px solid #e5e7eb">
              <td style="padding-top:8px">รวมรายได้</td>
              <td align="right" style="padding-top:8px; color:#059669">${formatCurrency(payslip.gross_income)}</td>
            </tr>
          </table>

          <h3 style="color:#dc2626; border-bottom:2px solid #fee2e2; padding-bottom:8px">รายการหัก</h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:16px">
            ${payslip.social_security > 0 ? `<tr><td>ประกันสังคม</td><td align="right">${formatCurrency(payslip.social_security)}</td></tr>` : ''}
            ${payslip.withholding_tax > 0 ? `<tr><td>ภาษีหัก ณ ที่จ่าย${isFreelance ? ' (3%)' : ' (3% Incentive)'}</td><td align="right">${formatCurrency(payslip.withholding_tax)}</td></tr>` : ''}
            ${payslip.other_deduction > 0 ? `<tr><td>หักอื่นๆ${payslip.other_deduction_note ? ` (${payslip.other_deduction_note})` : ''}</td><td align="right">${formatCurrency(payslip.other_deduction)}</td></tr>` : ''}
            <tr style="font-weight:bold; border-top:1px solid #e5e7eb">
              <td style="padding-top:8px">รวมหัก</td>
              <td align="right" style="padding-top:8px; color:#dc2626">${formatCurrency(payslip.total_deduction)}</td>
            </tr>
          </table>

          <div style="background:#f0fdf4; border:2px solid #86efac; border-radius:8px; padding:16px; text-align:center; margin:20px 0">
            <div style="color:#666; font-size:14px">ยอดสุทธิที่ได้รับ</div>
            <div style="font-size:28px; font-weight:bold; color:#15803d">${formatCurrency(payslip.net_pay)}</div>
          </div>

          ${payslip.admin_note ? `<div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:12px; margin-top:8px"><strong>หมายเหตุ:</strong> ${payslip.admin_note}</div>` : ''}

          <div style="text-align:center; margin-top:16px; color:#9ca3af; font-size:12px">
            หากมีข้อสงสัยกรุณาติดต่อ HR
          </div>
        </div>
        <div style="background:#f9fafb; padding:16px 32px; color:#9ca3af; font-size:12px; text-align:center">
          ข้อมูลนี้เป็นความลับ กรุณาอย่าเผยแพร่ต่อ
        </div>
      </div>
    </body>
    </html>
  `
}

export async function sendPayslipEmail(payslip: Payslip) {
  const emp = payslip.employee!
  const period = formatPeriod(payslip.period_month, payslip.period_year)
  const transporter = createTransporter()

  const result = await transporter.sendMail({
    from: `"Payslip System" <${process.env.BREVO_SENDER_EMAIL}>`,
    to: emp.email,
    cc: process.env.ADMIN_EMAIL!,
    subject: `สลิปเงินเดือน ${period} — ${emp.name}`,
    html: buildPayslipEmailHtml(payslip),
  })

  return result
}
