'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Payslip } from '@/types'
import PayslipCard from '@/components/PayslipCard'
import { use } from 'react'

export default function SinglePayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [payslip, setPayslip] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(true)
  const [ackLoading, setAckLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = `/login`
        return
      }

      const { data, error } = await supabase
        .from('payslips')
        .select('*, employee:employees(*)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setPayslip(data as Payslip)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function acknowledge() {
    setAckLoading(true)
    const res = await fetch(`/api/payslips/${id}/acknowledge`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setPayslip(data as Payslip)
    }
    setAckLoading(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">กำลังโหลด...</p></div>
  }

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">ไม่พบสลิปนี้</p></div>
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <a href="/payslip" className="text-sm text-indigo-600 hover:underline">← กลับหน้าหลัก</a>
        {payslip && (
<PayslipCard payslip={payslip} showExport />
        )}
      </div>
    </main>
  )
}
