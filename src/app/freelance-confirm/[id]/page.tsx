'use client'
import { useEffect, useState, use } from 'react'
import { formatCurrency, formatPeriod } from '@/lib/utils'
import { LineItem } from '@/types'

interface ConfirmData {
  id: string
  guest_name: string | null
  guest_email: string | null
  guest_type: string | null
  period_month: number
  period_year: number
  gross_income: number
  withholding_tax: number
  net_pay: number
  base_salary: number
  other_income: number
  is_paid: boolean
  wht_cert_email: string | null
  line_items: LineItem[] | null
  freelance_confirmed_at: string | null
  freelance_confirm_id_card_url: string | null
  freelance_confirm_bank_book_url: string | null
  employee: { id: string; name: string; email: string; doc_id_card_url: string | null; doc_bank_book_url: string | null } | null
}

export default function FreelanceConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<ConfirmData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [idCardUrl, setIdCardUrl] = useState('')
  const [bankBookUrl, setBankBookUrl] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/payslips/${id}/freelance-confirm`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((d: ConfirmData) => {
        setData(d)
        setIdCardUrl(d.freelance_confirm_id_card_url || d.employee?.doc_id_card_url || '')
        setBankBookUrl(d.freelance_confirm_bank_book_url || d.employee?.doc_bank_book_url || '')
        setEmail(d.wht_cert_email || d.employee?.email || d.guest_email || '')
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!idCardUrl.trim() || !bankBookUrl.trim() || !email.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง')
      return
    }
    setSubmitting(true)
    const res = await fetch(`/api/payslips/${id}/freelance-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_card_url: idCardUrl.trim(), bank_book_url: bankBookUrl.trim(), email: email.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setData(prev => prev ? { ...prev, freelance_confirmed_at: updated.freelance_confirmed_at, freelance_confirm_id_card_url: idCardUrl, freelance_confirm_bank_book_url: bankBookUrl, wht_cert_email: email.trim() } : prev)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">กำลังโหลด...</p></div>
  }
  if (notFound || !data) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">ไม่พบรายการนี้</p></div>
  }

  const name = data.employee?.name ?? data.guest_name ?? ''
  const items = data.line_items ?? []
  const confirmed = !!data.freelance_confirmed_at

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-1">💰 รายรับของคุณ — {formatPeriod(data.period_month, data.period_year)}</p>
          <p className="font-bold text-gray-800 text-lg mb-3">{name}</p>

          {items.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{it.description || '(ไม่ระบุ)'} {it.quantity ? `· ${it.quantity} ${it.unit}` : ''}</span>
                  <span className="text-gray-700 font-medium">{formatCurrency(it.total)}</span>
                </div>
              ))}
            </div>
          ) : data.base_salary > 0 && (
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-600">ค่าจ้าง</span>
              <span className="text-gray-700 font-medium">{formatCurrency(data.base_salary)}</span>
            </div>
          )}

          <div className="border-t pt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between text-gray-500">
              <span>รวม</span><span>{formatCurrency(data.gross_income)}</span>
            </div>
            <div className="flex items-center justify-between text-red-500">
              <span>หักภาษี ณ ที่จ่าย 3%</span><span>-{formatCurrency(data.withholding_tax)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold text-indigo-700 pt-1">
              <span>ยอดโอนสุทธิ</span><span>{formatCurrency(data.net_pay)}</span>
            </div>
          </div>
        </div>

        {confirmed ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-green-700 font-medium">ส่งข้อมูลเรียบร้อยแล้ว ขอบคุณค่ะ</p>
            <p className="text-xs text-green-600 mt-1">
              ยืนยันเมื่อ {new Date(data.freelance_confirmed_at!).toLocaleString('th-TH')}
            </p>
            {data.is_paid && <p className="text-xs text-green-600 mt-1">โอนเงินเรียบร้อยแล้ว</p>}
            <div className="mt-3 text-xs text-gray-500 space-y-1 text-left">
              <p>📧 อีเมล: {data.wht_cert_email || email}</p>
              <p>📎 สำเนาบัตรประชาชน: <a href={data.freelance_confirm_id_card_url || idCardUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{data.freelance_confirm_id_card_url || idCardUrl}</a></p>
              <p>🏦 สำเนา Book Bank: <a href={data.freelance_confirm_bank_book_url || bankBookUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{data.freelance_confirm_bank_book_url || bankBookUrl}</a></p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">📎 เอกสารสำหรับโอนเงิน</p>
            <p className="text-xs text-gray-400">กรุณาตรวจสอบยอดด้านบนให้ถูกต้อง แล้วกรอกลิงก์เอกสารด้านล่าง — ระบบจะโอนเงินไปยังบัญชีตามเอกสารที่ส่งมานี้</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">อีเมลของคุณ (ฝ่ายบัญชีจะส่งหนังสือรับรองหัก ณ ที่จ่าย 50 ทวิ มาที่นี่)</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              📌 Google Drive Link เท่านั้นและกรุณาเช็คว่าคนอื่นเข้าไปดูได้ค่ะ view ได้ ไม่งั้นอาจได้รับเงินล่าช้า เพราะเข้าไฟล์ดูไม่ได้ค่ะ ขอบคุณค่ะ
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ลิงก์สำเนาบัตรประชาชน</label>
              <input type="url" required value={idCardUrl} onChange={e => setIdCardUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ลิงก์สำเนา Book Bank</label>
              <input type="url" required value={bankBookUrl} onChange={e => setBankBookUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ กรุณาตรวจสอบลิงก์ให้ถูกต้อง เนื่องจากบริษัทจะโอนเงินเข้าบัญชีตามเอกสารนี้
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {submitting ? 'กำลังส่ง...' : '✅ ยืนยันข้อมูลถูกต้อง — โอนตามนี้'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
