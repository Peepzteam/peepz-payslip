'use client'
import { useEffect, useState } from 'react'
import { Payslip } from '@/types'
import { formatCurrency, formatPeriod } from '@/lib/utils'
import { CheckCircle, Clock, Users, DollarSign } from 'lucide-react'

export default function OverviewTab() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [month] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())

  useEffect(() => {
    fetch(`/api/payslips?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { setPayslips(Array.isArray(d) ? d : []); setLoading(false) })
  }, [month, year])

  const paid = payslips.filter((p) => p.transfer_date).length
  const pending = payslips.filter((p) => !p.transfer_date).length
  const totalNet = payslips.reduce((s, p) => s + p.net_pay, 0)

  const stats = [
    { label: 'สลิปทั้งหมดเดือนนี้', value: payslips.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'จ่ายแล้ว', value: paid, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'รอจ่าย', value: pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'ยอดจ่ายรวมเดือนนี้', value: formatCurrency(totalNet), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-800">
        ภาพรวม {formatPeriod(month, year)}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">รายการสลิปเดือนนี้</h3>
        </div>
        {loading ? (
          <p className="p-6 text-center text-gray-400">กำลังโหลด...</p>
        ) : payslips.length === 0 ? (
          <p className="p-6 text-center text-gray-400">ยังไม่มีสลิปเดือนนี้</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">ชื่อ</th>
                <th className="px-4 py-3 text-left">ประเภท</th>
                <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                <th className="px-4 py-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.employee?.name ?? p.guest_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{p.employee?.email ?? p.guest_email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const type = p.employee?.type ?? p.guest_type ?? 'fulltime'
                      const isFL = type === 'freelance'
                      return (
                        <span className={`text-xs px-2 py-1 rounded-full ${isFL ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {isFL ? 'Freelance' : 'ประจำ'}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {formatCurrency(p.net_pay)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.transfer_date ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle size={14} /> จ่ายแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                        <Clock size={14} /> รอจ่าย
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
