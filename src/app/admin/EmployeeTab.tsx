'use client'
import React, { useEffect, useState, useRef } from 'react'
import { Employee, SalaryHistory } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Upload, UserPlus, Download, Pencil, X, Check, Trash2, ChevronDown, ChevronUp, Plus, History } from 'lucide-react'

const EMPTY_FORM = {
  name: '', email: '', employee_code: '', type: 'fulltime',
  department: '', position: '', base_salary: '', start_date: '', is_owner: false
}

function getProbationStatus(start_date: string | null): { label: string; color: string; detail: string } | null {
  if (!start_date) return null
  const start = new Date(start_date)
  const probationEnd = new Date(start)
  probationEnd.setMonth(probationEnd.getMonth() + 4)
  const today = new Date()
  if (today < probationEnd) {
    const diffDays = Math.ceil((probationEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return { label: '🔶 ทดลองงาน', color: 'bg-amber-100 text-amber-700', detail: `บรรจุใน ${diffDays} วัน` }
  }
  return { label: '✅ พนักงานประจำ', color: 'bg-green-100 text-green-700', detail: `บรรจุแล้ว` }
}

function formatDateTH(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default function EmployeeTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [salaryHistories, setSalaryHistories] = useState<Record<string, SalaryHistory[]>>({})
  const [addingSalary, setAddingSalary] = useState<string | null>(null)
  const [salaryForm, setSalaryForm] = useState({ effective_date: '', salary: '', note: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { loadEmployees() }, [])

  async function loadEmployees() {
    const res = await fetch('/api/employees')
    const data = await res.json()
    setEmployees(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function loadSalaryHistory(employeeId: string) {
    const res = await fetch(`/api/salary-history?employee_id=${employeeId}`)
    const data = await res.json()
    setSalaryHistories(prev => ({ ...prev, [employeeId]: Array.isArray(data) ? data : [] }))
  }

  function toggleExpand(empId: string) {
    if (expandedId === empId) {
      setExpandedId(null)
      setAddingSalary(null)
    } else {
      setExpandedId(empId)
      setAddingSalary(null)
      loadSalaryHistory(empId)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, base_salary: Number(form.base_salary) || null, start_date: form.start_date || null }),
    })
    setShowForm(false)
    setForm(EMPTY_FORM)
    loadEmployees()
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditForm({
      name: emp.name,
      email: emp.email,
      employee_code: emp.employee_code || '',
      type: emp.type,
      department: emp.department || '',
      position: emp.position || '',
      base_salary: emp.base_salary?.toString() || '',
      start_date: emp.start_date || '',
      is_owner: emp.is_owner ?? false,
    })
  }

  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`ปิดใช้งาน "${name}"?\n\nพนักงานจะไม่แสดงในระบบอีก แต่ข้อมูลสลิปเงินเดือนและการทำงานยังคงอยู่`)) return
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      alert('ลบไม่ได้: ' + (err.error || JSON.stringify(err)))
    }
    loadEmployees()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, base_salary: Number(editForm.base_salary) || null, start_date: editForm.start_date || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert('บันทึกไม่ได้: ' + (err.error || JSON.stringify(err)))
        return
      }
      setEditingId(null)
      await loadEmployees()
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  async function addSalaryHistory(employeeId: string) {
    if (!salaryForm.effective_date || !salaryForm.salary) return
    await fetch('/api/salary-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        effective_date: salaryForm.effective_date,
        salary: Number(salaryForm.salary),
        note: salaryForm.note || null,
      }),
    })
    setSalaryForm({ effective_date: '', salary: '', note: '' })
    setAddingSalary(null)
    loadSalaryHistory(employeeId)
    // update base_salary in employees table to latest
    await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_salary: Number(salaryForm.salary) }),
    })
    loadEmployees()
  }

  async function deleteSalaryHistory(id: string, employeeId: string) {
    if (!confirm('ลบประวัติเงินเดือนนี้?')) return
    await fetch(`/api/salary-history/${id}`, { method: 'DELETE' })
    loadSalaryHistory(employeeId)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/employees/import', { method: 'POST', body: fd })
    const data = await res.json()
    setImportMsg(`นำเข้าสำเร็จ ${data.imported} คน`)
    setImporting(false)
    loadEmployees()
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadTemplate() {
    const csv = 'name,email,employee_code,type,department,position,base_salary\nสมชาย ใจดี,somchai@example.com,EMP001,fulltime,Marketing,Manager,35000\nฟรีแลนซ์ตัวอย่าง,free@example.com,,freelance,Design,,0'
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_template.csv'
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">พนักงาน ({employees.length} คน)</h2>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-1 text-sm border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
            <Download size={15} /> Template
          </button>
          <label className="flex items-center gap-1 text-sm border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload size={15} /> Import CSV
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null) }} className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700">
            <UserPlus size={15} /> เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">✅ {importMsg}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800">เพิ่มพนักงานใหม่</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ชื่อ *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="อีเมล *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Field label="รหัสพนักงาน (ปล่อยว่างให้ระบบออกให้)" value={form.employee_code} onChange={(v) => setForm({ ...form, employee_code: v })} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="fulltime">พนักงานประจำ</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <Field label="แผนก" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <Field label="ตำแหน่ง" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
            <Field label="📅 วันเริ่มงาน" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <Field label="เงินเดือนเริ่มต้น" type="number" value={form.base_salary} onChange={(v) => setForm({ ...form, base_salary: v })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">บันทึก</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center text-gray-400">กำลังโหลด...</p>
        ) : employees.length === 0 ? (
          <p className="p-6 text-center text-gray-400">ยังไม่มีพนักงาน</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">ชื่อ / อีเมล</th>
                <th className="px-4 py-3 text-left">แผนก / ตำแหน่ง</th>
                <th className="px-4 py-3 text-center">ประเภท</th>
                <th className="px-4 py-3 text-left">วันเริ่มงาน / สถานะ</th>
                <th className="px-4 py-3 text-right">เงินเดือนปัจจุบัน</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const probation = getProbationStatus(emp.start_date)
                const isExpanded = expandedId === emp.id
                const history = salaryHistories[emp.id] || []

                return (
                  <React.Fragment key={emp.id}>
                    {editingId === emp.id ? (
                      /* ─── Edit row ─── */
                      <tr key={`edit-${emp.id}`} className="bg-indigo-50">
                        <td className="px-4 py-3" colSpan={6}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <Field label="ชื่อ" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} required />
                            <Field label="อีเมล" type="email" value={editForm.email} onChange={(v) => setEditForm({ ...editForm, email: v })} required />
                            <Field label="รหัสพนักงาน" value={editForm.employee_code} onChange={(v) => setEditForm({ ...editForm, employee_code: v })} />
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
                              <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                <option value="fulltime">พนักงานประจำ</option>
                                <option value="freelance">Freelance</option>
                              </select>
                            </div>
                            <Field label="แผนก" value={editForm.department} onChange={(v) => setEditForm({ ...editForm, department: v })} />
                            <Field label="ตำแหน่ง" value={editForm.position} onChange={(v) => setEditForm({ ...editForm, position: v })} />
                            <Field label="📅 วันเริ่มงาน" type="date" value={editForm.start_date} onChange={(v) => setEditForm({ ...editForm, start_date: v })} />
                            <Field label="เงินเดือน (ปัจจุบัน)" type="number" value={editForm.base_salary} onChange={(v) => setEditForm({ ...editForm, base_salary: v })} />
                          </div>
                          <div className="mb-3">
                            <label className="flex items-center gap-2 cursor-pointer w-fit">
                              <input type="checkbox" checked={!!editForm.is_owner}
                                onChange={e => setEditForm({ ...editForm, is_owner: e.target.checked })}
                                className="w-4 h-4 rounded accent-indigo-600" />
                              <span className="text-sm text-gray-700 font-medium">👑 เจ้าของบริษัท / ผู้ถือหุ้น (ยกเว้นประกันสังคม)</span>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(emp.id)} disabled={saving}
                              className="flex items-center gap-1 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-60">
                              <Check size={14} /> {saving ? 'บันทึก...' : 'บันทึก'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 border border-gray-300 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                              <X size={14} /> ยกเลิก
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      /* ─── Normal row ─── */
                      <tr key={`row-${emp.id}`} className={`border-t border-gray-100 hover:bg-gray-50 ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                          {emp.employee_code && <p className="text-xs text-gray-400">{emp.employee_code}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {emp.department && <p>{emp.department}</p>}
                          {emp.position && <p className="text-xs text-gray-400">{emp.position}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${emp.type === 'freelance' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {emp.type === 'freelance' ? 'Freelance' : 'ประจำ'}
                          </span>
                          {emp.is_owner && (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">👑 เจ้าของ</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-500">{formatDateTH(emp.start_date)}</p>
                          {probation && emp.type === 'fulltime' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${probation.color}`}>
                              {probation.label}
                            </span>
                          )}
                          {probation && emp.type === 'fulltime' && probation.label.includes('ทดลอง') && (
                            <p className="text-xs text-gray-400 mt-0.5">{probation.detail}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {emp.base_salary ? formatCurrency(emp.base_salary) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => toggleExpand(emp.id)}
                              className={`p-1.5 rounded transition ${isExpanded ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              title="ประวัติเงินเดือน">
                              <History size={14} />
                            </button>
                            <button onClick={() => { startEdit(emp); setShowForm(false); setExpandedId(null) }}
                              className="text-indigo-500 hover:text-indigo-700 p-1.5 rounded hover:bg-indigo-50" title="แก้ไข">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteEmployee(emp.id, emp.name)}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="ลบ">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ─── Salary history panel ─── */}
                    {isExpanded && editingId !== emp.id && (
                      <tr key={`history-${emp.id}`} className="border-t border-indigo-100">
                        <td colSpan={6} className="px-4 py-4 bg-indigo-50/40">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <History size={15} className="text-indigo-500" />
                              <span className="text-sm font-semibold text-indigo-700">ประวัติเงินเดือน — {emp.name}</span>
                              {emp.start_date && (
                                <span className="text-xs text-gray-400">เริ่มงาน {formatDateTH(emp.start_date)}</span>
                              )}
                            </div>
                            <button onClick={() => setAddingSalary(addingSalary === emp.id ? null : emp.id)}
                              className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                              <Plus size={12} /> บันทึกการปรับเงินเดือน
                            </button>
                          </div>

                          {/* Add salary form */}
                          {addingSalary === emp.id && (
                            <div className="bg-white rounded-xl border border-indigo-200 p-4 mb-3 space-y-3">
                              <p className="text-xs font-semibold text-indigo-700">+ บันทึกการปรับเงินเดือน</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">วันที่มีผล *</label>
                                  <input type="date" value={salaryForm.effective_date}
                                    onChange={e => setSalaryForm(p => ({...p, effective_date: e.target.value}))}
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">เงินเดือน (บาท) *</label>
                                  <input type="number" value={salaryForm.salary} placeholder="เช่น 28000"
                                    onChange={e => setSalaryForm(p => ({...p, salary: e.target.value}))}
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                                  <input value={salaryForm.note} placeholder="เช่น หลังบรรจุประจำ"
                                    onChange={e => setSalaryForm(p => ({...p, note: e.target.value}))}
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => addSalaryHistory(emp.id)}
                                  className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700">
                                  💾 บันทึก
                                </button>
                                <button onClick={() => setAddingSalary(null)}
                                  className="border border-gray-300 px-4 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Salary history table */}
                          {history.length === 0 ? (
                            <p className="text-center text-gray-300 text-xs py-4">ยังไม่มีประวัติเงินเดือน</p>
                          ) : (
                            <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-indigo-50 text-indigo-600">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-semibold">วันที่มีผล</th>
                                    <th className="px-4 py-2 text-right font-semibold">เงินเดือน</th>
                                    <th className="px-4 py-2 text-left font-semibold">หมายเหตุ</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {history.map((h, idx) => (
                                    <tr key={h.id} className={`group ${idx === history.length - 1 ? 'bg-indigo-50/50' : ''}`}>
                                      <td className="px-4 py-2 text-gray-700 font-medium">{formatDateTH(h.effective_date)}</td>
                                      <td className="px-4 py-2 text-right font-bold text-indigo-700">{formatCurrency(h.salary)}</td>
                                      <td className="px-4 py-2 text-gray-400 italic">
                                        {h.note || (idx === history.length - 1 ? '(ปัจจุบัน)' : '')}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button onClick={() => deleteSalaryHistory(h.id, emp.id)}
                                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition">
                                          <Trash2 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {/* Tax summary */}
                              <TaxSummaryForEmployee employee={emp} history={history} />
                            </div>
                          )}
                          <button onClick={() => setExpandedId(null)} className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                            <ChevronUp size={12} /> ย่อ
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Tax Summary ──────────────────────────────────────────────────────────────
function TaxSummaryForEmployee({ employee, history }: { employee: Employee; history: SalaryHistory[] }) {
  if (history.length === 0 && !employee.base_salary) return null

  const currentYear = new Date().getFullYear()
  // Calculate estimated annual income based on salary history for this year
  let annualIncome = 0
  const monthsInYear = 12

  if (history.length === 0 && employee.base_salary) {
    annualIncome = employee.base_salary * monthsInYear
  } else {
    // For each month of the year, find which salary applies
    for (let m = 1; m <= monthsInYear; m++) {
      const monthDate = new Date(currentYear, m - 1, 1)
      // Find latest salary record effective on or before this month
      const applicable = history
        .filter(h => new Date(h.effective_date) <= monthDate)
        .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
      if (applicable) {
        annualIncome += applicable.salary
      } else if (employee.base_salary) {
        annualIncome += employee.base_salary
      }
    }
  }

  // Thai income tax calculation (simplified)
  const expenseDeduction = Math.min(annualIncome * 0.5, 100000)
  const personalDeduction = 60000
  const socialSecurity = 750 * 12 // approx
  const taxableIncome = Math.max(0, annualIncome - expenseDeduction - personalDeduction - socialSecurity)

  let tax = 0
  const brackets = [
    { limit: 150000, rate: 0 },
    { limit: 300000, rate: 0.05 },
    { limit: 500000, rate: 0.10 },
    { limit: 750000, rate: 0.15 },
    { limit: 1000000, rate: 0.20 },
    { limit: 2000000, rate: 0.25 },
    { limit: 5000000, rate: 0.30 },
  ]
  let remaining = taxableIncome
  let prev = 0
  for (const b of brackets) {
    const slice = Math.min(Math.max(remaining - prev, 0), b.limit - prev)
    tax += slice * b.rate
    prev = b.limit
    if (remaining <= b.limit) break
  }
  if (remaining > 5000000) tax += (remaining - 5000000) * 0.35

  const monthlyTax = tax / 12

  return (
    <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100">
      <p className="text-xs font-semibold text-indigo-700 mb-2">📊 ประมาณการภาษีปี {currentYear + 543}</p>
      <div className="grid grid-cols-4 gap-1 sm:gap-2 text-xs text-center">
        <div>
          <p className="text-gray-400">รายได้ต่อปี</p>
          <p className="font-bold text-gray-700">{formatCurrency(annualIncome)}</p>
        </div>
        <div>
          <p className="text-gray-400">รายได้สุทธิหลังหัก</p>
          <p className="font-bold text-gray-700">{formatCurrency(taxableIncome)}</p>
        </div>
        <div>
          <p className="text-gray-400">ภาษีทั้งปี</p>
          <p className="font-bold text-purple-700">{formatCurrency(tax)}</p>
        </div>
        <div>
          <p className="text-gray-400">หักต่อเดือน</p>
          <p className="font-bold text-indigo-700">{formatCurrency(monthlyTax)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-300 mt-1">* ประมาณการ หักค่าใช้จ่าย 50% (สูงสุด 100,000) + ค่าลดหย่อนส่วนตัว 60,000 + ประกันสังคม</p>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  )
}
