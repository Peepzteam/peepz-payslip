/**
 * คำนวณภาษีเงินได้บุคคลธรรมดา (พนักงานประจำ)
 * ตามกฎหมายภาษีไทย — อัปเดตล่าสุดปี 2567
 */

export interface TaxBreakdown {
  annualIncome: number        // รายได้ต่อปี
  expenseDeduction: number    // ค่าใช้จ่าย 50% (สูงสุด 100,000)
  personalAllowance: number   // ค่าลดหย่อนส่วนตัว 60,000
  socialSecurityDeduction: number // ประกันสังคมที่จ่ายทั้งปี
  taxableIncome: number       // เงินได้สุทธิ
  annualTax: number           // ภาษีต่อปี
  monthlyTax: number          // หักต่อเดือน (annualTax / 12)
  brackets: { from: number; to: number | null; rate: number; tax: number }[]
}

const TAX_BRACKETS = [
  { from: 0,         to: 150_000,   rate: 0   },
  { from: 150_000,   to: 300_000,   rate: 0.05 },
  { from: 300_000,   to: 500_000,   rate: 0.10 },
  { from: 500_000,   to: 750_000,   rate: 0.15 },
  { from: 750_000,   to: 1_000_000, rate: 0.20 },
  { from: 1_000_000, to: 2_000_000, rate: 0.25 },
  { from: 2_000_000, to: 5_000_000, rate: 0.30 },
  { from: 5_000_000, to: null,      rate: 0.35 },
]

/**
 * @param monthlySalary  เงินเดือนต่อเดือน
 * @param monthlyOtAvg   ค่า OT เฉลี่ยต่อเดือน (ถ้ามี)
 * @param monthlyIncentiveAvg  Incentive เฉลี่ยต่อเดือน
 * @param monthlySocialSecurity ประกันสังคมที่จ่ายต่อเดือน
 * @param extraAllowances ค่าลดหย่อนเพิ่มเติม เช่น ประกันชีวิต กองทุนสำรอง ฯ
 */
export function calculateTax(
  monthlySalary: number,
  monthlyOtAvg = 0,
  monthlyIncentiveAvg = 0,
  monthlySocialSecurity = 875,
  extraAllowances = 0,
): TaxBreakdown {
  const annualIncome = (monthlySalary + monthlyOtAvg + monthlyIncentiveAvg) * 12

  // ค่าใช้จ่าย: 50% แต่ไม่เกิน 100,000
  const expenseDeduction = Math.min(annualIncome * 0.5, 100_000)

  // ค่าลดหย่อนส่วนตัว
  const personalAllowance = 60_000

  // ประกันสังคม (จ่ายจริงทั้งปี)
  const socialSecurityDeduction = monthlySocialSecurity * 12

  // เงินได้สุทธิ
  const taxableIncome = Math.max(
    0,
    annualIncome - expenseDeduction - personalAllowance - socialSecurityDeduction - extraAllowances
  )

  // คำนวณภาษีตาม bracket
  let remaining = taxableIncome
  let annualTax = 0
  const brackets = TAX_BRACKETS.map(b => {
    const size = b.to ? b.to - b.from : Infinity
    const taxable = Math.min(remaining, size)
    const tax = taxable > 0 ? Math.round(taxable * b.rate) : 0
    remaining -= taxable
    return { ...b, tax }
  })
  annualTax = brackets.reduce((s, b) => s + b.tax, 0)

  const monthlyTax = Math.round(annualTax / 12)

  return {
    annualIncome,
    expenseDeduction,
    personalAllowance,
    socialSecurityDeduction,
    taxableIncome,
    annualTax,
    monthlyTax,
    brackets: brackets.filter(b => b.tax > 0 || b.from === 0),
  }
}

/** เกณฑ์เงินได้สุทธิที่ต้องเสียภาษี */
export const TAX_THRESHOLD_TAXABLE = 150_000
/** เกณฑ์เงินเดือนต่อปี (approx.) ที่เริ่มต้องพิจารณาภาษี */
export const MONTHLY_SALARY_THRESHOLD = 26_000
