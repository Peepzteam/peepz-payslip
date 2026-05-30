'use client'
import { useState } from 'react'
import EmployeeTab from './EmployeeTab'
import PayslipTab from './PayslipTab'
import OverviewTab from './OverviewTab'

type Tab = 'overview' | 'payslips' | 'employees'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'ภาพรวม', icon: '📊' },
    { id: 'payslips', label: 'สลิปเงินเดือน', icon: '🧾' },
    { id: 'employees', label: 'พนักงาน', icon: '👥' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin — Payslip System</h1>
            <p className="text-xs text-gray-400">จัดการสลิปเงินเดือนพนักงาน</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'payslips' && <PayslipTab />}
        {tab === 'employees' && <EmployeeTab />}
      </div>
    </main>
  )
}
