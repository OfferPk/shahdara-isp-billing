// Sales tax (19.5%) per package — Polish #11.
//
// One rate, one rounding rule, no stored state: every figure here is
// derived from the catalog price or the customer's current package, so
// a rate change can never rewrite history — old bills keep the cents
// recorded on them at the time. All money is PKR only, in integer
// cents; display uses the min-0-decimals formatter, so 292.5 reads
// "PKR 292.5" and 195 reads "PKR 195", never "PKR 292.50" or "PKR 0".
//
// Pinned rounding: tax = Math.round(priceCents x 195 / 1000). For all
// six catalog prices the computation is exact (no rounding occurs);
// for any other positive amount it rounds half-up to the nearest
// paisa. Never round to whole rupees.
//
// Pure and import-free apart from the package catalog (the single
// source of truth for prices — the price table is never duplicated
// here): no storage, clock, network, or page reads; never mutates an
// input.

import { BILL_PACKAGES, billPackageById, billPackageByLabel } from './package-catalog.js';

// 19.5% expressed as basis points, so the rate is one integer.
export const SALES_TAX_RATE_BPS = 1950;
export const SALES_TAX_RATE_PERCENT = 19.5;

// The receipt / dashboard label for the tax line, bilingual like the
// other receipt charge lines.
export const SALES_TAX_RECEIPT_LABEL = 'Sales tax / سیلز ٹیکس (19.5%)';

