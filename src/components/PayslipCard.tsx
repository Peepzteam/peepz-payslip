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
  const isFreelance = payslip.employee?.type === 'freelance'
  const cardRef = useRef<HTMLDivElement>(null)

  async function downloadPNG() {
    if (!cardRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        ignoreElements: (el) => el.tagName === 'BUTTON',
      })
      const filename = `สลิป-${payslip.employee?.name || 'payslip'}-${formatPeriod(payslip.period_month, payslip.period_year)}.png`
      const link = document.createElement('a')
      link.download = filename
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('PNG export failed:', err)
      alert('เซฟรูปไม่ได้ กรุณาลองใหม่')
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
            {payslip.employee && (
              <p className="text-indigo-200 text-sm mt-1">
                {payslip.employee.name}
                {payslip.employee.employee_code && ` · ${payslip.employee.employee_code}`}
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
