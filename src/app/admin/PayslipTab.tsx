'use client'
import { useEffect, useState, useRef } from 'react'
import { Employee, Payslip, LineItem } from '@/types'
import { formatCurrency, formatPeriod } from '@/lib/utils'
import { Send, Upload, Plus, Download, Pencil, Trash2, Eye, X, Banknote } from 'lucide-react'
import PayslipCard from '@/components/PayslipCard'

const UNITS = ['ชม.', 'วัน', 'งาน', 'ครั้ง', 'เดือน', 'ชิ้น']
const EMPTY_LINE: LineItem = { description: '', quantity: 1, unit: 'ชม.', rate: 0, total: 0 }

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

export default function PayslipTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null)
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }])

  const [form, setForm] = useState({
    employee_id: '',
    period_month: CURRENT_MONTH,
    period_year: CURRENT_YEAR,
    base_salary: '',
    ot_hours: '', ot_rate: '',
    incentive: '', incentive_note: '',
    other_income: '', other_income_note: '',
    project_name: '', work_days: '', daily_rate: '',
    social_security: '', withholding_tax: '',
    other_deduction: '', other_deduction_note: '',
    admin_note: '',
    transfer_date: '',
    send_email: true,
  })
  const [confirmingSend, setConfirmingSend] = useState<string | null>(null)

  const selectedEmployee = employees.find((e) => e.id === form.employee_id)
  const isFreelance = selectedEmployee?.type === 'freelance'

  const otAmount = (Number(form.ot_hours) || 0) * (Number(form.ot_rate) || 0)
  const lineItemsTotal = lineItems.reduce((s, i) => s + (i.total || 0), 0)
  const grossIncome = isFreelance
    ? lineItemsTotal + (Number(form.other_income) || 0)
    : (Number(form.base_salary) || 0) + otAmount + (Number(form.incentive) || 0) + (Number(form.other_income) || 0)
  const totalDeduction =
    (Number(form.social_security) || 0) +
    (Number(form.withholding_tax) || 0) +
    (Number(form.other_deduction) || 0)
  const netPay = grossIncome - totalDeduction

  const subtotalBeforeIncentive = (Number(form.base_salary) || 0) - (Number(form.social_security) || 0) + otAmount

  // auto-update withholding_tax เมื่อ lineItems เปลี่ยน (freelance)
  useEffect(() => {
    if (!isFreelance) return
    const tax = String(Math.round(lineItemsTotal * 0.03 * 100) / 100)
    setForm((prev) => ({ ...prev, withholding_tax: tax }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItemsTotal, isFreelance])

  useEffect(() => {
    fetch('/api/employees').then((r) => r.json()).then((d) => setEmployees(Array.isArray(d) ? d : []))
  }, [])

  // Auto-fill when employee changes
  useEffect(() => {
    if (!selectedEmployee) return
    const isFree = selectedEmployee.type === 'freelance'
    setForm((prev) => ({
      ...prev,
      base_salary: selectedEmployee.base_salary?.toString() || prev.base_salary,
      social_security: isFree ? '0' : '875',
      withholding_tax: isFree ? '0' : String(Math.round((Number(prev.incentive) || 0) * 0.03 * 100) / 100),
    }))
    if (isFree) setLineItems([{ ...EMPTY_LINE }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.employee_id])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/payslips?month=${filterMonth}&year=${filterYear}`)
      .then((r) => r.json())
      .then((d) => { setPayslips(Array.isArray(d) ? d : []); setLoading(false) })
  }, [filterMonth, filterYear])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      employee_id: form.employee_id,
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      base_salary: Number(form.base_salary) || 0,
      ot_hours: Number(form.ot_hours) || 0,
      ot_rate: Number(form.ot_rate) || 0,
      ot_amount: otAmount,
      incentive: Number(form.incentive) || 0,
      incentive_note: form.incentive_note,
      other_income: Number(form.other_income) || 0,
      other_income_note: form.other_income_note,
      project_name: form.project_name,
      work_days: Number(form.work_days) || null,
      daily_rate: Number(form.daily_rate) || 0,
      social_security: Number(form.social_security) || 0,
      withholding_tax: Number(form.withholding_tax) || 0,
      other_deduction: Number(form.other_deduction) || 0,
      other_deduction_note: form.other_deduction_note,
      admin_note: form.admin_note,
      transfer_date: form.transfer_date || null,
      send_email: form.send_email,
      line_items: isFreelance ? lineItems.filter((i) => i.total > 0) : [],
    }
    const res = await fetch('/api/payslips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setShowForm(false)
      fetch(`/api/payslips?month=${filterMonth}&year=${filterYear}`)
        .then((r) => r.json()).then((d) => setPayslips(Array.isArray(d) ? d : []))
    }
  }

  async function resendEmail(payslip: Payslip) {
    setSending(payslip.id)
    const res = await fetch(`/api/payslips/${payslip.id}/send-email`, { method: 'POST' })
    if (!res.ok) {
      const d = await res.json()
      alert('ส่ง email ไม่ได้: ' + d.error)
    }
    setSending(null)
  }

  async function sendTransferConfirm(payslip: Payslip, date?: string) {
    setConfirmingSend(payslip.id)
    const res = await fetch(`/api/payslips/${payslip.id}/transfer-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfer_date: date || payslip.transfer_date || new Date().toISOString().slice(0, 10) }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert('ส่งไม่ได้: ' + d.error)
    } else {
      setPayslips((prev) => prev.map((p) => p.id === payslip.id ? { ...p, transfer_date: date || p.transfer_date || new Date().toISOString().slice(0, 10) } : p))
    }
    setConfirmingSend(null)
  }

  async function deletePayslip(id: string) {
    if (!confirm('ลบสลิปนี้? ไม่สามารถกู้คืนได้')) return
    setDeleting(id)
    await fetch(`/api/payslips/${id}`, { method: 'DELETE' })
    setDeleting(null)
    setPayslips((prev) => prev.filter((p) => p.id !== id))
  }

  function startEdit(p: Payslip) {
    if (p.line_items?.length) setLineItems(p.line_items)
    else setLineItems([{ ...EMPTY_LINE }])
    setEditingPayslip(p)
    setForm({
      employee_id: p.employee_id,
      period_month: p.period_month,
      period_year: p.period_year,
      base_salary: p.base_salary.toString(),
      ot_hours: p.ot_hours.toString(),
      ot_rate: p.ot_rate.toString(),
      incentive: p.incentive.toString(),
      incentive_note: p.incentive_note || '',
      other_income: p.other_income.toString(),
      other_income_note: p.other_income_note || '',
      project_name: p.project_name || '',
      work_days: p.work_days?.toString() || '',
      daily_rate: p.daily_rate.toString(),
      social_security: p.social_security.toString(),
      withholding_tax: p.withholding_tax.toString(),
      other_deduction: p.other_deduction.toString(),
      other_deduction_note: p.other_deduction_note || '',
      admin_note: p.admin_note || '',
      transfer_date: p.transfer_date || '',
      send_email: false,
    })
    setShowForm(true)
    setViewPayslip(null)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayslip) return
    const payload = {
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      base_salary: Number(form.base_salary) || 0,
      ot_hours: Number(form.ot_hours) || 0,
      ot_rate: Number(form.ot_rate) || 0,
      ot_amount: otAmount,
      incentive: Number(form.incentive) || 0,
      incentive_note: form.incentive_note,
      other_income: Number(form.other_income) || 0,
      other_income_note: form.other_income_note,
      project_name: form.project_name,
      work_days: Number(form.work_days) || null,
      daily_rate: Number(form.daily_rate) || 0,
      social_security: Number(form.social_security) || 0,
      withholding_tax: Number(form.withholding_tax) || 0,
      other_deduction: Number(form.other_deduction) || 0,
      other_deduction_note: form.other_deduction_note,
      admin_note: form.admin_note,
      transfer_date: form.transfer_date || null,
      line_items: isFreelance ? lineItems.filter((i) => i.total > 0) : [],
    }
    const res = await fetch(`/api/payslips/${editingPayslip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      setPayslips((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setShowForm(false)
      setEditingPayslip(null)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('send_emails', 'true')
    const res = await fetch('/api/payslips/import', { method: 'POST', body: fd })
    const data = await res.json()
    setImportResult(`นำเข้าสำเร็จ ${data.imported} รายการ${data.errors?.length ? ` (${data.errors.length} ผิดพลาด)` : ''}`)
    setImporting(false)
    fetch(`/api/payslips?month=${filterMonth}&year=${filterYear}`)
      .then((r) => r.json()).then(setPayslips)
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadTemplate() {
    const csv = 'email,month,year,base_salary,ot_hours,ot_rate,incentive,incentive_note,other_income,other_income_note,project_name,work_days,daily_rate,social_security,withholding_tax,other_deduction,other_deduction_note,admin_note\nsomchai@example.com,6,2025,35000,8,262.5,5000,ยอดขายดี,0,,,,0,750,0,0,,\nfree@example.com,6,2025,15000,0,0,0,,0,,Website redesign,10,1500,0,450,0,,'
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payslip_template.csv'
    a.click()
  }

  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800">สลิปเงินเดือน</h2>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-1 text-sm border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
            <Download size={15} /> Template
          </button>
          <label className="flex items-center gap-1 text-sm border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload size={15} /> {importing ? 'กำลังนำเข้า...' : 'Import Excel/CSV'}
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={() => { setShowForm(!showForm); setEditingPayslip(null) }} className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={15} /> สร้างสลิป
          </button>
        </div>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
          ✅ {importResult}
        </div>
      )}

      {showForm && (
        <form onSubmit={editingPayslip ? handleUpdate : handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{editingPayslip ? 'แก้ไขสลิป' : 'สร้างสลิปใหม่'}</h3>
            {editingPayslip && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">กำลังแก้ไข: {editingPayslip.employee?.name}</span>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {!editingPayslip && (
            <div className="col-span-3 md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">พนักงาน *</label>
              <select
                required
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— เลือกพนักงาน —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.type === 'freelance' ? 'Freelance' : 'ประจำ'})</option>
                ))}
              </select>
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
              <select
                value={form.period_month}
                onChange={(e) => setForm({ ...form, period_month: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ปี (ค.ศ.)</label>
              <input
                type="number"
                value={form.period_year}
                onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-3">รายได้</h4>
            {isFreelance ? (
              <div className="space-y-2">
                {/* header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                  <div className="col-span-4">ประเภทงาน</div>
                  <div className="col-span-2">จำนวน</div>
                  <div className="col-span-2">หน่วย</div>
                  <div className="col-span-2">อัตรา/หน่วย</div>
                  <div className="col-span-1 text-right">ยอด</div>
                  <div className="col-span-1" />
                </div>
                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="เช่น ไลฟ์สด, งานอีเว้น"
                      value={item.description}
                      onChange={(e) => {
                        const next = [...lineItems]; next[idx] = { ...next[idx], description: e.target.value }; setLineItems(next)
                      }}
                    />
                    <input
                      type="number"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="0"
                      value={item.quantity || ''}
                      onChange={(e) => {
                        const q = Number(e.target.value) || 0
                        const next = [...lineItems]; next[idx] = { ...next[idx], quantity: q, total: q * next[idx].rate }; setLineItems(next)
                      }}
                    />
                    <select
                      className="col-span-2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={item.unit}
                      onChange={(e) => {
                        const next = [...lineItems]; next[idx] = { ...next[idx], unit: e.target.value }; setLineItems(next)
                      }}
                    >
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                    <input
                      type="number"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="0"
                      value={item.rate || ''}
                      onChange={(e) => {
                        const r = Number(e.target.value) || 0
                        const next = [...lineItems]; next[idx] = { ...next[idx], rate: r, total: next[idx].quantity * r }; setLineItems(next)
                      }}
                    />
                    <div className="col-span-1 text-right text-sm font-medium text-indigo-700">{formatCurrency(item.total)}</div>
                    <button type="button" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                      className="col-span-1 text-gray-400 hover:text-red-500 flex justify-center">
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setLineItems([...lineItems, { ...EMPTY_LINE }])}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mt-1">
                  <Plus size={14} /> เพิ่มรายการ
                </button>
                <div className="text-right text-sm font-semibold text-gray-700 border-t pt-2">
                  รวมค่าจ้าง: <span className="text-indigo-700">{formatCurrency(lineItemsTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <FField label="เงินเดือน (บาท)" value={form.base_salary} onChange={(v) => setForm({ ...form, base_salary: v })} type="number" />
                <FField label="OT (ชั่วโมง)" value={form.ot_hours} onChange={(v) => setForm({ ...form, ot_hours: v })} type="number" />
                <FField label="อัตรา OT/ชม." value={form.ot_rate} onChange={(v) => setForm({ ...form, ot_rate: v })} type="number" />
                {(Number(form.ot_hours) > 0 || Number(form.ot_rate) > 0) && (
                  <div className="col-span-3 text-sm text-indigo-600">
                    OT: {form.ot_hours} ชม. × {formatCurrency(Number(form.ot_rate))} = <strong>{formatCurrency(otAmount)}</strong>
                  </div>
                )}
                <FField
                  label="Incentive (บาท)"
                  value={form.incentive}
                  onChange={(v) => {
                    const tax = String(Math.round(Number(v) * 0.03 * 100) / 100)
                    setForm({ ...form, incentive: v, withholding_tax: tax })
                  }}
                  type="number"
                />
                <div className="col-span-2">
                  <FField label="หมายเหตุ Incentive" value={form.incentive_note} onChange={(v) => setForm({ ...form, incentive_note: v })} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mt-3">
              <FField label="รายได้อื่นๆ" value={form.other_income} onChange={(v) => setForm({ ...form, other_income: v })} type="number" />
              <div className="col-span-2">
                <FField label="หมายเหตุ" value={form.other_income_note} onChange={(v) => setForm({ ...form, other_income_note: v })} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">รายการหัก</h4>
            <p className="text-xs text-gray-400 mb-3">คำนวณอัตโนมัติ — แก้ไขได้ถ้าจำเป็น</p>
            <div className="grid grid-cols-3 gap-4">
              <FField label={`ประกันสังคม${!isFreelance ? ' (875 บาท)' : ''}`} value={form.social_security} onChange={(v) => setForm({ ...form, social_security: v })} type="number" />
              <FField label={`ภาษีหัก ณ ที่จ่าย${isFreelance ? ' (3% ค่าจ้าง)' : ' (3% Incentive)'}`} value={form.withholding_tax} onChange={(v) => setForm({ ...form, withholding_tax: v })} type="number" />
              <FField label="หักอื่นๆ" value={form.other_deduction} onChange={(v) => setForm({ ...form, other_deduction: v })} type="number" />
              <div className="col-span-3">
                <FField label="หมายเหตุการหัก" value={form.other_deduction_note} onChange={(v) => setForm({ ...form, other_deduction_note: v })} />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            {!isFreelance && (
              <div className="text-xs text-gray-500 mb-2">
                รวมแล้ว (เงินเดือน {formatCurrency(Number(form.base_salary)||0)} − ปกส {formatCurrency(Number(form.social_security)||0)} + OT {formatCurrency(otAmount)}) = <strong className="text-gray-700">{formatCurrency(subtotalBeforeIncentive)}</strong>
                {Number(form.incentive) > 0 && (
                  <span> + Incentive {formatCurrency(Number(form.incentive))} − ภาษี {formatCurrency(Number(form.withholding_tax)||0)}</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-500">รวมรายได้</p>
                <p className="font-bold text-green-700">{formatCurrency(grossIncome)}</p>
              </div>
              <div>
                <p className="text-gray-500">รวมหัก</p>
                <p className="font-bold text-red-600">{formatCurrency(totalDeduction)}</p>
              </div>
              <div>
                <p className="text-gray-500">ยอดโอนสุทธิ</p>
                <p className="font-bold text-indigo-700 text-lg">{formatCurrency(netPay)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FField label="หมายเหตุจาก Admin" value={form.admin_note} onChange={(v) => setForm({ ...form, admin_note: v })} />
            <FField label="วันที่โอนเงิน (ถ้าโอนแล้ว)" value={form.transfer_date} onChange={(v) => setForm({ ...form, transfer_date: v })} type="date" />
          </div>

          {!editingPayslip && (
          <div className="flex items-center gap-2">
            <input
              id="send_email"
              type="checkbox"
              checked={form.send_email}
              onChange={(e) => setForm({ ...form, send_email: e.target.checked })}
              className="w-4 h-4 text-indigo-600"
            />
            <label htmlFor="send_email" className="text-sm text-gray-700">ส่ง Email แจ้งพนักงานทันที</label>
          </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingPayslip ? '💾 บันทึกการแก้ไข' : form.send_email ? '💾 บันทึก & ส่ง Email' : '💾 บันทึก'}
            </button>
            {editingPayslip && (
              <button
                type="button"
                onClick={async () => {
                  await handleUpdate({ preventDefault: () => {} } as React.FormEvent)
                  await resendEmail(editingPayslip)
                }}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                💾 บันทึก & ส่ง Email
              </button>
            )}
            <button type="button" onClick={() => { setShowForm(false); setEditingPayslip(null) }} className="border border-gray-300 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-gray-400">กำลังโหลด...</p>
        ) : payslips.length === 0 ? (
          <p className="p-6 text-center text-gray-400">ไม่มีสลิปสำหรับช่วงเวลานี้</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">พนักงาน</th>
                <th className="px-4 py-3 text-left">งวด</th>
                <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{p.employee?.name}</p>
                    <p className="text-xs text-gray-400">{p.employee?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatPeriod(p.period_month, p.period_year)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-800">{formatCurrency(p.net_pay)}</p>
                    {p.transfer_date && (
                      <p className="text-xs text-green-600">✅ โอนแล้ว {new Date(p.transfer_date).toLocaleDateString('th-TH')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewPayslip(p)} title="ดูสลิป"
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => startEdit(p)} title="แก้ไข"
                        className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => resendEmail(p)} title="ส่งสลิป Email" disabled={sending === p.id}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40">
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => sendTransferConfirm(p)}
                        title="ส่งยืนยันการโอนเงิน"
                        disabled={confirmingSend === p.id}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                      >
                        <Banknote size={14} />
                      </button>
                      <button onClick={() => deletePayslip(p.id)} title="ลบ" disabled={deleting === p.id}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View / Export modal */}
      {viewPayslip && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl mt-8 mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold">ดูสลิป</h3>
              <button onClick={() => setViewPayslip(null)} className="text-white hover:text-gray-200">
                <X size={22} />
              </button>
            </div>
            <PayslipCard payslip={viewPayslip} showExport />
            <div className="mt-3 flex gap-2">
              <button onClick={() => startEdit(viewPayslip)}
                className="flex items-center gap-1 bg-white text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50">
                <Pencil size={14} /> แก้ไขสลิปนี้
              </button>
              <button onClick={() => { deletePayslip(viewPayslip.id); setViewPayslip(null) }}
                className="flex items-center gap-1 bg-white text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50">
                <Trash2 size={14} /> ลบสลิปนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}
