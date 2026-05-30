'use client'
import { useEffect, useState, useRef } from 'react'
import { Employee } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Upload, UserPlus, Download, Pencil, X, Check } from 'lucide-react'

const EMPTY_FORM = { name: '', email: '', employee_code: '', type: 'fulltime', department: '', position: '', base_salary: '' }

export default function EmployeeTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { loadEmployees() }, [])

  async function loadEmployees() {
    const res = await fetch('/api/employees')
    const data = await res.json()
    setEmployees(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, base_salary: Number(form.base_salary) || null }),
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
    })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, base_salary: Number(editForm.base_salary) || null }),
    })
    setSaving(false)
    setEditingId(null)
    loadEmployees()
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
            <Upload size={15} /> Import Excel/CSV
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null) }} className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700">
            <UserPlus size={15} /> เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
          ✅ {importMsg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800">เพิ่มพนักงานใหม่</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ชื่อ *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="อีเมล *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Field label="รหัสพนักงาน" value={form.employee_code} onChange={(v) => setForm({ ...form, employee_code: v })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="fulltime">พนักงานประจำ</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <Field label="แผนก" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <Field label="ตำแหน่ง" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
            <Field label="เงินเดือนพื้นฐาน" type="number" value={form.base_salary} onChange={(v) => setForm({ ...form, base_salary: v })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">บันทึก</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
                <th className="px-4 py-3 text-right">เงินเดือน</th>
                <th className="px-4 py-3 text-center">แก้ไข</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) =>
                editingId === emp.id ? (
                  /* ─── Edit row ─── */
                  <tr key={emp.id} className="bg-indigo-50">
                    <td className="px-4 py-2" colSpan={5}>
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
                        <Field label="เงินเดือน" type="number" value={editForm.base_salary} onChange={(v) => setEditForm({ ...editForm, base_salary: v })} />
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
                  <tr key={emp.id} className="hover:bg-gray-50">
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
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {emp.base_salary ? formatCurrency(emp.base_salary) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { startEdit(emp); setShowForm(false) }}
                        className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50">
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
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
