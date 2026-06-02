'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeTab from './EmployeeTab'
import PayslipTab from './PayslipTab'
import OverviewTab from './OverviewTab'
import HRTab from './HRTab'
import FinanceTab from './FinanceTab'
import HolidaysTab from './HolidaysTab'
import ControlBoardTab from './ControlBoardTab'

type Tab = 'overview' | 'payslips' | 'employees' | 'hr' | 'finance' | 'holidays' | 'control'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'ภาพรวม', icon: '📊' },
    { id: 'payslips', label: 'สลิปเงินเดือน', icon: '🧾' },
    { id: 'hr', label: 'HR & การทำงาน', icon: '🗓️' },
    { id: 'employees', label: 'พนักงาน', icon: '👥' },
    { id: 'finance', label: 'การเงิน', icon: '💰' },
    { id: 'holidays', label: 'วันหยุด', icon: '🏖️' },
    { id: 'control', label: 'Control Board', icon: '📋' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-900">Peepz Admin</h1>
            <p className="text-xs text-gray-400 hidden sm:block">จัดการสลิปเงินเดือนพนักงาน</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs sm:text-sm text-gray-500 hover:text-red-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-red-200 transition"
          >
            ออกจากระบบ
          </button>
        </div>
        {/* Tab bar — scrollable on mobile */}
        <div className="max-w-6xl mx-auto px-0 sm:px-6 overflow-x-auto scrollbar-none">
          <div className="flex min-w-max sm:min-w-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{t.icon}</span>
                <span className="hidden sm:inline">{t.icon} </span>
                <span className="sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'payslips' && <PayslipTab />}
        {tab === 'hr' && <HRTab />}
        {tab === 'employees' && <EmployeeTab />}
        {tab === 'finance' && <FinanceTab />}
        {tab === 'holidays' && <HolidaysTab />}
        {tab === 'control' && <ControlBoardTab />}
      </div>
    </main>
  )
}
