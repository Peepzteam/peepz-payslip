'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } else {
      setSent(true)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h1>
          <p className="text-gray-500 text-sm mt-1">ดูสลิปเงินเดือนของคุณ</p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมลพนักงาน
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {loading ? 'กำลังส่ง...' : 'ส่ง Magic Link ไปยังอีเมล'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-3">
            <div className="text-5xl">📧</div>
            <p className="font-semibold text-gray-800">ส่ง Link แล้ว!</p>
            <p className="text-sm text-gray-500">
              กรุณาเช็คอีเมล <strong>{email}</strong> แล้วคลิก link เพื่อเข้าสู่ระบบ
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-indigo-600 text-sm underline mt-2"
            >
              ส่งใหม่
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
