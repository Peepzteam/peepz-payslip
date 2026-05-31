'use client'
import { useRef } from 'react'
import { Payslip, LineItem } from '@/types'
import { formatCurrency, formatPeriod } from '@/lib/utils'
import { Download, Image } from 'lucide-react'

interface Props {
  payslip: Payslip
  showExport?: boolean
}

export default function PayslipCard({ payslip, showExport = false }: Props) {
  const isFreelance = payslip.employee ? payslip.employee.type === 'freelance' : payslip.guest_type === 'freelance'
  const displayName = payslip.employee?.name ?? payslip.guest_name ?? ''
  const displayCode = payslip.employee?.employee_code
  const cardRef = useRef<HTMLDivElement>(null)

  async function downloadPNG() {
    try {
      const html2canvas = (await import('html2canvas')).default
      const html = buildPrintHtml(payslip)

      const win = window.open('', '_blank', 'width=640,height=900')
      if (!win) { alert('กรุณาอนุญาต popup ก่อนนะ'); return }
      win.document.write(html)
      win.document.close()

      await new Promise((r) => setTimeout(r, 500))

      const canvas = await html2canvas(win.document.body, {
        scale: 2,
        backgroundColor: '#f5f5f5',
        logging: false,
        windowWidth: 640,
      })
      win.close()

      const filename = `สลิป-${displayName || 'payslip'}-${formatPeriod(payslip.period_month, payslip.period_year)}.png`
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('PNG export failed:', err)
      alert('เซฟรูปไม่ได้: ' + String(err))
    }
  }

  function downloadPDF() {
    const style = document.createElement('style')
    style.id = '__print_override'
    style.innerHTML = `
      @media print {
        body > *:not(#__payslip_print_root) { display: none !important; }
        #__payslip_print_root { display: block !important; position: static !important; }
        @page { margin: 10mm; size: A5 portrait; }
      }
    `
    document.head.appendChild(style)

    const root = document.createElement('div')
    root.id = '__payslip_print_root'
    root.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:white;padding:24px'
    root.innerHTML = cardRef.current?.outerHTML || ''
    document.body.appendChild(root)

    window.print()

    setTimeout(() => {
      document.head.removeChild(style)
      document.body.removeChild(root)
    }, 500)
  }

  return (
    <div ref={cardRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{formatPeriod(payslip.period_month, payslip.period_year)}</h2>
            {displayName && (
              <p className="text-indigo-200 text-sm mt-1">
                {displayName}
                {displayCode && ` · ${displayCode}`}
              </p>
            )}
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            isFreelance ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {isFreelance ? 'Freelance' : 'พนักงานประจำ'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Income section */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">รายได้</h3>
          <div className="space-y-2">
            {isFreelance ? (
              <>
                {payslip.line_items?.length ? (
                  payslip.line_items.map((item: LineItem, i: number) => (
                    <div key={i} className="flex justify-between items-center text-gray-700">
                      <span className="text-sm">
                        {item.description || 'งาน'}
                        <span className="text-xs text-gray-400 ml-1">({item.quantity} {item.unit} × {formatCurrency(item.rate)})</span>
                      </span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))
                ) : (
                  <Row label={`ค่าจ้าง${payslip.project_name ? ` (${payslip.project_name})` : ''}`} value={payslip.base_salary} />
                )}
              </>
            ) : (
              <>
                <Row label="เงินเดือนพื้นฐาน" value={payslip.base_salary} />
                {payslip.ot_amount > 0 && (
                  <Row
                    label={`ค่า OT (${payslip.ot_hours} ชม. × ${formatCurrency(payslip.ot_rate)}/ชม.)`}
                    value={payslip.ot_amount}
                    sub
                  />
                )}
                {payslip.incentive > 0 && (
                  <Row
                    label={`Incentive${payslip.incentive_note ? ` — ${payslip.incentive_note}` : ''}`}
                    value={payslip.incentive}
                    sub
                  />
                )}
              </>
            )}
            {payslip.other_income > 0 && (
              <Row
                label={`รายได้อื่นๆ${payslip.other_income_note ? ` — ${payslip.other_income_note}` : ''}`}
                value={payslip.other_income}
                sub
              />
            )}
            <div className="border-t border-gray-100 pt-2">
              <Row label="รวมรายได้" value={payslip.gross_income} bold green />
            </div>
          </div>
        </section>

        {/* Deduction section */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">รายการหัก</h3>
          <div className="space-y-2">
            {payslip.social_security > 0 && (
              <Row label="ประกันสังคม" value={payslip.social_security} />
            )}
            {payslip.withholding_tax > 0 && (
              <Row
                label={`ภาษีหัก ณ ที่จ่าย${isFreelance ? ' (3%)' : ' (3% Incentive)'}`}
                value={payslip.withholding_tax}
              />
            )}
            {payslip.other_deduction > 0 && (
              <Row
                label={`หักอื่นๆ${payslip.other_deduction_note ? ` — ${payslip.other_deduction_note}` : ''}`}
                value={payslip.other_deduction}
              />
            )}
            <div className="border-t border-gray-100 pt-2">
              <Row label="รวมหัก" value={payslip.total_deduction} bold red />
            </div>
          </div>
        </section>

        {/* Net pay */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">ยอดสุทธิที่ได้รับ</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(payslip.net_pay)}</p>
          {payslip.transfer_date && (
            <p className="text-sm text-green-600 mt-2 font-medium">
              ✅ โอนเงินแล้ว วันที่ {new Date(payslip.transfer_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Note */}
        {payslip.admin_note && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>หมายเหตุ:</strong> {payslip.admin_note}
          </div>
        )}

        {/* Export buttons */}
        {showExport && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={downloadPDF}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              <Download size={15} /> บันทึก PDF
            </button>
            <button
              onClick={downloadPNG}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              <Image size={15} /> บันทึก PNG
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function buildPrintHtml(payslip: Payslip): string {
  const isFreelance = payslip.employee ? payslip.employee.type === 'freelance' : payslip.guest_type === 'freelance'
  const emp = payslip.employee
  const displayName = emp?.name ?? payslip.guest_name ?? ''
  const displayCode = emp?.employee_code
  const period = formatPeriod(payslip.period_month, payslip.period_year)

  const incomeRows = isFreelance
    ? (payslip.line_items?.length
        ? payslip.line_items.map((item) =>
            `<tr><td style="padding:6px 0;color:#374151">${item.description || 'งาน'} <span style="color:#9ca3af;font-size:12px">(${item.quantity} ${item.unit} × ${formatCurrency(item.rate)})</span></td><td style="padding:6px 0;text-align:right;font-weight:500">${formatCurrency(item.total)}</td></tr>`
          ).join('')
        : `<tr><td style="padding:6px 0;color:#374151">ค่าจ้าง${payslip.project_name ? ` (${payslip.project_name})` : ''}</td><td style="padding:6px 0;text-align:right;font-weight:500">${formatCurrency(payslip.base_salary)}</td></tr>`
      )
    : `<tr><td style="padding:6px 0;color:#374151">เงินเดือนพื้นฐาน</td><td style="padding:6px 0;text-align:right;font-weight:500">${formatCurrency(payslip.base_salary)}</td></tr>
       ${payslip.ot_amount > 0 ? `<tr><td style="padding:6px 0;color:#374151;padding-left:12px;font-size:13px">ค่า OT (${payslip.ot_hours} ชม. × ${formatCurrency(payslip.ot_rate)}/ชม.)</td><td style="padding:6px 0;text-align:right;font-size:13px">${formatCurrency(payslip.ot_amount)}</td></tr>` : ''}
       ${payslip.incentive > 0 ? `<tr><td style="padding:6px 0;color:#374151;padding-left:12px;font-size:13px">Incentive${payslip.incentive_note ? ` — ${payslip.incentive_note}` : ''}</td><td style="padding:6px 0;text-align:right;font-size:13px">${formatCurrency(payslip.incentive)}</td></tr>` : ''}`

  const otherIncomeRow = payslip.other_income > 0
    ? `<tr><td style="padding:6px 0;color:#374151;padding-left:12px;font-size:13px">รายได้อื่นๆ${payslip.other_income_note ? ` — ${payslip.other_income_note}` : ''}</td><td style="padding:6px 0;text-align:right;font-size:13px">${formatCurrency(payslip.other_income)}</td></tr>`
    : ''

  const deductionRows = [
    payslip.social_security > 0 ? `<tr><td style="padding:6px 0;color:#374151">ประกันสังคม</td><td style="padding:6px 0;text-align:right">${formatCurrency(payslip.social_security)}</td></tr>` : '',
    payslip.withholding_tax > 0 ? `<tr><td style="padding:6px 0;color:#374151">ภาษีหัก ณ ที่จ่าย${isFreelance ? ' (3%)' : ' (3% Incentive)'}</td><td style="padding:6px 0;text-align:right">${formatCurrency(payslip.withholding_tax)}</td></tr>` : '',
    payslip.other_deduction > 0 ? `<tr><td style="padding:6px 0;color:#374151">หักอื่นๆ${payslip.other_deduction_note ? ` — ${payslip.other_deduction_note}` : ''}</td><td style="padding:6px 0;text-align:right">${formatCurrency(payslip.other_deduction)}</td></tr>` : '',
  ].join('')

  const transferLine = payslip.transfer_date
    ? `<p style="margin:8px 0 0;color:#16a34a;font-size:13px">✅ โอนเงินแล้ว วันที่ ${new Date(payslip.transfer_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; background: #f5f5f5; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .header { background: linear-gradient(to right, #4f46e5, #4338ca); color: white; padding: 24px; }
  .header h2 { font-size: 20px; font-weight: 700; }
  .header p { font-size: 13px; opacity: .85; margin-top: 4px; }
  .badge { display: inline-block; font-size: 11px; padding: 3px 10px; border-radius: 999px; font-weight: 600; background: ${isFreelance ? '#fef3c7' : '#e0e7ff'}; color: ${isFreelance ? '#92400e' : '#3730a3'}; }
  .body { padding: 24px; }
  .section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  .divider { border-top: 1px solid #f3f4f6; margin: 8px 0; }
  .net-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0; }
  .net-box .label { font-size: 13px; color: #6b7280; }
  .net-box .amount { font-size: 32px; font-weight: 700; color: #15803d; margin-top: 4px; }
  .note-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; font-size: 13px; color: #92400e; margin-top: 12px; }
  section { margin-bottom: 20px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2>${period}</h2>
        ${displayName ? `<p>${displayName}${displayCode ? ` · ${displayCode}` : ''}</p>` : ''}
      </div>
      <span class="badge">${isFreelance ? 'Freelance' : 'พนักงานประจำ'}</span>
    </div>
  </div>
  <div class="body">
    <section>
      <div class="section-title">รายได้</div>
      <table>
        ${incomeRows}
        ${otherIncomeRow}
        <tr class="divider"><td colspan="2" style="padding:0"><div class="divider"></div></td></tr>
        <tr><td style="padding:6px 0;font-weight:700;color:#1f2937">รวมรายได้</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#15803d">${formatCurrency(payslip.gross_income)}</td></tr>
      </table>
    </section>
    <section>
      <div class="section-title">รายการหัก</div>
      <table>
        ${deductionRows}
        <tr><td colspan="2" style="padding:0"><div class="divider"></div></td></tr>
        <tr><td style="padding:6px 0;font-weight:700;color:#1f2937">รวมหัก</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#dc2626">${formatCurrency(payslip.total_deduction)}</td></tr>
      </table>
    </section>
    <div class="net-box">
      <div class="label">ยอดสุทธิที่ได้รับ</div>
      <div class="amount">${formatCurrency(payslip.net_pay)}</div>
      ${transferLine}
    </div>
    ${payslip.admin_note ? `<div class="note-box"><strong>หมายเหตุ:</strong> ${payslip.admin_note}</div>` : ''}
  </div>
</div>
</body>
</html>`
}

function Row({
  label, value, bold, green, red, sub,
}: {
  label: string
  value: number
  bold?: boolean
  green?: boolean
  red?: boolean
  sub?: boolean
}) {
  return (
    <div className={`flex justify-between items-center ${sub ? 'pl-2 text-sm text-gray-600' : ''}`}>
      <span className={bold ? 'font-semibold text-gray-800' : 'text-gray-700'}>{label}</span>
      <span className={`font-${bold ? 'bold' : 'medium'} ${green ? 'text-green-700' : red ? 'text-red-600' : 'text-gray-800'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
