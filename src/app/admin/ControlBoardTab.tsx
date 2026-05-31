'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Check } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Campaign {
  id: string; year: number; month: number
  client_name: string; client_type: 'new' | 'existing'
  service_type: string; campaign_name: string | null
  revenue: number; cost: number; note: string | null
}
interface ControlEntry {
  id: string; year: number; month: number; category: string; amount: number; note: string | null
}
interface PayslipRow {
  id: string; period_month: number; period_year: number
  base_salary: number; ot_amount: number; incentive: number
  withholding_tax: number; net_pay: number
  employee: { name: string; type: string; is_owner: boolean } | null
  guest_type: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const SERVICE_TYPES = [
  { val: 'live', label: '📺 Live Commerce' },
  { val: 'influencer', label: '🌟 Influencer Review' },
  { val: 'content', label: '📝 Content Production' },
  { val: 'ads', label: '📢 Ads' },
  { val: 'seeding', label: '🌱 Seeding Marketing' },
  { val: 'event', label: '🎪 Event' },
  { val: 'other', label: '🔧 Others' },
]

// control_entries categories
const MANUAL_CATS: Record<string, string> = {
  kbiz_carry:      'ยอดยกมา',
  kbiz_income:     'ยอดเงินเข้าจริง KBIZ',
  kbiz_reserve:    'ยอดกันเงินเก็บไว้ใน KBIZ',
  petty_cash:      'โอนเข้า Petty Cash',
  team_food:       'ค่าเลี้ยงข้าวพนักงาน',
  team_outing:     'ค่า Outing / Team building',
  team_party:      'ค่า Party บริษัท / Celebration',
  team_snack:      'ค่า Snack / เครื่องดื่มในออฟฟิศ',
  team_birthday:   'ค่า Birthday / Gift พนักงาน',
  team_welcome:    'ค่า Welcome / Farewell พนักงาน',
  team_activity:   'ค่า Internal Activity',
  mkt_ads:         'ค่าโฆษณา (Ads)',
  mkt_ops:         'Operating Cost (ค่าใช้จ่ายดำเนินงาน)',
  office_rent:     'ค่าเช่าออฟฟิศ',
  office_utils:    'ค่าน้ำ / ไฟ / อินเทอร์เน็ต',
  office_software: 'ค่า Software (Canva, Google, ChatGPT ฯลฯ)',
  office_domain:   'ค่า Domain / Website / Hosting',
  office_equip:    'ค่าอุปกรณ์สำนักงาน / จิปาถะ',
  tax_vat_wht:     'ค่าภาษี (VAT / WHT) และงานราชการ',
}

function pct(num: number, den: number) {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ControlBoardTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [entries, setEntries] = useState<ControlEntry[]>([])
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [incomeRecs, setIncomeRecs] = useState<{month:number;amount:number}[]>([])
  const [expenseRecs, setExpenseRecs] = useState<{month:number;category:string;amount:number}[]>([])

  // Campaign form
  type CampForm = { client_name:string; client_type:'new'|'existing'; service_type:string; campaign_name:string; revenue:string; profit:string; note:string; month:number }
  const EMPTY_C: CampForm = { client_name:'', client_type:'new', service_type:'live', campaign_name:'', revenue:'', profit:'', note:'', month: now.getMonth()+1 }
  const [showCampForm, setShowCampForm] = useState(false)
  const [campForm, setCampForm] = useState({...EMPTY_C})
  const [campSaving, setCampSaving] = useState(false)

  // Inline cell editing for control_entries
  const [editingCell, setEditingCell] = useState<{cat: string; month: number} | null>(null)
  const [cellVal, setCellVal] = useState('')

  // Section collapse
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const toggle = (k: string) => setCollapsed(p => ({...p, [k]: !p[k]}))

  // Campaign detail modal
  const [showCampDetail, setShowCampDetail] = useState<number|null>(null) // month
  // Inline edit for campaign row
  type EditCampForm = { client_name:string; client_type:'new'|'existing'; service_type:string; campaign_name:string; revenue:string; profit:string; note:string }
  const [editingCampId, setEditingCampId] = useState<string|null>(null)
  const [editCampForm, setEditCampForm] = useState<EditCampForm>({ client_name:'', client_type:'new', service_type:'live', campaign_name:'', revenue:'', profit:'', note:'' })
  const [editCampSaving, setEditCampSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const safeJson = async (r: Response) => { try { return await r.json() } catch { return [] } }
      const [cRes, eRes, pRes, incRes, expRes] = await Promise.all([
        fetch(`/api/campaigns?year=${year}`, { cache: 'no-store' }),
        fetch(`/api/control-entries?year=${year}`, { cache: 'no-store' }),
        fetch(`/api/payslips?year=${year}&slim=1`, { cache: 'no-store' }),
        fetch(`/api/income-records?year=${year}`, { cache: 'no-store' }),
        fetch(`/api/expense-records?year=${year}`, { cache: 'no-store' }),
      ])
      const [c, e, p, inc, exp] = await Promise.all([safeJson(cRes), safeJson(eRes), safeJson(pRes), safeJson(incRes), safeJson(expRes)])
      setCampaigns(Array.isArray(c) ? c : [])
      setEntries(Array.isArray(e) ? e : [])
      setPayslips(Array.isArray(p) ? p : [])
      setIncomeRecs(Array.isArray(inc) ? inc.map((r: {month:number;amount:number}) => ({month:r.month, amount:r.amount})) : [])
      setExpenseRecs(Array.isArray(exp) ? exp.map((r: {month:number;category:string;amount:number}) => ({month:r.month, category:r.category, amount:r.amount})) : [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [year])

  useEffect(() => { load() }, [load])

  // ─── Helper: get entry value ───
  function entryVal(cat: string, m: number) {
    return entries.find(e => e.category === cat && e.month === m)?.amount ?? 0
  }
  function entryRow(cat: string): number[] {
    return Array.from({length:12}, (_,i) => entryVal(cat, i+1))
  }

  // ─── Payslip aggregations ───
  function slipsForMonth(m: number) {
    return payslips.filter(p => p.period_month === m && p.period_year === year)
  }
  function ownerSlips(m: number) {
    return slipsForMonth(m).filter(p => p.employee?.is_owner)
  }
  function staffSlips(m: number) {  // fulltime non-owner
    return slipsForMonth(m).filter(p => !p.employee?.is_owner && p.employee?.type === 'fulltime')
  }
  function freelanceSlips(m: number) {
    return slipsForMonth(m).filter(p =>
      (p.employee?.type === 'freelance' || p.guest_type === 'freelance') && !p.employee?.is_owner
    )
  }

  // ─── Finance records aggregations ───
  function financeIncome(m: number) {
    return incomeRecs.filter(r => r.month === m).reduce((s,r) => s+r.amount, 0)
  }
  function financeExp(cat: string, m: number) {
    // map control-board category keys → Finance expense_records categories
    const catMap: Record<string,string> = {
      office_rent:     'rent',
      office_utils:    'utilities',
      office_software: 'software',
      tax_vat_wht:     'tax',
    }
    const finCat = catMap[cat]
    if (!finCat) return null // null = no Finance source → stays manual
    return expenseRecs.filter(r => r.month === m && r.category === finCat).reduce((s,r) => s+r.amount, 0)
  }
  // Categories that are auto-synced from Finance tab (read-only in control board)
  const FINANCE_SYNCED = new Set(['office_rent','office_utils','office_software','tax_vat_wht'])

  // ─── Campaign aggregations ───
  function campsForMonth(m: number, type?: 'new'|'existing') {
    return campaigns.filter(c => c.month === m && (!type || c.client_type === type))
  }

  // ─── Save entry cell (optimistic) ───
  async function saveCell(cat: string, m: number) {
    const amount = Number(cellVal) || 0
    // Optimistic update — update state immediately, no full reload
    setEntries(prev => {
      const exists = prev.find(e => e.category === cat && e.month === m && e.year === year)
      if (exists) return prev.map(e => e.category===cat && e.month===m && e.year===year ? {...e, amount} : e)
      return [...prev, { id: `tmp-${cat}-${m}`, year, month: m, category: cat, amount, note: null }]
    })
    setEditingCell(null)
    try {
      const res = await fetch('/api/control-entries', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ year, month: m, category: cat, amount }),
      })
      if (!res.ok) { alert('บันทึกไม่สำเร็จ'); load(); return }
      // Replace tmp id with real id from server
      const saved: ControlEntry = await res.json().catch(() => null)
      if (saved?.id) {
        setEntries(prev => prev.map(e => e.id===`tmp-${cat}-${m}` ? saved : e))
      }
    } catch { alert('เกิดข้อผิดพลาด'); load() }
  }

