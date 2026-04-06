/** Phuket STR calculator — parity with legacy `calcUpdate()` in catalogue HTML. */

export interface StrCalcInput {
  price: number;
  sqm: number;
  adr: number;
  occPct: number;
  mgmtPct: number;
  camPerSqmMonth: number;
  appreciationPct: number;
}

export interface StrCalcResult {
  grossIncome: number;
  mgmtCost: number;
  netBeforeTax: number;
  camAnnual: number;
  taxable: number;
  tax: number;
  netIncome: number;
  grossYieldPct: number;
  netYieldPct: number;
  paybackYears: number | null;
  exit5: number;
  /** Sum for cost bar segments (mgmt + cam + tax + net) */
  costTotal: number;
}

export function computeStrCalc(input: StrCalcInput): StrCalcResult {
  const occ = input.occPct / 100;
  const mgmt = input.mgmtPct / 100;

  const grossIncome = input.adr * 365 * occ;
  const mgmtCost = grossIncome * mgmt;
  const netBeforeTax = grossIncome - mgmtCost;
  const camAnnual = input.camPerSqmMonth * input.sqm * 12;
  const taxable = Math.max(0, netBeforeTax - camAnnual);
  const tax = taxable * 0.125;
  const netIncome = netBeforeTax - camAnnual - tax;

  const grossYieldPct =
    input.price > 0 ? (grossIncome / input.price) * 100 : 0;
  const netYieldPct =
    input.price > 0 ? (netIncome / input.price) * 100 : 0;
  const paybackYears =
    netIncome > 0 ? input.price / netIncome : null;
  const exit5 =
    input.price * Math.pow(1 + input.appreciationPct / 100, 5);

  const costTotal = mgmtCost + camAnnual + tax + netIncome;

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
    exit5,
    costTotal,
  };
}

/** Segment flex percentages for the cost bar; when total==0 return zeros. */
export function costBarSegments(r: StrCalcResult): {
  mgmt: number;
  cam: number;
  tax: number;
  net: number;
} {
  const t = r.costTotal;
  if (t <= 0 || !Number.isFinite(t)) {
    return { mgmt: 0, cam: 0, tax: 0, net: 0 };
  }
  return {
    mgmt: (r.mgmtCost / t) * 100,
    cam: (r.camAnnual / t) * 100,
    tax: (r.tax / t) * 100,
    net: (r.netIncome / t) * 100,
  };
}
