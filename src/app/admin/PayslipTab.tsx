'use client'
import { useEffect, useState, useRef } from 'react'
import { Employee, Payslip, LineItem, OtItem, IncentiveItem } from '@/types'
import { formatCurrency, formatPeriod } from '@/lib/utils'
import { Send, Upload, Plus, Download, Pencil, Trash2, Eye, X, Banknote, CheckSquare, Square, Wallet, Receipt, PartyPopper, UserPlus, Copy, Loader2, Check } from 'lucide-react'
import { calculateTax, calcSocialSecurity } from '@/lib/tax'
import PayslipCard from '@/components/PayslipCard'

const UNITS = ['ชม.', 'วัน', 'งาน', 'ครั้ง', 'เดือน', 'ชิ้น']
const EMPTY_LINE: LineItem = { description: '', quantity: 1, unit: 'ชม.', rate: 0, total: 0 }
const EMPTY_OT: OtItem = { date: '', start_time: '', end_time: '', hours: 0, type: 'normal', rate: 0, amount: 0 }
const EMPTY_INCENTIVE: IncentiveItem = { description: '', amount: 0 }

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff <= 0) diff += 24 * 60 // ข้ามเที่ยงคืน เช่น 18:00 → 00:00
  return Math.round(diff / 60 * 100) / 100
}

