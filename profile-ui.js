import { derivedBillStatus, formatPKR } from './core.js';

const BILL_STATUS = Object.freeze({
  paid: { label:'Paid', className:'status-received' },
  pending: { label:'Pending', className:'status-pending' },
  partial: { label:'Partial', className:'status-partial' },
  'not-set': { label:'Not set', className:'status-empty' }
});

/** Present only a saved bill and the balance computed from existing payment allocations. */
export function currentBillPresentation(customer, month, allocations) {
  const bill = (customer?.bills ?? []).find(item => item.month === month) ?? null;
  const amount = bill?.dueAmount;
  const hasBillAmount = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
  const status = derivedBillStatus(customer, bill, allocations);
  const balanceDueCents = allocations?.forMonth?.(customer?.id, month)?.balanceDueCents ?? null;
  const statusPresentation = BILL_STATUS[status] ?? BILL_STATUS['not-set'];

  return {
    month,
    billAmount: hasBillAmount ? Number(amount) : null,
    billAmountLabel: hasBillAmount ? formatPKR(Number(amount)) : 'Not set',
    status,
    statusLabel: statusPresentation.label,
    statusClassName: statusPresentation.className,
    balanceDueCents,
    balanceDueLabel: balanceDueCents === null ? 'Not set' : formatPKR(balanceDueCents / 100)
  };
}

/** Build shortcuts solely from an explicitly saved, numeric phone value; never infer a country code. */
export function contactActionTargets(phone) {
  const saved = String(phone ?? '').trim();
  if (!saved) return null;
  const compact = saved.replace(/[\s().-]/g, '');
  if (!/^\+?\d{3,20}$/.test(compact)) return null;
  const whatsappDigits = compact.replace(/^\+/, '');
  if (!whatsappDigits) return null;
  return {
    tel: `tel:${compact}`,
    whatsapp: `https://wa.me/${whatsappDigits}`
  };
}
