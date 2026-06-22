'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmployeeTab from './EmployeeTab'
import PayslipTab from './PayslipTab'
import OverviewTab from './OverviewTab'
import HRTab from './HRTab'
import FinanceTab from './FinanceTab'
import HolidaysTab from './HolidaysTab'
import ControlBoardTab from './ControlBoardTab'

type Tab = 'overview' | 'payslips' | 'employees' | 'hr' | 'finance' | 'holidays' | 'control'

const TAB_IDS: Tab[] = ['overview', 'payslips', 'employees', 'hr', 'finance', 'holidays', 'control']

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  )
}

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as Tab | null
  const fromPeepzFlow = searchParams.get('from') === 'peepzflow'
  const incomingPayslipId = searchParams.get('payslip_id') ?? undefined
  const incomingMonth = searchParams.get('month') ?? undefined

  const defaultTab: Tab = fromPeepzFlow ? 'payslips' : (tabFromUrl && TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'overview')
  const [tab, setTabState] = useState<Tab>(defaultTab)

  function setTab(t: Tab) {
    setTabState(t)
    router.push(`/admin?tab=${t}`)
  }

  useEffect(() => {
    if (tabFromUrl && TAB_IDS.includes(tabFromUrl) && tabFromUrl !== tab) {
      setTabState(tabFromUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl])
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.role === 'readonly') setIsReadOnly(true)
        if (d.username) setCurrentUser(d.username)
      })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function handleBackup() {
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) { alert('Backup ไม่สำเร็จ'); return }
      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `peepz-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('เกิดข้อผิดพลาด ไม่สามารถ backup ได้')
    }
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
          <div className="flex items-center gap-2">
            {currentUser && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${currentUser === 'Prae' ? 'bg-pink-100 text-pink-500' : 'bg-gray-100 text-gray-500'}`}>
                👤 {currentUser}
              </span>
            )}
            {isReadOnly && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                👁️ ดูได้อย่างเดียว
              </span>
            )}
            {!isReadOnly && (
              <button
                onClick={handleBackup}
                title="ดาวน์โหลด backup ข้อมูลทั้งหมด"
                className="text-xs text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-400 px-2.5 py-1.5 rounded-lg transition hidden sm:inline-flex items-center gap-1"
              >
                ⬇️ Backup
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-gray-500 hover:text-red-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-red-200 transition"
            >
              ออกจากระบบ
            </button>
          </div>
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
        {tab === 'payslips' && <PayslipTab isReadOnly={isReadOnly} incomingPayslipId={incomingPayslipId} incomingMonth={incomingMonth} />}
        {tab === 'hr' && <HRTab isReadOnly={isReadOnly} />}
        {tab === 'employees' && <EmployeeTab isReadOnly={isReadOnly} />}
        {tab === 'finance' && <FinanceTab isReadOnly={isReadOnly} />}
        {tab === 'holidays' && <HolidaysTab isReadOnly={isReadOnly} />}
        {tab === 'control' && <ControlBoardTab />}
      </div>
    </main>
  )
}