export default function PayslipTab({ isReadOnly = false, incomingPayslipId, incomingMonth }: { isReadOnly?: boolean; incomingPayslipId?: string; incomingMonth?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sentFlash, setSentFlash] = useState<string | null>(null)
  const [confirmFlash, setConfirmFlash] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const lastEditedId = useRef<string | null>(null)

  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null)
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE }])
  const [otItems, setOtItems] = useState<OtItem[]>([])
  const [incentiveItems, setIncentiveItems] = useState<IncentiveItem[]>([])

  const [guestMode, setGuestMode] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestType, setGuestType] = useState<'fulltime' | 'freelance'>('freelance')

  const [form, setForm] = useState({
    employee_id: '',
    period_month: CURRENT_MONTH,
    period_year: CURRENT_YEAR,
    base_salary: '',
    incentive: '', incentive_note: '',
    other_income: '', other_income_note: '',
    project_name: '', work_days: '', daily_rate: '',
    social_security: '', withholding_tax: '',
    other_deduction: '', other_deduction_note: '',
    admin_note: '',
    transfer_date: '',
    due_date: '',
    document_url: '',
    payment_doc_url: '',
    wht_cert_email: '',
    freelance_confirm_id_card_url: '',
    freelance_confirm_bank_book_url: '',
    send_email: true,
  })
  const [confirmingSend, setConfirmingSend] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'list' | 'batch'>('list')
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set())
  const [batchDocLinks, setBatchDocLinks] = useState<Record<string, string>>({})
  const [batchPaying, setBatchPaying] = useState(false)
  const [freelanceFilter, setFreelanceFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid')
  const [expandedFreelance, setExpandedFreelance] = useState<Set<string>>(new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const selectedEmployee = employees.find((e) => e.id === form.employee_id)
  const isFreelance = guestMode ? guestType === 'freelance' : selectedEmployee?.type === 'freelance'
  const isOwner = !guestMode && selectedEmployee?.is_owner === true

  const dailyRate = (Number(form.base_salary) || 0) / 30
  const normalOtRate = Math.round(dailyRate / 8 * 1.5 * 100) / 100
  const holidayOtRate = Math.round(dailyRate / 8 * 3 * 100) / 100

  // OT items with auto-computed rates
  const otItemsWithRate = otItems.map((item) => {
    const rate = item.type === 'holiday' ? holidayOtRate : normalOtRate
    const hours = item.hours || calcHours(item.start_time, item.end_time)
    const amount = Math.round(hours * rate * 100) / 100
    return { ...item, rate, hours, amount }
  })
  const otAmount = otItemsWithRate.reduce((s, i) => s + i.amount, 0)

  const lineItemsTotal = lineItems.reduce((s, i) => s + (i.total || 0), 0)
  const incentiveTotal = incentiveItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const grossIncome = isFreelance
    ? lineItemsTotal + (Number(form.other_income) || 0)
    : (Number(form.base_salary) || 0) + otAmount + incentiveTotal + (Number(form.other_income) || 0)
  const totalDeduction =
    (Number(form.social_security) || 0) +
    (Number(form.withholding_tax) || 0) +
    (Number(form.other_deduction) || 0)
  const netPay = grossIncome - totalDeduction

  const subtotalBeforeIncentive = (Number(form.base_salary) || 0) - (Number(form.social_security) || 0) + otAmount

  const taxCalc = !isFreelance && form.base_salary
    ? calculateTax(
        Number(form.base_salary) || 0,
        otAmount,
        incentiveTotal,
        Number(form.social_security) || 0,
      )
    : null

  // Auto-calc WHT ตามแนวบัญชี:
  // - Freelance: 3% ของค่าจ้างทั้งหมด
  // - เจ้าของ: 3% ของ เงินเดือน+incentive (ค่าบริการกรรมการ)
  // - พนักงานประจำ: 3% ของ incentive เท่านั้น (เงินเดือน+OT พนักงานยื่นภาษีเองปลายปี)
  useEffect(() => {
    let wht = 0
    if (isFreelance) {
      wht = Math.round(lineItemsTotal * 0.03 * 100) / 100
    } else if (isOwner) {
      wht = Math.round(incentiveTotal * 0.03 * 100) / 100
    } else {
      wht = Math.round(incentiveTotal * 0.03 * 100) / 100
    }
    // ตอนเปิดฟอร์มแก้ไขครั้งแรก ใช้ค่า WHT ที่บันทึกไว้เดิม ไม่ทับด้วยค่าคำนวณใหม่
    if (editingPayslip && lastEditedId.current !== editingPayslip.id) {
      lastEditedId.current = editingPayslip.id
      return
    }
    if (!editingPayslip) lastEditedId.current = null
    setForm((prev) => ({ ...prev, withholding_tax: wht.toFixed(2) }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.base_salary, incentiveTotal, lineItemsTotal, isFreelance, isOwner, editingPayslip])

  useEffect(() => {
    fetch('/api/employees').then((r) => r.json()).then((d) => setEmployees(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showForm])

  // Incoming from Peepz Flow: set month filter + highlight the payslip
  useEffect(() => {
    if (!incomingPayslipId) return
    if (incomingMonth) {
      const [yearStr, monthStr] = incomingMonth.split('-')
      const m = parseInt(monthStr, 10)
      const y = parseInt(yearStr, 10)
      if (!isNaN(m) && !isNaN(y)) {
        setFilterMonth(m)
        setFilterYear(y)
        setFreelanceFilter('all')
      }
    }
    setHighlightId(incomingPayslipId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingPayslipId])

  // Scroll to highlighted payslip after payslips load
  useEffect(() => {
    if (!highlightId || loading) return
    setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }, [highlightId, loading])

  useEffect(() => {
    if (!selectedEmployee || editingPayslip) return
    const isFree = selectedEmployee.type === 'freelance'
    const isOwnEmp = selectedEmployee.is_owner === true
    const salary = selectedEmployee.base_salary || 0
    const ss = calcSocialSecurity(salary, isOwnEmp, isFree)
    // WHT ตอนเลือก employee: ยังไม่มี incentive → WHT = 0 เสมอ (จะ recalc เมื่อกรอก incentive)
    const wht = 0
    setForm((prev) => ({
      ...prev,
      base_salary: selectedEmployee.base_salary?.toString() || prev.base_salary,
      social_security: String(ss),
      withholding_tax: String(wht),
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

  // โหลดสลิป Freelance ของเดือนก่อน เพื่อเช็คว่าใครยังไม่มีสลิปเดือนนี้
  const [prevFreelancePayslips, setPrevFreelancePayslips] = useState<Payslip[]>([])
  useEffect(() => {
    const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1
    const prevYear = filterMonth === 1 ? filterYear - 1 : filterYear
    fetch(`/api/payslips?month=${prevMonth}&year=${prevYear}`)
      .then((r) => r.json())
      .then((d) => setPrevFreelancePayslips(
        Array.isArray(d) ? d.filter((p: Payslip) => p.employee?.type === 'freelance' || p.guest_type === 'freelance') : []
      ))
  }, [filterMonth, filterYear])

  function updateOtItem(idx: number, patch: Partial<OtItem>) {
    setOtItems((prev) => {
      const next = [...prev]
      const item = { ...next[idx], ...patch }
      // auto-calc hours from time if not explicitly set
      if ('start_time' in patch || 'end_time' in patch) {
        item.hours = calcHours(item.start_time, item.end_time)
      }
      next[idx] = item
      return next
    })
  }

  function addOtRow() {
    const today = new Date().toISOString().slice(0, 10)
    setOtItems((prev) => [...prev, { ...EMPTY_OT, date: today }])
  }

  function removeOtRow(idx: number) {
    setOtItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addIncentiveRow() {
    setIncentiveItems((prev) => [...prev, { ...EMPTY_INCENTIVE }])
  }
  function updateIncentiveItem(idx: number, patch: Partial<IncentiveItem>) {
    setIncentiveItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }
  function removeIncentiveRow(idx: number) {
    setIncentiveItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalOtItems = otItemsWithRate
    const payload = {
      employee_id: guestMode ? null : form.employee_id,
      guest_name: guestMode ? guestName : null,
      guest_email: guestMode ? guestEmail : null,
      guest_type: guestMode ? guestType : null,
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      base_salary: Number(form.base_salary) || 0,
      ot_hours: finalOtItems.reduce((s, i) => s + i.hours, 0),
      ot_rate: finalOtItems.length === 1 ? finalOtItems[0].rate : normalOtRate,
      ot_amount: otAmount,
      ot_items: finalOtItems,
      incentive: incentiveTotal,
      incentive_note: incentiveItems.map(i => i.description).filter(Boolean).join(', '),
      incentive_items: incentiveItems.filter(i => i.amount > 0),
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
      due_date: form.due_date || null,
      document_url: form.document_url || null,
      payment_doc_url: form.payment_doc_url || null,
      wht_cert_email: form.wht_cert_email || null,
      freelance_confirm_id_card_url: form.freelance_confirm_id_card_url || null,
      freelance_confirm_bank_book_url: form.freelance_confirm_bank_book_url || null,
      send_email: form.send_email,
      line_items: isFreelance ? lineItems.filter((i) => i.total > 0) : [],
      is_paid: !!form.transfer_date,
    }
    try {
      const res = await fetch('/api/payslips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert('บันทึกไม่สำเร็จ: ' + (d.error || `HTTP ${res.status}`))
        return
      }
      setShowForm(false)
      setOtItems([])
      setIncentiveItems([])
      fetch(`/api/payslips?month=${filterMonth}&year=${filterYear}`)
        .then((r) => r.json()).then((d) => setPayslips(Array.isArray(d) ? d : []))
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + String(err))
    }
  }

  async function ensureRecipientEmail(payslip: Payslip): Promise<Payslip | null> {
    if (payslip.employee?.email || payslip.guest_email || payslip.wht_cert_email) return payslip
    const name = payslip.employee?.name ?? payslip.guest_name ?? ''
    const email = window.prompt(`ยังไม่มีอีเมลของ "${name}" ในระบบ\nกรุณากรอกอีเมลเพื่อส่ง (จะบันทึกไว้ใช้ครั้งต่อไปด้วย):`)
    if (!email || !email.trim()) return null
    const res = await fetch(`/api/payslips/${payslip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wht_cert_email: email.trim() }),
    })
    if (!res.ok) { alert('บันทึกอีเมลไม่สำเร็จ'); return null }
    const updated = { ...payslip, wht_cert_email: email.trim() }
    setPayslips((prev) => prev.map((p) => p.id === payslip.id ? updated : p))
    return updated
  }

  async function resendEmail(payslip: Payslip) {
    const target = await ensureRecipientEmail(payslip)
    if (!target) return
    setSending(payslip.id)
    const res = await fetch(`/api/payslips/${payslip.id}/send-email`, { method: 'POST' })
    if (!res.ok) {
      const d = await res.json()
      alert('ส่ง email ไม่ได้: ' + d.error)
    } else {
      setSentFlash(payslip.id)
      setTimeout(() => setSentFlash(null), 2000)
    }
    setSending(null)
  }

  async function sendTransferConfirm(payslip: Payslip, date?: string) {
    const target = await ensureRecipientEmail(payslip)
    if (!target) return
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
      setConfirmFlash(payslip.id)
      setTimeout(() => setConfirmFlash(null), 2000)
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

  async function markPaid(payslip: Payslip) {
    const today = new Date().toISOString().slice(0, 10)
    const confirmed = confirm(`ยืนยันการจ่ายเงิน?\n\n👤 ${payslip.employee?.name ?? payslip.guest_name}\n💰 ${formatCurrency(payslip.net_pay)}\n📅 วันที่จ่าย: ${today}`)
    if (!confirmed) return
    const res = await fetch(`/api/payslips/${payslip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: true, transfer_date: today }),
    })
    if (!res.ok) { alert('เกิดข้อผิดพลาด'); return }
    setPayslips((prev) => prev.map((p) => p.id === payslip.id ? { ...p, is_paid: true, transfer_date: today } : p))
  }

  function copyItemList(p: Payslip) {
    const items = p.line_items ?? []
    let lines: string[]
    if (items.length > 0) {
      lines = items.map(it => `${it.description || '(ไม่ระบุ)'}${it.quantity ? ` ${it.quantity} ${it.unit}` : ''}`)
    } else {
      lines = [p.project_name || 'ค่าจ้าง']
      if (p.other_income_note) lines.push(p.other_income_note)
    }
    const name = p.employee?.name ?? p.guest_name ?? ''
    navigator.clipboard.writeText([name, ...lines].join('\n'))
    alert('คัดลอกรายการแล้ว ✅')
  }

  function copyConfirmLink(p: Payslip) {
    const url = `${window.location.origin}/freelance-confirm/${p.id}`
    const text = `รบกวนเช็คยอดที่บัญชีจะโอนให้ในรอบนี้ค่ะ รวมถึงส่งลิงก์สำเนาบัตรประชาชนและ Book Bank และกรอกอีเมลเพื่อให้บัญชีส่งใบ 50 ทวิให้นะคะ ขอบคุณค่า\n\n${url}`
    navigator.clipboard.writeText(text)
    alert('คัดลอกข้อความ + ลิงก์แล้ว ✅')
  }

  function startEdit(p: Payslip) {
    if (p.line_items?.length) setLineItems(p.line_items)
    else if ((p.guest_type === 'freelance' || p.employee?.type === 'freelance') && p.base_salary > 0) {
      setLineItems([{ description: p.project_name || 'ค่าจ้าง', quantity: 1, unit: 'งาน', rate: p.base_salary, total: p.base_salary }])
    } else setLineItems([{ ...EMPTY_LINE }])
    // Load ot_items or convert legacy ot_hours to single row
    if (p.ot_items?.length) {
      setOtItems(p.ot_items)
    } else if (p.ot_hours > 0) {
      setOtItems([{ date: '', start_time: '', end_time: '', hours: p.ot_hours, type: 'normal', rate: p.ot_rate, amount: p.ot_amount }])
    } else {
      setOtItems([])
    }
    // Load incentive_items or convert legacy single incentive
    if (p.incentive_items?.length) {
      setIncentiveItems(p.incentive_items)
    } else if (p.incentive > 0) {
      setIncentiveItems([{ description: p.incentive_note || 'Incentive', amount: p.incentive }])
    } else {
      setIncentiveItems([])
    }
    if (p.employee_id) {
      setGuestMode(false)
    } else {
      setGuestMode(true)
      setGuestName(p.guest_name || '')
      setGuestEmail(p.guest_email || '')
      setGuestType((p.guest_type as 'fulltime' | 'freelance') || 'freelance')
    }
    setEditingPayslip(p)
    setForm({
      employee_id: p.employee_id ?? '',
      period_month: p.period_month,
      period_year: p.period_year,
      base_salary: p.base_salary.toString(),
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
      transfer_date: p.is_paid ? (p.transfer_date || '') : '',
      due_date: p.due_date || '',
      document_url: p.document_url || '',
      payment_doc_url: p.payment_doc_url || '',
      wht_cert_email: p.wht_cert_email || '',
      freelance_confirm_id_card_url: p.freelance_confirm_id_card_url || p.employee?.doc_id_card_url || '',
      freelance_confirm_bank_book_url: p.freelance_confirm_bank_book_url || p.employee?.doc_bank_book_url || '',
      send_email: false,
    })
    setShowForm(true)
    setViewPayslip(null)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayslip) return
    const finalOtItems = otItemsWithRate
    const payload = {
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      base_salary: Number(form.base_salary) || 0,
      ot_hours: finalOtItems.reduce((s, i) => s + i.hours, 0),
      ot_rate: finalOtItems.length === 1 ? finalOtItems[0].rate : normalOtRate,
      ot_amount: otAmount,
      ot_items: finalOtItems,
      incentive: incentiveTotal,
      incentive_note: incentiveItems.map(i => i.description).filter(Boolean).join(', '),
      incentive_items: incentiveItems.filter(i => i.amount > 0),
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
      document_url: form.document_url || null,
      payment_doc_url: form.payment_doc_url || null,
      wht_cert_email: form.wht_cert_email || null,
      freelance_confirm_id_card_url: form.freelance_confirm_id_card_url || null,
      freelance_confirm_bank_book_url: form.freelance_confirm_bank_book_url || null,
      line_items: isFreelance ? lineItems.filter((i) => i.total > 0) : [],
      is_paid: !!form.transfer_date,
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
      setOtItems([])
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

  function exportCSV() {
    const MONTHS_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    const headers = ['ชื่อ','อีเมล','งวด','ประเภท','เงินเดือน','OT (ชม.)','ค่า OT','Incentive','รายได้อื่น','รวมรายได้','ประกันสังคม','ภาษีหัก','หักอื่น','รวมหัก','ยอดสุทธิ','วันที่โอน','หมายเหตุ','ลิงก์เอกสารประกอบ','ลิงก์เอกสารทำจ่าย','อีเมลใบ 50 ทวิ']
    const rows = payslips.map((p) => [
      p.employee?.name ?? p.guest_name ?? '',
      p.employee?.email ?? p.guest_email ?? '',
      `${MONTHS_TH[p.period_month]} ${p.period_year + 543}`,
      p.employee ? (p.employee.type === 'freelance' ? 'Freelance' : 'ประจำ') : (p.guest_type === 'freelance' ? 'Freelance' : 'ประจำ'),
      p.base_salary,
      p.ot_hours,
      p.ot_amount,
      p.incentive,
      p.other_income,
      p.gross_income,
      p.social_security,
      p.withholding_tax,
      p.other_deduction,
      p.total_deduction,
      p.net_pay,
      p.transfer_date ? new Date(p.transfer_date).toLocaleDateString('th-TH') : '',
      p.admin_note ?? '',
      p.document_url ?? '',
      p.payment_doc_url ?? '',
      p.wht_cert_email ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const MONTHS_TH2 = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
    a.download = `payslips-${MONTHS_TH2[filterMonth]}-${filterYear + 543}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  const freelanceUnpaid = payslips.filter(p =>
    (p.employee?.type === 'freelance' || p.guest_type === 'freelance') && !p.is_paid
  )
  const freelancePayslipsAll = payslips.filter(p =>
    p.employee?.type === 'freelance' || p.guest_type === 'freelance'
  )
  const freelanceDisplayed = freelanceFilter === 'unpaid' ? freelancePayslipsAll.filter(p => !p.is_paid)
    : freelanceFilter === 'paid' ? freelancePayslipsAll.filter(p => p.is_paid)
    : freelancePayslipsAll
  const freelanceTotalGross = freelancePayslipsAll.reduce((s, p) => s + p.gross_income, 0)
  const freelanceTotalWht = freelancePayslipsAll.reduce((s, p) => s + p.withholding_tax, 0)
  const freelanceTotalNet = freelancePayslipsAll.reduce((s, p) => s + p.net_pay, 0)

  // Freelance ที่มีสลิปเดือนก่อน แต่ยังไม่มีสลิปของเดือนนี้ (น่าจะเป็น Freelance ประจำ)
  const freelanceMissingThisMonth = prevFreelancePayslips.filter(prev => {
    const key = prev.employee_id ?? prev.guest_email ?? prev.guest_name
    return !payslips.some(p => (p.employee_id ?? p.guest_email ?? p.guest_name) === key)
  })

  function quickCreateFromPrevious(prev: Payslip, keepIncome = true) {
    setGuestMode(!prev.employee_id)
    if (!prev.employee_id) {
      setGuestName(prev.guest_name || '')
      setGuestEmail(prev.guest_email || '')
      setGuestType(prev.guest_type === 'fulltime' ? 'fulltime' : 'freelance')
    }
    setLineItems(keepIncome && prev.line_items?.length ? prev.line_items.map(i => ({ ...i })) : [{ ...EMPTY_LINE }])
    setOtItems([])
    setIncentiveItems([])
    setEditingPayslip(null)
    setForm({
      employee_id: prev.employee_id ?? '',
      period_month: filterMonth,
      period_year: filterYear,
      base_salary: keepIncome ? (prev.base_salary?.toString() ?? '') : '',
      incentive: '', incentive_note: '',
      other_income: keepIncome && prev.other_income ? prev.other_income.toString() : '',
      other_income_note: keepIncome ? (prev.other_income_note || '') : '',
      project_name: prev.project_name || '',
      work_days: '', daily_rate: '',
      social_security: prev.social_security?.toString() ?? '0',
      withholding_tax: '0',
      other_deduction: '0', other_deduction_note: '',
      admin_note: '',
      transfer_date: '',
      due_date: '',
      document_url: '',
      payment_doc_url: '',
      wht_cert_email: prev.wht_cert_email || '',
      freelance_confirm_id_card_url: prev.freelance_confirm_id_card_url || prev.employee?.doc_id_card_url || '',
      freelance_confirm_bank_book_url: prev.freelance_confirm_bank_book_url || prev.employee?.doc_bank_book_url || '',
      send_email: true,
    })
    setShowForm(true)
  }

  async function payOneFreelancer(p: Payslip) {
    const today = new Date().toISOString().slice(0, 10)
    const patch: Record<string, unknown> = { is_paid: true, transfer_date: today }
    if (batchDocLinks[p.id]) patch.document_url = batchDocLinks[p.id]
    const res = await fetch(`/api/payslips/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      setPayslips(prev => prev.map(x => x.id === p.id
        ? { ...x, is_paid: true, transfer_date: today, document_url: batchDocLinks[p.id] || x.document_url }
        : x))
      setBatchSelected(prev => { const s = new Set(prev); s.delete(p.id); return s })
    }
  }

  function openNewFreelanceForm() {
    setEditingPayslip(null)
    setGuestMode(true)
    setGuestName('')
    setGuestEmail('')
    setGuestType('freelance')
    setLineItems([{ ...EMPTY_LINE }])
    setOtItems([])
    setIncentiveItems([])
    setForm({
      employee_id: '',
      period_month: filterMonth,
      period_year: filterYear,
      base_salary: '',
      incentive: '', incentive_note: '',
      other_income: '', other_income_note: '',
      project_name: '', work_days: '', daily_rate: '',
      social_security: '0', withholding_tax: '0',
      other_deduction: '', other_deduction_note: '',
      admin_note: '',
      transfer_date: '',
      due_date: '',
      document_url: '',
      payment_doc_url: '',
      wht_cert_email: '',
      freelance_confirm_id_card_url: '',
      freelance_confirm_bank_book_url: '',
      send_email: true,
    })
    setShowForm(true)
  }

  async function payBatch() {
    if (batchSelected.size === 0) return
    if (!confirm(`ยืนยันจ่ายค่าบริการ ${batchSelected.size} คน?\nรวม ฿${freelanceUnpaid.filter(p => batchSelected.has(p.id)).reduce((s, p) => s + p.net_pay, 0).toLocaleString('th-TH')}`)) return
    setBatchPaying(true)
    const today = new Date().toISOString().slice(0, 10)
    await Promise.all(Array.from(batchSelected).map(id => {
      const patch: Record<string, unknown> = { is_paid: true, transfer_date: today }
      if (batchDocLinks[id]) patch.document_url = batchDocLinks[id]
      return fetch(`/api/payslips/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    }))
    setPayslips(prev => prev.map(p =>
      batchSelected.has(p.id)
        ? { ...p, is_paid: true, transfer_date: today, document_url: batchDocLinks[p.id] || p.document_url }
        : p
    ))
    setBatchSelected(new Set())
    setBatchDocLinks({})
    setBatchPaying(false)
  }

  const renderPayslipRow = (p: Payslip) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-gray-800">{p.employee?.name ?? p.guest_name}</p>
                      {p.created_by && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${p.created_by === 'Prae' ? 'bg-pink-100 text-pink-500' : p.created_by === 'Ploy' ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                          {p.created_by}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{p.employee?.email ?? p.guest_email}</p>
                    {p.document_url && (
                      <a href={p.document_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
                        📎 เอกสารประกอบ
                      </a>
                    )}
                    {p.payment_doc_url && (
                      <a href={p.payment_doc_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5 ml-2">
                        📄 เอกสารทำจ่าย
                      </a>
                    )}
                    {p.wht_cert_email && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5 ml-2">
                        📧 50ทวิ: {p.wht_cert_email}
                      </span>
                    )}
                    {(p.employee?.doc_id_card_url || p.employee?.doc_bank_book_url) && (
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        {p.employee?.doc_id_card_url && (
                          <a href={p.employee.doc_id_card_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 hover:underline">
                            🪪 บัตรประชาชน
                          </a>
                        )}
                        {p.employee?.doc_bank_book_url && (
                          <a href={p.employee.doc_bank_book_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-600 hover:underline">
                            🏦 Book Bank
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatPeriod(p.period_month, p.period_year)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-800">{formatCurrency(p.net_pay)}</p>
                    {p.is_paid ? (
                      <p className="text-xs text-green-600 font-medium">
                        {(p.employee?.type === 'freelance' || p.guest_type === 'freelance') ? '✅ จ่ายค่าบริการแล้ว' : '✅ จ่ายแล้ว'}
                        {' '}{p.transfer_date ? new Date(p.transfer_date).toLocaleDateString('th-TH') : ''}
                      </p>
                    ) : p.due_date ? (
                      <p className={`text-xs font-medium ${new Date(p.due_date) < new Date() ? 'text-red-500' : 'text-amber-500'}`}>
                        🗓 ครบกำหนด {new Date(p.due_date).toLocaleDateString('th-TH')}
                        {new Date(p.due_date) < new Date() ? ' ⚠️ เกินกำหนด' : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {!isReadOnly && !p.is_paid && (
                        <button onClick={() => markPaid(p)} title="กดเมื่อจ่ายแล้ว"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                          <Banknote size={12} />
                          {(p.employee?.type === 'freelance' || p.guest_type === 'freelance') ? 'จ่ายค่าบริการแล้ว' : 'จ่ายแล้ว'}
                        </button>
                      )}
                      <button onClick={() => setViewPayslip(p)} title="ดูสลิป"
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Eye size={14} />
                      </button>
                      {!isReadOnly && (
                        <>
                          <button onClick={() => startEdit(p)} title="แก้ไข"
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => resendEmail(p)} title="ส่งสลิป Email" disabled={sending === p.id}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40">
                            {sending === p.id ? <Loader2 size={14} className="animate-spin" /> : sentFlash === p.id ? <Check size={14} className="text-green-600" /> : <Send size={14} />}
                          </button>
                          <button
                            onClick={() => sendTransferConfirm(p)}
                            title="ส่งยืนยันการโอนเงิน"
                            disabled={confirmingSend === p.id}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
                          >
                            {confirmingSend === p.id ? <Loader2 size={14} className="animate-spin" /> : confirmFlash === p.id ? <Check size={14} className="text-green-600" /> : <Banknote size={14} />}
                          </button>
                          <button onClick={() => deletePayslip(p.id)} title="ลบ" disabled={deleting === p.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
  )

  const fulltimePayslips = payslips.filter(p => !(p.employee?.type === 'freelance' || p.guest_type === 'freelance'))
  const freelancePayslipsList = payslips.filter(p => p.employee?.type === 'freelance' || p.guest_type === 'freelance')

  const listTotalAll = payslips.reduce((s, p) => s + p.net_pay, 0)
  const listTotalPaid = payslips.filter(p => p.is_paid).reduce((s, p) => s + p.net_pay, 0)
  const listTotalUnpaid = listTotalAll - listTotalPaid
  const listUnpaidCount = payslips.filter(p => !p.is_paid).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-gray-800">🧾 สลิปเงินเดือน</h2>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['list', 'batch'] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`relative px-2.5 py-1 rounded-md text-xs font-medium transition ${subTab === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'list' ? '📋 รายการ' : '💸 รอบจ่าย'}
                {t === 'batch' && (freelanceUnpaid.length + freelanceMissingThisMonth.length) > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>
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
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs sm:text-sm border border-gray-300 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-50">
            <Download size={14} /> <span className="hidden sm:inline">Template</span>
          </button>
          {!isReadOnly && (
            <label className="flex items-center gap-1 text-xs sm:text-sm border border-gray-300 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Upload size={14} /> {importing ? 'นำเข้า...' : <><span className="hidden sm:inline">Import </span>Excel</>}
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
          )}
          {payslips.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs sm:text-sm border border-gray-300 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-50 text-green-700 border-green-300">
              <Download size={14} /> CSV
            </button>
          )}
          {!isReadOnly && (
            <button onClick={() => { setShowForm(!showForm); setEditingPayslip(null); setOtItems([]) }} className="flex items-center gap-1 text-xs sm:text-sm bg-indigo-600 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-700">
              <Plus size={14} /> สร้างสลิป
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
          ✅ {importResult}
        </div>
      )}

      {/* ─── Batch Payment View ─── */}
      {subTab === 'batch' && (
        <div className="space-y-3">
          {freelanceUnpaid.length === 0 && freelancePayslipsAll.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <PartyPopper size={32} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-gray-600 font-medium">จ่ายครบทุกคนแล้ว!</p>
              <p className="text-xs text-gray-400 mt-1">ไม่มี Freelance ค้างจ่ายในเดือนนี้</p>
            </div>
          )}

          {/* Freelance ที่เคยมีสลิปเดือนก่อน แต่ยังไม่ได้สร้างของเดือนนี้ */}
          {freelanceMissingThisMonth.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                <UserPlus size={16} /> Freelance ที่มีสลิปเดือนก่อน แต่ยังไม่ได้สร้างของเดือนนี้ ({freelanceMissingThisMonth.length} คน)
              </p>
              <div className="space-y-1.5">
                {freelanceMissingThisMonth.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.employee?.name ?? p.guest_name}</p>
                      <p className="text-xs text-gray-400">
                        เดือนก่อน: {formatCurrency(p.net_pay)}
                        {p.line_items?.length ? ` · ${p.line_items.length} รายการ` : ''}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <button onClick={() => quickCreateFromPrevious(p)}
                        className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0">
                        <Plus size={12} /> สร้างสลิปเดือนนี้
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {freelancePayslipsAll.length === 0 && freelanceMissingThisMonth.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-gray-400 text-sm">ยังไม่มีงาน Freelance ในเดือนนี้</p>
            </div>
          )}

          {freelancePayslipsAll.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Wallet size={15} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate">ยอดรวม</p>
                    <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{formatCurrency(freelanceTotalGross)}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <Receipt size={15} className="text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate">หัก 3%</p>
                    <p className="font-bold text-red-500 text-sm sm:text-base truncate">{formatCurrency(freelanceTotalWht)}</p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 shadow-sm p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <Banknote size={15} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-green-700 truncate">ยอดโอนสุทธิ</p>
                    <p className="font-bold text-green-700 text-sm sm:text-base truncate">{formatCurrency(freelanceTotalNet)}</p>
                  </div>
                </div>
              </div>

              {/* Filter chips + batch pay */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {([
                    ['all', `ทั้งหมด (${freelancePayslipsAll.length})`],
                    ['unpaid', `รอโอน (${freelancePayslipsAll.filter(p => !p.is_paid).length})`],
                    ['paid', `โอนแล้ว (${freelancePayslipsAll.filter(p => p.is_paid).length})`],
                  ] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFreelanceFilter(key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${freelanceFilter === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {!isReadOnly && freelanceUnpaid.length > 0 && (
                  <button
                    onClick={() => setBatchSelected(
                      batchSelected.size === freelanceUnpaid.length
                        ? new Set()
                        : new Set(freelanceUnpaid.map(p => p.id))
                    )}
                    className="text-xs text-amber-700 hover:text-amber-900 underline">
                    {batchSelected.size === freelanceUnpaid.length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด (รอโอน)'}
                  </button>
                )}
              </div>

              {!isReadOnly && batchSelected.size > 0 && (
                <button onClick={payBatch} disabled={batchPaying}
                  className="w-full flex items-center justify-center gap-1.5 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                  <Banknote size={14} />
                  {batchPaying ? 'กำลังจ่าย...' : `จ่ายค่าบริการ ${batchSelected.size} คน — ${formatCurrency(freelanceUnpaid.filter(p => batchSelected.has(p.id)).reduce((s, p) => s + p.net_pay, 0))}`}
                </button>
              )}

              {/* Banner เมื่อมาจาก Peepz Flow */}
              {highlightId && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="font-semibold">บันทึกแล้ว!</p>
                    <p className="text-xs text-emerald-600">สลิปถูกสร้างจาก Peepz Flow — สถานะ "รอโอน" รอคุณอนุมัติจ่ายค่ะ</p>
                  </div>
                  <button onClick={() => setHighlightId(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
                </div>
              )}

              {/* Freelance cards */}
              <div className="space-y-2.5">
                {freelanceDisplayed.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
                    ไม่มีรายการในหมวดนี้
                  </div>
                )}
                {freelanceDisplayed.map(p => {
                  const name = p.employee?.name ?? p.guest_name ?? '-'
                  const checked = batchSelected.has(p.id)
                  const items = p.line_items ?? []
                  const expanded = expandedFreelance.has(p.id)
                  const visibleItems = expanded ? items : items.slice(0, 2)
                  const isHighlighted = p.id === highlightId
                  return (
                    <div key={p.id} ref={isHighlighted ? highlightRef : null}
                      className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                        isHighlighted ? 'border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50/20' :
                        checked ? 'border-green-300 bg-green-50/30' : 'border-gray-100'
                      }`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2">
                          {!isReadOnly && !p.is_paid && (
                            <button className="mt-0.5" onClick={() => {
                              const s = new Set(batchSelected)
                              checked ? s.delete(p.id) : s.add(p.id)
                              setBatchSelected(s)
                            }}>
                              {checked
                                ? <CheckSquare size={18} className="text-green-600" />
                                : <Square size={18} className="text-gray-300" />}
                            </button>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-gray-800">{name}</p>
                              {p.employee_id && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-medium">ประจำทุกเดือน</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{items.length > 0 ? `${items.length} รายการงาน` : (p.project_name || '')}</p>
                            {(p.employee?.email || p.guest_email) && (
                              <p className="text-xs text-gray-400">✉️ {p.employee?.email || p.guest_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isReadOnly && (
                            <button onClick={() => startEdit(p)} title="แก้ไขสลิปนี้"
                              className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full hover:bg-amber-100 whitespace-nowrap">
                              <Pencil size={11} /> แก้ไข
                            </button>
                          )}
                          {!isReadOnly && (
                            <button onClick={() => quickCreateFromPrevious(p, false)} title="ทำซ้ำสลิปนี้ (ไม่นำรายได้เดิมมาด้วย)"
                              className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full hover:bg-indigo-100 whitespace-nowrap">
                              <Copy size={11} /> ทำซ้ำ
                            </button>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${p.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.is_paid ? '✅ โอนแล้ว' : 'รอโอน'}
                          </span>
                        </div>
                      </div>

                      {!p.is_paid && (
                        <div className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 mb-2 text-xs ${p.freelance_confirmed_at ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                          {p.freelance_confirmed_at ? (
                            <span>✅ Freelance ยืนยันข้อมูลแล้ว เมื่อ {new Date(p.freelance_confirmed_at).toLocaleString('th-TH')}</span>
                          ) : (
                            <span>⏳ รอ Freelance ยืนยันข้อมูล/ส่งเอกสาร</span>
                          )}
                          {!isReadOnly && (
                            <button
                              onClick={() => copyConfirmLink(p)}
                              className="text-indigo-500 hover:underline whitespace-nowrap">
                              🔗 คัดลอกลิงก์ส่งให้ Freelance
                            </button>
                          )}
                        </div>
                      )}
                      {p.freelance_confirmed_at && (p.freelance_confirm_id_card_url || p.freelance_confirm_bank_book_url) && (
                        <div className="flex items-center gap-3 text-xs mb-2">
                          {p.freelance_confirm_id_card_url && (
                            <a href={p.freelance_confirm_id_card_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">🪪 บัตรประชาชน (จาก Freelance)</a>
                          )}
                          {p.freelance_confirm_bank_book_url && (
                            <a href={p.freelance_confirm_bank_book_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">🏦 Book Bank (จาก Freelance)</a>
                          )}
                        </div>
                      )}

                      {items.length > 0 ? (
                        <div className="space-y-1 mb-2">
                          {visibleItems.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{it.description || '(ไม่ระบุ)'} {it.quantity ? `· ${it.quantity} ${it.unit}` : ''}</span>
                              <span className="text-gray-700 font-medium">{formatCurrency(it.total)}</span>
                            </div>
                          ))}
                          {items.length > 2 && (
                            <button
                              onClick={() => setExpandedFreelance(prev => {
                                const s = new Set(prev)
                                expanded ? s.delete(p.id) : s.add(p.id)
                                return s
                              })}
                              className="text-xs text-indigo-500 hover:underline">
                              {expanded ? 'ย่อรายการ' : `ดูทั้งหมด (${items.length}) ▾`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1 mb-2">
                          {p.base_salary > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{p.project_name || 'ค่าจ้าง'}</span>
                              <span className="text-gray-700 font-medium">{formatCurrency(p.base_salary)}</span>
                            </div>
                          )}
                          {p.other_income > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{p.other_income_note || 'รายได้อื่นๆ'}</span>
                              <span className="text-gray-700 font-medium">{formatCurrency(p.other_income)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-t pt-2 flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>รวม {formatCurrency(p.gross_income)} — หัก 3% {formatCurrency(p.withholding_tax)}</span>
                        <span className="text-base font-bold text-indigo-700">โอน {formatCurrency(p.net_pay)}</span>
                      </div>

                      <button
                        onClick={() => copyItemList(p)}
                        className="text-xs text-indigo-500 hover:underline mb-2">
                        📋 คัดลอกรายการงาน (สำหรับโน้ตใบเสร็จ)
                      </button>

                      {p.is_paid ? (
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          {p.transfer_date && <span>โอนเมื่อ {new Date(p.transfer_date).toLocaleDateString('th-TH')}</span>}
                          {p.document_url && (
                            <a href={p.document_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                              📎 สลิป
                            </a>
                          )}
                          {p.payment_doc_url && (
                            <a href={p.payment_doc_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                              📄 เอกสารทำจ่าย
                            </a>
                          )}
                          {!isReadOnly && (
                            <button
                              onClick={() => copyConfirmLink(p)}
                              className="inline-flex items-center gap-1 text-indigo-400 hover:underline ml-auto">
                              🔗 ลิงก์ดูสลิปของตัวเอง
                            </button>
                          )}
                        </div>
                      ) : !isReadOnly && (
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={batchDocLinks[p.id] ?? p.document_url ?? ''}
                            onChange={e => setBatchDocLinks(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="แนบลิงก์สลิป (ถ้ามี)"
                            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                          <button onClick={() => payOneFreelancer(p)}
                            className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 whitespace-nowrap">
                            <Banknote size={12} /> โอนแล้ว
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {!isReadOnly && (
                <button onClick={openNewFreelanceForm}
                  className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-indigo-200 text-indigo-500 px-4 py-3 rounded-xl text-sm font-medium hover:bg-indigo-50">
                  <Plus size={14} /> เพิ่มงาน freelance
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showForm && (
        <form ref={formRef} onSubmit={editingPayslip ? handleUpdate : handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800">{editingPayslip ? 'แก้ไขสลิป' : 'สร้างสลิปใหม่'}</h3>
            {editingPayslip
              ? <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">กำลังแก้ไข: {editingPayslip.employee?.name ?? editingPayslip.guest_name}</span>
              : (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <div
                    onClick={() => { setGuestMode(!guestMode); setForm((f) => ({ ...f, employee_id: '' })) }}
                    className={`relative w-10 h-5 rounded-full transition ${guestMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${guestMode ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-gray-600">สร้างครั้งเดียว (ไม่บันทึกในระบบ)</span>
                </label>
              )
            }
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {!editingPayslip && (
              guestMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                    <input required value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="ชื่อ-นามสกุล"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล (ถ้ามี)</label>
                    <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="email@example.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <p className="text-xs text-gray-400 mt-0.5">ไม่กรอกก็ได้ — ส่งลิงก์ยืนยันให้ Freelance กรอกข้อมูลเองได้</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                    <select value={guestType} onChange={(e) => setGuestType(e.target.value as 'fulltime' | 'freelance')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option value="freelance">Freelance</option>
                      <option value="fulltime">พนักงานประจำ</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-3 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">พนักงาน *</label>
                  <select required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">— เลือกพนักงาน —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.type === 'freelance' ? 'Freelance' : 'ประจำ'})</option>
                    ))}
                  </select>
                </div>
              )
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <FField label="เงินเดือน (บาท)" value={form.base_salary} onChange={(v) => {
                  setForm({ ...form, base_salary: v })
                }} type="number" />

                {/* OT Section — multi-row */}
                <div className="col-span-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">การทำงานล่วงเวลา (OT)</label>
                    {form.base_salary && Number(form.base_salary) > 0 && (
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        ปกติ ×1.5 = <strong>{formatCurrency(normalOtRate)}</strong>/ชม. &nbsp;|&nbsp; วันหยุด ×3 = <strong>{formatCurrency(holidayOtRate)}</strong>/ชม.
                      </div>
                    )}
                  </div>

                  {otItems.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-1 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                        <div className="col-span-2">วันที่</div>
                        <div className="col-span-2">เริ่ม</div>
                        <div className="col-span-2">จบ</div>
                        <div className="col-span-1 text-center">ชม.</div>
                        <div className="col-span-2">ประเภท</div>
                        <div className="col-span-1 text-right">อัตรา</div>
                        <div className="col-span-1 text-right">ยอด</div>
                        <div className="col-span-1" />
                      </div>
                      {/* Rows */}
                      {otItemsWithRate.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-center px-3 py-2 border-t border-gray-100 hover:bg-gray-50">
                          <input type="date" value={item.date}
                            onChange={(e) => updateOtItem(idx, { date: e.target.value })}
                            className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          <input type="time" value={item.start_time}
                            onChange={(e) => updateOtItem(idx, { start_time: e.target.value })}
                            className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          <input type="time" value={item.end_time}
                            onChange={(e) => updateOtItem(idx, { end_time: e.target.value })}
                            className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          <div className="col-span-1 text-center">
                            {item.hours > 0
                              ? <span className="text-xs font-medium text-indigo-700">{item.hours}</span>
                              : <input type="number" value={item.hours || ''}
                                  onChange={(e) => updateOtItem(idx, { hours: Number(e.target.value) || 0 })}
                                  placeholder="0"
                                  className="w-full border border-gray-200 rounded px-1 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                            }
                          </div>
                          <select value={item.type}
                            onChange={(e) => updateOtItem(idx, { type: e.target.value as 'normal' | 'holiday' })}
                            className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                            <option value="normal">ปกติ ×1.5</option>
                            <option value="holiday">วันหยุด ×3</option>
                          </select>
                          <div className="col-span-1 text-right text-xs text-gray-500">{formatCurrency(item.rate)}</div>
                          <div className="col-span-1 text-right text-xs font-semibold text-indigo-700">{formatCurrency(item.amount)}</div>
                          <button type="button" onClick={() => removeOtRow(idx)}
                            className="col-span-1 flex justify-center text-gray-300 hover:text-red-500">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      {/* OT total */}
                      {otItems.length > 0 && (
                        <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100 text-right text-sm font-semibold text-indigo-700">
                          รวม OT: {formatCurrency(otAmount)}
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={addOtRow}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                    <Plus size={14} /> เพิ่มแถว OT
                  </button>
                </div>

                {/* Incentive Items */}
                <div className="col-span-3">
                  <div className="rounded-lg border border-purple-200 overflow-hidden">
                    <div className="bg-purple-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-700">🏆 Incentive</span>
                      {incentiveTotal > 0 && (
                        <span className="text-xs font-bold text-purple-700">รวม {formatCurrency(incentiveTotal)}</span>
                      )}
                    </div>
                    {incentiveItems.length > 0 && (
                      <div>
                        <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 font-medium">
                          <div className="col-span-8">ชื่องาน / ที่มา</div>
                          <div className="col-span-3 text-right">ยอดเงิน (บาท)</div>
                          <div className="col-span-1" />
                        </div>
                        {incentiveItems.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-1 items-center px-3 py-2 border-t border-gray-100 hover:bg-gray-50">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateIncentiveItem(idx, { description: e.target.value })}
                              placeholder="เช่น ยอดขาย Live, คอมมิชชั่น..."
                              className="col-span-8 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <input
                              type="number"
                              value={item.amount || ''}
                              onChange={(e) => updateIncentiveItem(idx, { amount: Number(e.target.value) || 0 })}
                              placeholder="0"
                              className="col-span-3 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <button type="button" onClick={() => removeIncentiveRow(idx)}
                              className="col-span-1 flex justify-center text-gray-300 hover:text-red-500">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        {incentiveItems.length > 1 && (
                          <div className="px-3 py-2 bg-purple-50 border-t border-purple-100 text-right text-sm font-semibold text-purple-700">
                            รวม Incentive: {formatCurrency(incentiveTotal)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={addIncentiveRow}
                    className="mt-2 flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 border border-dashed border-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-50">
                    <Plus size={14} /> เพิ่มรายการ Incentive
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
              <FField label="รายได้อื่นๆ" value={form.other_income} onChange={(v) => setForm({ ...form, other_income: v })} type="number" />
              <div className="col-span-2">
                <FField label="หมายเหตุ" value={form.other_income_note} onChange={(v) => setForm({ ...form, other_income_note: v })} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-1">รายการหัก</h4>
            <p className="text-xs text-gray-400 mb-1">คำนวณอัตโนมัติ — แก้ไขได้ถ้าจำเป็น</p>
            {taxCalc && (
              <div className={`rounded-lg border mb-3 overflow-hidden ${taxCalc.taxableIncome > 150000 ? 'border-amber-200' : 'border-green-200'}`}>
                <div className={`px-4 py-2 flex items-center justify-between ${taxCalc.taxableIncome > 150000 ? 'bg-amber-50' : 'bg-green-50'}`}>
                  <div className="text-sm font-semibold text-gray-700">
                    {taxCalc.taxableIncome > 150000
                      ? `⚠️ ต้องหักภาษีเงินได้ — ${formatCurrency(taxCalc.monthlyTax)}/เดือน`
                      : `✅ ยังไม่ถึงเกณฑ์เสียภาษี (เงินได้สุทธิ ${formatCurrency(taxCalc.taxableIncome)})`}
                  </div>
                  {taxCalc.taxableIncome > 150000 && (
                    <button type="button"
                      onClick={() => setForm(prev => ({ ...prev, withholding_tax: String(taxCalc.monthlyTax) }))}
                      className="text-xs bg-amber-600 text-white px-3 py-1 rounded-lg hover:bg-amber-700 font-medium">
                      ใส่ค่านี้อัตโนมัติ
                    </button>
                  )}
                </div>
                <div className="px-4 py-3 bg-white text-xs text-gray-600 space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-gray-500">รายได้ต่อปี (ประมาณ)</span>
                    <span className="text-right font-medium">{formatCurrency(taxCalc.annualIncome)}</span>
                    <span className="text-gray-500">− ค่าใช้จ่าย 50% (สูงสุด 100,000)</span>
                    <span className="text-right text-red-500">− {formatCurrency(taxCalc.expenseDeduction)}</span>
                    <span className="text-gray-500">− ลดหย่อนส่วนตัว</span>
                    <span className="text-right text-red-500">− {formatCurrency(taxCalc.personalAllowance)}</span>
                    <span className="text-gray-500">− ประกันสังคม (ทั้งปี)</span>
                    <span className="text-right text-red-500">− {formatCurrency(taxCalc.socialSecurityDeduction)}</span>
                    <span className="font-semibold text-gray-700 border-t pt-1">เงินได้สุทธิ</span>
                    <span className={`text-right font-bold border-t pt-1 ${taxCalc.taxableIncome > 150000 ? 'text-amber-700' : 'text-green-700'}`}>
                      {formatCurrency(taxCalc.taxableIncome)}
                    </span>
                    {taxCalc.annualTax > 0 && <>
                      <span className="text-gray-500">ภาษีต่อปี</span>
                      <span className="text-right font-medium text-amber-700">{formatCurrency(taxCalc.annualTax)}</span>
                      <span className="font-semibold text-gray-700">หักต่อเดือน</span>
                      <span className="text-right font-bold text-amber-700">{formatCurrency(taxCalc.monthlyTax)}</span>
                    </>}
                  </div>
                  {taxCalc.annualTax > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-gray-400 mb-1">bracket ที่เสียภาษี:</p>
                      {taxCalc.brackets.filter(b => b.tax > 0).map((b, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{formatCurrency(b.from)} – {b.to ? formatCurrency(b.to) : '∞'} ({Math.round(b.rate*100)}%)</span>
                          <span className="font-medium">{formatCurrency(b.tax)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
            <div className="grid grid-cols-3 gap-3 text-center">
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

          {form.transfer_date && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 font-medium">
              ✅ จ่ายค่าบริการแล้ว เมื่อ {new Date(form.transfer_date).toLocaleDateString('th-TH')}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <FField label="หมายเหตุจาก Admin" value={form.admin_note} onChange={(v) => setForm({ ...form, admin_note: v })} />
            <FField label="🗓 กำหนดจ่ายเงิน" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} type="date" />
            <FField label="วันที่โอนเงิน (ถ้าโอนแล้ว)" value={form.transfer_date} onChange={(v) => setForm({ ...form, transfer_date: v })} type="date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📎 ลิงก์เอกสารประกอบ</label>
            <input
              type="url"
              value={form.document_url}
              onChange={(e) => setForm({ ...form, document_url: e.target.value })}
              placeholder="https://drive.google.com/... หรือ Dropbox, OneDrive ฯลฯ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-0.5">เช่น สลิปเงิน, ใบโอน, Screenshot การโอน</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📄 ลิงก์เอกสารทำจ่าย</label>
            <input
              type="url"
              value={form.payment_doc_url}
              onChange={(e) => setForm({ ...form, payment_doc_url: e.target.value })}
              placeholder="https://docs.google.com/... ใบเสนอราคา/ใบแจ้งหนี้/รายละเอียดงาน"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-0.5">เอกสารที่ใช้ประกอบการทำจ่าย เช่น ใบเสนอราคา, สรุปงาน, รายการคำนวณ</p>
          </div>
          {isFreelance && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📧 อีเมลรับใบ 50 ทวิ (หัก ณ ที่จ่าย)</label>
              <input
                type="email"
                value={form.wht_cert_email}
                onChange={(e) => setForm({ ...form, wht_cert_email: e.target.value })}
                placeholder="accounting@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-0.5">อีเมลที่ฝ่ายบัญชีจะใช้ส่งหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</p>
            </div>
          )}
          {isFreelance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🪪 ลิงก์สำเนาบัตรประชาชน (Freelance)</label>
                <input
                  type="url"
                  value={form.freelance_confirm_id_card_url}
                  onChange={(e) => setForm({ ...form, freelance_confirm_id_card_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🏦 ลิงก์สำเนา Book Bank (Freelance)</label>
                <input
                  type="url"
                  value={form.freelance_confirm_bank_book_url}
                  onChange={(e) => setForm({ ...form, freelance_confirm_bank_book_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <p className="text-xs text-gray-400 -mt-1 sm:col-span-2">ถ้าแอดมินกรอกไว้แล้ว ลิงก์นี้จะแสดงเป็นค่าจริงในหน้ายืนยันของ Freelance โดยไม่ต้องกรอกซ้ำ</p>
            </div>
          )}

          {!editingPayslip && (
          <div className="flex items-center gap-2">
            <input
              id="send_email"
              type="checkbox"
              checked={form.send_email && (!guestMode || !!guestEmail)}
              disabled={guestMode && !guestEmail}
              onChange={(e) => setForm({ ...form, send_email: e.target.checked })}
              className="w-4 h-4 text-indigo-600"
            />
            <label htmlFor="send_email" className="text-sm text-gray-700">
              ส่ง Email แจ้งพนักงานทันที
              {guestMode && !guestEmail && <span className="text-gray-400"> (ไม่มีอีเมล — ใช้ลิงก์ยืนยันส่งให้แทน)</span>}
            </label>
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
            <button type="button" onClick={() => { setShowForm(false); setEditingPayslip(null); setOtItems([]) }} className="border border-gray-300 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
          </div>
        </form>
      )}

      {subTab === 'list' && payslips.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">ยอดรวมทั้งหมด</p>
              <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{formatCurrency(listTotalAll)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CheckSquare size={15} className="text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">จ่ายแล้ว</p>
              <p className="font-bold text-green-700 text-sm sm:text-base truncate">{formatCurrency(listTotalPaid)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Banknote size={15} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 truncate">ยังต้องจ่าย {listUnpaidCount > 0 ? `(${listUnpaidCount})` : ''}</p>
              <p className="font-bold text-amber-600 text-sm sm:text-base truncate">{formatCurrency(listTotalUnpaid)}</p>
            </div>
          </div>
        </div>
      )}

      {subTab === 'list' && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center text-gray-400">กำลังโหลด...</p>
        ) : payslips.length === 0 ? (
          <p className="p-6 text-center text-gray-400">ไม่มีสลิปสำหรับช่วงเวลานี้</p>
        ) : (
          <table className="w-full text-sm" style={{minWidth:'600px'}}>
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">พนักงาน</th>
                <th className="px-4 py-3 text-left">งวด</th>
                <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fulltimePayslips.length > 0 && (
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500">👥 พนักงานประจำ ({fulltimePayslips.length})</td>
                </tr>
              )}
              {fulltimePayslips.map(renderPayslipRow)}
              {freelancePayslipsList.length > 0 && (
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500">🧑‍💻 Freelance ({freelancePayslipsList.length})</td>
                </tr>
              )}
              {freelancePayslipsList.map(renderPayslipRow)}
            </tbody>
          </table>
        )}
      </div>}

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
            {!isReadOnly && (
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FField({ label, value, onChange, type = 'text' }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string
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
