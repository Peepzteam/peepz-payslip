import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">💰</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payslip System</h1>
        <p className="text-gray-500 mb-8">ระบบสลิปเงินเดือนออนไลน์ ปลอดภัย โปร่งใส</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition"
          >
            พนักงาน — ดูสลิปของฉัน
          </Link>
          <Link
            href="/admin"
            className="bg-white text-indigo-600 border-2 border-indigo-200 px-8 py-3 rounded-xl font-semibold hover:border-indigo-400 transition"
          >
            Admin — จัดการสลิป
          </Link>
        </div>
      </div>
    </main>
  )
}