// Min-0 decimals, grouped like the other live money lines: 19500
// cents reads 'PKR 195', 29250 cents reads 'PKR 292.5'.
export function formatSalesTaxAmount(cents) {
  if (cents === null || cents === undefined) return 'Not set';
  if (typeof cents === 'boolean') return 'Not set';
  if (typeof cents === 'string' && cents.trim() === '') return 'Not set';
  const value = Number(cents);
  if (!Number.isFinite(value)) return 'Not set';
  return `PKR ${(value / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent a
// tax out of nothing. The value is in rupees; the result is in
// integer cents.
function salesTaxPriceCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const rupees = Number(value);
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  return Math.round(rupees * 100);
}

// The sales tax on one package price, in integer cents:
// Math.round(priceCents x 195 / 1000). Null for anything that is not
// a positive amount — never zero.
export function salesTaxCentsForPrice(priceRupees) {
  const priceCents = salesTaxPriceCents(priceRupees);
  if (priceCents === null) return null;
  return Math.round((priceCents * SALES_TAX_RATE_BPS) / 10000);
}

// The sales tax for one catalog package: { packageId, label,
// priceCents, taxCents }, or null for an unknown id.
export function salesTaxForPackage(packageId) {
  const plan = typeof packageId === 'string' && packageId !== '' ? billPackageById(packageId) : null;
  if (!plan) return null;
  return {
    packageId: plan.id,
    label: plan.label,
    priceCents: Math.round(Number(plan.price) * 100),
    taxCents: salesTaxCentsForPrice(plan.price),
  };
}

// The six catalog rows (package, price, tax) for the bill-form
// options and the dashboard.
export function salesTaxTable() {
  return BILL_PACKAGES.map((plan) => salesTaxForPackage(plan.id));
}

// The tax for a customer's CURRENT package, in integer cents:
// catalog match on the package label (or id) first, else 19.5% of
// the monthly selling amount when positive. Null when the customer
// has no package — never a guessed zero.
export function customerSalesTaxCents(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const label = typeof customer.packageSpeed === 'string' ? customer.packageSpeed.trim() : '';
  if (label !== '') {
    const plan = billPackageByLabel(label) ?? billPackageById(label);
    if (plan) return salesTaxCentsForPrice(plan.price);
  }
  return salesTaxCentsForPrice(customer.monthlySellingAmount);
}

// The tax recorded on one bill, in integer cents: the bill's own
// recorded figure, never recomputed from today's rate, so history
// stays exactly as billed. Null when the bill carries no tax.
export function salesTaxCentsOfBill(bill) {
  if (!bill || typeof bill !== 'object') return null;
  const cents = bill.salesTaxCents;
  if (cents === null || cents === undefined) return null;
  if (typeof cents === 'boolean') return null;
  if (typeof cents === 'string' && cents.trim() === '') return null;
  const value = Number(cents);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

// The receipt tax line for one bill — { label, taxCents } — or null
// when the bill carries no tax, so untaxed receipts show no line.
// Polish #23: a tagged month (first month free) carries no tax line
// either — the whole gross was waived, so 0 tax was collected.
export function salesTaxReceiptLine(bill) {
  if (bill && Number(bill.firstMonthWaivedAmount) > 0) return null;
  const taxCents = salesTaxCentsOfBill(bill);
  if (taxCents === null) return null;
  return { label: SALES_TAX_RECEIPT_LABEL, taxCents };
}

function salesTaxRowText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Per-customer rows for the sales-tax dashboard, current month only:
// name, mohalla, package label, package price and monthly tax (both
// in integer cents), plus the tax actually charged on this month's
// bill (from the bill's recorded cents — a voided payment never
// changes it, because the tax is charged on the bill, not on a
// payment). Archived customers are excluded; a customer with no
// package is listed with null tax, never a guessed zero. Rows sort
// by name, then customer number, so the table is stable.
export function salesTaxDashboardRows(customers, month) {
  const list = Array.isArray(customers) ? customers : [];
  const monthKey = typeof month === 'string' ? month : '';
  const rows = [];
  for (const customer of list) {
    if (!customer || typeof customer !== 'object') continue;
    if (customer.archived === true) continue;
    const bill = monthKey !== ''
      ? (Array.isArray(customer.bills) ? customer.bills.find((entry) => entry?.month === monthKey) : undefined)
      : undefined;
    // Polish #23: a tagged month was waived in full, so 0 tax was
    // charged on it — the dashboard's charged total must exclude it
    // (the recorded cents stay on the bill as the audit trail). The
    // derived total is unchanged: it sums the per-package taxes.
    const firstMonthWaived = Boolean(bill && Number(bill.firstMonthWaivedAmount) > 0);
    const billTaxCents = firstMonthWaived ? 0 : salesTaxCentsOfBill(bill);
    const label = salesTaxRowText(customer.packageSpeed);
    const plan = label !== '' ? (billPackageByLabel(label) ?? billPackageById(label)) : null;
    const priceCents = plan ? Math.round(Number(plan.price) * 100) : salesTaxPriceCents(customer.monthlySellingAmount);
    const taxCents = customerSalesTaxCents(customer);
    rows.push({
      customerId: customer.id ?? '',
      customerNumber: customer.customerNumber ?? null,
      customerName: salesTaxRowText(customer.name),
      mohalla: salesTaxRowText(customer.mohalla),
      packageLabel: plan ? plan.label : label,
      hasPackage: taxCents !== null,
      priceCents: taxCents === null ? null : priceCents,
      taxCents,
      billTaxCents,
      firstMonthWaived,
    });
  }
  rows.sort((a, b) => (a.customerName.localeCompare(b.customerName))
    || (Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0)));
  return rows;
}

// The dashboard totals from its rows: the derived monthly tax (the
// sum of the per-package taxes — "tax on the books") and the charged
// monthly tax (the sum of the recorded cents on this month's bills —
// "tax actually billed"). The charged total is zero when no bill
// carries tax yet, never a blank.
export function salesTaxDashboardTotals(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let derivedTotalCents = 0;
  let chargedTotalCents = 0;
  let taxedCustomerCount = 0;
  let noPackageCount = 0;
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    if (typeof row.taxCents === 'number' && Number.isFinite(row.taxCents) && row.taxCents > 0) {
      derivedTotalCents += Math.round(row.taxCents);
      taxedCustomerCount += 1;
    } else {
      noPackageCount += 1;
    }
    if (typeof row.billTaxCents === 'number' && Number.isFinite(row.billTaxCents) && row.billTaxCents > 0) {
      chargedTotalCents += Math.round(row.billTaxCents);
    }
  }
  return {
    derivedTotalCents,
    chargedTotalCents,
    customerCount: list.length,
    taxedCustomerCount,
    noPackageCount,
  };
}
