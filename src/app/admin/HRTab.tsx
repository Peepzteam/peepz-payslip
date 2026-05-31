'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Employee } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Users, Clock, Calendar, TrendingUp, AlertCircle, Download, X, Save, CalendarRange } from 'lucide-react'

interface WorkRecord {
  id?: string
  employee_id: string
  date: string
  status: string
  check_in: string | null
  check_out: string | null
  ot_hours: number
  ot_type: string
  note: string | null
}

interface PayslipSummary {
  employee_id: string
  net_pay: number
  ot_amount: number
  employee?: { name: string }
}

interface CompanyHoliday {
  id: string
  date: string
  name: string
  year: number
}

const STATUS_OPTIONS = [
  { val: 'present',        label: 'มาทำงาน',     color: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500' },
  { val: 'late',           label: 'มาสาย',        color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  { val: 'absent',         label: 'ขาดงาน',       color: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500' },
  { val: 'leave_sick',     label: 'ลาป่วย',       color: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-400' },
  { val: 'leave_annual',   label: 'ลาพักร้อน',    color: 'bg-purple-100 text-purple-700 border-purple-200',dot: 'bg-purple-400' },
  { val: 'leave_personal', label: 'ลากิจ',        color: 'bg-orange-100 text-orange-700 border-orange-200',dot: 'bg-orange-400' },
  { val: 'holiday',        label: 'วันหยุด',      color: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400' },
]

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const DAY_NAMES = ['อา','จ','อ','พ','พฤ','ศ','ส']

export default function HRTab() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [subTab, setSubTab] = useState<'dashboard' | 'attendance'>('dashboard')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set())
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [prevRecords, setPrevRecords] = useState<WorkRecord[]>([])
  const [payslips, setPayslips] = useState<PayslipSummary[]>([])
  const [prevPayslips, setPrevPayslips] = useState<PayslipSummary[]>([])
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, Partial<WorkRecord>>>({})

  // Cell editor
  const [editCell, setEditCell] = useState<{ empId: string; day: number } | null>(null)
  const [cellForm, setCellForm] = useState<Partial<WorkRecord>>({})

  // Bulk fill
  const [showBulk, setShowBulk] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    empIds: [] as string[],
    dateFrom: '',
    dateTo: '',
    status: 'present',
    check_in: '09:00',
    check_out: '18:00',
    ot_hours: 0,
    ot_type: 'normal',
    note: '',
    skipWeekend: true,
    skipHoliday: true,
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, recRes, prevRecRes, payRes, prevPayRes, holRes] = await Promise.all([
        fetch('/api/employees'),
        fetch(`/api/work-records?month=${month}&year=${year}`),
        fetch(`/api/work-records?month=${prevMonth}&year=${prevYear}`),
        fetch(`/api/payslips?month=${month}&year=${year}`),
        fetch(`/api/payslips?month=${prevMonth}&year=${prevYear}`),
        fetch(`/api/holidays?year=${year}`),
      ])
      const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
      const [emps, recs, prevRecs, pays, prevPays, hols] = await Promise.all([
        safeJson(empRes), safeJson(recRes), safeJson(prevRecRes), safeJson(payRes), safeJson(prevPayRes), safeJson(holRes)
      ])
      const activeEmps: Employee[] = Array.isArray(emps) ? emps.filter((e: Employee) => e.is_active) : []
      setEmployees(activeEmps)
      // Default: fulltime selected, freelance unselected
      setSelectedEmpIds(prev => {
        if (prev.size > 0) return prev
        const ids = new Set(activeEmps.filter(e => e.type === 'fulltime').map(e => e.id))
        return ids
      })
      setRecords(Array.isArray(recs) ? recs : [])
      setPrevRecords(Array.isArray(prevRecs) ? prevRecs : [])
      setPayslips(Array.isArray(pays) ? pays : [])
      setPrevPayslips(Array.isArray(prevPays) ? prevPays : [])
      setHolidays(Array.isArray(hols) ? hols : [])
    } catch (err) {
      console.error('HRTab load error:', err)
    } finally {
      setLoading(false)
    }
  }, [month, year, prevMonth, prevYear])

  useEffect(() => { load() }, [load])

  const shownEmployees = employees.filter(e => selectedEmpIds.has(e.id))

  function getRecord(empId: string, day: number): Partial<WorkRecord> {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const key = `${empId}_${dateStr}`
    if (edits[key]) return edits[key]
    return records.find(r => r.employee_id === empId && r.date === dateStr) || {}
  }

  function openCell(empId: string, day: number) {
    const rec = getRecord(empId, day)
    setEditCell({ empId, day })
    setCellForm({
      status: rec.status || '',
      check_in: rec.check_in || '',
      check_out: rec.check_out || '',
      ot_hours: rec.ot_hours || 0,
      ot_type: rec.ot_type || 'normal',
      note: rec.note || '',
    })
  }

  function saveCell() {
    if (!editCell) return
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(editCell.day).padStart(2,'0')}`
    const key = `${editCell.empId}_${dateStr}`
    const existing = records.find(r => r.employee_id === editCell.empId && r.date === dateStr) || {}
    setEdits(prev => ({
      ...prev,
      [key]: { ...existing, ...cellForm, employee_id: editCell.empId, date: dateStr }
    }))
    setEditCell(null)
  }

  async function saveAll() {
    setSaving(true)
    const payload = Object.values(edits).filter(r => r.status)
    if (payload.length > 0) {
      const res = await fetch('/api/work-records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert('บันทึกไม่ได้: ' + (err.error || JSON.stringify(err)))
        setSaving(false)
        return
      }
    }
    setEdits({})
    await load()
    setSaving(false)
  }

  async function applyBulk() {
    if (!bulkForm.dateFrom || !bulkForm.dateTo || bulkForm.empIds.length === 0) {
      alert('กรุณาเลือกพนักงาน วันเริ่มต้น และวันสิ้นสุด')
      return
    }
    setBulkSaving(true)
    const holidayDates = new Set(holidays.map(h => h.date))
    const payload: Partial<WorkRecord>[] = []
    const from = new Date(bulkForm.dateFrom + 'T00:00:00')
    const to = new Date(bulkForm.dateTo + 'T00:00:00')
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (bulkForm.skipWeekend && (dow === 0 || dow === 6)) continue
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (bulkForm.skipHoliday && holidayDates.has(iso)) continue
      for (const empId of bulkForm.empIds) {
        payload.push({
          employee_id: empId,
          date: iso,
          status: bulkForm.status,
          check_in: bulkForm.check_in || null,
          check_out: bulkForm.check_out || null,
          ot_hours: bulkForm.ot_hours,
          ot_type: bulkForm.ot_type,
          note: bulkForm.note || null,
        })
      }
    }
    if (payload.length === 0) {
      alert('ไม่มีวันที่ต้องกรอก (อาจถูกข้ามทั้งหมดเพราะเป็นเสาร์-อาทิตย์/วันหยุด)')
      setBulkSaving(false)
      return
    }
    const res = await fetch('/api/work-records/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      alert('บันทึกไม่ได้: ' + (err.error || JSON.stringify(err)))
    } else {
      alert(`✅ บันทึกสำเร็จ ${payload.length} รายการ`)
      setShowBulk(false)
      await load()
    }
    setBulkSaving(false)
  }

  async function exportPNG() {
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = gridRef.current
      if (!el) return
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `HR-${MONTHS[month-1]}-${year+543}.png`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) { alert('Export ไม่ได้: ' + String(e)) }
  }

  async function exportEmployeePNG(empId: string) {
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const daysInMonth = new Date(year, month, 0).getDate()
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      const dayNames = ['อา','จ','อ','พ','พฤ','ศ','ส']
      const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
      const holidayMap = new Map(
        holidays
          .filter(h => { const d = new Date(h.date+'T00:00:00'); return d.getMonth()+1===month && d.getFullYear()===year })
          .map(h => [new Date(h.date+'T00:00:00').getDate(), h.name])
      )
      const statusLabel: Record<string,string> = {
        present:'มาทำงาน', late:'มาสาย', absent:'ขาดงาน',
        leave_sick:'ลาป่วย', leave_annual:'ลาพักร้อน', leave_personal:'ลากิจ', holiday:'วันหยุด'
      }
      const statusColor: Record<string,string> = {
        present:'#d1fae5', late:'#fef9c3', absent:'#fee2e2',
        leave_sick:'#dbeafe', leave_annual:'#ede9fe', leave_personal:'#ffedd5', holiday:'#f3f4f6'
      }
      const statusText: Record<string,string> = {
        present:'#065f46', late:'#92400e', absent:'#991b1b',
        leave_sick:'#1e40af', leave_annual:'#5b21b6', leave_personal:'#9a3412', holiday:'#6b7280'
      }

      // Build HTML
      const rows = days.map(d => {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        const key = `${empId}_${dateStr}`
        const rec = edits[key] || records.find(r => r.employee_id === empId && r.date === dateStr) || {}
        const dow = new Date(year, month-1, d).getDay()
        const isWeekend = dow === 0 || dow === 6
        const holName = holidayMap.get(d)
        const isHol = !!holName
        const bg = isWeekend ? '#fff1f2' : isHol ? '#fffbeb' : '#ffffff'
        const st = rec.status as string | undefined
        const badge = st ? `<span style="background:${statusColor[st]||'#f3f4f6'};color:${statusText[st]||'#374151'};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">${statusLabel[st]||st}</span>` : '<span style="color:#d1d5db;font-size:11px;">—</span>'
        const holBadge = isHol ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;margin-left:4px;">🏖️ ${holName}</span>` : ''
        const time = (rec.check_in || rec.check_out) ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${rec.check_in||''}${rec.check_in&&rec.check_out?' – ':''}${rec.check_out||''}</div>` : ''
        const ot = Number(rec.ot_hours) > 0 ? `<div style="font-size:10px;color:#4f46e5;font-weight:600;">OT ${rec.ot_hours}h</div>` : ''
        return `<tr style="background:${bg};">
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151;width:40px;text-align:center;">${d}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:30px;text-align:center;">${dayNames[dow]}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;">${badge}${holBadge}${time}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">${ot}</td>
        </tr>`
      }).join('')

      const presentCount = days.filter(d => { const dateStr=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const k=`${empId}_${dateStr}`; const r=edits[k]||records.find(x=>x.employee_id===empId&&x.date===dateStr)||{}; return r.status==='present'||r.status==='late' }).length
      const otTotal = days.reduce((s,d) => { const dateStr=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const k=`${empId}_${dateStr}`; const r=edits[k]||records.find(x=>x.employee_id===empId&&x.date===dateStr)||{}; return s+Number(r.ot_hours||0) }, 0)

      const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;padding:24px;width:500px;">
        <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;">
            <div style="color:white;font-size:18px;font-weight:700;">${emp.name}</div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">${emp.employee_code} · ${emp.type==='freelance'?'Freelance':'พนักงานประจำ'}</div>
            <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-top:8px;font-weight:600;">${monthNames[month-1]} ${year+543}</div>
          </div>
          <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;">
            <div style="flex:1;padding:12px 16px;text-align:center;border-right:1px solid #e5e7eb;">
              <div style="font-size:22px;font-weight:700;color:#059669;">${presentCount}</div>
              <div style="font-size:11px;color:#6b7280;">วันเข้างาน</div>
            </div>
            <div style="flex:1;padding:12px 16px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#4f46e5;">${otTotal}</div>
              <div style="font-size:11px;color:#6b7280;">ชม. OT</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 10px;font-size:11px;color:#6b7280;font-weight:600;text-align:center;">วัน</th>
                <th style="padding:8px 10px;font-size:11px;color:#6b7280;font-weight:600;text-align:center;">วันที่</th>
                <th style="padding:8px 10px;font-size:11px;color:#6b7280;font-weight:600;text-align:left;">สถานะ</th>
                <th style="padding:8px 10px;font-size:11px;color:#6b7280;font-weight:600;text-align:right;">OT</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`

      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
      container.innerHTML = html
      document.body.appendChild(container)
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, { scale: 2, backgroundColor: '#f9fafb', useCORS: true, logging: false })
      document.body.removeChild(container)
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${emp.name}-${monthNames[month-1]}-${year+543}.png`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) { alert('Export ไม่ได้: ' + String(e)) }
  }

  function calcStats(recs: WorkRecord[]) {
    return {
      present: recs.filter(r => r.status === 'present').length,
      late: recs.filter(r => r.status === 'late').length,
      absent: recs.filter(r => r.status === 'absent').length,
      leave: recs.filter(r => r.status?.startsWith('leave_')).length,
      otHours: recs.reduce((s, r) => s + (Number(r.ot_hours) || 0), 0),
    }
  }
  const stats = calcStats(records)
  const prevStats = calcStats(prevRecords)
  const totalPayroll = payslips.reduce((s, p) => s + p.net_pay, 0)
  const prevTotalPayroll = prevPayslips.reduce((s, p) => s + p.net_pay, 0)

  function diff(curr: number, prev: number) {
    if (!prev) return null
    const d = curr - prev
    return { d, pct: Math.round((d / prev) * 100), up: d >= 0 }
  }

  function navigate(dir: number) {
    let m = month + dir, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  const pendingCount = Object.keys(edits).length

  // status display helper
  function statusMeta(val: string | undefined) {
    return STATUS_OPTIONS.find(s => s.val === val)
  }

  const fulltimeEmps = employees.filter(e => e.type === 'fulltime')
  const freelanceEmps = employees.filter(e => e.type === 'freelance')

  return (
    <div className="flex gap-4 min-h-0">

      {/* ─── Left sidebar: employee selector ─── */}
      <div className="w-52 shrink-0 space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">พนักงานประจำ</p>
          {fulltimeEmps.map(emp => (
            <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer group">
              <input type="checkbox" checked={selectedEmpIds.has(emp.id)}
                onChange={e => {
                  const s = new Set(selectedEmpIds)
                  e.target.checked ? s.add(emp.id) : s.delete(emp.id)
                  setSelectedEmpIds(s)
                }}
                className="w-3.5 h-3.5 accent-indigo-600 rounded" />
              <span className="text-sm text-gray-700 group-hover:text-indigo-600 leading-tight">{emp.name}</span>
            </label>
          ))}
          {fulltimeEmps.length === 0 && <p className="text-xs text-gray-400">ไม่มีพนักงานประจำ</p>}

          {freelanceEmps.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-3 pt-2 border-t border-gray-100">Freelance (เลือกได้)</p>
              {freelanceEmps.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer group">
                  <input type="checkbox" checked={selectedEmpIds.has(emp.id)}
                    onChange={e => {
                      const s = new Set(selectedEmpIds)
                      e.target.checked ? s.add(emp.id) : s.delete(emp.id)
                      setSelectedEmpIds(s)
                    }}
                    className="w-3.5 h-3.5 accent-amber-500 rounded" />
                  <div>
                    <span className="text-sm text-gray-700 group-hover:text-amber-600 leading-tight">{emp.name}</span>
                    <span className="block text-xs text-gray-400">{emp.employee_code}</span>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">สถานะ</p>
          <div className="space-y-1">
            {STATUS_OPTIONS.map(s => (
              <div key={s.val} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-xs text-gray-600">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Header bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
              <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft size={15} /></button>
              <span className="text-sm font-semibold px-2 min-w-[90px] text-center">{MONTHS[month-1]} {year+543}</span>
              <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight size={15} /></button>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['dashboard','attendance'] as const).map(t => (
                <button key={t} onClick={() => setSubTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${subTab===t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'dashboard' ? '📊 Dashboard' : '📋 บันทึกการทำงาน'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <button onClick={saveAll} disabled={saving}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-60">
                <Save size={13} /> {saving ? 'กำลังบันทึก...' : `บันทึก ${pendingCount} รายการ`}
              </button>
            )}
            {subTab === 'attendance' && (
              <button onClick={() => setShowBulk(true)}
                className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-700">
                <CalendarRange size={13} /> กรอกแบบช่วง
              </button>
            )}
            <button onClick={exportPNG}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
              <Download size={13} /> บันทึก PNG
            </button>
          </div>
        </div>

        <div ref={gridRef}>
        {loading ? (
          <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>
        ) : subTab === 'dashboard' ? (
          <DashboardView
            month={month} year={year} prevMonth={prevMonth} prevYear={prevYear}
            stats={stats} prevStats={prevStats} diff={diff}
            totalPayroll={totalPayroll} prevTotalPayroll={prevTotalPayroll}
            employees={shownEmployees} records={records} payslips={payslips}
            holidays={holidays}
          />
        ) : (
          <AttendanceGrid
            employees={shownEmployees} days={days} year={year} month={month}
            getRecord={getRecord} openCell={openCell} holidays={holidays}
            onExportEmployee={exportEmployeePNG}
          />
        )}
        </div>
      </div>

      {/* ─── Bulk Fill Modal ─── */}
      {showBulk && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-800 text-base">📅 กรอกการทำงานแบบช่วง</p>
                <p className="text-xs text-gray-400 mt-0.5">เลือกช่วงวันที่ แล้วกรอกข้อมูลทีเดียว</p>
              </div>
              <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">

              {/* Employee selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">พนักงาน *</label>
                <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 rounded-lg">
                    <input type="checkbox"
                      checked={bulkForm.empIds.length === employees.length}
                      onChange={e => setBulkForm(f => ({ ...f, empIds: e.target.checked ? employees.map(emp => emp.id) : [] }))}
                      className="w-3.5 h-3.5 accent-violet-600" />
                    <span className="text-xs font-semibold text-violet-600">เลือกทั้งหมด</span>
                  </label>
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 rounded-lg">
                      <input type="checkbox"
                        checked={bulkForm.empIds.includes(emp.id)}
                        onChange={e => setBulkForm(f => ({
                          ...f,
                          empIds: e.target.checked ? [...f.empIds, emp.id] : f.empIds.filter(id => id !== emp.id)
                        }))}
                        className="w-3.5 h-3.5 accent-violet-600" />
                      <span className="text-sm text-gray-700">{emp.name}</span>
                      <span className="text-xs text-gray-400">{emp.employee_code}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">วันที่เริ่ม *</label>
                  <input type="date" value={bulkForm.dateFrom}
                    onChange={e => setBulkForm(f => ({ ...f, dateFrom: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">วันที่สิ้นสุด *</label>
                  <input type="date" value={bulkForm.dateTo}
                    onChange={e => setBulkForm(f => ({ ...f, dateTo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">สถานะ</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.val} type="button"
                      onClick={() => setBulkForm(f => ({ ...f, status: s.val }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition ${bulkForm.status === s.val ? s.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">เวลาเข้า</label>
                  <input type="time" value={bulkForm.check_in}
                    onChange={e => setBulkForm(f => ({ ...f, check_in: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">เวลาออก</label>
                  <input type="time" value={bulkForm.check_out}
                    onChange={e => setBulkForm(f => ({ ...f, check_out: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              {/* OT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">OT (ชั่วโมง)</label>
                  <input type="number" min="0" step="0.5" value={bulkForm.ot_hours || ''}
                    onChange={e => setBulkForm(f => ({ ...f, ot_hours: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ประเภท OT</label>
                  <select value={bulkForm.ot_type} onChange={e => setBulkForm(f => ({ ...f, ot_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                    <option value="normal">ปกติ (×1.5)</option>
                    <option value="holiday">วันหยุด (×3)</option>
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">หมายเหตุ</label>
                <input type="text" value={bulkForm.note}
                  onChange={e => setBulkForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="(ถ้ามี)"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>

              {/* Skip options */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ข้ามวัน</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bulkForm.skipWeekend}
                    onChange={e => setBulkForm(f => ({ ...f, skipWeekend: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-violet-600" />
                  <span className="text-sm text-gray-700">ข้ามเสาร์-อาทิตย์</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bulkForm.skipHoliday}
                    onChange={e => setBulkForm(f => ({ ...f, skipHoliday: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-violet-600" />
                  <span className="text-sm text-gray-700">ข้ามวันหยุดบริษัท</span>
                </label>
              </div>

            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={applyBulk} disabled={bulkSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-60">
                <Save size={15} /> {bulkSaving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
              </button>
              <button onClick={() => setShowBulk(false)}
                className="flex-1 border border-gray-300 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cell Editor Panel ─── */}
      {editCell && (() => {
        const emp = employees.find(e => e.id === editCell.empId)
        const dateStr = `${year}/${String(month).padStart(2,'0')}/${String(editCell.day).padStart(2,'0')}`
        return (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                <div>
                  <p className="font-semibold text-gray-800">{emp?.name}</p>
                  <p className="text-sm text-gray-400">{dateStr} · {DAY_NAMES[new Date(year, month-1, editCell.day).getDay()]}.</p>
                </div>
                <button onClick={() => setEditCell(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
              </div>
              <div className="px-5 py-4 space-y-4">

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">สถานะ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s.val} type="button"
                        onClick={() => setCellForm(f => ({ ...f, status: s.val }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${cellForm.status === s.val ? s.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">เวลาเข้า</label>
                    <input type="time" value={cellForm.check_in || ''} onChange={e => setCellForm(f => ({ ...f, check_in: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">เวลาออก</label>
                    <input type="time" value={cellForm.check_out || ''} onChange={e => setCellForm(f => ({ ...f, check_out: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                </div>

                {/* OT */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">OT (ชั่วโมง)</label>
                    <input type="number" min="0" step="0.5" value={cellForm.ot_hours || ''} onChange={e => setCellForm(f => ({ ...f, ot_hours: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">ประเภท OT</label>
                    <select value={cellForm.ot_type || 'normal'} onChange={e => setCellForm(f => ({ ...f, ot_type: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option value="normal">ปกติ (×1.5)</option>
                      <option value="holiday">วันหยุด (×3)</option>
                    </select>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">หมายเหตุ</label>
                  <input type="text" value={cellForm.note || ''} onChange={e => setCellForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="เช่น สายเพราะรถติด"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={saveCell}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
                  <Save size={14} /> บันทึก
                </button>
                <button onClick={() => setEditCell(null)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({ month, year, prevMonth, prevYear, stats, prevStats, diff, totalPayroll, prevTotalPayroll, employees, records, payslips, holidays }: {
  month: number; year: number; prevMonth: number; prevYear: number
  stats: { present: number; late: number; absent: number; leave: number; otHours: number }
  prevStats: { present: number; late: number; absent: number; leave: number; otHours: number }
  diff: (a: number, b: number) => { d: number; pct: number; up: boolean } | null
  totalPayroll: number; prevTotalPayroll: number
  employees: Employee[]; records: WorkRecord[]; payslips: PayslipSummary[]
  holidays: CompanyHoliday[]
}) {
  const monthHolidays = holidays.filter(h => {
    const d = new Date(h.date + 'T00:00:00')
    return d.getMonth() + 1 === month && d.getFullYear() === year
  }).sort((a, b) => a.date.localeCompare(b.date))
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const upcomingHolidays = holidays.filter(h => h.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 3)
  const cards = [
    { label: 'วันเข้างาน (รวม)', value: stats.present, prev: prevStats.present, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'มาสาย', value: stats.late, prev: prevStats.late, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'ลา / ขาด', value: stats.leave + stats.absent, prev: prevStats.leave + prevStats.absent, icon: Calendar, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'ชม. OT รวม', value: stats.otHours, prev: prevStats.otHours, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', unit: 'ชม.' },
  ]

  function empStats(empId: string) {
    const r = records.filter(r => r.employee_id === empId)
    return {
      present: r.filter(x => x.status === 'present').length,
      late: r.filter(x => x.status === 'late').length,
      absent: r.filter(x => x.status === 'absent').length,
      leave: r.filter(x => x.status?.startsWith('leave_')).length,
      otHours: r.reduce((s, x) => s + (Number(x.ot_hours) || 0), 0),
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const d = diff(c.value, c.prev)
          return (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-2`}>
                <c.icon size={16} className={c.color} />
              </div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${c.color}`}>{c.value}{c.unit ? ` ${c.unit}` : ''}</p>
              {d && <p className={`text-xs mt-1 ${d.up ? 'text-green-600' : 'text-red-500'}`}>{d.up ? '▲' : '▼'} {Math.abs(d.pct)}% จากเดือนก่อน</p>}
            </div>
          )
        })}
      </div>

      {/* Payroll comparison */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm"><TrendingUp size={15} /> เปรียบเทียบเงินเดือน</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div><p className="text-xs text-gray-400">เดือนนี้</p><p className="text-xl font-bold text-indigo-600">{formatCurrency(totalPayroll)}</p></div>
          <div><p className="text-xs text-gray-400">เดือนก่อน</p><p className="text-xl font-bold text-gray-400">{formatCurrency(prevTotalPayroll)}</p></div>
        </div>
        {prevTotalPayroll > 0 && (
          <div className="space-y-1">
            <div className="flex gap-2 h-3">
              <div className="bg-gray-200 rounded-full h-full" style={{ width: `${(prevTotalPayroll / Math.max(totalPayroll, prevTotalPayroll)) * 100}%` }} />
              <div className="bg-indigo-500 rounded-full h-full" style={{ width: `${(totalPayroll / Math.max(totalPayroll, prevTotalPayroll)) * 100}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />เดือนก่อน</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />เดือนนี้</span>
            </div>
          </div>
        )}
      </div>

      {/* Holidays this month */}
      {monthHolidays.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2 text-sm">🏖️ วันหยุดเดือน{['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][month-1]} — {monthHolidays.length} วัน</h3>
          <div className="flex flex-wrap gap-2">
            {monthHolidays.map(h => {
              const d = new Date(h.date + 'T00:00:00')
              const dayNames = ['อา','จ','อ','พ','พฤ','ศ','ส']
              const isToday = h.date === todayStr
              return (
                <div key={h.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${isToday ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-amber-700 border-amber-300'}`}>
                  <span className="font-bold">{d.getDate()}</span>
                  <span className="opacity-70">{dayNames[d.getDay()]}.</span>
                  <span>{h.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming holidays (cross-month) */}
      {monthHolidays.length === 0 && upcomingHolidays.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2 text-sm">🗓️ วันหยุดที่กำลังจะมาถึง</h3>
          <div className="flex flex-wrap gap-2">
            {upcomingHolidays.map(h => {
              const d = new Date(h.date + 'T00:00:00')
              const dayNames = ['อา','จ','อ','พ','พฤ','ศ','ส']
              const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
              return (
                <div key={h.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-white text-amber-700 border-amber-300">
                  <span className="font-bold">{d.getDate()} {monthNames[d.getMonth()]}</span>
                  <span className="opacity-70">{dayNames[d.getDay()]}.</span>
                  <span>{h.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-employee */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">สรุปรายพนักงาน — {MONTHS[month-1]} {year+543}</h3>
        </div>
        {employees.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">เลือกพนักงานจากแถบซ้าย</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">พนักงาน</th>
                  <th className="px-3 py-2 text-center">มาทำงาน</th>
                  <th className="px-3 py-2 text-center">สาย</th>
                  <th className="px-3 py-2 text-center">ลา/ขาด</th>
                  <th className="px-3 py-2 text-center">OT</th>
                  <th className="px-4 py-2 text-right">เงินเดือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map(emp => {
                  const s = empStats(emp.id)
                  const pay = payslips.find(p => p.employee_id === emp.id)
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.employee_code} · {emp.type === 'freelance' ? 'Freelance' : 'ประจำ'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{s.present}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${s.late > 0 ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300'}`}>{s.late}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${(s.leave+s.absent) > 0 ? 'bg-red-100 text-red-600' : 'text-gray-300'}`}>{s.leave+s.absent}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${s.otHours > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-gray-300'}`}>{s.otHours > 0 ? `${s.otHours}h` : '-'}</span></td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{pay ? formatCurrency(pay.net_pay) : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Attendance Grid ──────────────────────────────────────────────────────────
function AttendanceGrid({ employees, days, year, month, getRecord, openCell, holidays, onExportEmployee }: {
  employees: Employee[]
  days: number[]
  year: number
  month: number
  getRecord: (empId: string, day: number) => Partial<WorkRecord>
  openCell: (empId: string, day: number) => void
  holidays: CompanyHoliday[]
  onExportEmployee: (empId: string) => void
}) {
  const dateOf = (d: number) => new Date(year, month - 1, d)
  const isWeekend = (d: number) => [0, 6].includes(dateOf(d).getDay())
  const holidayMap = new Map(
    holidays
      .filter(h => { const dd = new Date(h.date + 'T00:00:00'); return dd.getMonth()+1 === month && dd.getFullYear() === year })
      .map(h => [new Date(h.date + 'T00:00:00').getDate(), h.name])
  )

  function statusMeta(val: string | undefined) {
    return STATUS_OPTIONS.find(s => s.val === val)
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <p className="text-lg mb-1">ยังไม่ได้เลือกพนักงาน</p>
        <p className="text-sm">เลือกพนักงานจากแถบซ้ายก่อน</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-gray-600 font-semibold border-b border-r border-gray-200 min-w-[150px]">
              พนักงาน
            </th>
            {days.map(d => {
              const isHol = holidayMap.has(d)
              const holName = holidayMap.get(d)
              return (
                <th key={d} className={`px-1 py-2 text-center border-b border-gray-200 min-w-[52px] ${isWeekend(d) ? 'bg-red-50' : isHol ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <div className={`font-bold ${isWeekend(d) ? 'text-red-400' : isHol ? 'text-amber-600' : 'text-gray-700'}`}>{d}</div>
                  <div className={`font-normal ${isHol ? 'text-amber-500' : 'text-gray-400'}`} style={{fontSize:'9px'}}>{isHol ? '🏖️' : DAY_NAMES[dateOf(d).getDay()]}</div>
                  {isHol && <div className="text-amber-500 leading-tight" style={{fontSize:'8px',maxWidth:'50px',wordBreak:'break-word'}}>{holName}</div>}
                </th>
              )
            })}
            <th className="px-3 py-3 text-center bg-gray-50 border-b border-l border-gray-200 min-w-[90px] text-gray-600 font-semibold">สรุป</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, ei) => {
            const empRecs = days.map(d => getRecord(emp.id, d))
            const presentCount = empRecs.filter(r => r.status === 'present' || r.status === 'late').length
            const absentLeave = empRecs.filter(r => r.status === 'absent' || r.status?.startsWith('leave_')).length
            const otTotal = empRecs.reduce((s, r) => s + (Number(r.ot_hours) || 0), 0)
            return (
              <tr key={emp.id} className={ei % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className={`sticky left-0 z-10 px-4 py-3 border-r border-gray-200 ${ei % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{emp.name}</p>
                      <p className="text-gray-400 text-xs">{emp.employee_code}</p>
                    </div>
                    <button onClick={() => onExportEmployee(emp.id)} title="บันทึก PNG"
                      className="shrink-0 p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition">
                      <Download size={13} />
                    </button>
                  </div>
                </td>
                {days.map(d => {
                  const rec = getRecord(emp.id, d)
                  const meta = statusMeta(rec.status)
                  const hasOt = Number(rec.ot_hours) > 0
                  const hasTime = rec.check_in || rec.check_out
                  const isHolDay = holidayMap.has(d)
                  return (
                    <td key={d}
                      onClick={() => openCell(emp.id, d)}
                      className={`border border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors ${isWeekend(d) ? 'bg-red-50/30' : isHolDay ? 'bg-amber-50/40' : ''}`}>
                      <div className="px-1 py-1.5 flex flex-col items-center gap-0.5 min-h-[52px] justify-center">
                        {meta ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${meta.color}`}>
                            {meta.label.length > 4 ? meta.label.slice(0,3)+'.' : meta.label}
                          </span>
                        ) : (
                          <span className="w-6 h-5 rounded border border-dashed border-gray-200" />
                        )}
                        {hasTime && (
                          <div className="text-gray-400 leading-tight text-center" style={{fontSize:'9px'}}>
                            {rec.check_in && <div>{rec.check_in.slice(0,5)}</div>}
                            {rec.check_out && <div>{rec.check_out.slice(0,5)}</div>}
                          </div>
                        )}
                        {hasOt && (
                          <span className="text-indigo-500 font-bold" style={{fontSize:'9px'}}>OT {rec.ot_hours}h</span>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-2 border-l border-gray-200 text-center space-y-1">
                  <div className="text-green-600 font-semibold">{presentCount} วัน</div>
                  {absentLeave > 0 && <div className="text-red-500">ลา/ขาด {absentLeave}</div>}
                  {otTotal > 0 && <div className="text-indigo-600">OT {otTotal}h</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
