/**
 * Phuket STR calculator — matches legacy monolith `calcUpdate()`:
 * grossIncome = ADR × 365 × occupancy
 * taxable = max(0, netAfterMgmt − CAM annual)
 * tax = taxable × 12.5%
 * netIncome = netAfterMgmt − CAM − tax
 */

export interface CalcStrInput {
  price: number;
  sqm: number;
  adr: number;
  /** Occupancy 0–100 */
  occPct: number;
  /** Management fee % of gross rent */
  mgmtPctOfGross: number;
  /** CAM ฿/sqm/month */
  camPerSqmMonth: number;
  /** Annual appreciation % for 5-year exit (display only) */
  appreciationPct: number;
}

export interface CalcStrResult {
  grossIncome: number;
  mgmtCost: number;
  netBeforeTax: number;
  camAnnual: number;
  taxable: number;
  tax: number;
  netIncome: number;
  grossYieldPct: number;
  netYieldPct: number;
  /** Years; null if non-positive net income */
  paybackYears: number | null;
  exitValue5yr: number;
  /** Bar segments as share of gross income (sum to 1 when grossIncome > 0) */
  barFrac: { mgmt: number; cam: number; tax: number; net: number };
}

export function computeCalcStr(input: CalcStrInput): CalcStrResult {
  const occ = input.occPct / 100;
  const mgmtRate = input.mgmtPctOfGross / 100;
  const app = input.appreciationPct / 100;

  const grossIncome = input.adr * 365 * occ;
  const mgmtCost = grossIncome * mgmtRate;
  const netBeforeTax = grossIncome - mgmtCost;
  const camAnnual = input.camPerSqmMonth * input.sqm * 12;
  const taxable = Math.max(0, netBeforeTax - camAnnual);
  const tax = taxable * 0.125;
  const netIncome = netBeforeTax - camAnnual - tax;

  const price = input.price;
  const grossYieldPct = price > 0 ? (grossIncome / price) * 100 : 0;
  const netYieldPct = price > 0 ? (netIncome / price) * 100 : 0;
  const paybackYears = netIncome > 0 ? price / netIncome : null;
  const exitValue5yr = price * Math.pow(1 + app, 5);

  const g = grossIncome;
  let barFrac = { mgmt: 0, cam: 0, tax: 0, net: 0 };
  if (g > 0) {
    barFrac = {
      mgmt: mgmtCost / g,
      cam: camAnnual / g,
      tax: tax / g,
      net: netIncome / g,
    };
  }

  return {
    grossIncome,
    mgmtCost,
    netBeforeTax,
    camAnnual,
    taxable,
    tax,
    netIncome,
    grossYieldPct,
    netYieldPct,
    paybackYears,
    exitValue5yr,
    barFrac,
  };
}