  // ─── Add Campaign (optimistic) ───
  async function addCampaign() {
    if (!campForm.client_name || !campForm.revenue) { alert('กรอกชื่อลูกค้าและยอดขายด้วยนะคะ'); return }
    setCampSaving(true)
    const revenue = Number(campForm.revenue) || 0
    const profit  = Number(campForm.profit)  || 0
    const payload = {
      year, month: Number(campForm.month),
      client_name: campForm.client_name, client_type: campForm.client_type,
      service_type: campForm.service_type, campaign_name: campForm.campaign_name || null,
      revenue, cost: revenue - profit,   // DB ยังเก็บ cost แต่ UI ให้กรอก กำไร
      note: campForm.note || null,
    }
    // Optimistic add
    const tmpId = `tmp-${Date.now()}`
    setCampaigns(prev => [...prev, { ...payload, id: tmpId }])
    setCampForm({...EMPTY_C}); setShowCampForm(false)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(()=>({}))
        alert('บันทึกไม่สำเร็จ: '+(e.error||''))
        setCampaigns(prev => prev.filter(c => c.id !== tmpId)); return
      }
      const saved: Campaign = await res.json().catch(() => null)
      if (saved?.id) setCampaigns(prev => prev.map(c => c.id===tmpId ? saved : c))
    } catch { alert('เกิดข้อผิดพลาด'); setCampaigns(prev => prev.filter(c => c.id !== tmpId)) }
    finally { setCampSaving(false) }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('ลบแคมเปญนี้?')) return
    setCampaigns(prev => prev.filter(c => c.id !== id))
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) { alert('ลบไม่ได้'); load() }
    } catch { alert('ลบไม่ได้'); load() }
  }

  function startEditCamp(c: Campaign) {
    setEditingCampId(c.id)
    setEditCampForm({
      client_name: c.client_name, client_type: c.client_type,
      service_type: c.service_type, campaign_name: c.campaign_name ?? '',
      revenue: String(c.revenue), profit: String(c.revenue - c.cost),
      note: c.note ?? '',
    })
  }

  async function saveEditCamp(id: string) {
    setEditCampSaving(true)
    const revenue = Number(editCampForm.revenue) || 0
    const profit  = Number(editCampForm.profit)  || 0
    const patch = {
      client_name: editCampForm.client_name, client_type: editCampForm.client_type,
      service_type: editCampForm.service_type,
      campaign_name: editCampForm.campaign_name || null,
      revenue, cost: revenue - profit,
      note: editCampForm.note || null,
    }
    // Optimistic update
    setCampaigns(prev => prev.map(c => c.id===id ? {...c, ...patch} : c))
    setEditingCampId(null)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(patch),
      })
      if (!res.ok) { alert('บันทึกไม่สำเร็จ'); load() }
    } catch { alert('เกิดข้อผิดพลาด'); load() }
    finally { setEditCampSaving(false) }
  }

  // ─── Cell component ───
  function Cell({ cat, m, value, readOnly=false, color='', bold=false }: {
    cat?: string; m: number; value: number; readOnly?: boolean; color?: string; bold?: boolean
  }) {
    const isEditing = !readOnly && editingCell?.cat === cat && editingCell?.month === m
    if (isEditing) {
      return (
        <td className="px-1 py-1 text-center" style={{minWidth:80}}>
          <div className="flex items-center gap-0.5">
            <input autoFocus type="number" value={cellVal} onChange={e=>setCellVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') saveCell(cat!,m); if(e.key==='Escape') setEditingCell(null) }}
              className="w-full border border-indigo-400 rounded px-1 py-0.5 text-xs text-right focus:outline-none" />
            <button onClick={()=>saveCell(cat!,m)} className="text-green-600 hover:text-green-700"><Check size={11}/></button>
            <button onClick={()=>setEditingCell(null)} className="text-gray-400 hover:text-red-400"><X size={11}/></button>
          </div>
        </td>
      )
    }
    return (
      <td
        className={`px-2 py-1.5 text-right text-xs whitespace-nowrap ${bold?'font-bold':'font-medium'} ${color||'text-gray-700'} ${!readOnly && cat ? 'cursor-pointer hover:bg-indigo-50 rounded' : ''}`}
        style={{minWidth:80}}
        onClick={()=>{ if(!readOnly && cat){ setEditingCell({cat, month: m}); setCellVal(String(value||'')) } }}
      >
        {value !== 0 ? formatCurrency(value) : <span className="text-gray-200">—</span>}
      </td>
    )
  }

  function PctCell({ num, den, m }: { num: number; den: number; m: number }) {
    const p = pct(num, den)
    return (
      <td key={m} className="px-2 py-1.5 text-right text-xs whitespace-nowrap text-gray-500" style={{minWidth:80}}>
        {den > 0 ? `${p}%` : <span className="text-gray-200">—</span>}
      </td>
    )
  }

  // ─── Section header ───
  function SectionHeader({ id, label, color='bg-gray-100 text-gray-700' }: {id:string;label:string;color?:string}) {
    return (
      <tr className="cursor-pointer select-none" onClick={()=>toggle(id)}>
        <td colSpan={15} className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${color} rounded`}>
          <span className="flex items-center gap-1.5">
            {collapsed[id] ? <ChevronDown size={12}/> : <ChevronUp size={12}/>} {label}
          </span>
        </td>
      </tr>
    )
  }

  // ─── Row label ───
  function RowLabel({ label, indent=0, sub=false, bold=false, synced=false }: {label:string;indent?:number;sub?:boolean;bold?:boolean;synced?:boolean}) {
    return (
      <td className={`px-3 py-1.5 text-xs whitespace-nowrap ${sub?'text-gray-400':bold?'text-gray-800 font-bold':'text-gray-600 font-medium'} sticky left-0 bg-white z-10`}
        style={{paddingLeft: 12 + indent*16}}>
        <span className="flex items-center gap-1">
          {sub ? `· ${label}` : label}
          {synced && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded font-medium leading-none">🔗 Finance</span>}
        </span>
      </td>
    )
  }

  // ─── Build month arrays ───
  const m12 = Array.from({length:12},(_,i)=>i+1)

  // Sales data
  const newCamps    = m12.map(m => campsForMonth(m,'new'))
  const exCamps     = m12.map(m => campsForMonth(m,'existing'))
  const newRevArr   = m12.map((_,i) => newCamps[i].reduce((s,c)=>s+c.revenue,0))
  const newCostArr  = m12.map((_,i) => newCamps[i].reduce((s,c)=>s+c.cost,0))
  const newProfArr  = m12.map((_,i) => newRevArr[i] - newCostArr[i])
  const exRevArr    = m12.map((_,i) => exCamps[i].reduce((s,c)=>s+c.revenue,0))
  const exCostArr   = m12.map((_,i) => exCamps[i].reduce((s,c)=>s+c.cost,0))
  const exProfArr   = m12.map((_,i) => exRevArr[i] - exCostArr[i])
  const totRevArr   = m12.map((_,i) => newRevArr[i]+exRevArr[i])
  const totCostArr  = m12.map((_,i) => newCostArr[i]+exCostArr[i])
  const totProfArr  = m12.map((_,i) => totRevArr[i]-totCostArr[i])

  // Owner (แพร+พลอย) payslips
  const ownerSalArr  = m12.map(m => ownerSlips(m).reduce((s,p)=>s+p.base_salary,0))
  const ownerIncArr  = m12.map(m => ownerSlips(m).reduce((s,p)=>s+p.incentive,0))
  const ownerWhtArr  = m12.map(m => ownerSlips(m).reduce((s,p)=>s+p.withholding_tax,0))
  const ownerTotArr  = m12.map((_,i)=>ownerSalArr[i]+ownerIncArr[i]-ownerWhtArr[i])

  // Staff (fulltime non-owner)
  const staffSalArr  = m12.map(m => staffSlips(m).reduce((s,p)=>s+p.base_salary,0))
  const staffOtArr   = m12.map(m => staffSlips(m).reduce((s,p)=>s+p.ot_amount+p.incentive,0))
  const flArr        = m12.map(m => freelanceSlips(m).reduce((s,p)=>s+p.net_pay,0))
  const staffTotArr  = m12.map((_,i)=>ownerTotArr[i]+staffSalArr[i]+staffOtArr[i]+flArr[i])

  // KBIZ — kbiz_income auto-synced from Finance income_records
  const kbizIncArr   = m12.map((_,i) => financeIncome(i+1) || entryVal('kbiz_income', i+1))
  const kbizCarryArr = entryRow('kbiz_carry')
  // For synced expense cats: use Finance data; for others: use control_entries
  function resolveExpVal(cat: string, m: number) {
    const fromFinance = financeExp(cat, m)
    return fromFinance !== null ? fromFinance : entryVal(cat, m)
  }
  // total expense = owner + staff + all expense cats (auto or manual)
  const expCats = ['team_food','team_outing','team_party','team_snack','team_birthday','team_welcome','team_activity',
                   'mkt_ads','mkt_ops','office_rent','office_utils','office_software','office_domain','office_equip',
                   'tax_vat_wht','petty_cash']
  const manualExpArr = m12.map((_,i) => expCats.reduce((s,cat)=>s+resolveExpVal(cat,i+1),0))
  const totalExpArr  = m12.map((_,i)=>staffTotArr[i]+manualExpArr[i])
  const kbizBalArr   = m12.map((_,i)=>kbizCarryArr[i]+kbizIncArr[i]-totalExpArr[i])

  // Service breakdown (from campaigns)
  const serviceRows = SERVICE_TYPES.map(st => ({
    ...st,
    arr: m12.map(m => campaigns.filter(c=>c.month===m&&c.service_type===st.val).reduce((s,c)=>s+c.revenue,0))
  }))

  const sum = (arr: number[]) => arr.reduce((s,v)=>s+v,0)

  if (loading) return <p className="text-center text-gray-400 py-12">กำลังโหลด...</p>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📊 Control Board</h2>
          <p className="text-xs text-gray-400">สรุปภาพรวมธุรกิจรายปี</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setYear(y=>y-1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">◀</button>
          <span className="font-semibold text-gray-700 text-sm px-2">{year + 543}</span>
          <button onClick={()=>setYear(y=>y+1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">▶</button>
          <button onClick={()=>setShowCampForm(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700">
            <Plus size={13}/> เพิ่มแคมเปญ
          </button>
        </div>
      </div>

      {/* Campaign Add Form */}
      {showCampForm && (
        <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-indigo-700">➕ เพิ่มแคมเปญ</h3>
            <button onClick={()=>setShowCampForm(false)}><X size={15} className="text-gray-400"/></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">เดือน</label>
              <select value={campForm.month} onChange={e=>setCampForm({...campForm,month:Number(e.target.value)})}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {MONTHS_FULL.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ชื่อลูกค้า *</label>
              <input type="text" value={campForm.client_name} onChange={e=>setCampForm({...campForm,client_name:e.target.value})}
                placeholder="เช่น บจก.วรินดา"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ประเภทลูกค้า</label>
              <select value={campForm.client_type} onChange={e=>setCampForm({...campForm,client_type:e.target.value as 'new'|'existing'})}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="new">🆕 ลูกค้าใหม่</option>
                <option value="existing">🔄 ลูกค้าเก่า</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ประเภทงาน</label>
              <select value={campForm.service_type} onChange={e=>setCampForm({...campForm,service_type:e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {SERVICE_TYPES.map(s=><option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ชื่อแคมเปญ</label>
              <input type="text" value={campForm.campaign_name} onChange={e=>setCampForm({...campForm,campaign_name:e.target.value})}
                placeholder="ชื่องาน (ถ้ามี)"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ยอดขาย (บาท) *</label>
              <input type="number" value={campForm.revenue} onChange={e=>setCampForm({...campForm,revenue:e.target.value})}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">กำไร (บาท)</label>
              <input type="number" value={campForm.profit} onChange={e=>setCampForm({...campForm,profit:e.target.value})}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">หมายเหตุ</label>
              <input type="text" value={campForm.note} onChange={e=>setCampForm({...campForm,note:e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={addCampaign} disabled={campSaving}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {campSaving ? 'กำลังบันทึก...' : '✅ บันทึก'}
            </button>
            <button onClick={()=>setShowCampForm(false)}
              className="border border-gray-300 px-4 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {showCampDetail !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setShowCampDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">แคมเปญ — {MONTHS_FULL[showCampDetail-1]} {year+543}</h3>
              <button onClick={()=>setShowCampDetail(null)}><X size={16} className="text-gray-400"/></button>
            </div>
            {campsForMonth(showCampDetail).length === 0 ? (
              <p className="text-gray-400 text-sm">ยังไม่มีแคมเปญเดือนนี้</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left">ลูกค้า / งาน</th>
                  <th className="px-3 py-2 text-left">ประเภท</th>
                  <th className="px-3 py-2 text-right">ยอดขาย</th>
                  <th className="px-3 py-2 text-right">กำไร</th>
                  <th className="px-3 py-2"/>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {campsForMonth(showCampDetail).map(c=>{
                    const isEditing = editingCampId === c.id
                    const ef = editCampForm
                    const inp = 'w-full border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400'
                    if (isEditing) return (
                      <tr key={c.id} className="bg-indigo-50/60">
                        <td className="px-3 py-2" colSpan={2}>
                          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                            <input className={inp} placeholder="ชื่อลูกค้า" value={ef.client_name} onChange={e=>setEditCampForm(p=>({...p,client_name:e.target.value}))}/>
                            <input className={inp} placeholder="ชื่องาน" value={ef.campaign_name} onChange={e=>setEditCampForm(p=>({...p,campaign_name:e.target.value}))}/>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <select className={inp} value={ef.client_type} onChange={e=>setEditCampForm(p=>({...p,client_type:e.target.value as 'new'|'existing'}))}>
                              <option value="new">🆕 ลูกค้าใหม่</option>
                              <option value="existing">🔄 ลูกค้าเก่า</option>
                            </select>
                            <select className={inp} value={ef.service_type} onChange={e=>setEditCampForm(p=>({...p,service_type:e.target.value}))}>
                              {SERVICE_TYPES.map(s=><option key={s.val} value={s.val}>{s.label}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" className={inp} placeholder="ยอดขาย" value={ef.revenue} onChange={e=>setEditCampForm(p=>({...p,revenue:e.target.value}))}/>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" className={inp} placeholder="กำไร" value={ef.profit} onChange={e=>setEditCampForm(p=>({...p,profit:e.target.value}))}/>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={()=>saveEditCamp(c.id)} disabled={editCampSaving}
                              className="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 disabled:opacity-50">
                              {editCampSaving?'...':'✅'}
                            </button>
                            <button onClick={()=>setEditingCampId(null)} className="text-gray-400 hover:text-gray-600 px-1">✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800">{c.client_name}</p>
                          {c.campaign_name && <p className="text-xs text-gray-400">{c.campaign_name}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${c.client_type==='new'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>
                            {c.client_type==='new'?'🆕 ใหม่':'🔄 เก่า'}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">{SERVICE_TYPES.find(s=>s.val===c.service_type)?.label}</p>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-indigo-600">{formatCurrency(c.revenue-c.cost)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={()=>startEditCamp(c)} className="text-gray-300 hover:text-indigo-500 p-1"><Pencil size={13}/></button>
                            <button onClick={()=>deleteCampaign(c.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Annual Matrix ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
          💡 คลิกเซลล์สีเทาเพื่อแก้ไข | คลิกยอดแคมเปญเพื่อดูรายละเอียด
        </p>
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
          <table className="w-full text-xs border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-30">
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2.5 text-left sticky left-0 bg-gray-800 z-40 min-w-[220px]">Objective</th>
                {MONTHS_SHORT.map((m,i)=>(
                  <th key={i} className="px-2 py-2.5 text-center font-medium min-w-[80px]">{m}</th>
                ))}
                <th className="px-2 py-2.5 text-center font-bold bg-gray-700 min-w-[90px]">รวม</th>
              </tr>
            </thead>
            <tbody>

              {/* ═══ SECTION: Sales ══════════════════════════════════════════ */}
              <SectionHeader id="sales" label="💼 Sales" color="bg-indigo-50 text-indigo-800"/>
              {!collapsed['sales'] && <>
                {/* New Client */}
                <tr className="bg-green-50/50"><td colSpan={15} className="px-3 py-1 text-xs font-semibold text-green-700 sticky left-0">🆕 New Client</td></tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="จำนวนแคมเปญ (ลค ใหม่)" indent={1} sub/>
                  {m12.map(m=>(
                    <td key={m} className="px-2 py-1.5 text-center text-xs text-gray-600 cursor-pointer hover:bg-indigo-50"
                      onClick={()=>setShowCampDetail(m)}>
                      {newCamps[m-1].length>0 ? <span className="font-semibold text-indigo-700">{newCamps[m-1].length}</span> : <span className="text-gray-200">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold text-indigo-700 bg-gray-50">{campaigns.filter(c=>c.client_type==='new').length}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="ยอดขาย ลค ใหม่" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={newRevArr[i]} readOnly color="text-emerald-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-emerald-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(newRevArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="Profit จาก ลค ใหม่" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={newProfArr[i]} readOnly color={newProfArr[i]>=0?'text-indigo-600':'text-red-500'}/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap" style={{color:sum(newProfArr)>=0?'#4f46e5':'#ef4444'}}>{formatCurrency(sum(newProfArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="% Profit ลค ใหม่" indent={1} sub/>
                  {m12.map((_,i)=><PctCell key={i+1} num={newProfArr[i]} den={newRevArr[i]} m={i+1}/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-gray-500 bg-gray-50">{pct(sum(newProfArr),sum(newRevArr))}%</td>
                </tr>
                {/* Existing Client */}
                <tr className="bg-blue-50/50"><td colSpan={15} className="px-3 py-1 text-xs font-semibold text-blue-700 sticky left-0">🔄 Existing Client</td></tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="จำนวนแคมเปญ (ลค เก่า)" indent={1} sub/>
                  {m12.map(m=>(
                    <td key={m} className="px-2 py-1.5 text-center text-xs text-gray-600 cursor-pointer hover:bg-indigo-50"
                      onClick={()=>setShowCampDetail(m)}>
                      {exCamps[m-1].length>0 ? <span className="font-semibold text-blue-700">{exCamps[m-1].length}</span> : <span className="text-gray-200">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold text-blue-700 bg-gray-50">{campaigns.filter(c=>c.client_type==='existing').length}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="ยอดขาย ลค เก่า" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={exRevArr[i]} readOnly color="text-emerald-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-emerald-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(exRevArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="Profit จาก ลค เก่า" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={exProfArr[i]} readOnly color={exProfArr[i]>=0?'text-indigo-600':'text-red-500'}/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap" style={{color:sum(exProfArr)>=0?'#4f46e5':'#ef4444'}}>{formatCurrency(sum(exProfArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="% Profit ลค เก่า" indent={1} sub/>
                  {m12.map((_,i)=><PctCell key={i+1} num={exProfArr[i]} den={exRevArr[i]} m={i+1}/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-gray-500 bg-gray-50">{pct(sum(exProfArr),sum(exRevArr))}%</td>
                </tr>
                {/* All Sale */}
                <tr className="bg-indigo-50/60"><td colSpan={15} className="px-3 py-1 text-xs font-semibold text-indigo-700 sticky left-0">📊 All Sale</td></tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="Total Campaigns" indent={1} sub/>
                  {m12.map(m=>(
                    <td key={m} className="px-2 py-1.5 text-center text-xs cursor-pointer hover:bg-indigo-50"
                      onClick={()=>setShowCampDetail(m)}>
                      {campsForMonth(m).length>0?<span className="font-bold text-indigo-700">{campsForMonth(m).length}</span>:<span className="text-gray-200">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold text-indigo-700 bg-gray-50">{campaigns.length}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="ยอดขายทั้งหมด" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={totRevArr[i]} readOnly color="text-emerald-600" bold/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-emerald-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(totRevArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="Total Profit" indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={totProfArr[i]} readOnly color={totProfArr[i]>=0?'text-indigo-600':'text-red-500'} bold/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap" style={{color:sum(totProfArr)>=0?'#4f46e5':'#ef4444'}}>{formatCurrency(sum(totProfArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label="% Total Profit" indent={1} sub/>
                  {m12.map((_,i)=><PctCell key={i+1} num={totProfArr[i]} den={totRevArr[i]} m={i+1}/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-gray-500 bg-gray-50">{pct(sum(totProfArr),sum(totRevArr))}%</td>
                </tr>
              </>}

              {/* ═══ SECTION: KBIZ Cash Flow ═════════════════════════════════ */}
              <SectionHeader id="kbiz" label="🏦 เงินเข้าออกรายเดือน (KBIZ)" color="bg-amber-50 text-amber-800"/>
              {!collapsed['kbiz'] && <>
                {[
                  {cat:'kbiz_carry', color:'text-gray-700'},
                  {cat:'kbiz_income', color:'text-emerald-600'},
                ].map(({cat,color})=>(
                  <tr key={cat} className="hover:bg-gray-50/50">
                    <RowLabel label={MANUAL_CATS[cat]} synced={cat==='kbiz_income'}/>
                    {cat==='kbiz_income'
                      ? m12.map((_,i)=><Cell key={i+1} m={i+1} value={kbizIncArr[i]} readOnly color={color}/>)
                      : m12.map((_,i)=><Cell key={i+1} cat={cat} m={i+1} value={entryVal(cat,i+1)} color={color}/>)
                    }
                    <td className="px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap">
                      {cat==='kbiz_income' ? formatCurrency(sum(kbizIncArr)) : formatCurrency(sum(entryRow(cat)))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-rose-50/40 hover:bg-rose-50">
                  <RowLabel label="รายจ่ายทั้งหมด" bold/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={totalExpArr[i]} readOnly color="text-rose-600" bold/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-rose-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(totalExpArr))}</td>
                </tr>
                <tr className="bg-indigo-50/40 hover:bg-indigo-50">
                  <RowLabel label="คงเหลือต่อเดือน" bold/>
                  {m12.map((_,i)=>(
                    <td key={i+1} className={`px-2 py-1.5 text-right text-xs font-bold whitespace-nowrap ${kbizBalArr[i]>=0?'text-indigo-600':'text-red-500'}`}>
                      {kbizBalArr[i]!==0?formatCurrency(kbizBalArr[i]):<span className="text-gray-200">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap"
                    style={{color:sum(kbizBalArr)>=0?'#4f46e5':'#ef4444'}}>{formatCurrency(sum(kbizBalArr))}</td>
                </tr>
                <tr className="hover:bg-gray-50/50">
                  <RowLabel label={MANUAL_CATS['kbiz_reserve']}/>
                  {m12.map((_,i)=><Cell key={i+1} cat="kbiz_reserve" m={i+1} value={entryVal('kbiz_reserve',i+1)} color="text-amber-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-amber-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(entryRow('kbiz_reserve')))}</td>
                </tr>
              </>}

              {/* ═══ SECTION: แพร+พลอย ══════════════════════════════════════ */}
              <SectionHeader id="owner" label="👑 รายจ่ายแพร+พลอย (จ่ายผ่าน KBIZ)" color="bg-purple-50 text-purple-800"/>
              {!collapsed['owner'] && <>
                {[
                  {label:'เงินเดือน แพร+พลอย', arr:ownerSalArr, color:'text-indigo-600'},
                  {label:'Incentive แพร+พลอย', arr:ownerIncArr, color:'text-purple-600'},
                  {label:'หัก ณ ที่จ่าย 3%', arr:ownerWhtArr, color:'text-rose-500'},
                ].map(({label,arr,color})=>(
                  <tr key={label} className="hover:bg-gray-50/50">
                    <RowLabel label={label} indent={1} sub/>
                    {m12.map((_,i)=><Cell key={i+1} m={i+1} value={arr[i]} readOnly color={color}/>)}
                    <td className={`px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap ${color}`}>{formatCurrency(sum(arr))}</td>
                  </tr>
                ))}
                <tr className="bg-purple-50/40">
                  <RowLabel label="รวมเงินแพร+พลอย" bold/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={ownerTotArr[i]} readOnly color="text-purple-700" bold/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-purple-700 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(ownerTotArr))}</td>
                </tr>
              </>}

              {/* ═══ SECTION: Staff & Freelance ════════════════════════════ */}
              <SectionHeader id="staff" label="👥 Total Staff & Freelance Cost (ไม่รวมแพร+พลอย)" color="bg-teal-50 text-teal-800"/>
              {!collapsed['staff'] && <>
                {[
                  {label:'เงินเดือนพนักงานประจำ', arr:staffSalArr, color:'text-teal-600'},
                  {label:'Incentive / OT พนักงานประจำ', arr:staffOtArr, color:'text-orange-500'},
                  {label:'ค่าจ้าง Freelance', arr:flArr, color:'text-amber-600'},
                ].map(({label,arr,color})=>(
                  <tr key={label} className="hover:bg-gray-50/50">
                    <RowLabel label={label} indent={1} sub/>
                    {m12.map((_,i)=><Cell key={i+1} m={i+1} value={arr[i]} readOnly color={color}/>)}
                    <td className={`px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap ${color}`}>{formatCurrency(sum(arr))}</td>
                  </tr>
                ))}
                <tr className="bg-teal-50/40">
                  <RowLabel label="รวมจ่ายเงินเดือนทั้งหมด (แพร+พลอย+ทีม+Freelance)" bold/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={staffTotArr[i]} readOnly color="text-teal-700" bold/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-teal-700 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(staffTotArr))}</td>
                </tr>
              </>}

              {/* ═══ SECTION: Team & Culture ════════════════════════════════ */}
              <SectionHeader id="team" label="🎉 Team & Culture Cost (จ่ายโดย KBIZ)" color="bg-pink-50 text-pink-800"/>
              {!collapsed['team'] && ['team_food','team_outing','team_party','team_snack','team_birthday','team_welcome','team_activity'].map(cat=>(
                <tr key={cat} className="hover:bg-gray-50/50">
                  <RowLabel label={MANUAL_CATS[cat]} indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} cat={cat} m={i+1} value={entryVal(cat,i+1)} color="text-pink-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-pink-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(entryRow(cat)))}</td>
                </tr>
              ))}

              {/* ═══ SECTION: Marketing & Sales ═════════════════════════════ */}
              <SectionHeader id="mkt" label="📢 Marketing & Sales Cost" color="bg-orange-50 text-orange-800"/>
              {!collapsed['mkt'] && ['mkt_ads','mkt_ops'].map(cat=>(
                <tr key={cat} className="hover:bg-gray-50/50">
                  <RowLabel label={MANUAL_CATS[cat]} indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} cat={cat} m={i+1} value={entryVal(cat,i+1)} color="text-orange-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-orange-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(entryRow(cat)))}</td>
                </tr>
              ))}

              {/* ═══ SECTION: Office & System ════════════════════════════════ */}
              <SectionHeader id="office" label="🏢 Office & System Cost (จ่ายโดย KBIZ)" color="bg-sky-50 text-sky-800"/>
              {!collapsed['office'] && ['office_rent','office_utils','office_software','office_domain','office_equip'].map(cat=>{
                const synced = FINANCE_SYNCED.has(cat)
                const rowArr = m12.map((_,i)=>resolveExpVal(cat,i+1))
                return (
                  <tr key={cat} className="hover:bg-gray-50/50">
                    <RowLabel label={MANUAL_CATS[cat]} indent={1} sub synced={synced}/>
                    {m12.map((_,i)=>(
                      synced
                        ? <Cell key={i+1} m={i+1} value={rowArr[i]} readOnly color="text-sky-600"/>
                        : <Cell key={i+1} cat={cat} m={i+1} value={entryVal(cat,i+1)} color="text-sky-600"/>
                    ))}
                    <td className="px-2 py-1.5 text-right text-xs font-bold text-sky-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(rowArr))}</td>
                  </tr>
                )
              })}

              {/* ═══ SECTION: ภาษี + Petty Cash ═══════════════════════════ */}
              <SectionHeader id="tax" label="📋 ภาษีและงานราชการ + Petty Cash" color="bg-red-50 text-red-800"/>
              {!collapsed['tax'] && ['tax_vat_wht','petty_cash'].map(cat=>{
                const synced = FINANCE_SYNCED.has(cat)
                const color = cat==='petty_cash'?'text-gray-600':'text-red-600'
                const rowArr = m12.map((_,i)=>resolveExpVal(cat,i+1))
                return (
                  <tr key={cat} className="hover:bg-gray-50/50">
                    <RowLabel label={MANUAL_CATS[cat]} indent={1} sub synced={synced}/>
                    {m12.map((_,i)=>(
                      synced
                        ? <Cell key={i+1} m={i+1} value={rowArr[i]} readOnly color={color}/>
                        : <Cell key={i+1} cat={cat} m={i+1} value={entryVal(cat,i+1)} color={color}/>
                    ))}
                    <td className={`px-2 py-1.5 text-right text-xs font-bold bg-gray-50 whitespace-nowrap ${color}`}>{formatCurrency(sum(rowArr))}</td>
                  </tr>
                )
              })}

              {/* ═══ SECTION: Services Sold ══════════════════════════════════ */}
              <SectionHeader id="services" label="🛒 Services ที่ขายออก (ยอดขายแยกตามประเภท)" color="bg-violet-50 text-violet-800"/>
              {!collapsed['services'] && serviceRows.map(s=>(
                <tr key={s.val} className="hover:bg-gray-50/50">
                  <RowLabel label={s.label} indent={1} sub/>
                  {m12.map((_,i)=><Cell key={i+1} m={i+1} value={s.arr[i]} readOnly color="text-violet-600"/>)}
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-violet-600 bg-gray-50 whitespace-nowrap">{formatCurrency(sum(s.arr))}</td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
