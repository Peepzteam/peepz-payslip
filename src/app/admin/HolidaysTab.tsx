'use client'
import { useEffect, useState, useCallback } from 'react'
import { CompanyHoliday } from '@/types'
import { Plus, Trash2, X } from 'lucide-react'

const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const DAYS_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

function formatDateTH(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default function HolidaysTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', name: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/holidays?year=${year}`)
    const data = await res.json()
    setHolidays(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.name) return
    setSaving(true)
    const d = new Date(form.date + 'T00:00:00')
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: form.date, name: form.name, year: d.getFullYear() }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert('บันทึกไม่ได้: ' + err.error)
    } else {
      setForm({ date: '', name: '' })
      setShowForm(false)
      load()
    }
    setSaving(false)
  }

  async function deleteHoliday(id: string) {
    if (!confirm('ลบวันหยุดนี้?')) return
    try {
      const res = await fetch(`/api/holidays/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert('ลบวันหยุดไม่สำเร็จ: ' + (e.error || res.status)); return }
      load()
    } catch { alert('เกิดข้อผิดพลาด ไม่สามารถลบวันหยุดได้') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">🏖️ วันหยุดประจำปี</h2>
          <p className="text-xs text-gray-400">บริษัท เฮ้าส์ ออฟ มูมู่ จำกัด</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>ปี {y + 543} ({y})</option>
            ))}
          </select>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={15} /> เพิ่มวันหยุด
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={addHoliday} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-800 text-sm">เพิ่มวันหยุดใหม่</p>
            <button type="button" onClick={() => setShowForm(false)}><X size={15} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">วันที่ *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อวันหยุด *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required
                placeholder="เช่น วันสงกรานต์"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-300 py-8">กำลังโหลด...</p>
      ) : holidays.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-300 text-4xl mb-3">🏖️</p>
          <p className="text-gray-400 text-sm mb-4">ยังไม่มีวันหยุดปี {year + 543}</p>
          <p className="text-xs text-gray-400">กดปุ่ม "เพิ่มวันหยุด" ด้านบนเพื่อเพิ่มวันหยุดค่ะ</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-800">
              🎉 วันหยุดทั้งหมดปี {year + 543} — {holidays.length} วัน
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-center w-8">#</th>
                  <th className="px-4 py-3 text-left">วันที่</th>
                  <th className="px-4 py-3 text-left">ชื่อวันหยุด</th>
                  <th className="px-4 py-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {holidays.map((h, idx) => {
                  const d = new Date(h.date + 'T00:00:00')
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <tr key={h.id} className="hover:bg-amber-50/30 group">
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{formatDateTH(h.date)}</p>
                        {isWeekend && <p className="text-xs text-amber-500">⚠️ ตรงกับวันหยุดสุดสัปดาห์</p>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{h.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => deleteHoliday(h.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
