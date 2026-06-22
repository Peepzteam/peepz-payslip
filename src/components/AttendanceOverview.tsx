'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, XCircle } from 'lucide-react'

interface WorkRecord {
  id?: string
  employee_id: string
  date: string
  status: string
  check_in: string | null
  check_out: string | null
  ot_hours: number
  ot_type: string | null
}
interface LeaveRecord {
  id: string
  employee_id: string
  leave_type: 'sick' | 'vacation' | 'personal' | 'other'
  start_date: string
  end_date: string
  days: number
  note: string | null
  year: number
}

const LEAVE_TYPES = [
  { val: 'sick',     label: 'ลาป่วย',    quota: 30, color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-400' },
  { val: 'vacation', label: 'ลาพักร้อน', quota: 6,  color: 'bg-purple-50 text-purple-700 border-purple-200', bar: 'bg-purple-400' },
  { val: 'personal', label: 'ลากิจ',      quota: 6,  color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400' },
  { val: 'other',    label: 'ลาอื่นๆ',    quota: 0,  color: 'bg-gray-50 text-gray-700 border-gray-200', bar: 'bg-gray-400' },
]

const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function formatDateTH(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AttendanceOverview({ employeeId }: { employeeId: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([])
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lRes, wRes] = await Promise.all([
        fetch(`/api/leave-records?year=${year}&employee_id=${employeeId}`, { cache: 'no-store' }),
        fetch(`/api/work-records?employee_id=${employeeId}`, { cache: 'no-store' }),
      ])
      const [l, w] = await Promise.all([lRes.json().catch(()=>[]), wRes.json().catch(()=>[])])
      setLeaveRecords(Array.isArray(l) ? l : [])
      setWorkRecords(Array.isArray(w) ? (w as WorkRecord[]).filter(r => r.date.startsWith(String(year))) : [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [year, employeeId])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>

  // ── Aggregations ──
  const lateRecords = workRecords.filter(r => r.status === 'late')
  const absentRecords = workRecords.filter(r => r.status === 'absent')

  const leaveByType = LEAVE_TYPES.map(lt => {
    const recs = leaveRecords.filter(r => r.leave_type === lt.val)
    const used = recs.reduce((s, r) => s + r.days, 0)
    return { ...lt, used, recs }
  })

  // Combined timeline: leaves + late + absent, sorted by date desc
  type TimelineItem = { date: string; endDate?: string; type: string; label: string; color: string; note?: string | null; days?: number }
  const timeline: TimelineItem[] = [
    ...leaveRecords.map(r => ({
      date: r.start_date,
      endDate: r.end_date !== r.start_date ? r.end_date : undefined,
      type: r.leave_type,
      label: LEAVE_TYPES.find(t => t.val === r.leave_type)?.label ?? 'ลา',
      color: LEAVE_TYPES.find(t => t.val === r.leave_type)?.color ?? 'bg-gray-50 text-gray-700 border-gray-200',
      note: r.note,
      days: r.days,
    })),
    ...lateRecords.map(r => ({
      date: r.date, type: 'late', label: 'มาสาย',
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      note: r.check_in ? `เข้างาน ${r.check_in}` : null,
    })),
    ...absentRecords.map(r => ({
      date: r.date, type: 'absent', label: 'ขาดงาน',
      color: 'bg-red-50 text-red-700 border-red-200',
      note: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const totalLeaveDays = leaveRecords.reduce((s, r) => s + r.days, 0)

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">📊 ภาพรวมการทำงาน</h2>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-gray-50 rounded text-gray-500"><ChevronLeft size={15}/></button>
          <span className="text-sm font-semibold px-2 min-w-[70px] text-center text-gray-700">{year + 543}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-gray-50 rounded text-gray-500"><ChevronRight size={15}/></button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">วันลารวม</p>
          <p className="text-xl font-bold text-indigo-600">{totalLeaveDays}</p>
          <p className="text-[10px] text-gray-400">วัน</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><AlertCircle size={11}/> มาสาย</p>
          <p className="text-xl font-bold text-yellow-600">{lateRecords.length}</p>
          <p className="text-[10px] text-gray-400">ครั้ง</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><XCircle size={11}/> ขาดงาน</p>
          <p className="text-xl font-bold text-red-600">{absentRecords.length}</p>
          <p className="text-[10px] text-gray-400">ครั้ง</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><Calendar size={11}/> รายการทั้งหมด</p>
          <p className="text-xl font-bold text-gray-700">{timeline.length}</p>
          <p className="text-[10px] text-gray-400">รายการ</p>
        </div>
      </div>

      {/* Leave quota bars */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">โควต้าวันลา</h3>
        <div className="space-y-3">
          {leaveByType.filter(lt => lt.quota > 0 || lt.used > 0).map(lt => {
            const pct = lt.quota > 0 ? Math.min(100, Math.round((lt.used / lt.quota) * 100)) : 0
            const over = lt.quota > 0 && lt.used > lt.quota
            return (
              <div key={lt.val}>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className={`px-2 py-0.5 rounded-full border ${lt.color} font-medium`}>{lt.label}</span>
                  <span className={`font-semibold ${over ? 'text-red-600' : 'text-gray-600'}`}>
                    {lt.used} {lt.quota > 0 ? `/ ${lt.quota}` : ''} วัน
                    {over && ' ⚠️ เกินโควต้า'}
                  </span>
                </div>
                {lt.quota > 0 && (
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-red-400' : lt.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {leaveByType.every(lt => lt.used === 0) && (
            <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีการลาในปีนี้ 🎉</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">รายละเอียดวันที่ลา / มาสาย / ขาดงาน</h3>
        {timeline.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีข้อมูลในปีนี้</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((item, i) => (
              <div key={i} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${item.color}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 whitespace-nowrap">{item.label}</span>
                  <span className="text-xs truncate">
                    {formatDateTH(item.date)}
                    {item.endDate && ` – ${formatDateTH(item.endDate)}`}
                    {item.note && <span className="opacity-70"> · {item.note}</span>}
                  </span>
                </div>
                {item.days !== undefined && (
                  <span className="text-xs font-bold whitespace-nowrap">{item.days} วัน</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
