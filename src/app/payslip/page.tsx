'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Payslip } from '@/types'
import PayslipCard from '@/components/PayslipCard'
import AttendanceOverview from '@/components/AttendanceOverview'
import { LogOut } from 'lucide-react'

type Tab = 'payslips' | 'attendance'

export default function PayslipPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [ackLoading, setAckLoading] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('payslips')

  useEffect(() => {
    loadPayslips()
  }, [])

  async function loadPayslips() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }
    setUserEmail(user.email ?? '')

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .single()

    if (!emp) {
      setLoading(false)
      return
    }
    setEmployeeId(emp.id)

    const { data } = await supabase
      .from('payslips')
      .select('*, employee:employees(*)')
      .eq('employee_id', emp.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })

    setPayslips((data as Payslip[]) ?? [])
    setLoading(false)
  }

  async function acknowledge(id: string) {
    setAckLoading(id)
    const res = await fetch(`/api/payslips/${id}/acknowledge`, { method: 'POST' })
    if (res.ok) {
      setPayslips((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'acknowledged', acknowledged_at: new Date().toISOString() }
            : p
        )
      )
    }
    setAckLoading(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">พื้นที่พนักงาน</h1>
          <p className="text-xs text-gray-400">{userEmail}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut size={16} />
          ออกจากระบบ
        </button>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 flex gap-1">
          {([
            { id: 'payslips' as Tab, label: '🧾 สลิปเงินเดือน' },
            { id: 'attendance' as Tab, label: '📊 ภาพรวมการทำงาน' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {tab === 'payslips' && (
          payslips.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p>ยังไม่มีสลิปเงินเดือน</p>
            </div>
          ) : (
            payslips.map((p) => (
              <PayslipCard key={p.id} payslip={p} />
            ))
          )
        )}

        {tab === 'attendance' && (
          employeeId
            ? <AttendanceOverview employeeId={employeeId} />
            : <div className="text-center py-16 text-gray-400"><p>ไม่พบข้อมูลพนักงาน</p></div>
        )}
      </div>
    </main>
  )
}
