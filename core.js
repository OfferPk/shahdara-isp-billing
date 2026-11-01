import { validatePhase3State, buildManualPayrollSummary, monthEnd, PAYROLL_RULES_EFFECTIVE_DATE, SAAD_BASE_MONTHLY_SALARY, SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY, canonicalMohalla } from './phase3.js';
import { createBillPackageSnapshot, validateBillPackageSnapshot, BILL_PACKAGES } from './package-catalog.js';
import { sanitizeDigitalPaymentsSettings, getDefaultDigitalPaymentsSettings } from './digital-payments-settings.js';
import { sanitizeReceiptFooter, getDefaultReceiptFooter } from './receipt-footer-studio.js';
import { sanitizeBranchGuard, sanitizeBranchGuardStamp, classifyBranchGuardRestore, fingerprintState } from './branch-guard.js';
import { sanitizeShopSettlements } from './shop-settlement.js';
import { normalizeTid } from './wallet-reconciliation.js';
import { sanitizeComplaints } from './complaint-register.js';
import { sanitizeHomeBudget } from './home-budget.js';
import { sanitizeRoznamchaDays } from './roznamcha.js';
import { sanitizeTickets } from './complaint-tickets.js';
import { sanitizeInventory } from './inventory-book.js';
import { sanitizeLoanEntries } from './loan-ledger.js';
import { sanitizeSaadPayments, sanitizeSaadVisits } from './saad-visits.js';
import { sanitizeInstallRequests } from './install-tracker.js';
import { sanitizePendingWorks } from './pending-works.js';
import { sanitizeBillingGroups } from './group-billing.js';
import { sanitizeSuspensePayments } from './suspense-payments.js';
import { sanitizePolesRegistry } from './pole-asset-tracker.js';
import { sanitizeFiberDrums } from './fiber-drum-tracker.js';
import { sanitizeStormInspections } from './storm-inspection.js';
import { sanitizeSupplierKhata } from './supplier-khata.js';
import { sanitizeCommissionRules } from './collector-commission.js';
import { sanitizeUpsNodes } from './power-backup-monitor.js';
import { sanitizeReferralCredits } from './referral-credits.js';
import { sanitizeCreditTransfers } from './credit-transfer.js';
import { sanitizeFieldTools } from './tool-custody-register.js';
import { sanitizeSpliceClosures } from './fiber-splice-closure.js';
import { sanitizeBadDebts } from './bad-debt-ledger.js';
import { sanitizeMonthlyClosingNotes } from './monthly-closing-notes.js';import { sanitizeBillKistLines, sanitizeInstallmentPlans } from './installment-plan.js';
import { sanitizeSplitterBoxGps } from './gps-pin-helper.js';
import { sanitizeWaTemplates } from './whatsapp-templates.js';
import { validateUpstreamLink, normalizeFiberZone } from './outage-impact.js';
import { isFeederHost, sanitizeFeederHostCreditPKR } from './feeder-host-credit.js';
import { isBillingPaused, validatePauseFields, pauseSkippedMonthsOnResume, sanitizePauseFields } from './pause-billing.js';
import { computeBackupChecksum, verifyBackupChecksum } from './backup-health.js';
import { sanitizePartnerLedgerEntries, sanitizePartnerSettlements, sanitizePartnerSettings } from './partner-settlement.js';
import { sanitizeCharityReserveSettings } from './charity-reserve.js';
import { sanitizeOverheads } from './fixed-overheads.js';
import { isVoidedPayment, sanitizeVoidPayments } from './payment-void-audit.js';
import { lateFeeWaiverOf, sanitizeWaivedLateFeeStamp } from './late-fee-waiver.js';
import { sanitizeDepositSettlement } from './hardware-custody.js';
import { sanitizeDisconnectDetails, sanitizeDisconnectHistory, sanitizeDisconnectDateTime, DISCONNECT_HISTORY_LIMIT } from './churn-winback.js';
import { sanitizeSignalReadings } from './signal-history.js';
import { sanitizeReceiptLang, sanitizeReceiptChannel, prefersSmsForChannel } from './receipt-preferences.js';
// Privacy (owner order, 2026-10-29): NO customer names ship with this
// public app. The customer list starts EMPTY; every record is entered
// by the owner locally and lives only in the browser's storage.
export const INITIAL_NAMES = Object.freeze([]);
export const PAYMENT_METHODS = Object.freeze(['Cash','JazzCash','Easypaisa','NayaPay','Bank Transfer','Raast','Cash at Waseem Abbasi shop','Cash at Hassan shop','Cash at Balla shop','Cash at Hassan Balla shop']);

export function isDigitalPaymentMethod(method) {
  if (!method) return false;
  const m = String(method).trim().toLowerCase();
  return m.includes('jazzcash') || m.includes('easypaisa') || m.includes('nayapay') || m.includes('bank') || m.includes('raast') || m.includes('online');
}

export function isCashPaymentMethod(method) {
  return !isDigitalPaymentMethod(method);
}
export const MONTH_LIMIT = 24;
export const STORAGE_KEY = 'shahdara-isp-billing-v1';
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const moneyCents = value => Math.round(Number(value || 0) * 100);
const moneyValue = cents => Number((cents / 100).toFixed(2));
export function formatPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits:Number.isInteger(amount) ? 0 : 2, maximumFractionDigits:2 });
  return `PKR ${formatter.format(amount)}`;
}
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
function zonedParts(date, options) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { ...options, timeZone:PAKISTAN_TIME_ZONE }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
const monthKey = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit' }); return `${p.year}-${p.month}`; };
function shiftMonth(month, delta) { const [year, number] = month.split('-').map(Number); const index = year * 12 + number - 1 + delta; return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`; }
const nextMonthKey = month => shiftMonth(month, 1);
const dateKey = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit', day:'2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
const offsetDateKey = (date, days) => { const shifted = new Date(`${date}T00:00:00.000Z`); shifted.setUTCDate(shifted.getUTCDate() + days); return shifted.toISOString().slice(0, 10); };
export const localDateTimeValue = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 || wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour || wallClock.getUTCMinutes() !== minute) return null;
  return wallClock.getTime() - 5 * 60 * 60 * 1000;
}

// Uptime tracking: the manual service-status history is an append-only
// log of { status, at } stamps (Pakistan local datetimes), one per
// status flip recorded by updateCustomerProfile/addCustomer. Readers
// tolerate anything malformed by dropping the entry — a corrupt log
// must never break a save/load or a backup. Capped so a pathological
// flip-flop history cannot grow the ledger without bound.
const SERVICE_STATUS_HISTORY_LIMIT = 500;
function sanitizeServiceStatusHistory(value) {
  if (!Array.isArray(value)) return [];
  const entries = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    if (!['active', 'offline', 'not-set'].includes(entry.status)) continue;
    const at = typeof entry.at === 'string' ? entry.at.trim() : '';
    if (parseLocalDateTime(at) === null) continue;
    entries.push({ status: entry.status, at });
  }
  return entries
    .sort((a, b) => a.at.localeCompare(b.at) || a.status.localeCompare(b.status))
    .slice(-SERVICE_STATUS_HISTORY_LIMIT);
}

export function createInitialState(names = INITIAL_NAMES) {
  return { version: 1, nextCustomerNumber: names.length + 1, customers: names.map((name, index) => ({ id: `seed-${String(index + 1).padStart(3, '0')}`, customerNumber: index + 1, name, mohalla: '', zone:'', address: '', phone: '', ispProvider:'', serviceStatus:'not-set', serviceStatusHistory:[], packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], relocationLog:[], archived:false, archivedAt:null, bills: [], incidents: [] })), inventoryItems:[],inventoryMovements:[],expenses:[],saadAttendanceDays:[],umairWorkdays:[],monthlyClosings:[] };
}

// SISP-92: load-time GPS pin sanitize — a stored pin survives only when
// BOTH coordinates are finite in-range numbers; anything missing,
// half-recorded or malformed loads as no pin (null pair), never as
// invented coordinates and never as a load failure.
function sanitizeGpsPair(source) {
  const lat = source?.gpsLat;
  const lng = source?.gpsLng;
  const latOk = lat !== '' && lat !== null && lat !== undefined
    && Number.isFinite(Number(lat)) && Number(lat) >= -90 && Number(lat) <= 90;
  const lngOk = lng !== '' && lng !== null && lng !== undefined
    && Number.isFinite(Number(lng)) && Number(lng) >= -180 && Number(lng) <= 180;
  if (!latOk || !lngOk) return { gpsLat: null, gpsLng: null };
  return {
    gpsLat: Math.round(Number(lat) * 1e6) / 1e6,
    gpsLng: Math.round(Number(lng) * 1e6) / 1e6
  };
}

export function readState(storage, key = STORAGE_KEY) {
  const raw = storage.getItem(key);
  if (raw === null) return createInitialState();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Saved billing data is malformed. It was not changed. Use a JSON backup to recover it.'); }
  if (parsed?.version !== 1 || !Array.isArray(parsed.customers)) throw new Error('Saved billing data has an unsupported version or structure. It was not changed. Use a JSON backup to recover it.');
  if (!parsed.customers.every(customer => customer && typeof customer === 'object' && typeof customer.name === 'string' && customer.name.trim())) throw new Error('Saved billing data contains an invalid customer record. It was not changed. Use a JSON backup to recover it.');
  const numberCounts = new Map();
  for (const customer of parsed.customers) if (Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0) numberCounts.set(customer.customerNumber, (numberCounts.get(customer.customerNumber) ?? 0) + 1);
  const reserved = new Set([...numberCounts].filter(([, count]) => count === 1).map(([number]) => number));
  const storedNext = Number.isSafeInteger(parsed.nextCustomerNumber) && parsed.nextCustomerNumber > 0 ? parsed.nextCustomerNumber : INITIAL_NAMES.length + 1;
  let nextAvailable = Math.max(storedNext, ...reserved, 0);
  const migrationDate = new Date();
  const currentMonth = monthKey(migrationDate);
  const used = new Set();
  const customers = parsed.customers.map((customer, index) => {
    let customerNumber = Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 && numberCounts.get(customer.customerNumber) === 1 ? customer.customerNumber : null;
    if (customerNumber === null) {
      const legacyNumber = index + 1;
      if (!reserved.has(legacyNumber) && !used.has(legacyNumber)) customerNumber = legacyNumber;
      else {
        while (reserved.has(nextAvailable) || used.has(nextAvailable)) nextAvailable++;
        customerNumber = nextAvailable++;
      }
    }
    used.add(customerNumber);
    let bills = (Array.isArray(customer.bills) ? customer.bills : []).map(bill => ({ ...bill, dueDate:checkOptionalDate(bill.dueDate ?? null), amountHistory:Array.isArray(bill.amountHistory) ? bill.amountHistory : [] }));
    const monthlySellingAmount = customer.monthlySellingAmount ?? null;
    let monthlyPriceSchedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
    if (monthlySellingAmount !== null && monthlySellingAmount !== undefined && monthlySellingAmount !== '' && monthlyPriceSchedule.length === 0) {
      const currentBillIndex = bills.findIndex(bill => bill.month === currentMonth);
      let effectiveMonth = currentMonth;
      if (currentBillIndex >= 0) {
        effectiveMonth = nextMonthKey(currentMonth);
        const currentBill = bills[currentBillIndex];
        if (currentBill.dueAmount === null || currentBill.dueAmount === undefined || currentBill.dueAmount === '') bills[currentBillIndex] = { ...currentBill, dueAmount:Number(monthlySellingAmount), generated:true, priceSnapshot:Number(monthlySellingAmount), createdAt:currentBill.createdAt ?? localDateTimeValue(migrationDate), amountHistory:currentBill.amountHistory };
      }
      monthlyPriceSchedule = [{ amount:Number(monthlySellingAmount), effectiveMonth, recordedAt:localDateTimeValue(migrationDate) }];
    }
    return {
      ...customer,
      id:customer.id ?? `saved-${index + 1}`,
      customerNumber,
      addedOn:validDateOrNull(customer.addedOn),
      mohalla:customer.mohalla ?? '',
      zone:customer.zone ?? '',
      address:customer.address ?? '',
      phone:customer.phone ?? '',
      cnic:customer.cnic ?? '',
      ispProvider:customer.ispProvider ?? '',
      serviceStatus:['active','offline','not-set'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set',
      serviceStatusHistory:sanitizeServiceStatusHistory(customer.serviceStatusHistory),
      packageSpeed:customer.packageSpeed ?? '',
      monthlyPurchaseCost:customer.monthlyPurchaseCost ?? null,
      monthlySellingAmount,
      monthlyPriceSchedule,
      billingStartMonth:validMonthString(customer.billingStartMonth) ? customer.billingStartMonth : null,
      connectionDate:validDateOrNull(customer.connectionDate),
      connectionFee:normalizeMoneyOrNull(customer.connectionFee),
      routerModel:typeof customer.routerModel === 'string' ? customer.routerModel.trim().slice(0, 100) : '',
      routerPrice:normalizeMoneyOrNull(customer.routerPrice),
      fiberMeters:normalizeMetersOrNull(customer.fiberMeters),
      // SISP-19: hardware custody fields — safe defaults for legacy records.
      routerOwnership:['isp-owned','customer-owned'].includes(customer.routerOwnership) ? customer.routerOwnership : '',
      mediaConverterOwnership:['isp-owned','customer-owned'].includes(customer.mediaConverterOwnership) ? customer.mediaConverterOwnership : '',
      serialNumber:typeof customer.serialNumber === 'string' ? customer.serialNumber.trim().slice(0, 100) : '',
      securityDeposit:normalizeMoneyOrNull(customer.securityDeposit),
      // SISP-50: a stamped deposit settlement survives reloads; a
      // malformed record sanitizes to null instead of posing as settled.
      depositSettlement:sanitizeDepositSettlement(customer.depositSettlement),
      hardwareRecovered:{
        router:validDateOrNull(customer.hardwareRecovered?.router ?? null),
        mediaConverter:validDateOrNull(customer.hardwareRecovered?.mediaConverter ?? null)
      },
      // SISP-24: optical splitter assignment + last RX reading — old saves
      // without them load as empty / null, never as invented data.
      splitterBoxId:typeof customer.splitterBoxId === 'string' ? customer.splitterBoxId.trim().slice(0, 100) : '',
      splitterPort:Number.isInteger(Number(customer.splitterPort)) && Number(customer.splitterPort) >= 1 && Number(customer.splitterPort) <= 16 ? Number(customer.splitterPort) : null,
      oltPonPort:typeof customer.oltPonPort === 'string' ? customer.oltPonPort.trim().slice(0, 100) : '',
      lastRxDbm:Number.isFinite(Number(customer.lastRxDbm)) && customer.lastRxDbm !== '' && customer.lastRxDbm !== null && customer.lastRxDbm !== undefined ? Math.round(Number(customer.lastRxDbm) * 10) / 10 : null,
      // SISP-92: GPS pin — old saves without it load as a null pair.
      ...sanitizeGpsPair(customer),
      // OWNER-SIGNAL: append-only signal reading history — old saves
      // without it load as an empty history, never invented readings.
      signalReadings:sanitizeSignalReadings(customer.signalReadings),
      // SISP-23: installation cost fields — optional, null when unrecorded.
      mediaConverterCost:normalizeMoneyOrNull(customer.mediaConverterCost),
      linemanInstallFee:normalizeMoneyOrNull(customer.linemanInstallFee),
      fiberPerMeterRate:normalizeMoneyOrNull(customer.fiberPerMeterRate),      expiryDate:validDateOrNull(customer.expiryDate),
      cancellationDate:validDateOrNull(customer.cancellationDate),
      packageHistory:Array.isArray(customer.packageHistory) ? customer.packageHistory : [],
      // Owner default roster (2026-10-29): free connections keep their
      // flag through save/load; legacy records load as not free.
      isFreeConnection:customer.isFreeConnection === true,
      // SISP-84: connection type — legacy records without the field
      // load as 'residential'; only the exact VIP tag survives.
      connectionType:customer.connectionType === 'commercial_vip' ? 'commercial_vip' : 'residential',
      // SISP-76: SMS-first contact preference — legacy records load
      // as WhatsApp-default (false), never as an invented opt-in.
      prefersSms:customer.prefersSms === true,
      // SISP-91: receipt language/channel preferences — legacy records
      // load as unset (null), never as an invented preference. The
      // channel composes with prefersSms at read time through the ONE
      // mapping in receipt-preferences.js (receiptChannelPreference).
      preferredReceiptLang:sanitizeReceiptLang(customer.preferredReceiptLang),
      preferredReceiptChannel:sanitizeReceiptChannel(customer.preferredReceiptChannel),
      archived:customer.archived === true,
      archivedAt:customer.archived === true ? customer.archivedAt ?? null : null,
      // SISP-108: disconnect capture — customers archived before this
      // feature load with NO reason (never invented); the disconnect
      // history survives restores because it is the record of past
      // disconnections, not a property of the current archive.
      disconnectReason:['shifted','competitor','affordability','temporary-travel'].includes(customer.disconnectReason) ? customer.disconnectReason : '',
      winBackEligible:customer.winBackEligible === true,
      disconnectNote:typeof customer.disconnectNote === 'string' ? customer.disconnectNote.trim().slice(0, 500) : '',
      disconnectHistory:sanitizeDisconnectHistory(customer.disconnectHistory),
      winBackOfferSentAt:sanitizeDisconnectDateTime(customer.winBackOfferSentAt),
      // SISP-8: vacation hold — corrupt values fall back to "no hold",
      // so old saves load exactly as before.
      paused:customer.paused === true,
      pauseStartDate:validDateOrNull(customer.pauseStartDate),
      autoResumeDate:validDateOrNull(customer.autoResumeDate),
      pauseSkippedMonths:Array.isArray(customer.pauseSkippedMonths) ? [...new Set(customer.pauseSkippedMonths.filter((month) => validMonthString(month)))].sort() : [],
      // SISP-106: the speed-boost log rides the customer record; legacy
      // saves without it load with an empty log, never invented boosts.
      speedBoosts: sanitizeSpeedBoosts(customer.speedBoosts),
      bills,
      // Owner feature (2026-10-29): manual baqaya entries ride the
      // customer record; legacy saves without the field load as none.
      manualBaqaya:sanitizeManualBaqayaEntries(customer.manualBaqaya),
      incidents:Array.isArray(customer.incidents) ? customer.incidents.map(incident => ({ ...incident, restoredAt:incident.restoredAt || null, note:incident.note ?? '', corrections:Array.isArray(incident.corrections) ? incident.corrections : [] })) : []
    };
  });
  const phase3 = validatePhase3State(parsed);
  const highestNumber = Math.max(0, ...customers.map(customer => customer.customerNumber));
  const monthlyClosings = validateMonthlyClosingSnapshots(parsed.monthlyClosings ?? []);
  return { ...parsed, ...phase3, nextCustomerNumber:Math.max(storedNext, nextAvailable, highestNumber + 1), customers, monthlyClosings };
}

function validDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  try { return checkOptionalDate(value, 'Profile date'); } catch { return null; }
}

// Onboarding economics (connection fee / router / fiber) are optional: an
// unrecorded value stays null (or '' for the router model) and is never
// invented. Normalization only cleans corrupt saved values.
function normalizeMoneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}
function normalizeMetersOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 10) / 10;
}

export function persistState(state, storage, key = STORAGE_KEY) {
  storage.setItem(key, JSON.stringify(state));
}

export function monthsForHistory(referenceDate = new Date()) {
  const current = monthKey(referenceDate);
  return Array.from({ length:MONTH_LIMIT }, (_, i) => shiftMonth(current, -i));
}

/** Derive the following cycle's fifth from the bill period, never the payment date. */
export function nextCycleDueDateFromBillMonth(month) {
  if (!validMonthString(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  if (year < 1 || (year === 9999 && monthNumber === 12)) return null;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-05`;
}

/**
 * Generate one immutable bill snapshot for each missing retained month on or after
 * the customer's saved price-effective month. Runs locally when the app opens,
 * resumes, or is active across a month boundary; it never infers earlier months.
 */
export function generateMonthlyBillsThroughCurrentMonth(state, referenceDate = new Date()) {
  const months = monthsForHistory(referenceDate).reverse();
  let changed = false;
  const customers = state.customers.map(customer => {
    if (customer.archived) return customer;
    // Owner rule (2026-10-29): a free connection never gets a bill —
    // no monthly fee, no pending amount, ever.
    if (customer.isFreeConnection) return customer;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const existingMonths = new Set(bills.map(bill => bill.month));
    const schedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
    const generated = [];
    let skippedMonths = null;
    for (const month of months) {
      if (validMonthString(customer.billingStartMonth) && month < customer.billingStartMonth) continue;
      if (existingMonths.has(month)) continue;
      // SISP-8: a billing-paused month gets no bill, and the month is
      // recorded as skipped so it is never backfilled after resume —
      // a frozen customer is never double-billed when service resumes.
      if (isBillingPaused(customer, month)) {
        const current = sanitizePauseFields(customer).pauseSkippedMonths;
        if (!current.includes(month)) {
          skippedMonths = skippedMonths ?? [...current];
          if (!skippedMonths.includes(month)) skippedMonths.push(month);
        }
        continue;
      }
      const applicable = schedule.filter(entry => typeof entry.effectiveMonth === 'string' && entry.effectiveMonth <= month).sort((a,b) => a.effectiveMonth.localeCompare(b.effectiveMonth)).at(-1);
      const amount = applicable?.amount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) continue;
      const snapshot = Number(amount);
      generated.push({ id:makeId(), month, dueAmount:snapshot, dueDate:`${month}-05`, status:'pending', payments:[], generated:true, priceSnapshot:snapshot, createdAt:localDateTimeValue(referenceDate), amountHistory:[] });
      existingMonths.add(month);
    }
    if (!generated.length && !skippedMonths) return customer;
    changed = true;
    const next = { ...customer, bills:[...bills, ...generated].sort((a,b) => b.month.localeCompare(a.month)) };
    if (skippedMonths) next.pauseSkippedMonths = [...skippedMonths].sort();
    return next;
  });
  return changed ? { ...state, customers } : state;
}

// SISP-118: digit-shape check mirroring normalizePakistaniWhatsAppPhone
// (form-validation.js) — core.js cannot import that module (it imports
// core), so the acceptance rules are restated here and the SISP-118 test
// cross-checks this helper against the real normalizer on a battery of
// numbers so the two can never silently drift apart.
function usableWhatsAppDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return false;
  if (digits.startsWith('0092')) return digits.length === 14 && digits.slice(2).startsWith('923');
  if (digits.startsWith('92')) return digits.length === 12 && digits.startsWith('923');
  if (digits.startsWith('03')) return digits.length === 11;
  if (digits.startsWith('3')) return digits.length === 10;
  return digits.length >= 10 && digits.length <= 15 && !digits.startsWith('0');
}

/**
 * SISP-118: the ONE WhatsApp-number resolution seam. Every wa.me draft
 * addressed to a customer (receipts, reminders, Waada follow-ups, outage
 * alerts, Quick Collect / Field Mode receipt drafts) resolves its target
 * through here: the customer's dedicated WhatsApp number wins when it is
 * a usable WhatsApp number; an unusable WhatsApp number falls back to
 * the primary phone so a draft is never aimed at a broken number; when
 * neither is usable the preferred raw value is returned and each
 * surface's existing formatter reports it invalid exactly as before.
 * Voice calls never use this — they dial the primary (and alternate)
 * numbers via contactActionTargets.
 */
export function whatsappPhoneFor(customer) {
  const whatsapp = String(customer?.whatsappPhone ?? '').trim();
  const primary = String(customer?.phone ?? '').trim();
  if (whatsapp && usableWhatsAppDigits(whatsapp)) return whatsapp;
  if (primary && usableWhatsAppDigits(primary)) return primary;
  return whatsapp || primary;
}

export function addCustomer(state, name, referenceDate = new Date(), options = {}) {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) throw new Error('Enter a customer name.');
  if (!options.allowDuplicateName && state.customers.some(c => c.name.localeCompare(cleaned, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('That customer is already in the list.');
  const cleanText = (value, maxLength, label) => {
    const result = String(value ?? '').trim();
    if (result.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return result;
  };
  const address = cleanText(options.address, 200, 'Address');
  const phone = cleanText(options.phone, 40, 'Phone number');
  // SISP-118: optional separate WhatsApp + alternate voice numbers.
  const whatsappPhone = cleanText(options.whatsappPhone, 40, 'WhatsApp number');
  const alternatePhone = cleanText(options.alternatePhone, 40, 'Alternate phone number');
  const cnic = cleanText(options.cnic, 30, 'CNIC');
  const mohallaRaw = cleanText(options.mohalla, 100, 'Mohalla');
  const mohalla = canonicalMohalla(mohallaRaw)?.stored ?? mohallaRaw;
  const zone = cleanText(options.zone, 100, 'Zone');
  const connectionFee = checkCost(options.connectionFee);
  const routerModel = cleanText(options.routerModel, 100, 'Router model');
  const routerPrice = checkCost(options.routerPrice);
  const fiberMeters = checkFiberMeters(options.fiberMeters);
  // SISP-19: custody fields — ownership enum validated, deposit is money.
  const routerOwnership = checkCustodyOwnership(options.routerOwnership);
  const mediaConverterOwnership = checkCustodyOwnership(options.mediaConverterOwnership);
  const serialNumber = cleanText(options.serialNumber, 100, 'Serial / MAC number');
  const securityDeposit = checkCost(options.securityDeposit);
  // SISP-24: optical splitter assignment + last RX reading (all optional).
  const splitterBoxId = cleanText(options.splitterBoxId, 100, 'Splitter box');
  const splitterPort = checkSplitterPort(options.splitterPort);
  const oltPonPort = cleanText(options.oltPonPort, 100, 'PON port');
  const lastRxDbm = checkRxDbm(options.lastRxDbm);
  // SISP-92: GPS pin (optional pair; absent reads back as nulls).
  const { gpsLat, gpsLng } = checkGpsPair(options.gpsLat, options.gpsLng);
  // SISP-32: pole & landmark directory (all optional).
  const poleNumber = cleanText(options.poleNumber, 100, 'Pole / landmark');
  const boxLocationNote = cleanText(options.boxLocationNote, 200, 'Box location note');
  const dropWireCoreColor = cleanText(options.dropWireCoreColor, 100, 'Drop wire color');
  const mediaConverterCost = checkCost(options.mediaConverterCost);
  const linemanInstallFee = checkCost(options.linemanInstallFee);
  const fiberPerMeterRate = checkCost(options.fiberPerMeterRate);  const nameUrdu = cleanText(options.nameUrdu, 100, 'Urdu name');
  const pppoeUsername = cleanText(options.pppoeUsername, 100, 'PPPoE username');
  const pppoePassword = cleanText(options.pppoePassword, 100, 'PPPoE password');
  const staticIp = cleanText(options.staticIp, 45, 'Static IP');
  const macAddress = cleanText(options.macAddress, 20, 'MAC address');
  // SISP-94: router credential vault — the Wi-Fi/admin credentials the
  // ISP itself set on the customer's router (all optional).
  const wifiSsid = cleanText(options.wifiSsid, 64, 'Wi-Fi SSID');
  const wifiPassword = cleanText(options.wifiPassword, 100, 'Wi-Fi password');
  const routerAdminPort = checkAdminPort(options.routerAdminPort);
  const routerAdminPassword = cleanText(options.routerAdminPassword, 100, 'Router admin password');
  // SISP-74: a brand-new record may not take a PPPoE username / static IP
  // that an active customer already holds (see findIdentityConflicts).
  assertNoBlockingIdentityConflicts(state.customers, { pppoeUsername, staticIp, macAddress, serialNumber });
  // SISP-40: hamsaya referral link — the existing customer who brought
  // this one. Validated against the live list so a stored link always
  // points at a real record (a dangling id would queue credit for nobody).
  const referredByRaw = cleanText(options.referredByCustomerId, 100, 'Referrer');
  let referredByCustomerId = null;
  if (referredByRaw) {
    const referrer = state.customers.find(c => c.id === referredByRaw);
    if (!referrer) throw new Error('Referrer not found — pick an existing customer as the referrer.');
    referredByCustomerId = referrer.id;
  }
  const usedNumbers = new Set(state.customers.map(customer => customer.customerNumber).filter(Number.isSafeInteger));
  // SISP-53: a bulk import may ask for the register's own Connection ID. It
  // is honoured only when free; a taken number throws so the duplicate guard
  // can never silently re-number or overwrite an existing customer.
  const requested = Number.isSafeInteger(options.requestedCustomerNumber) && options.requestedCustomerNumber > 0
    ? options.requestedCustomerNumber : null;
  if (requested !== null && usedNumbers.has(requested)) throw new Error(`Connection ID #${requested} is already in use.`);
  let customerNumber = requested;
  if (customerNumber === null) {
    customerNumber = Math.max(state.nextCustomerNumber ?? 1, ...usedNumbers, 0);
    while (usedNumbers.has(customerNumber)) customerNumber++;
  }
  const nextCustomerNumber = requested !== null
    ? Math.max(state.nextCustomerNumber ?? 1, customerNumber + 1)
    : customerNumber + 1;
  // Uptime tracking: a customer created already Active or Offline gets
  // the first stamp of its service-status history at creation time, so
  // an offline span can accrue from day one.
  // SISP-91: optional receipt language/channel preferences. An explicit
  // channel composes the SISP-76 prefersSms flag through the ONE mapping
  // in receipt-preferences.js (prefersSmsForChannel).
  const preferredReceiptLang = sanitizeReceiptLang(options.preferredReceiptLang);
  const preferredReceiptChannel = sanitizeReceiptChannel(options.preferredReceiptChannel);
  const initialServiceStatus = ['active','offline','not-set'].includes(options.serviceStatus) ? options.serviceStatus : 'not-set';
  const initialStatusHistory = initialServiceStatus === 'not-set' ? [] : [{ status: initialServiceStatus, at: localDateTimeValue(referenceDate) }];
  return { ...state, nextCustomerNumber, customers: [...state.customers, { id: makeId(), customerNumber, name: cleaned, addedOn:dateKey(referenceDate), mohalla, zone, address, phone, whatsappPhone, alternatePhone, cnic, ispProvider:'', serviceStatus:initialServiceStatus, serviceStatusHistory:initialStatusHistory, packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], billingStartMonth:null, connectionDate:null, connectionFee, routerModel, routerPrice, fiberMeters, mediaConverterCost, linemanInstallFee, fiberPerMeterRate, routerOwnership, mediaConverterOwnership, serialNumber, securityDeposit, depositSettlement:null, hardwareRecovered:{ router:null, mediaConverter:null }, splitterBoxId, splitterPort, oltPonPort, lastRxDbm, gpsLat, gpsLng, poleNumber, boxLocationNote, dropWireCoreColor, nameUrdu, pppoeUsername, pppoePassword, staticIp, macAddress, wifiSsid, wifiPassword, routerAdminPort, routerAdminPassword, referredByCustomerId, expiryDate:null, cancellationDate:null, packageHistory:[], relocationLog:[], isFreeConnection:options.isFreeConnection === true, connectionType:options.connectionType === 'commercial_vip' ? 'commercial_vip' : 'residential', prefersSms:prefersSmsForChannel(preferredReceiptChannel, options.prefersSms === true), preferredReceiptLang, preferredReceiptChannel, archived:false, archivedAt:null, disconnectReason:'', winBackEligible:false, disconnectNote:'', disconnectHistory:[], winBackOfferSentAt:null, paused:false, pauseStartDate:null, autoResumeDate:null, pauseSkippedMonths:[], bills: [], manualBaqaya: [], incidents: [], installmentPlans: [] }] };}
// ---------------------------------------------------------------------------
// SISP-74: network-identity conflict guard + identity search.
//
// Four stored identifiers single out a customer's network identity: the
// PPPoE username and static IP feed the MikroTik RouterOS export
// (mikrotik-generator.js — a duplicate PPPoE secret or a duplicate IP /
// ARP / queue target produces a broken router config), and the MAC
// address plus the SISP-19 custody "Serial / MAC number" identify the
// physical router/converter at the customer's house.
//
// Severity is chosen per field risk:
//   - pppoeUsername, staticIp -> BLOCK. A save that newly assigns one of
//     these while another ACTIVE (non-archived) customer holds it throws,
//     naming the holder (assertNoBlockingIdentityConflicts, called by
//     addCustomer and updateCustomerProfile).
//   - macAddress, serialNumber -> WARN. Duplicates can be legitimate
//     record-keeping (a swapped router not yet re-registered, a shared
//     placeholder MAC), so core never throws for them; the profile save
//     flow asks the operator with findIdentityConflicts + an explicit
//     "Save anyway" confirm before writing.
//
// A customer never conflicts with itself, archived customers never block
// or warn (their identifiers are free again), blank values never
// conflict, and — on update — a value the record already had is not a new
// assignment, so pre-guard duplicates never freeze unrelated edits.
// ---------------------------------------------------------------------------
const IDENTITY_FIELD_DEFS = Object.freeze([
  { field: 'pppoeUsername', label: 'PPPoE username', severity: 'block' },
  { field: 'staticIp', label: 'Static IP', severity: 'block' },
  { field: 'macAddress', label: 'MAC address', severity: 'warn' },
  { field: 'serialNumber', label: 'Serial / MAC number', severity: 'warn' }
]);

/**
 * Canonical form of one identity value for duplicate comparison, using the
 * house NFKC + trim normalization (SISP-31 / Feature-1 search): usernames
 * and IPs compare case-insensitively, MACs compare as bare hex (so
 * "AA:BB:CC:DD:EE:FF", "aa-bb-cc-dd-ee-ff" and "aabb.ccdd.eeff" are the
 * same address), and serials compare with spaces/dashes removed and case
 * folded (a serial typed with different separators is the same device).
 */
export function normalizeIdentityValue(field, value) {
  const text = String(value ?? '').normalize('NFKC').trim();
  if (!text) return '';
  if (field === 'macAddress') return text.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (field === 'serialNumber') return text.replace(/[\s-]+/g, '').toUpperCase();
  return text.toLocaleLowerCase();
}

/**
 * Every identity conflict a candidate assignment would create: one entry
 * per field (the first active holder found), each naming the holder.
 * `excludeCustomerId` is the record being saved (it never conflicts with
 * itself); `previous` (the record's stored values before this save) makes
 * unchanged values skip the check — only NEW assignments are guarded.
 */
export function findIdentityConflicts(customers, candidate = {}, { excludeCustomerId = null, previous = null } = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const conflicts = [];
  for (const def of IDENTITY_FIELD_DEFS) {
    const wanted = normalizeIdentityValue(def.field, candidate?.[def.field]);
    if (!wanted) continue;
    if (previous && normalizeIdentityValue(def.field, previous[def.field]) === wanted) continue;
    for (const other of list) {
      if (!other || other.archived) continue;
      if (excludeCustomerId !== null && excludeCustomerId !== undefined && other.id === excludeCustomerId) continue;
      if (normalizeIdentityValue(def.field, other[def.field]) !== wanted) continue;
      conflicts.push({
        field: def.field,
        label: def.label,
        severity: def.severity,
        value: String(candidate[def.field]).trim(),
        customerId: other.id,
        customerNumber: other.customerNumber ?? null,
        customerName: other.name ?? ''
      });
      break;
    }
  }
  return conflicts;
}

/** Throws (naming the holder) when a candidate assignment hard-conflicts. */
function assertNoBlockingIdentityConflicts(customers, candidate, options = {}) {
  const blocking = findIdentityConflicts(customers, candidate, options).filter(conflict => conflict.severity === 'block');
  if (!blocking.length) return;
  const conflict = blocking[0];
  throw new Error(`${conflict.label} "${conflict.value}" is already assigned to ${conflict.customerName} (#${conflict.customerNumber}). PPPoE usernames and static IPs must be unique among active customers — change the ${conflict.label} before saving.`);
}

/**
 * Search side of SISP-74: does the query match the customer's PPPoE
 * username, static IP, MAC address or router serial? Substring matching
 * (exact + partial, house style) plus a separator-insensitive MAC path —
 * typing "aabbcc" finds a MAC stored as "AA:BB:CC:DD:EE:FF".
 */
export function identitySearchMatches(customer, query) {
  const normalized = String(query ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!normalized || !customer) return false;
  const values = [customer.pppoeUsername, customer.staticIp, customer.macAddress, customer.serialNumber];
  if (values.some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(normalized))) return true;
  const hexQuery = normalized.replace(/[^0-9a-f]/g, '');
  if (hexQuery.length < 4) return false;
  return [customer.macAddress, customer.serialNumber].some(value => {
    const hex = String(value ?? '').replace(/[^0-9a-f]/gi, '').toLocaleLowerCase();
    return hex.length >= 4 && hex.includes(hexQuery);
  });
}

function customerMatchesQuery(customer, query, allocations = null) {
  const normalized = String(query ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const phoneValues = [customer.phone, customer.customerPhone];
  const cnicValues = [customer.cnic, customer.customerCnic];
  const fields = [customer.name, ...phoneValues, ...cnicValues, customer.address, customer.customerAddress, customer.customerNumber, customer.id]
    .map(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase());
  if (fields.some(value => value.includes(normalized))) return true;
  // SISP-74: global search also matches the network identifiers (PPPoE
  // username, static IP, MAC, router serial), incl. separator-free MACs.
  if (identitySearchMatches(customer, normalized)) return true;
  const digitsQuery = normalized.replace(/\D/g, '');
  if (/^[+\d\s().-]+$/.test(normalized) && digitsQuery.length >= 3 && phoneValues.some(value => String(value ?? '').replace(/\D/g, '').includes(digitsQuery))) return true;
  if (digitsQuery.length >= 4 && cnicValues.some(value => String(value ?? '').replace(/\D/g, '').includes(digitsQuery))) return true;
  const numberQuery = normalized.replace(/^#\s*/, '').trim();
  if (/^\d+$/.test(numberQuery) && String(customer.customerNumber ?? '').includes(numberQuery)) return true;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  if (!bills.length) return false;
  const ledgerAllocations = allocations ?? calculatePaymentAllocations({ customers:[customer] });
  const ledgerFields = [];
  for (const bill of bills) {
    const status = derivedBillStatus(customer, bill, ledgerAllocations);
    const summary = ledgerAllocations.forMonth?.(customer.id, bill.month);
    const billAmount = bill.dueAmount;
    const received = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = summary?.balanceDueCents === null || summary?.balanceDueCents === undefined ? null : summary.balanceDueCents / 100;
    ledgerFields.push(bill.month, bill.id, status, billAmount, received, balance);
    for (const amount of [billAmount, received, balance]) if (amount !== null && amount !== undefined && amount !== '') ledgerFields.push(formatPKR(amount));
    for (const payment of bill.payments ?? []) ledgerFields.push(payment.id, payment.date, payment.method, payment.paidBy, payment.amount, formatPKR(payment.amount));
  }
  return ledgerFields.some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(normalized));
}

function transactionMatchesQuery(row, query) {
  const normalized = String(query ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const fields = [row.customerName, row.customerNumber, row.customerPhone, row.customerAddress, row.month, row.date, row.method, row.paidBy, row.status, row.paymentId, row.amount, formatPKR(row.amount), `#${row.customerNumber}`];
  return customerMatchesQuery({ name:row.customerName, customerNumber:row.customerNumber, customerPhone:row.customerPhone, customerAddress:row.customerAddress }, normalized)
    || fields.some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(normalized));
}

export function searchCustomers(state, query = '') {
  if (!String(query ?? '').normalize('NFKC').trim()) return state.customers.slice();
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => customerMatchesQuery(customer, query, allocations));
}

export function derivedBillStatus(customer, bill, allocations = null) {
  if (!bill) return 'not-set';
  const amount = bill.dueAmount;
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'not-set';
  const result = allocations ?? calculatePaymentAllocations({ customers:[customer] });
  const summary = result.forMonth?.(customer.id, bill.month) ?? result.byCustomerMonth?.get(monthAllocationKey(customer.id, bill.month));
  if (!summary || summary.balanceDueCents === null || summary.balanceDueCents === undefined) return 'not-set';
  if (summary.balanceDueCents <= 0) return 'paid';
  return summary.sameMonthAppliedCents > 0 || summary.creditAppliedCents > 0 || (summary.discountAppliedCents || 0) > 0 ? 'partial' : 'pending';
}

export function buildPayrollSummary(state, month, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const allocations = calculatePaymentAllocations(state);
  const eligibleCustomers = state.customers.filter(customer => {
    if (!customer.addedOn || customer.addedOn <= PAYROLL_RULES_EFFECTIVE_DATE || customer.addedOn > monthEnd(month)) return false;
    if (customer.archived || customer.serviceStatus !== 'active') return false;
    const bill = (customer.bills ?? []).find(item => item.month === month);
    return derivedBillStatus(customer, bill, allocations) === 'paid';
  });
  const manual = buildManualPayrollSummary(state, month);
  const saadMonthlyIncrement = eligibleCustomers.length * SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY;
  return {...manual,eligibleActivePaidCustomerCount:eligibleCustomers.length,eligibleCustomers:eligibleCustomers.map(customer=>({id:customer.id,customerNumber:customer.customerNumber,name:customer.name})),
    saadBaseMonthlySalary:SAAD_BASE_MONTHLY_SALARY,saadMonthlyIncrement,saadMonthlySalary:SAAD_BASE_MONTHLY_SALARY+saadMonthlyIncrement};
}

export function filterCustomersByStatus(state, { serviceStatus = 'all', billingStatus = 'all', month = monthsForHistory()[0], customerQuery = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (!['all','active','offline','not-set'].includes(serviceStatus)) throw new Error('Choose All, Active, Offline, or Not set for service status.');
  if (!['all','paid','pending','partial','not-set'].includes(billingStatus)) throw new Error('Choose All, Paid, Pending, Partial, or Not set for billing status.');
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => {
    if (!customerMatchesQuery(customer, customerQuery, allocations)) return false;
    if (serviceStatus !== 'all' && (customer.serviceStatus ?? 'not-set') !== serviceStatus) return false;
    if (billingStatus === 'all') return true;
    const bill = (customer.bills ?? []).find(item => item.month === month);
    return derivedBillStatus(customer, bill, allocations) === billingStatus;
  });
}

export function deleteCustomer(state, customerId) {
  return { ...state, customers: state.customers.filter(c => c.id !== customerId) };
}

export function archiveCustomer(state, customerId, referenceDate = new Date(), disconnectDetails = null) {
  customerOrThrow(state, customerId);
  return { ...state, customers:state.customers.map(customer => {
    if (customer.id !== customerId) return customer;
    const archivedAt = localDateTimeValue(referenceDate);
    // SISP-108: without capture details this is exactly the pre-SISP-108
    // behaviour. With details (the archive dialog always passes them),
    // the capture is stamped as the current disconnect record, appended
    // to the disconnect history, and any earlier win-back offer stamp is
    // cleared — the offer for THIS disconnect has not been sent yet.
    if (disconnectDetails === null || disconnectDetails === undefined) return { ...customer, archived:true, archivedAt };
    const details = sanitizeDisconnectDetails(disconnectDetails);
    const disconnectHistory = [...sanitizeDisconnectHistory(customer.disconnectHistory), { archivedAt, ...details }].slice(-DISCONNECT_HISTORY_LIMIT);
    return { ...customer, archived:true, archivedAt, disconnectReason:details.disconnectReason, winBackEligible:details.winBackEligible, disconnectNote:details.disconnectNote, disconnectHistory, winBackOfferSentAt:null };
  }) };
}

// SISP-108: stamp that the win-back reconnection offer was sent (the
// wa.me draft was opened). The customer stays in the Win-Back Queue —
// only an actual restore/reconnect removes them.
export function recordWinBackOfferSent(state, customerId, referenceDate = new Date()) {
  customerOrThrow(state, customerId);
  return { ...state, customers:state.customers.map(customer => customer.id === customerId ? { ...customer, winBackOfferSentAt:localDateTimeValue(referenceDate) } : customer) };
}

export function unarchiveCustomer(state, customerId, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  if (!customer.archived) return state;
  const currentMonth = monthKey(referenceDate);
  let monthlyPriceSchedule = [...(customer.monthlyPriceSchedule ?? [])];
  if (customer.monthlySellingAmount !== null && customer.monthlySellingAmount !== undefined && customer.monthlySellingAmount !== '') {
    const effectiveMonth = (customer.bills ?? []).some(bill => bill.month === currentMonth) ? nextMonthKey(currentMonth) : currentMonth;
    monthlyPriceSchedule = [...monthlyPriceSchedule.filter(entry => entry.effectiveMonth !== effectiveMonth), { amount:Number(customer.monthlySellingAmount), effectiveMonth, recordedAt:localDateTimeValue(referenceDate) }];
  }
  return { ...state, customers:state.customers.map(item => item.id === customerId ? { ...item, archived:false, archivedAt:null, billingStartMonth:currentMonth, monthlyPriceSchedule } : item) };
}

export function updateMohalla(state, customerId, mohalla) {
  return { ...state, customers: state.customers.map(c => c.id === customerId ? { ...c, mohalla: String(mohalla ?? '').trim() } : c) };
}

function checkMonth(month, referenceDate) {
  if (!monthsForHistory(referenceDate).includes(month)) throw new Error(`Choose a month within the last ${MONTH_LIMIT} months.`);
}
function checkPositiveAmount(value, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be greater than zero.');
  return Math.round(number * 100) / 100;
}
function checkPaymentAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be greater than zero.');
  const cents = Math.round(number * 100);
  const normalizedAmount = cents / 100;
  if (!Number.isSafeInteger(cents) || cents < 1 || number !== normalizedAmount) {
    throw new Error('Payment amount must be at least PKR 0.01, use no more than two decimal places, and fit safely in cents.');
  }
  return normalizedAmount;
}
function checkCost(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Monthly purchase cost cannot be negative.');
  return Math.round(number * 100) / 100;
}
function checkFiberMeters(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Fiber wire used cannot be negative.');
  return Math.round(number * 10) / 10;
}
// SISP-24: splitter port is a 1-based PLC port (1:8 or 1:16 box).
function checkSplitterPort(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 16) throw new Error('Splitter port must be between 1 and 16.');
  return number;
}
// SISP-24: optical RX power in dBm (negative; -26.0 dBm is the weak-signal line).
function checkRxDbm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -60 || number > 10) throw new Error('Optical RX signal must be between -60 and 10 dBm.');
  return Math.round(number * 10) / 10;
}
// SISP-94: the customer router's remote-admin port (e.g. 8080) — a TCP
// port number or nothing; anything else is a typo, not user data.
function checkAdminPort(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error('Router admin port must be between 1 and 65535.');
  return number;
}
// SISP-92: GPS pin coordinates (WGS84 degrees). A pin is a PAIR: both
// empty clears / omits the pin; a lone latitude or longitude is a caller
// bug, never half a location. Coordinates round to 6 decimals (~0.1 m),
// which is all a phone GPS fix can honestly claim.
function checkGpsPair(latValue, lngValue) {
  const latEmpty = latValue === '' || latValue === null || latValue === undefined;
  const lngEmpty = lngValue === '' || lngValue === null || lngValue === undefined;
  if (latEmpty && lngEmpty) return { gpsLat: null, gpsLng: null };
  if (latEmpty !== lngEmpty) throw new Error('GPS pin needs both latitude and longitude.');
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('GPS latitude must be between -90 and 90.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('GPS longitude must be between -180 and 180.');
  return { gpsLat: Math.round(lat * 1e6) / 1e6, gpsLng: Math.round(lng * 1e6) / 1e6 };
}
function checkServiceStatus(value) {
  if (!['active','offline','not-set'].includes(value)) throw new Error('Choose Active, Offline, or Not set for manual service status.');
  return value;
}
// SISP-84: connection type — 'residential' (default) or 'commercial_vip'
// (commercial / plaza SLA tag, see commercial-sla.js). An unknown value
// coerces to 'residential' rather than blocking an unrelated save, so a
// corrupt or legacy value can never lock the profile form.
function checkConnectionType(value) {
  return value === 'commercial_vip' ? 'commercial_vip' : 'residential';
}
// SISP-19: custody ownership — '' (not recorded), ISP-owned returnable,
// or customer-purchased. Anything else is a caller bug, not user data.
function checkCustodyOwnership(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value !== 'isp-owned' && value !== 'customer-owned') throw new Error('Choose ISP Owned — Returnable, Customer Purchased, or Not recorded for hardware ownership.');
  return value;
}
function checkOptionalDate(value, label = 'Due date') {
  if (value === '' || value === null || value === undefined) return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  return date;
}
function customerOrThrow(state, customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  return customer;
}

export function updateCustomerProfile(state, customerId, values = {}, referenceDate = new Date()) {
  const current = customerOrThrow(state, customerId);
  const valueOrCurrent = key => Object.hasOwn(values, key) ? values[key] : current[key];
  const cleanText = (value, maxLength, label) => {
    const cleaned = String(value ?? '').trim();
    if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return cleaned;
  };
  const mohallaRaw = cleanText(valueOrCurrent('mohalla') ?? '', 100, 'Mohalla');
  const fields = {
    mohalla: canonicalMohalla(mohallaRaw)?.stored ?? mohallaRaw,
    zone: cleanText(valueOrCurrent('zone') ?? '', 100, 'Zone'),
    address: cleanText(valueOrCurrent('address') ?? '', 200, 'Address'),
    notes: cleanText(valueOrCurrent('notes') ?? '', 1000, 'Customer notes'),
    phone: cleanText(valueOrCurrent('phone') ?? '', 40, 'Phone number'),
    // SISP-118: optional separate WhatsApp + alternate voice numbers
    // (absent on older records, which read back as empty).
    whatsappPhone: cleanText(valueOrCurrent('whatsappPhone') ?? '', 40, 'WhatsApp number'),
    alternatePhone: cleanText(valueOrCurrent('alternatePhone') ?? '', 40, 'Alternate phone number'),
    cnic: cleanText(valueOrCurrent('cnic') ?? '', 30, 'CNIC'),
    ispProvider: cleanText(valueOrCurrent('ispProvider') ?? '', 100, 'ISP/provider name'),
    serviceStatus: checkServiceStatus(valueOrCurrent('serviceStatus') ?? 'not-set'),
    // SISP-84: connection type (residential / commercial_vip SLA tag).
    connectionType: checkConnectionType(valueOrCurrent('connectionType')),
    packageSpeed: cleanText(valueOrCurrent('packageSpeed') ?? '', 80, 'Package/speed'),
    monthlyPurchaseCost: checkCost(valueOrCurrent('monthlyPurchaseCost')),
    monthlySellingAmount: checkPositiveAmount(valueOrCurrent('monthlySellingAmount'), true),
    connectionDate: checkOptionalDate(valueOrCurrent('connectionDate'), 'Connection date'),
    connectionFee: checkCost(valueOrCurrent('connectionFee')),
    // SISP-24: optical splitter assignment + last RX reading (optional;
    // absent on pre-SISP-24 records, which read back as empty / null).
    splitterBoxId: cleanText(valueOrCurrent('splitterBoxId') ?? '', 100, 'Splitter box'),
    splitterPort: checkSplitterPort(valueOrCurrent('splitterPort')),
    oltPonPort: cleanText(valueOrCurrent('oltPonPort') ?? '', 100, 'OLT PON port'),
    lastRxDbm: checkRxDbm(valueOrCurrent('lastRxDbm')),
    // SISP-92: GPS pin (pair-validated; passing both empty clears it,
    // omitting both keeps the saved pin via valueOrCurrent).
    ...checkGpsPair(valueOrCurrent('gpsLat'), valueOrCurrent('gpsLng')),
    // SISP-32: pole & landmark directory (optional; absent on older
    // records, which read back as empty).
    poleNumber: cleanText(valueOrCurrent('poleNumber') ?? '', 100, 'Pole / landmark'),
    boxLocationNote: cleanText(valueOrCurrent('boxLocationNote') ?? '', 200, 'Box location note'),
    dropWireCoreColor: cleanText(valueOrCurrent('dropWireCoreColor') ?? '', 100, 'Drop wire color'),
    routerModel: cleanText(valueOrCurrent('routerModel') ?? '', 100, 'Router model'),
    routerPrice: checkCost(valueOrCurrent('routerPrice')),
    fiberMeters: checkFiberMeters(valueOrCurrent('fiberMeters')),
    // SISP-19: custody fields edited on the profile form. Recovery dates
    // are NOT edited here — they are set only by the mark-recovered action
    // (hardware-custody.js), so a profile save can never fake a recovery.
    routerOwnership: checkCustodyOwnership(valueOrCurrent('routerOwnership')),
    mediaConverterOwnership: checkCustodyOwnership(valueOrCurrent('mediaConverterOwnership')),
    serialNumber: cleanText(valueOrCurrent('serialNumber') ?? '', 100, 'Serial / MAC number'),
    securityDeposit: checkCost(valueOrCurrent('securityDeposit')),
    mediaConverterCost: checkCost(valueOrCurrent('mediaConverterCost')),
    linemanInstallFee: checkCost(valueOrCurrent('linemanInstallFee')),
    fiberPerMeterRate: checkCost(valueOrCurrent('fiberPerMeterRate')),    nameUrdu: cleanText(valueOrCurrent('nameUrdu') ?? '', 100, 'Urdu name'),
    pppoeUsername: cleanText(valueOrCurrent('pppoeUsername') ?? '', 100, 'PPPoE username'),
    pppoePassword: cleanText(valueOrCurrent('pppoePassword') ?? '', 100, 'PPPoE password'),
    staticIp: cleanText(valueOrCurrent('staticIp') ?? '', 45, 'Static IP'),
    macAddress: cleanText(valueOrCurrent('macAddress') ?? '', 20, 'MAC address'),
    // SISP-94: router credential vault fields, edited on the profile form.
    wifiSsid: cleanText(valueOrCurrent('wifiSsid') ?? '', 64, 'Wi-Fi SSID'),
    wifiPassword: cleanText(valueOrCurrent('wifiPassword') ?? '', 100, 'Wi-Fi password'),
    routerAdminPort: checkAdminPort(valueOrCurrent('routerAdminPort')),
    routerAdminPassword: cleanText(valueOrCurrent('routerAdminPassword') ?? '', 100, 'Router admin password'),
    expiryDate: checkOptionalDate(valueOrCurrent('expiryDate'), 'Expiry date'),
    cancellationDate: checkOptionalDate(valueOrCurrent('cancellationDate'), 'Cancellation date'),
    // SISP-7: feeder link — whose converter/switch feeds this customer, and
    // which feeder zone (Side 1 to Side 4c) the drop belongs to. An unknown
    // zone value coerces to '' rather than blocking an unrelated save.
    upstreamCustomerId: cleanText(valueOrCurrent('upstreamCustomerId') ?? '', 100, 'Upstream customer'),
    fiberZone: normalizeFiberZone(valueOrCurrent('fiberZone') ?? ''),
    // SISP-97: monthly feeder-host bijli credit (PKR) configured on an
    // upstream host house. Sanitized here; the eligibility guard below
    // zeroes it when the house feeds no active downstream home.
    feederHostCreditPKR: sanitizeFeederHostCreditPKR(valueOrCurrent('feederHostCreditPKR')),
    // SISP-76: contact preference edited on the profile form.
    prefersSms: valueOrCurrent('prefersSms') === true,
    // SISP-91: receipt language/channel preferences edited on the same
    // form (optional; unset/corrupt values store as null).
    preferredReceiptLang: sanitizeReceiptLang(valueOrCurrent('preferredReceiptLang')),
    preferredReceiptChannel: sanitizeReceiptChannel(valueOrCurrent('preferredReceiptChannel')),
    paused: valueOrCurrent('paused') === true,
    pauseStartDate: checkOptionalDate(valueOrCurrent('pauseStartDate'), 'Pause start date'),
    autoResumeDate: checkOptionalDate(valueOrCurrent('autoResumeDate'), 'Auto-resume date')
  };
  // SISP-91: a save that SETS an explicit receipt channel rewrites the
  // SISP-76 prefersSms flag from it ('sms' -> true, any other channel
  // -> false), so the stored boolean and the stored channel can never
  // disagree (the ONE mapping in receipt-preferences.js). A save that
  // does not mention the channel leaves prefersSms exactly as edited,
  // so the legacy SISP-76 checkbox path is untouched.
  if (Object.hasOwn(values, 'preferredReceiptChannel') && fields.preferredReceiptChannel) {
    fields.prefersSms = fields.preferredReceiptChannel === 'sms';
  }
  // SISP-74: hard-block a save that newly assigns a PPPoE username or
  // static IP already held by another active customer. Values the record
  // already had (previous === current) are not re-blocked, so legacy
  // duplicates never freeze unrelated edits; MAC / serial duplicates are
  // warnings surfaced by the caller (findIdentityConflicts), never throws.
  assertNoBlockingIdentityConflicts(state.customers, fields, { excludeCustomerId: customerId, previous: current });
  // SISP-7: a feeder link must point at a real customer, never at itself,
  // and never close a cycle back to this customer.
  const feederLinkError = validateUpstreamLink(state.customers, customerId, fields.upstreamCustomerId);
  if (feederLinkError) throw new Error(feederLinkError);
  // SISP-97: a house that feeds no active downstream home can never
  // hold a feeder-host credit. Zero it instead of refusing the save —
  // a downstream link removed on another record must not freeze this
  // house's unrelated profile edits. (Cycle-time eligibility is derived
  // live regardless; this keeps the stored value honest too.)
  if (fields.feederHostCreditPKR > 0 && !isFeederHost(state.customers, current)) {
    fields.feederHostCreditPKR = 0;
  }
  const pauseError = validatePauseFields(fields);
  if (pauseError) throw new Error(pauseError);
  // Customer rename: only when the caller explicitly passes a name (the
  // profile header's Edit name editor and the profile form). The name is
  // the one field that may never be blanked — every list, bill and receipt
  // is labelled with it.
  if (Object.hasOwn(values, 'name')) {
    const name = cleanText(values.name ?? '', 100, 'Customer name');
    if (!name) throw new Error('Customer name cannot be empty.');
    fields.name = name;
  }
  const previousPrice = current.monthlySellingAmount ?? null;
  const nextPrice = fields.monthlySellingAmount ?? null;
  const priceChanged = (previousPrice === null) !== (nextPrice === null) || (previousPrice !== null && nextPrice !== null && moneyCents(previousPrice) !== moneyCents(nextPrice));
  const packageChanged = String(current.packageSpeed ?? '') !== fields.packageSpeed;
  let packageHistory = Array.isArray(current.packageHistory) ? [...current.packageHistory] : [];
  if (packageChanged || priceChanged) {
    const staffName = cleanText(values.packageChangeStaffName ?? '', 100, 'Staff name');
    const historyEntry = {
      date:dateKey(referenceDate), recordedAt:localDateTimeValue(referenceDate),
      oldPackage:String(current.packageSpeed ?? ''), newPackage:fields.packageSpeed,
      oldMonthlyRate:previousPrice, newMonthlyRate:nextPrice,
      monthlyRecurringPriceDelta:previousPrice === null || nextPrice === null ? null : Number((nextPrice - previousPrice).toFixed(2)),
      staffName
    };
    if (values.proRataAdjustment !== undefined && values.proRataAdjustment !== null) {
      historyEntry.proRataAdjustment = Number(values.proRataAdjustment);
    }
    if (values.proRatedBillAmount !== undefined && values.proRatedBillAmount !== null) {
      historyEntry.proRatedBillAmount = Number(values.proRatedBillAmount);
    }
    if (values.voucherId !== undefined && values.voucherId !== null) {
      historyEntry.voucherId = String(values.voucherId);
    }
    packageHistory.push(historyEntry);
  }
  let monthlyPriceSchedule = Array.isArray(current.monthlyPriceSchedule) ? [...current.monthlyPriceSchedule] : [];
  if (priceChanged) {
    const currentMonth = monthKey(referenceDate);
    const currentBillExists = (current.bills ?? []).some(bill => bill.month === currentMonth);
    const effectiveMonth = currentBillExists ? nextMonthKey(currentMonth) : currentMonth;
    monthlyPriceSchedule = [...monthlyPriceSchedule.filter(entry => entry.effectiveMonth !== effectiveMonth), { amount:nextPrice, effectiveMonth, recordedAt:localDateTimeValue(referenceDate) }];
  }
  // SISP-8: manual resume finalizes the hold — months inside the hold
  // that never got a bill are recorded as skipped, so the auto-generator
  // never backfills them after resume.
  let pauseSkippedMonths = Array.isArray(current.pauseSkippedMonths) ? [...current.pauseSkippedMonths] : [];
  if (current.paused === true && fields.paused === false) {
    pauseSkippedMonths = pauseSkippedMonthsOnResume(current, monthKey(referenceDate));
  }
  // Uptime tracking: every manual service-status flip is timestamped
  // into the customer's status history (the choke point — the customer
  // card buttons, the profile form and every other editor all pass
  // through here). A save that does not change the status appends
  // nothing, and legacy records without a history start one on their
  // first recorded flip.
  let serviceStatusHistory = sanitizeServiceStatusHistory(current.serviceStatusHistory);
  if (fields.serviceStatus !== (current.serviceStatus ?? 'not-set')) {
    serviceStatusHistory = [...serviceStatusHistory, { status: fields.serviceStatus, at: localDateTimeValue(referenceDate) }]
      .sort((a, b) => a.at.localeCompare(b.at) || a.status.localeCompare(b.status))
      .slice(-SERVICE_STATUS_HISTORY_LIMIT);
  }
  return { ...state, customers: state.customers.map(c => c.id === customerId ? { ...c, ...fields, monthlyPriceSchedule, packageHistory, pauseSkippedMonths, serviceStatusHistory } : c) };
}

function validateIncident(fields) {
  const reportedAt = String(fields.reportedAt ?? '').trim();
  const offlineAt = String(fields.offlineAt ?? '').trim();
  const restoredAt = String(fields.restoredAt ?? '').trim() || null;
  const reportedTime = parseLocalDateTime(reportedAt);
  const offlineTime = parseLocalDateTime(offlineAt);
  const restoredTime = restoredAt === null ? null : parseLocalDateTime(restoredAt);
  if (reportedTime === null) throw new Error('Enter a valid complaint/report date and time.');
  if (offlineTime === null) throw new Error('Enter a valid offline-start date and time.');
  if (restoredAt !== null && restoredTime === null) throw new Error('Enter a valid restored-online date and time.');
  if (restoredTime !== null && (restoredTime < reportedTime || restoredTime < offlineTime)) throw new Error('Restored-online time cannot be earlier than the report or offline-start time.');
  const note = String(fields.note ?? '').trim();
  if (note.length > 2000) throw new Error('Complaint/resolution note must be 2000 characters or fewer.');
  return { reportedAt, offlineAt, restoredAt, note };
}

export function addIncident(state, customerId, fields, recordedAt = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const incident = { id:makeId(), ...validateIncident(fields), createdAt:localDateTimeValue(recordedAt), corrections:[] };
  return { ...state, customers:state.customers.map(c => c.id === customerId ? { ...c, incidents:[...(c.incidents ?? []), incident].sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id)) } : c) };
}

export function updateIncident(state, customerId, incidentId, fields, editedAt = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const incident = (customer.incidents ?? []).find(item => item.id === incidentId);
  if (!incident) throw new Error('Complaint/outage record not found.');
  const correction = {
    recordedAt:localDateTimeValue(editedAt),
    previous:{ reportedAt:incident.reportedAt, offlineAt:incident.offlineAt, restoredAt:incident.restoredAt ?? null, note:incident.note ?? '' }
  };
  const updated = { ...incident, ...validateIncident(fields), corrections:[...(incident.corrections ?? []), correction] };
  return { ...state, customers:state.customers.map(c => c.id !== customerId ? c : { ...c, incidents:c.incidents.map(item => item.id === incidentId ? updated : item).sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id)) }) };
}

export function deleteIncident(state, customerId, incidentId) {
  const customer = customerOrThrow(state, customerId);
  if (!(customer.incidents ?? []).some(item => item.id === incidentId)) throw new Error('Complaint/outage record not found.');
  return { ...state, customers:state.customers.map(c => c.id !== customerId ? c : { ...c, incidents:c.incidents.filter(item => item.id !== incidentId) }) };
}

export function countCustomerIncidentsLast30Days(state, customerId, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const cutoff = referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000;
  return (customer.incidents ?? []).filter(incident => {
    const reportedTime = parseLocalDateTime(incident.reportedAt);
    return reportedTime !== null && reportedTime >= cutoff && reportedTime <= referenceDate.getTime();
  }).length;
}

export function saveBillMonth(state, customerId, { month, dueAmount = null, status, dueDate = undefined, packageId = '', clearPackageSnapshot = false }, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (status !== 'pending') throw new Error('Paid status is derived from actual receipts or valid carry-forward credit. Record an actual payment instead of manually marking a bill paid.');
  const selectedPackage = packageId ? createBillPackageSnapshot(packageId) : null;
  if (packageId && !selectedPackage) throw new Error('Choose one of the available monthly packages.');
  const due = checkPositiveAmount(selectedPackage?.nominalPrice ?? dueAmount, true);
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  if (customer.archived && !existing) throw new Error('Archived customers do not receive new bills. Unarchive the customer first.');
  if (!existing && due === null) throw new Error('Enter a bill amount before creating a bill. Unconfigured customers do not receive bills.');
  const requestedDueDate = dueDate === undefined ? undefined : checkOptionalDate(dueDate);
  const savedDueDate = existing ? (requestedDueDate === undefined ? existing.dueDate ?? null : requestedDueDate) : requestedDueDate ?? `${month}-05`;
  const amountHistory = [...(existing?.amountHistory ?? [])];
  const oldAmount = existing?.dueAmount ?? null;
  const amountChanged = existing && ((oldAmount === null) !== (due === null) || (oldAmount !== null && due !== null && moneyCents(oldAmount) !== moneyCents(due)));
  if (amountChanged) amountHistory.push({ changedAt:localDateTimeValue(referenceDate), previousAmount:oldAmount, newAmount:due, source:'manual correction' });
  const bill = existing
    ? { ...existing, dueAmount:due, dueDate:savedDueDate, status, amountHistory, ...(selectedPackage ? { packageSnapshot:selectedPackage } : {}) }
    : { id:makeId(), month, dueAmount:due, dueDate:savedDueDate, status, payments:[], generated:false, priceSnapshot:null, createdAt:localDateTimeValue(referenceDate), amountHistory:[], ...(selectedPackage ? { packageSnapshot:selectedPackage } : {}) };
  if (clearPackageSnapshot && !selectedPackage) delete bill.packageSnapshot;
  const bills = [...customer.bills.filter(b => b.month !== month), bill].sort((a,b) => b.month.localeCompare(a.month));
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills }) };
}

// ---------------------------------------------------------------------------
// Auto package follow (owner feature, 2026-10-29): "jab kisi customer ka
// bill pay ho jata hai to usko automatically uska package patch ho jana
// chahiye — kisi bande ne payment ki 2000, to uska package automatically
// 2000 ho jana chahiye, na ke manual baar baar set karna pare." The package
// follows the FEE DECISION for the customer's latest month, month by
// month: when a collect creates-and-settles a month whose bill was not
// priced yet, the fee actually taken for that month becomes the package
// (2,000 collected as the month's fee -> package 2,000; next month the
// fee is taken at 1,000 -> package 1,000 from that month onward, and the
// following month bills 1,000 with no manual change).
//
// The decision line is the bill's state BEFORE the payment (the
// persisted state the operator was looking at — bills auto-price from
// the schedule on app open and on every save, so a priced bill in that
// state is a charge the operator could see):
//  - Month NOT priced yet (no bill, or a bill with no amount): the
//    entered amount IS the month's fee decision, so the package follows
//    the fee taken for the month — every real receipt on that month,
//    net of the SISP-43 ticket-charge portion the allocation engine
//    keeps out of bill money (advance-tagged receipts never count: a
//    prepay is not a fee decision). The month's bill is then priced at
//    exactly that taken fee through saveBillMonth, so the month stands
//    at the taken fee and its receipts settle it — the bill was
//    unpriced or created inside this very recording, so no earlier
//    charge is ever rewritten.
//  - Month ALREADY priced (generated or manually set): the fee was
//    decided when the bill was priced. Any payment is a pay-down —
//    partial OR full — and never rewrites the package (a 1,000 payment
//    toward a generated 2,000 bill leaves the bill half-paid, 1,000
//    still due, and the package at 2,000).
// The assignment goes through updateCustomerProfile — the same plan path
// as the profile Edit form, Quick Collect setup and applyCustomerPlan —
// so the change lands in packageHistory with staff attribution and the
// price schedule moves exactly like a manual plan change; bills are then
// generated through the current month by the core generator, whose
// schedule-effective-month rule keeps earlier months untouched. A
// same-amount month is a strict no-op (no history churn). Free
// connections and archived customers never follow. The helper never
// throws: the recorded payment is the truth, and a failed follow must
// not lose a real collection.
export const AUTO_PACKAGE_STAFF_NAME = 'Auto-set from payment';

function isPricedBill(bill) {
  const amount = bill?.dueAmount;
  return amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
}

function applicableScheduleAmount(customer, month) {
  const schedule = Array.isArray(customer?.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
  const applicable = schedule
    .filter(entry => typeof entry?.effectiveMonth === 'string' && entry.effectiveMonth <= month)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .at(-1);
  const amount = applicable?.amount;
  return amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0 ? null : Number(amount);
}

/**
 * The fee actually taken for one month, in cents: every non-voided,
 * non-advance receipt on the month's bill, minus the SISP-43
 * ticket-charge portion of each receipt (ticket money is consumed by
 * the tickets, never bill money — the allocation engine's own split)
 * and minus the SISP-106 boost-charge portion (boost money is consumed
 * by the boost log, never package-fee money, so collecting a boost can
 * never pose as the month's package fee for the auto-package follow).
 */
export function monthFeeTakenCents(customer, month) {
  const bill = (customer?.bills ?? []).find(b => b.month === month);
  if (!bill) return 0;
  let takenCents = 0;
  for (const payment of bill.payments ?? []) {
    if (!payment || payment.voided === true || isAdvancePayment(payment)) continue;
    takenCents += Math.max(0, moneyCents(payment.amount) - paymentTicketChargeCents(payment) - paymentAddonChargeCents(payment) - paymentManualBaqayaCents(payment));

  }
  return takenCents;
}

/**
 * After a payment has been recorded (beforeState -> afterState via the
 * caller's normal addPayment path), move the customer's package to the
 * fee taken for `month` when that payment was the month's fee decision.
 * Returns { nextState, autoPackage } where autoPackage is null when
 * nothing changed, else { fee, packageLabel } for display.
 */
export function autoPackageFromPayment(beforeState, afterState, customerId, month, paymentId, referenceDate = new Date()) {
  const noChange = { nextState: afterState, autoPackage: null };
  try {
    const beforeCustomer = beforeState?.customers?.find(c => c.id === customerId);
    const customer = afterState?.customers?.find(c => c.id === customerId);
    if (!beforeCustomer || !customer) return noChange;
    if (customer.archived || customer.isFreeConnection) return noChange;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const bill = bills.find(b => b.month === month);
    if (!bill) return noChange;
    // The triggering receipt must be a real, normal payment on this
    // month (advance-tagged money is prepay, never a fee decision).
    const payment = (bill.payments ?? []).find(p => p.id === paymentId);
    if (!payment || payment.voided === true || isAdvancePayment(payment)) return noChange;
    // Only the customer's latest month can move the package — paying an
    // older month late never rewrites today's plan.
    const latestMonth = bills.reduce((max, b) => (typeof b?.month === 'string' && b.month > max ? b.month : max), '');
    if (month !== latestMonth) return noChange;
    // A bill already priced before this payment decided the month's fee
    // at pricing time; the payment only pays it down.
    const beforeBill = (beforeCustomer.bills ?? []).find(b => b.month === month);
    if (beforeBill && isPricedBill(beforeBill)) return noChange;
    const takenCents = monthFeeTakenCents(customer, month);
    if (takenCents <= 0) return noChange;
    const selling = Number(customer.monthlySellingAmount);
    const currentFee = Number.isFinite(selling) && selling > 0 ? selling : applicableScheduleAmount(customer, month);
    if (currentFee !== null && moneyCents(currentFee) === takenCents) return noChange;
    const takenFee = takenCents / 100;
    const plan = BILL_PACKAGES.find(p => moneyCents(p.price) === takenCents) ?? null;
    const values = { monthlySellingAmount: takenFee, packageChangeStaffName: AUTO_PACKAGE_STAFF_NAME };
    if (plan) values.packageSpeed = plan.label;
    let next = updateCustomerProfile(afterState, customerId, values, referenceDate);
    // The month stands at the taken fee: price its bill at exactly that
    // amount (saveBillMonth keeps the receipts and audits the amount
    // change). Skipped when the recording's own bill generation already
    // priced it at the taken fee.
    const monthBill = next.customers.find(c => c.id === customerId)?.bills?.find(b => b.month === month);
    if (monthBill && moneyCents(monthBill.dueAmount) !== takenCents) {
      next = saveBillMonth(next, customerId, { month, dueAmount: takenFee, status: 'pending' }, referenceDate);
    }
    next = generateMonthlyBillsThroughCurrentMonth(next, referenceDate);
    return { nextState: next, autoPackage: { fee: takenFee, packageLabel: plan ? plan.label : String(customer.packageSpeed ?? '') } };
  } catch {
    return noChange;
  }
}

// SISP-43: a payment can settle billed field-ticket charges (SISP-12) as
// part of the same cash receipt. The settled lines ride the payment as
// data — `ticketCharges: [{ ticketId, amount }]` — like the SISP-34
// clearedWaada stamp: the ledger records WHAT the cash settled, while
// the ticket side (complaint-tickets.js) owns the charge flags. The
// ticket portion of a payment is NOT bill money: the allocation engine
// never applies it to a bill and never turns it into advance credit, so
// one combined payment can neither clear a bill twice nor manufacture
// prepaid credit out of a repair charge.
const TICKET_CHARGE_ID_RE = /^TKT-\d+$/;
export function sanitizeTicketChargeLines(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Ticket charge lines must be a list.');
  if (value.length > 20) throw new Error('Too many ticket charge lines on one payment.');
  const seen = new Set();
  const lines = [];
  for (const entry of value) {
    const ticketId = typeof entry?.ticketId === 'string' ? entry.ticketId.trim() : '';
    if (!TICKET_CHARGE_ID_RE.test(ticketId)) throw new Error('A ticket charge line needs a ticket id like TKT-101.');
    if (seen.has(ticketId)) throw new Error(`Ticket charge ${ticketId} is listed twice on one payment.`);
    seen.add(ticketId);
    const amount = Number(entry?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A ticket charge amount must be greater than zero.');
    lines.push({ ticketId, amount: Math.round(amount * 100) / 100 });
  }
  return lines;
}
/** Stored stamp lines of a payment ([] when absent or unreadable). */
export function ticketChargeLinesOf(payment) {
  try { return sanitizeTicketChargeLines(payment?.ticketCharges); } catch { return []; }
}
/** The ticket-charge portion of a payment, in cents. */
export function paymentTicketChargeCents(payment) {
  return ticketChargeLinesOf(payment).reduce((sum, line) => sum + moneyCents(line.amount), 0);
}

// SISP-106: temporary speed boosts are logged ON THE CUSTOMER record
// (`speedBoosts: [...]`, owned by speed-addon.js). Each boost's add-on
// fee is a one-time charge settled exactly like a SISP-43 ticket charge:
// the settled lines ride the payment as `addonCharges: [{ boostId,
// amount }]`, the allocation engine keeps that portion out of bill
// money and advance credit, and void/undo reopens exactly the boosts
// its stamp settled. The base package price is never touched by a
// boost. Legacy records carry no speedBoosts and load with none.
const BOOST_ID_RE = /^BST-\d+$/;
function validBoostDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}
/** Load-safe cleanup of a customer's boost log ([] when absent/corrupt). */
export function sanitizeSpeedBoosts(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const boosts = [];
  for (const entry of value) {
    const boostId = typeof entry?.boostId === 'string' ? entry.boostId.trim() : '';
    if (!BOOST_ID_RE.test(boostId) || seen.has(boostId)) continue;
    const boostMbps = Number(entry?.boostMbps);
    const durationDays = Number(entry?.durationDays);
    const addonFeePKR = Number(entry?.addonFeePKR);
    const startDate = validBoostDate(entry?.startDate);
    const expiryDate = validBoostDate(entry?.expiryDate);
    if (!Number.isFinite(boostMbps) || boostMbps <= 0 || boostMbps > 10000) continue;
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) continue;
    if (!Number.isFinite(addonFeePKR) || addonFeePKR <= 0) continue;
    if (!startDate || !expiryDate || expiryDate < startDate) continue;
    seen.add(boostId);
    boosts.push({
      boostId,
      boostMbps: Math.round(boostMbps * 100) / 100,
      durationDays,
      addonFeePKR: Math.round(addonFeePKR * 100) / 100,
      startDate,
      expiryDate,
      chargePaid: entry?.chargePaid === true,
      chargePaidAt: typeof entry?.chargePaidAt === 'string' ? entry.chargePaidAt.slice(0, 40) : '',
      chargePaymentId: typeof entry?.chargePaymentId === 'string' ? entry.chargePaymentId.slice(0, 100) : ''
    });
  }
  return boosts;
}
export function sanitizeAddonChargeLines(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Boost charge lines must be a list.');
  if (value.length > 20) throw new Error('Too many boost charge lines on one payment.');
  const seen = new Set();
  const lines = [];
  for (const entry of value) {
    const boostId = typeof entry?.boostId === 'string' ? entry.boostId.trim() : '';
    if (!BOOST_ID_RE.test(boostId)) throw new Error('A boost charge line needs a boost id like BST-101.');
    if (seen.has(boostId)) throw new Error(`Boost charge ${boostId} is listed twice on one payment.`);
    seen.add(boostId);
    const amount = Number(entry?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A boost charge amount must be greater than zero.');
    lines.push({ boostId, amount: Math.round(amount * 100) / 100 });
  }
  return lines;
}
/** Stored boost-charge stamp lines of a payment ([] when absent/unreadable). */
export function addonChargeLinesOf(payment) {
  try { return sanitizeAddonChargeLines(payment?.addonCharges); } catch { return []; }
}
/** The boost-charge portion of a payment, in cents. */
export function paymentAddonChargeCents(payment) {
  return addonChargeLinesOf(payment).reduce((sum, line) => sum + moneyCents(line.amount), 0);
}

// ---------------------------------------------------------------------------
// OWNER FEATURE (2026-10-29, voice note): Manual Loan / Baqaya on the
// customer profile. A manual baqaya entry is a due the owner writes by
// hand for money that does NOT come from a generated bill — pre-app debt
// or an off-book amount from an earlier month ("customer ne is maah ke
// 3,000 bhej diye, pichhle maah ke abhi baqaya hain"). It is deliberately
// NOT a bill: the allocation engine's bill arrears never see it, so a
// real bill's arrears can never be double-counted through it.
//
// Storage: entries ride the customer record (`manualBaqaya`), so they
// travel in JSON backups with the profile and survive the load/backup
// sanitizers. Settlements are NOT stored on the entry — they ride the
// paying receipt as a stamp, `manualBaqayaSettlements: [{ entryId,
// amount }]`, exactly like the SISP-43 ticket-charge stamp and the
// SISP-34 clearedWaada stamp: the ledger records WHAT the cash settled,
// and each entry's remaining amount is DERIVED (entry amount minus the
// stamps of the customer's non-voided payments). Voiding a payment
// (SISP-34) therefore restores the baqaya exactly, with no second store
// to keep in sync, and deleting an undone payment restores it too. The
// stamped portion of a receipt is not bill money: the allocation engine
// never applies it to a bill and never turns it into advance credit.
const MANUAL_BAQAYA_ID_RE = /^MBQ-\d+$/;
const cleanBaqayaNote = (value) => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 200);

/**
 * OWNER-ADDPEND (2026-11-01): owner adjustments on a manual baqaya
 * entry. When the owner lowers the Additional Pending total in the
 * quick editor, the reduction is NOT an edit of history: it is stamped
 * on the entry as an adjustment ({ amount, date, note, createdAt },
 * rupees) and the remaining derivation subtracts adjustments exactly
 * like settlement stamps — with ONE difference: adjustments are owner
 * decisions, so voiding a payment never restores them (only the
 * payment's settlement stamps unwind on a void). Sanitized leniently
 * like the entries themselves; the field is stored ONLY when non-empty
 * so a legacy entry stays byte-identical.
 */
export function sanitizeManualBaqayaAdjustments(value) {
  if (!Array.isArray(value)) return [];
  const adjustments = [];
  for (const adjustment of value.slice(0, 50)) {
    const amount = Number(adjustment?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = validDateOrNull(adjustment?.date);
    if (!date) continue;
    adjustments.push({
      amount: Math.round(amount * 100) / 100,
      date,
      note: cleanBaqayaNote(adjustment?.note),
      createdAt: typeof adjustment?.createdAt === 'string' && adjustment.createdAt ? adjustment.createdAt : date
    });
  }
  return adjustments;
}

/**
 * Sanitizes the stored entry list of a customer record. Lenient by
 * design (load/backup path): a malformed entry is dropped, never
 * invented and never fatal — a corrupt manual entry must not brick the
 * whole ledger. Amounts are stored in rupees, rounded to cents.
 */
export function sanitizeManualBaqayaEntries(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const entries = [];
  for (const entry of value) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    if (!MANUAL_BAQAYA_ID_RE.test(id) || seen.has(id)) continue;
    const amount = Number(entry?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = validDateOrNull(entry?.date);
    if (!date) continue;
    seen.add(id);
    const adjustments = sanitizeManualBaqayaAdjustments(entry?.adjustments);
    entries.push({
      id,
      amount: Math.round(amount * 100) / 100,
      date,
      note: cleanBaqayaNote(entry?.note),
      createdAt: typeof entry?.createdAt === 'string' && entry.createdAt ? entry.createdAt : date,
      ...(adjustments.length > 0 ? { adjustments } : {})
    });
  }
  return entries;
}

/**
 * Strict sanitizer for the settlement lines stamped on a payment (the
 * write path — mirrors sanitizeTicketChargeLines): every line names a
 * manual baqaya entry and a positive amount; an entry settles at most
 * once per payment.
 */
export function sanitizeManualBaqayaSettlementLines(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Manual baqaya settlement lines must be a list.');
  if (value.length > 20) throw new Error('Too many manual baqaya settlement lines on one payment.');
  const seen = new Set();
  const lines = [];
  for (const entry of value) {
    const entryId = typeof entry?.entryId === 'string' ? entry.entryId.trim() : '';
    if (!MANUAL_BAQAYA_ID_RE.test(entryId)) throw new Error('A manual baqaya settlement line needs an entry id like MBQ-101.');
    if (seen.has(entryId)) throw new Error(`Manual baqaya entry ${entryId} is listed twice on one payment.`);
    seen.add(entryId);
    const amount = Number(entry?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A manual baqaya settlement amount must be greater than zero.');
    lines.push({ entryId, amount: Math.round(amount * 100) / 100 });
  }
  return lines;
}

/** Stored stamp lines of a payment ([] when absent or unreadable). */
export function manualBaqayaSettlementLinesOf(payment) {
  try { return sanitizeManualBaqayaSettlementLines(payment?.manualBaqayaSettlements); } catch { return []; }
}

/** The manual-baqaya portion of a payment, in cents. */
export function paymentManualBaqayaCents(payment) {
  return manualBaqayaSettlementLinesOf(payment).reduce((sum, line) => sum + moneyCents(line.amount), 0);
}

/** Settled cents per entry id, derived from the customer's non-voided payments. */
export function manualBaqayaSettledCentsByEntry(customer) {
  const settled = new Map();
  for (const bill of customer?.bills ?? []) {
    for (const payment of bill?.payments ?? []) {
      if (!payment || payment.voided === true) continue;
      for (const line of manualBaqayaSettlementLinesOf(payment)) {
        settled.set(line.entryId, (settled.get(line.entryId) ?? 0) + moneyCents(line.amount));
      }
    }
  }
  return settled;
}

/**
 * The customer's manual baqaya entries with derived settled/remaining
 * amounts, oldest first (entry date, then creation order) — the FIFO
 * order collections settle in. A stamp naming an entry that no longer
 * exists is ignored here (the entry was removed while unsettled stamps
 * cannot exist for it — removal is blocked once settled — so an orphan
 * stamp can only arrive via a hand-edited backup; it stays harmless).
 */
export function manualBaqayaEntriesWithRemaining(customer) {
  const settled = manualBaqayaSettledCentsByEntry(customer);
  return sanitizeManualBaqayaEntries(customer?.manualBaqaya)
    .map((entry) => {
      const settledCents = Math.min(settled.get(entry.id) ?? 0, moneyCents(entry.amount));
      // OWNER-ADDPEND: owner adjustments subtract exactly like settled
      // stamps in the remaining derivation (but, unlike settlements,
      // they are never restored by a payment void — see the adjustment
      // block above). Legacy entries carry no adjustments → 0.
      const adjustedCents = (entry.adjustments ?? []).reduce((sum, adjustment) => sum + moneyCents(adjustment.amount), 0);
      return { ...entry, settledCents, adjustedCents, remainingCents: Math.max(0, moneyCents(entry.amount) - settledCents - adjustedCents) };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
}

/** Total unpaid manual baqaya of a customer, in cents (0 when none). */
export function manualBaqayaOutstandingCents(customer) {
  return manualBaqayaEntriesWithRemaining(customer).reduce((sum, entry) => sum + entry.remainingCents, 0);
}

/** Total unpaid manual baqaya of a customer, in rupees (0 when none). */
export function manualBaqayaOutstanding(customer) {
  return manualBaqayaOutstandingCents(customer) / 100;
}

/**
 * Plans how much of an available cash remainder settles manual baqaya:
 * oldest entry first (FIFO by entry date), part-settling the last entry
 * the money reaches — a Rs 500 payment against a Rs 1,500 baqaya leaves
 * exactly Rs 1,000. Returns stamp lines in rupees + the total in cents.
 */
export function planManualBaqayaSettlement(customer, availableCents) {
  let budget = Math.max(0, Math.round(Number(availableCents) || 0));
  const lines = [];
  let totalCents = 0;
  if (budget > 0) {
    for (const entry of manualBaqayaEntriesWithRemaining(customer)) {
      if (budget <= 0) break;
      if (entry.remainingCents <= 0) continue;
      const appliedCents = Math.min(entry.remainingCents, budget);
      if (appliedCents <= 0) continue;
      lines.push({ entryId: entry.id, amount: appliedCents / 100 });
      totalCents += appliedCents;
      budget -= appliedCents;
    }
  }
  return { lines, totalCents };
}

function nextManualBaqayaId(customer) {
  let highest = 100;
  for (const entry of sanitizeManualBaqayaEntries(customer?.manualBaqaya)) {
    const suffix = Number(entry.id.slice(4));
    if (Number.isSafeInteger(suffix) && suffix > highest) highest = suffix;
  }
  return `MBQ-${highest + 1}`;
}

function cleanManualBaqayaFields(fields, referenceDate) {
  const amount = Number(fields?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a baqaya amount greater than zero.');
  const date = checkOptionalDate(fields?.date ?? '', 'Baqaya date');
  if (!date) throw new Error('Enter the date this baqaya belongs to.');
  if (date > dateKey(referenceDate)) throw new Error('Baqaya date cannot be in the future.');
  const note = cleanBaqayaNote(fields?.note);
  return { amount: Math.round(amount * 100) / 100, date, note };
}

function replaceCustomer(state, customerId, nextCustomer) {
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : nextCustomer) };
}

/**
 * Adds a manual baqaya entry to a customer. Guards (owner rules): a
 * FREE connection never owes anything, and an archived profile is
 * frozen history — both refuse new entries.
 */
export function addManualBaqayaEntry(state, customerId, fields, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  if (customer.archived) throw new Error('Archived customers cannot take a new manual baqaya entry. Unarchive the customer first.');
  if (customer.isFreeConnection === true) throw new Error('Free connections never owe anything — a manual baqaya entry cannot be added.');
  const clean = cleanManualBaqayaFields(fields, referenceDate);
  const entry = { id: nextManualBaqayaId(customer), ...clean, createdAt: localDateTimeValue(referenceDate) };
  const entries = [...sanitizeManualBaqayaEntries(customer.manualBaqaya), entry];
  return replaceCustomer(state, customerId, { ...customer, manualBaqaya: entries });
}

/**
 * Edits a manual baqaya entry. Audit rule: an entry can be edited or
 * removed ONLY while it is fully unsettled — once a payment has settled
 * part of it, the entry is ledger history; void the settling payment
 * first (which restores the baqaya) and the entry unlocks again.
 */
export function updateManualBaqayaEntry(state, customerId, entryId, fields, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const entries = manualBaqayaEntriesWithRemaining(customer);
  const existing = entries.find(entry => entry.id === entryId);
  if (!existing) throw new Error('Manual baqaya entry not found.');
  if (existing.settledCents > 0) throw new Error('This baqaya entry already has payments against it and cannot be changed. Void the payment first.');
  const clean = cleanManualBaqayaFields(fields, referenceDate);
  const nextEntries = sanitizeManualBaqayaEntries(customer.manualBaqaya)
    .map(entry => entry.id === entryId ? { ...entry, ...clean } : entry);
  return replaceCustomer(state, customerId, { ...customer, manualBaqaya: nextEntries });
}

/**
 * OWNER-ADDPEND (2026-11-01): set the customer's TOTAL outstanding
 * manual baqaya to an exact amount — the write path of the Additional
 * Pending quick editor. The editor manages the total, never a single
 * entry, and history is never rewritten:
 *  - Increase: ONE new entry is created for the difference, through
 *    addManualBaqayaEntry itself (same guards, id and date rules).
 *  - Decrease: the difference is stamped as owner adjustments against
 *    the NEWEST open entries first (LIFO), capped at each entry's
 *    remaining — settled portions stay settled, the total can reach 0
 *    but never below it.
 *  - Equal: the SAME state reference is returned (no write at all).
 * Guards mirror addManualBaqayaEntry (FREE / archived refuse). The
 * amount must be finite and >= 0; anything else throws before any
 * state is produced.
 */
export function setManualBaqayaOutstanding(state, customerId, fields, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  if (customer.archived) throw new Error('Archived customers cannot take a new manual baqaya entry. Unarchive the customer first.');
  if (customer.isFreeConnection === true) throw new Error('Free connections never owe anything — a manual baqaya entry cannot be added.');
  const amount = Number(fields?.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter an additional pending amount of zero or more.');
  const targetCents = moneyCents(amount);
  const currentCents = manualBaqayaOutstandingCents(customer);
  if (targetCents === currentCents) return state;
  const date = fields?.date ? checkOptionalDate(fields.date, 'Additional pending date') : dateKey(referenceDate);
  if (!date) throw new Error('Enter the date this additional pending belongs to.');
  if (date > dateKey(referenceDate)) throw new Error('Additional pending date cannot be in the future.');
  const note = cleanBaqayaNote(fields?.note);
  if (targetCents > currentCents) {
    return addManualBaqayaEntry(state, customerId, { amount: (targetCents - currentCents) / 100, date, note }, referenceDate);
  }
  let reductionLeftCents = currentCents - targetCents;
  const openNewestFirst = manualBaqayaEntriesWithRemaining(customer)
    .filter(entry => entry.remainingCents > 0)
    .reverse();
  const adjustmentsByEntry = new Map();
  for (const entry of openNewestFirst) {
    if (reductionLeftCents <= 0) break;
    const appliedCents = Math.min(entry.remainingCents, reductionLeftCents);
    if (appliedCents <= 0) continue;
    adjustmentsByEntry.set(entry.id, {
      amount: appliedCents / 100,
      date,
      note,
      createdAt: localDateTimeValue(referenceDate)
    });
    reductionLeftCents -= appliedCents;
  }
  const nextEntries = sanitizeManualBaqayaEntries(customer.manualBaqaya).map((entry) => {
    const adjustment = adjustmentsByEntry.get(entry.id);
    if (!adjustment) return entry;
    return { ...entry, adjustments: [...(entry.adjustments ?? []), adjustment] };
  });
  return replaceCustomer(state, customerId, { ...customer, manualBaqaya: nextEntries });
}

/** Removes a manual baqaya entry (same fully-unsettled audit rule as edit). */
export function removeManualBaqayaEntry(state, customerId, entryId) {
  const customer = customerOrThrow(state, customerId);
  const entries = manualBaqayaEntriesWithRemaining(customer);
  const existing = entries.find(entry => entry.id === entryId);
  if (!existing) throw new Error('Manual baqaya entry not found.');
  if (existing.settledCents > 0) throw new Error('This baqaya entry already has payments against it and cannot be removed. Void the payment first.');
  const nextEntries = sanitizeManualBaqayaEntries(customer.manualBaqaya).filter(entry => entry.id !== entryId);
  return replaceCustomer(state, customerId, { ...customer, manualBaqaya: nextEntries });

}

/**
 * Advance payments: money collected BEFORE the bill it belongs to exists
 * (or after the current bill was already settled in full) — e.g. a customer
 * paying next month early. The tag is the ONLY marker: the amount flows
 * through the ordinary allocation engine, whose excess/pending-credit
 * carry-forward turns it into advance credit for the next generated bill.
 * Legacy payments carry no kind and always read as normal payments.
 */
export const ADVANCE_PAYMENT_KIND = 'advance';
export function isAdvancePayment(payment) {
  return payment?.kind === ADVANCE_PAYMENT_KIND;
}

/**
 * Advance month targeting (owner feature, 2026-10-29 — the SISP-61
 * core): an advance payment may carry a targetMonth ('YYYY-MM') — the
 * month the money is FOR, chosen by the operator at record time ("ye
 * 3,000 November ka hai"). The allocation engine RESERVES a targeted
 * credit for its month: it never settles an earlier bill; the first
 * priced bill at or after the target month releases it, it applies
 * there like any credit, and any remainder then flows onward as
 * ordinary credit. Untargeted advances (every legacy record) keep the
 * long-standing FIFO behaviour exactly. This reader is the single
 * sanitization point: only the exact advance kind plus a strictly
 * valid month string reads as a target; anything else (missing,
 * malformed, riding a normal payment) reads as untargeted, so a
 * corrupt value in a backup can never steer money.
 */
export function advancePaymentTargetMonth(payment) {
  if (!isAdvancePayment(payment)) return null;
  return validMonthString(payment?.targetMonth) ? payment.targetMonth : null;
}

/**
 * SISP-61: the multi-month prepay terms a targeted advance may carry —
 * the operator picked 2, 3, 6 or 12 months of coverage at the
 * customer's package rate, paid the gross minus an optional upfront
 * discount in cash, and the customer is credited the FULL gross. The
 * terms ride the payment record (prepayMonths / prepayGross /
 * prepayRate, sanitized by validatePayment) and this reader is the
 * single sanitization point, mirroring advancePaymentTargetMonth: a
 * partial or corrupt triple reads as a plain targeted advance, never
 * as a prepay, so a damaged record can never mint discount coverage.
 * The start month is the payment's targetMonth.
 */
export const PREPAY_MONTH_OPTIONS = Object.freeze([2, 3, 6, 12]);
const prepayMoneyOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
};
export function prepayTermsOf(payment) {
  const startMonth = advancePaymentTargetMonth(payment);
  if (!startMonth) return null;
  const months = Number(payment?.prepayMonths);
  const gross = prepayMoneyOrNull(payment?.prepayGross);
  const rate = prepayMoneyOrNull(payment?.prepayRate);
  if (!PREPAY_MONTH_OPTIONS.includes(months) || gross === null || gross <= 0 || rate === null || rate <= 0) return null;
  return { months, gross, rate, startMonth };
}

export function validatePayment(fields, referenceDate = new Date(), options = {}) {
  const { date, amount, method, paidBy, discount, discountReason, transactionId, reference, referenceOverrideReason, screenshot, walletVerified, ticketCharges, addonCharges, manualBaqayaSettlements, kind, note, targetMonth, prepayMonths, prepayGross, prepayRate, senderTitle, senderDigits, lateFeeWaived, waivedAmount, waivedLateFee } = fields || {};

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw new Error('Enter a valid payment date.');
  if (date > dateKey(referenceDate)) throw new Error('Payment date cannot be in the future.');
  const cents = checkPaymentAmount(amount);
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');

  const ref = String(transactionId ?? reference ?? '').trim().slice(0, 64);
  const overrideReason = String(referenceOverrideReason ?? '').trim().slice(0, 100);

  if (options.strictDigitalReference || options.enforceDigitalReference) {
    if (isDigitalPaymentMethod(method) && !ref && !overrideReason) {
      throw new Error('Transaction ID / last 6 digits is required for digital payments (or provide an override reason).');
    }
  }

  const payer = String(paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (payer.length > 100) throw new Error('Paid by must be 100 characters or fewer.');
  let validDiscount = 0;
  if (discount !== undefined && discount !== null && discount !== '') {
    const dNum = Number(discount);
    if (!Number.isFinite(dNum) || dNum < 0) throw new Error('Discount must be a positive number or zero.');
    validDiscount = Math.round(dNum * 100) / 100;
  }
  const cleanReason = String(discountReason ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (cleanReason.length > 100) throw new Error('Discount reason must be 100 characters or fewer.');
  // SISP-43: settled ticket-charge lines ride the payment (see above).
  // The settled total can never exceed the cash actually collected.
  const ticketChargeLines = sanitizeTicketChargeLines(ticketCharges);
  const ticketChargeTotalCents = ticketChargeLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  if (ticketChargeTotalCents > Math.round(cents * 100)) throw new Error('Ticket charges on a payment cannot exceed the amount collected.');
  // SISP-106: settled boost-charge lines ride the payment the same way
  // (see above). Ticket + boost portions together can never exceed the
  // cash actually collected.
  const addonChargeLines = sanitizeAddonChargeLines(addonCharges);
  const addonChargeTotalCents = addonChargeLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  // Owner feature (2026-10-29): settled manual baqaya lines ride the
  // payment the same way (see the manual baqaya block above). Together
  // the two non-bill portions can never exceed the cash collected.
  const manualBaqayaLines = sanitizeManualBaqayaSettlementLines(manualBaqayaSettlements);
  const manualBaqayaTotalCents = manualBaqayaLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  if (ticketChargeTotalCents + addonChargeTotalCents + manualBaqayaTotalCents > Math.round(cents * 100)) throw new Error('Settled charges and baqaya on a payment cannot exceed the amount collected.');

  // Advance tag: only the exact 'advance' kind is kept — any other value
  // (including a missing one, i.e. every legacy payment) stays untagged,
  // so untagged records remain byte-identical to before.
  const cleanNote = String(note ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (cleanNote.length > 200) throw new Error('Payment note must be 200 characters or fewer.');
  // SISP-63: sender proof metadata — WHO sent a digital payment (the
  // sender's wallet/account title) and the last 4 digits of the account
  // or mobile it came from, recorded ALONGSIDE the TID (SISP-21) so a
  // wallet payment can be matched to its sender on statements and
  // receipts without opening the proof screenshot. Digital methods only
  // (the isDigitalPaymentMethod set: Easypaisa / JazzCash / NayaPay /
  // Bank / Raast …); on any other method the fields are dropped, never
  // stored, so cash records stay byte-identical to before. The digits
  // are normalized to digits-only and only the last 4 survive — a full
  // account number typed by mistake is never persisted whole.
  const cleanSenderTitle = String(senderTitle ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (cleanSenderTitle.length > 100) throw new Error('Sender name must be 100 characters or fewer.');
  const cleanSenderDigits = String(senderDigits ?? '').replace(/\D/g, '').slice(-4);
  const digitalSender = isDigitalPaymentMethod(method);
  // SISP-61: multi-month prepay terms ride the payment record ONLY on a
  // targeted advance (the recordPrepay path) and only as a complete,
  // sane triple — months from the fixed 2/3/6/12 picker, the gross
  // coverage and the package rate it was quoted from. Anything partial
  // or malformed is dropped whole, never stored raw, so a plain
  // targeted advance stays byte-identical to before. The allocation
  // engine reads these terms (see prepayTermsOf) to convert the
  // payment's upfront discount into reserved advance coverage.
  const prepayTerms = kind === ADVANCE_PAYMENT_KIND && validMonthString(targetMonth)
    && PREPAY_MONTH_OPTIONS.includes(Number(prepayMonths))
    && prepayMoneyOrNull(prepayGross) !== null && prepayMoneyOrNull(prepayGross) > 0
    && prepayMoneyOrNull(prepayRate) !== null && prepayMoneyOrNull(prepayRate) > 0
    ? { prepayMonths: Number(prepayMonths), prepayGross: prepayMoneyOrNull(prepayGross), prepayRate: prepayMoneyOrNull(prepayRate) }
    : null;
  // SISP-101: a late-fee waiver rides the payment that earned it — the
  // audit pair (lateFeeWaived + waivedAmount) plus the reversal stamp of
  // the bill's pre-waiver fee fields (waivedLateFee), sanitized by
  // late-fee-waiver.js. Kept ONLY as a complete, sane triple: anything
  // partial or malformed is dropped whole, never stored raw, so an
  // ordinary payment stays byte-identical to before and a damaged
  // record can never mint a fee restoration. The reader
  // (lateFeeWaiverOf) applies the same rule everywhere else.
  const waiverStamp = lateFeeWaived === true ? sanitizeWaivedLateFeeStamp(waivedLateFee) : null;
  const waiverAmount = lateFeeWaived === true ? prepayMoneyOrNull(waivedAmount) : null;
  const lateFeeWaiverTerms = waiverStamp && waiverAmount !== null && waiverAmount > 0
    ? { lateFeeWaived: true, waivedAmount: waiverAmount, waivedLateFee: waiverStamp }
    : null;
  return {
    date,
    amount: cents,
    method,
    ...(kind === ADVANCE_PAYMENT_KIND ? { kind: ADVANCE_PAYMENT_KIND } : {}),
    // Advance month target: kept only on an advance payment and only
    // as a strictly valid 'YYYY-MM' (the same rule as every other
    // month field) — anything else is dropped, never stored raw, so
    // untargeted records stay byte-identical to before.
    ...(kind === ADVANCE_PAYMENT_KIND && validMonthString(targetMonth) ? { targetMonth } : {}),
    ...(prepayTerms ?? {}),
    ...(lateFeeWaiverTerms ?? {}),
    ...(cleanNote ? { note: cleanNote } : {}),
    ...(ticketChargeLines.length > 0 ? { ticketCharges: ticketChargeLines } : {}),
    ...(addonChargeLines.length > 0 ? { addonCharges: addonChargeLines } : {}),
    ...(manualBaqayaLines.length > 0 ? { manualBaqayaSettlements: manualBaqayaLines } : {}),

    ...(payer ? { paidBy:payer } : {}),
    ...(validDiscount > 0 ? { discount: validDiscount } : {}),
    ...(cleanReason ? { discountReason: cleanReason } : {}),
    ...(ref ? { transactionId: ref, reference: ref } : {}),
    ...(digitalSender && cleanSenderTitle ? { senderTitle: cleanSenderTitle } : {}),
    ...(digitalSender && cleanSenderDigits ? { senderDigits: cleanSenderDigits } : {}),
    ...(overrideReason ? { referenceOverrideReason: overrideReason } : {}),
    // SISP-21: wallet statement verification rides the payment record. Only
    // an explicit true is kept; anything else reads as "Pending Screenshot
    // Verification" and is never treated as verified.
    ...(walletVerified === true ? { walletVerified: true } : {}),
    ...(screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/') ? { screenshot: screenshot.slice(0, 350000) } : {})
  };
}

/**
 * SISP-63: sender proof metadata readers — the single sanitization
 * point for display. validatePayment already cleans these fields on
 * write; the readers re-apply the same rules defensively so a legacy
 * or hand-edited record can never leak a newline, a >100-char title,
 * or more than the last 4 sender digits into a statement or receipt.
 */
export function paymentSenderTitle(payment) {
  return String(payment?.senderTitle ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
}
export function paymentSenderDigits(payment) {
  return String(payment?.senderDigits ?? '').replace(/\D/g, '').slice(-4);
}
/** Display label: "Hamza (…3310)", "Hamza", "…3310", or '' when absent. */
export function paymentSenderLabel(payment) {
  const title = paymentSenderTitle(payment);
  const digits = paymentSenderDigits(payment);
  if (title && digits) return `${title} (…${digits})`;
  return title || (digits ? `…${digits}` : '');
}

export function findDuplicatePaymentReference(state, transactionId, excludePaymentId = null) {
  if (!state || !Array.isArray(state.customers)) return null;
  // SISP-21: one normalization rule, shared with wallet-reconciliation.js —
  // whitespace and case are ignored, so a re-typed screenshot TID still matches.
  const cleanRef = normalizeTid(transactionId);
  if (!cleanRef) return null;

  for (const customer of state.customers) {
    for (const bill of (customer.bills ?? [])) {
      for (const payment of (bill.payments ?? [])) {
        if (excludePaymentId && payment.id === excludePaymentId) continue;
        const pRef = normalizeTid(payment.transactionId ?? payment.reference ?? '');
        if (pRef && pRef === cleanRef) {
          return {
            customerNumber: customer.customerNumber,
            customerName: customer.name,
            customerId: customer.id,
            billMonth: bill.month,
            month: bill.month,
            paymentDate: payment.date,
            date: payment.date,
            amount: payment.amount,
            method: payment.method,
            transactionId: payment.transactionId || payment.reference,
            paymentId: payment.id
          };
        }
      }
    }
  }
  return null;
}

export function calculateMethodCollectionTotals(state, month = null) {
  if (!state || !Array.isArray(state.customers)) return { total: 0, cashTotal: 0, digitalTotal: 0, byMethod: {} };
  let total = 0;
  let cashTotal = 0;
  let digitalTotal = 0;
  const byMethod = {};

  for (const customer of state.customers) {
    for (const bill of (customer.bills ?? [])) {
      if (month && bill.month !== month) continue;
      for (const payment of (bill.payments ?? [])) {
        // SISP-34: voided payments are not receipts anymore — they never
        // count toward method/cash/digital collection totals.
        if (payment?.voided === true) continue;
        if (month && typeof payment.date === 'string' && payment.date.slice(0, 7) !== month) continue;
        const amt = Number(payment.amount) || 0;
        const method = String(payment.method || 'Cash').trim();
        total += amt;
        if (isDigitalPaymentMethod(method)) {
          digitalTotal += amt;
        } else {
          cashTotal += amt;
        }
        if (!byMethod[method]) {
          byMethod[method] = { amount: 0, count: 0, isDigital: isDigitalPaymentMethod(method) };
        }
        byMethod[method].amount += amt;
        byMethod[method].count += 1;
      }
    }
  }

  return {
    total,
    cashTotal,
    digitalTotal,
    Cash: byMethod['Cash']?.amount ?? 0,
    JazzCash: byMethod['JazzCash']?.amount ?? 0,
    Easypaisa: byMethod['Easypaisa']?.amount ?? 0,
    Raast: byMethod['Raast']?.amount ?? 0,
    Bank: (byMethod['Bank']?.amount ?? 0) + (byMethod['Bank Transfer']?.amount ?? 0),
    other: Object.entries(byMethod)
      .filter(([m]) => !['Cash', 'JazzCash', 'Easypaisa', 'Raast', 'Bank', 'Bank Transfer'].includes(m))
      .reduce((s, [, v]) => s + v.amount, 0),
    byMethod
  };
}

/**
 * A discount waives part of a bill, so it can never exceed what is still
 * owed on that bill — the rule qa-discounts-late-fee.js already states
 * ("Discount cannot exceed remaining payable amount") but production never
 * enforced: validatePayment has no bill context, so a Rs 5,000 discount
 * could be stored against a Rs 1,000 bill, inflating concession reports
 * while the allocation engine silently applied only part of it.
 * The cap is the bill's allocation balance, which already accounts for
 * earlier receipts, their discounts and credit carried in from prior
 * months. For corrections, the payment being corrected is excluded first.
 */
function assertDiscountWithinRemainingPayable(state, customerId, month, discount, excludePaymentId = null, options = {}) {
  const discountCents = moneyCents(discount || 0);
  if (discountCents <= 0) return;
  // SISP-61: a prepay's upfront discount is never measured against the
  // bill the receipt happens to be attached to — it is not a discount
  // ON that bill at all. The allocation engine converts it into
  // reserved advance coverage (see calculatePaymentAllocations), so
  // the only cap that applies is the recorder's own discount < gross.
  if (options.prepayCoverage === true) return;
  let scopedState = state;
  if (excludePaymentId) {
    scopedState = { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: (b.payments ?? []).filter(p => p.id !== excludePaymentId) }) }) };
  }
  const summary = calculatePaymentAllocations(scopedState).forMonth(customerId, month);
  if (!summary || summary.balanceDueCents === null || summary.balanceDueCents === undefined) {
    throw new Error(`A discount needs a priced bill: set the bill amount for ${month} before recording a discount.`);
  }
  if (discountCents > summary.balanceDueCents) {
    throw new Error(`Discount cannot exceed remaining payable amount (${formatPKR(moneyValue(summary.balanceDueCents))}).`);
  }
}

export function addPayment(state, customerId, month, fields, referenceDate = new Date(), options = {}) {
  checkMonth(month, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  const payment = { id: makeId(), ...validatePayment(fields, referenceDate, options) };
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  if (customer.archived && !existing) throw new Error('Archived customers cannot receive a new monthly bill. Unarchive the customer first.');
  assertDiscountWithinRemainingPayable(state, customerId, month, payment.discount, null, { prepayCoverage: prepayTermsOf(payment) !== null });
  const bill = existing ? { ...existing, payments: [...existing.payments, payment] } : { id: makeId(), month, dueAmount: null, status: 'pending', payments: [payment] };
  const nextState = { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: existing ? c.bills.map(b => b.month === month ? bill : b) : [...c.bills, bill].sort((a,b) => b.month.localeCompare(a.month)) }) };
  // SISP-3: recording a FULL payment of the customer's pending balance
  // automatically clears the Waada promise. Outstanding is the allocation
  // balance across all priced bills (unpriced bills carry no due yet, so a
  // customer with no priced bill at all keeps the promise).
  const updated = nextState.customers.find(c => c.id === customerId);
  if (updated && typeof updated.promiseDate === 'string' && updated.promiseDate.trim() !== '') {
    const allocations = calculatePaymentAllocations(nextState);
    let pricedBillSeen = false;
    const outstandingCents = (updated.bills ?? []).reduce((sum, b) => {
      const summary = allocations.forMonth(customerId, b.month);
      if (summary && summary.balanceDueCents !== null && summary.balanceDueCents !== undefined) {
        pricedBillSeen = true;
        return sum + summary.balanceDueCents;
      }
      return sum;
    }, 0);
    if (pricedBillSeen && outstandingCents <= 0) {
      const cleared = { ...updated };
      // SISP-34: stamp the cleared promise onto the payment that cleared
      // it, so voiding that payment later can restore exactly this
      // promise (and nothing else). The stamp is data, not behavior.
      const stamp = {
        promiseDate: updated.promiseDate,
        promiseAmount: updated.promiseAmount ?? null,
        promiseNote: updated.promiseNote ?? ''
      };
      delete cleared.promiseDate;
      delete cleared.promiseAmount;
      delete cleared.promiseNote;
      cleared.bills = (cleared.bills ?? []).map(b => b.month !== month ? b : {
        ...b,
        payments: (b.payments ?? []).map(p => p.id === payment.id ? { ...p, clearedWaada: stamp } : p)
      });
      return { ...nextState, customers: nextState.customers.map(c => c.id !== customerId ? c : cleared) };
    }
  }
  return nextState;
}

export function correctPayment(state, customerId, month, paymentId, fields, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  const existingPayment = bill?.payments.find(p => p.id === paymentId);
  if (!existingPayment) throw new Error('Payment not found.');
  // SISP-34: a voided receipt is frozen history — correcting it would
  // silently drop the voided flag and un-void it.
  if (existingPayment.voided === true) throw new Error('Cannot correct a voided payment. Voided receipts are kept as history.');
  const mergedFields = {
    ...fields,
    discount: fields.discount !== undefined ? fields.discount : existingPayment.discount,
    discountReason: fields.discountReason !== undefined ? fields.discountReason : existingPayment.discountReason,
    // Advance month targeting: the correction form carries no kind or
    // target field, so a correction must never silently strip an
    // advance payment's tag or its month target (the walletVerified
    // carry-over rule below, applied to the advance fields).
    kind: fields.kind !== undefined ? fields.kind : existingPayment.kind,
    targetMonth: fields.targetMonth !== undefined ? fields.targetMonth : existingPayment.targetMonth,
    // SISP-61: the correction form carries no prepay fields either —
    // correcting a prepay receipt must never silently strip its terms
    // (same carry-over rule as kind/targetMonth above).
    prepayMonths: fields.prepayMonths !== undefined ? fields.prepayMonths : existingPayment.prepayMonths,
    prepayGross: fields.prepayGross !== undefined ? fields.prepayGross : existingPayment.prepayGross,
    prepayRate: fields.prepayRate !== undefined ? fields.prepayRate : existingPayment.prepayRate,
    // SISP-101: the correction form carries no waiver fields either —
    // correcting a waiver receipt must never silently strip its audit
    // pair or its reversal stamp (same carry-over rule as the prepay
    // terms above); the bill's fee stays waived, so the stamp must stay.
    lateFeeWaived: fields.lateFeeWaived !== undefined ? fields.lateFeeWaived : existingPayment.lateFeeWaived,
    waivedAmount: fields.waivedAmount !== undefined ? fields.waivedAmount : existingPayment.waivedAmount,
    waivedLateFee: fields.waivedLateFee !== undefined ? fields.waivedLateFee : existingPayment.waivedLateFee,
    // SISP-21: a correction form carries no verification toggle, so a
    // correction must never silently drop an existing verification.
    walletVerified: fields.walletVerified !== undefined ? fields.walletVerified : existingPayment.walletVerified,
    // Payment proof screenshot: the correction form carries no proof
    // picker either, so a correction must never silently drop an
    // attached proof (same rule as walletVerified above). Proofs are
    // attached at save time; there is deliberately no replace/remove
    // path short of voiding and re-recording the payment.
    screenshot: fields.screenshot !== undefined ? fields.screenshot : existingPayment.screenshot,
    // SISP-63: sender proof metadata — same carry-over rule: a caller
    // that does not pass the sender fields (e.g. a form without them)
    // must never silently strip who sent the payment.
    senderTitle: fields.senderTitle !== undefined ? fields.senderTitle : existingPayment.senderTitle,
    senderDigits: fields.senderDigits !== undefined ? fields.senderDigits : existingPayment.senderDigits
  };
  let payment = { id:paymentId, ...validatePayment(mergedFields, referenceDate), ...(fields.paidBy === undefined && existingPayment.paidBy ? { paidBy:existingPayment.paidBy } : {}) };
  // SISP-43: a correction restates the receipt, never its ticket-charge
  // settlement — the stamp is carried over verbatim, and the corrected
  // amount must still cover the settled charges. Anything else has to
  // void and re-record, so the ticket side can reopen cleanly.
  const settledTicketCharges = ticketChargeLinesOf(existingPayment);
  if (settledTicketCharges.length > 0) {
    if (moneyCents(payment.amount) <= settledTicketCharges.reduce((sum, line) => sum + moneyCents(line.amount), 0)) {
      throw new Error('This payment settled ticket charges. Void it and record a fresh payment to change the amount.');
    }
    payment = { ...payment, ticketCharges: settledTicketCharges };
  }
  // SISP-121: a correction restates the receipt, never its split-tender
  // link — the stamp is carried over verbatim (same rule as the ticket
  // charges above), so correcting one leg can never silently unlink it
  // from its sibling leg or from the combined receipt.
  if (typeof existingPayment.splitGroupId === 'string' && existingPayment.splitGroupId
    && (existingPayment.splitLeg === 1 || existingPayment.splitLeg === 2)) {
    payment = { ...payment, splitGroupId: existingPayment.splitGroupId, splitLeg: existingPayment.splitLeg };
  }
  // SISP-106: same carry-over rule for settled boost charges — a
  // correction restates the receipt, never its boost settlement.
  const settledAddonCharges = addonChargeLinesOf(existingPayment);
  if (settledAddonCharges.length > 0) {
    if (moneyCents(payment.amount) <= settledAddonCharges.reduce((sum, line) => sum + moneyCents(line.amount), 0)) {
      throw new Error('This payment settled a speed boost charge. Void it and record a fresh payment to change the amount.');
    }
    payment = { ...payment, addonCharges: settledAddonCharges };
  }
  // Owner feature (2026-10-29): the manual baqaya settlement stamp is
  // carried over verbatim under the same rule — a correction restates
  // the receipt, never what its cash settled; the corrected amount must
  // still cover the settled non-bill portions (baqaya + ticket charges).
  const settledBaqayaLines = manualBaqayaSettlementLinesOf(existingPayment);
  if (settledBaqayaLines.length > 0) {
    const settledNonBillCents = settledTicketCharges.reduce((sum, line) => sum + moneyCents(line.amount), 0)
      + settledBaqayaLines.reduce((sum, line) => sum + moneyCents(line.amount), 0)
      + settledAddonCharges.reduce((sum, line) => sum + moneyCents(line.amount), 0);
    if (moneyCents(payment.amount) <= settledNonBillCents) {
      throw new Error('This payment settled manual baqaya. Void it and record a fresh payment to change the amount.');
    }
    payment = { ...payment, manualBaqayaSettlements: settledBaqayaLines };
  }
  // SISP-126: a correction restates the receipt, never the remainder waada
  // the partial collection set — the stamp is carried over verbatim (same
  // rule as the ticket-charge settlement above), because the promise was
  // made against the original collection and must stay traceable to it.
  if (existingPayment.remainderWaada && typeof existingPayment.remainderWaada === 'object') {
    payment = { ...payment, remainderWaada: existingPayment.remainderWaada };
  }
  assertDiscountWithinRemainingPayable(state, customerId, month, payment.discount, paymentId, { prepayCoverage: prepayTermsOf(payment) !== null });
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.map(p => p.id === paymentId ? payment : p) }) }) };
}

export function deletePayment(state, customerId, month, paymentId, referenceDate = new Date(), options = {}) {
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill?.payments.some(payment => payment.id === paymentId)) throw new Error('Payment not found.');
  // SISP-34: deleting a voided row would erase the void audit trail.
  if (bill.payments.find(payment => payment.id === paymentId)?.voided === true) throw new Error('Cannot delete a voided payment. Voided receipts are kept as history.');
  // SISP-43: deleting a payment that settled ticket charges would leave
  // the tickets marked paid with no cash behind them. The quick-collect
  // undo reopens the charges first and passes ticketChargesReverted;
  // every other caller must void instead (voiding reopens them too).
  if (ticketChargeLinesOf(bill.payments.find(payment => payment.id === paymentId)).length > 0 && options?.ticketChargesReverted !== true) {
    throw new Error('This payment settled a ticket charge. Void it instead so the ticket charge reopens.');
  }
  // SISP-106: same guard for boost charges — deleting a payment that
  // settled one would leave the boost marked paid with no cash behind
  // it. The quick-collect undo reopens them first (addonChargesReverted).
  if (addonChargeLinesOf(bill.payments.find(payment => payment.id === paymentId)).length > 0 && options?.addonChargesReverted !== true) {
    throw new Error('This payment settled a speed boost charge. Void it instead so the boost charge reopens.');
  }
  // SISP-101: deleting a payment that waived a late fee would leave the
  // fee waived with no payment behind it. The quick-collect undo
  // restores the fee from the payment's stamp first and passes
  // lateFeeWaiverReverted; every other caller must void instead
  // (voiding restores the fee too — see payment-void-audit.js).
  if (lateFeeWaiverOf(bill.payments.find(payment => payment.id === paymentId)) && options?.lateFeeWaiverReverted !== true) {
    throw new Error('This payment waived a late fee. Void it instead so the late fee is restored.');

  }
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : {
    ...c,
    bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.filter(payment => payment.id !== paymentId) })
  }) };
}

/**
 * SISP-21: 1-tap wallet verification toggle. Sets walletVerified true, or
 * removes the field entirely when false (absent === pending, never verified).
 * Pure state transform; the caller persists and re-renders.
 */
export function setPaymentWalletVerified(state, customerId, month, paymentId, verified) {
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill?.payments.some(payment => payment.id === paymentId)) throw new Error('Payment not found.');
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : {
    ...c,
    bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.map(payment => {
      if (payment.id !== paymentId) return payment;
      if (verified === true) return { ...payment, walletVerified: true };
      const next = { ...payment };
      delete next.walletVerified;
      return next;
    }) })
  }) };
}

export function applyLateFeeToBill(state, customerId, month, { amount = 100, reason = 'Late payment surcharge' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill) throw new Error(`Bill for month ${month} not found on customer #${customer.customerNumber}.`);
  const lateFeeNum = Number(amount);
  if (!Number.isFinite(lateFeeNum) || lateFeeNum <= 0) throw new Error('Late fee amount must be a positive number.');
  const cleanFee = Math.round(lateFeeNum * 100) / 100;
  const cleanReason = String(reason || 'Late payment surcharge').trim();
  const amountHistory = [...(bill.amountHistory ?? [])];
  amountHistory.push({
    changedAt: localDateTimeValue(referenceDate),
    type: 'late_fee_applied',
    previousLateFee: bill.lateFee ?? 0,
    lateFee: cleanFee,
    note: cleanReason
  });
  const updatedBill = {
    ...bill,
    lateFee: cleanFee,
    lateFeeAppliedAt: localDateTimeValue(referenceDate),
    lateFeeReason: cleanReason,
    amountHistory
  };
  return {
    ...state,
    customers: state.customers.map(c => c.id !== customerId ? c : {
      ...c,
      bills: c.bills.map(b => b.month !== month ? b : updatedBill)
    })
  };
}

export function waiveLateFeeFromBill(state, customerId, month, { reason = 'Late fee waived by owner' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill) throw new Error(`Bill for month ${month} not found on customer #${customer.customerNumber}.`);
  if (!bill.lateFee) return state;
  const cleanReason = String(reason || 'Late fee waived by owner').trim();
  const amountHistory = [...(bill.amountHistory ?? [])];
  amountHistory.push({
    changedAt: localDateTimeValue(referenceDate),
    type: 'late_fee_waived',
    previousLateFee: bill.lateFee,
    lateFee: 0,
    note: cleanReason
  });
  const updatedBill = {
    ...bill,
    lateFee: 0,
    lateFeeAppliedAt: null,
    lateFeeReason: cleanReason,
    amountHistory
  };
  return {
    ...state,
    customers: state.customers.map(c => c.id !== customerId ? c : {
      ...c,
      bills: c.bills.map(b => b.month !== month ? b : updatedBill)
    })
  };
}

/**
 * SISP-28: record a house shift / relocation on the customer record.
 * Updates the customer's ACTIVE zone and address to the new values
 * (mohalla untouched; installed fiberMeters untouched — extra meters
 * are logged on the entry only). When addFeeToBill is true, a positive
 * shifting fee is added to the CURRENT month's bill as a dedicated
 * shiftingFee field (late-fee precedent — calculatePaymentAllocations
 * includes it, so SISP-2 netDue picks it up with no billing-cycle.js
 * change). When no current-month bill exists, the fee stays logged on
 * the entry (feeAppliedToBill: false) and NO bill is invented.
 * Historical bills are never modified. Returns the new state
 * (input untouched). Throws on a blank new address/zone, an invalid
 * shift date, or a negative fiber/fee value.
 */
export function recordCustomerRelocation(state, customerId, input = {}, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const cleanText = (value, maxLength, label) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > maxLength) throw new Error(`${label} is too long (max ${maxLength} characters).`);
    return text;
  };
  const toAddress = cleanText(input.toAddress ?? '', 200, 'New house address');
  if (!toAddress) throw new Error('Enter the new house address.');
  const toZone = cleanText(input.toZone ?? '', 100, 'New zone');
  if (!toZone) throw new Error('Enter the new zone.');
  const fromAddress = cleanText(input.fromAddress ?? customer.address ?? '', 200, 'Previous house address');
  const fromZone = cleanText(input.fromZone ?? customer.zone ?? '', 100, 'Previous zone');
  const shiftedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(input.shiftedAt ?? '')) ? String(input.shiftedAt) : dateKey(referenceDate);
  let extraFiberMeters = null;
  if (input.extraFiberMeters !== null && input.extraFiberMeters !== undefined && String(input.extraFiberMeters).trim() !== '') {
    const n = Number(input.extraFiberMeters);
    if (!Number.isFinite(n) || n < 0) throw new Error('Extra fiber meters must be zero or more.');
    extraFiberMeters = n;
  }
  let shiftingFee = 0;
  if (input.shiftingFee !== null && input.shiftingFee !== undefined && String(input.shiftingFee).trim() !== '') {
    const n = Number(input.shiftingFee);
    if (!Number.isFinite(n) || n < 0) throw new Error('Shifting fee must be zero or more.');
    shiftingFee = Math.round(n * 100) / 100;
  }
  const log = Array.isArray(customer.relocationLog) ? [...customer.relocationLog] : [];
  let maxId = 0;
  for (const entry of log) {
    const match = /^REL-(\d+)$/.exec(String(entry?.id || ''));
    if (match) maxId = Math.max(maxId, Number(match[1]));
  }
  const entryId = `REL-${maxId + 1}`;
  const currentMonth = monthKey(referenceDate);
  const currentBill = (customer.bills ?? []).find(bill => bill.month === currentMonth);
  let feeAppliedToBill = false;
  let feeBillMonth = null;
  let bills = customer.bills ?? [];
  if (input.addFeeToBill === true && shiftingFee > 0 && currentBill) {
    const previousFee = Number(currentBill.shiftingFee || 0);
    const newFee = Math.round((previousFee + shiftingFee) * 100) / 100;
    const amountHistory = [...(currentBill.amountHistory ?? [])];
    amountHistory.push({
      changedAt: localDateTimeValue(referenceDate),
      type: 'shifting_fee_applied',
      previousShiftingFee: previousFee,
      shiftingFee: newFee,
      note: `House shift ${fromZone || 'zone not recorded'} → ${toZone} (${entryId})`
    });
    bills = bills.map(bill => bill.month !== currentMonth ? bill : {
      ...bill,
      shiftingFee: newFee,
      shiftingFeeAppliedAt: localDateTimeValue(referenceDate),
      amountHistory
    });
    feeAppliedToBill = true;
    feeBillMonth = currentMonth;
  }
  log.push({
    id: entryId,
    fromAddress, toAddress, fromZone, toZone,
    extraFiberMeters, shiftingFee, feeAppliedToBill, feeBillMonth,
    shiftedAt, recordedAt: localDateTimeValue(referenceDate)
  });
  return {
    ...state,
    customers: state.customers.map(c => c.id !== customerId ? c : {
      ...c,
      zone: toZone,
      address: toAddress,
      relocationLog: log,
      bills
    })
  };
}


// SISP-30: Outage concession (Reaayat). Mirrors the late-fee shape: the bill
// amount itself is never rewritten — the concession rides as audited bill
// fields (concessionAmount + concessionReason + concessionAppliedAt) plus an
// amountHistory entry, and presentation layers subtract it from the net due.
// Dispute Guard: applying SETS the amount (never adds, so re-applying cannot
// stack) and clamps it to the bill's gross amount (dueAmount + lateFee), so
// a concession can never increase a due or drive it below zero.
export function applyConcessionToBill(state, customerId, month, { amount = 0, reason = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill) throw new Error(`Bill for month ${month} not found on customer #${customer.customerNumber}.`);
  const gross = Number(bill.dueAmount) + Number(bill.lateFee || 0);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Cannot apply an outage concession to an unpriced bill.');
  const requested = Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('Concession amount must be a positive number.');
  const cleanAmount = Math.min(Math.round(requested * 100) / 100, Math.round(gross * 100) / 100);
  const cleanReason = String(reason || 'Outage Reaayat').trim() || 'Outage Reaayat';
  const amountHistory = [...(bill.amountHistory ?? [])];
  amountHistory.push({
    changedAt: localDateTimeValue(referenceDate),
    type: 'concession_applied',
    previousConcession: bill.concessionAmount ?? 0,
    concession: cleanAmount,
    note: cleanReason
  });
  const updatedBill = {
    ...bill,
    concessionAmount: cleanAmount,
    concessionReason: cleanReason,
    concessionAppliedAt: localDateTimeValue(referenceDate),
    amountHistory
  };
  return {
    ...state,
    customers: state.customers.map(c => c.id !== customerId ? c : {
      ...c,
      bills: c.bills.map(b => b.month !== month ? b : updatedBill)
    })
  };
}

export function removeConcessionFromBill(state, customerId, month, { reason = 'Outage concession removed by owner' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill) throw new Error(`Bill for month ${month} not found on customer #${customer.customerNumber}.`);
  if (!bill.concessionAmount) return state;
  const cleanReason = String(reason || 'Outage concession removed by owner').trim();
  const amountHistory = [...(bill.amountHistory ?? [])];
  amountHistory.push({
    changedAt: localDateTimeValue(referenceDate),
    type: 'concession_removed',
    previousConcession: bill.concessionAmount,
    concession: 0,
    note: cleanReason
  });
  const updatedBill = {
    ...bill,
    concessionAmount: 0,
    concessionReason: cleanReason,
    concessionAppliedAt: null,
    amountHistory
  };
  return {
    ...state,
    customers: state.customers.map(c => c.id !== customerId ? c : {
      ...c,
      bills: c.bills.map(b => b.month !== month ? b : updatedBill)
    })
  };
}

export function recordedAmount(bill) {
  // SISP-34: voided payments are kept as history but are not receipts.
  return (bill?.payments ?? []).filter((p) => p?.voided !== true).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Summarize recorded receipt rows only. Bill amounts and derived credit are not
 * cash; stable payment IDs keep an accidentally repeated ledger row from counting twice.
 * Monthly buckets follow the actual payment date, not the bill month.
 */
export function summarizeCustomerReceipts(customer) {
  const seenPaymentIds = new Set();
  const monthlyCents = new Map();
  let totalCents = 0;
  let receiptCount = 0;
  for (const bill of Array.isArray(customer?.bills) ? customer.bills : []) {
    for (const payment of Array.isArray(bill?.payments) ? bill.payments : []) {
      if (!payment || typeof payment !== 'object') continue;
      // SISP-34: voided receipts are history, not cash — never counted.
      if (payment.voided === true) continue;
      const paymentId = typeof payment.id === 'string' ? payment.id.trim() : '';
      if (paymentId && seenPaymentIds.has(paymentId)) continue;
      let date;
      try { date = checkOptionalDate(payment.date, 'Payment date'); } catch { continue; }
      const amount = Number(payment.amount);
      if (!date || !Number.isFinite(amount) || amount <= 0) continue;
      const amountCents = moneyCents(amount);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) continue;
      if (paymentId) seenPaymentIds.add(paymentId);
      totalCents += amountCents;
      const month = date.slice(0, 7);
      const bucket = monthlyCents.get(month) ?? { amountCents:0, receiptCount:0 };
      bucket.amountCents += amountCents;
      bucket.receiptCount++;
      monthlyCents.set(month, bucket);
      receiptCount++;
    }
  }
  return {
    total:moneyValue(totalCents),
    receiptCount,
    monthly:[...monthlyCents.entries()].sort(([a],[b]) => b.localeCompare(a)).map(([month,bucket]) => ({ month, amount:moneyValue(bucket.amountCents), receiptCount:bucket.receiptCount }))
  };
}

/**
 * Calculate ISP time from an explicit connection date. Profile creation, billing
 * start, manual online status, and missing archive dates are never used as substitutes.
 */
export function summarizeCustomerTenure(customer, referenceDate = new Date()) {
  const safeDate = (value, label) => { try { return checkOptionalDate(value, label); } catch { return null; } };
  const connectionDate = safeDate(customer?.connectionDate, 'Connection date');
  const profileAddedOn = safeDate(customer?.addedOn, 'Customer added date');
  if (!connectionDate) return { status:'not-recorded', connectionDate:null, profileAddedOn, endDate:null, serviceMonths:null };
  const today = dateKey(referenceDate);
  if (connectionDate > today) return { status:'future', connectionDate, profileAddedOn, endDate:null, serviceMonths:null };

  const cancellationDate = safeDate(customer?.cancellationDate, 'Cancellation date');
  const expiryDate = safeDate(customer?.expiryDate, 'Expiry date');
  const archiveDate = customer?.archived === true
    ? safeDate(typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 10) : customer.archivedAt, 'Archive date')
    : null;
  const ended = customer?.archived === true || Boolean(cancellationDate && cancellationDate <= today) || Boolean(expiryDate && expiryDate < today);
  const endDate = [cancellationDate && cancellationDate <= today ? cancellationDate : null, expiryDate && expiryDate < today ? expiryDate : null, archiveDate && archiveDate <= today ? archiveDate : null].filter(Boolean).sort()[0] ?? null;
  if (ended && !endDate) return { status:'end-date-unknown', connectionDate, profileAddedOn, endDate:null, serviceMonths:null };
  const effectiveEndDate = endDate ?? today;
  if (effectiveEndDate < connectionDate) return { status:'date-review', connectionDate, profileAddedOn, endDate:effectiveEndDate, serviceMonths:null };
  const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const serviceMonths = monthIndex(effectiveEndDate) - monthIndex(connectionDate) + 1;
  return { status:endDate ? 'ended' : 'current', connectionDate, profileAddedOn, endDate, serviceMonths };
}

const monthAllocationKey = (customerId, month) => JSON.stringify([customerId, month]);

/**
 * New-customers-by-month report (view-only aggregation over saved data).
 *
 * A customer's join month is the month they were added (addedOn), falling
 * back to their connection date, then their billing-start month, then
 * their earliest saved bill month. Customers with none of these are
 * counted separately as undated — never forced into a month. Archived
 * customers are included: they did join in that month, even if they
 * were archived later. Nothing here rewrites balances or billing.
 */
function monthOfDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}
function earliestBillMonth(customer) {
  const months = (Array.isArray(customer.bills) ? customer.bills : [])
    .map(bill => bill?.month)
    .filter(month => validMonthString(month));
  if (!months.length) return null;
  return months.sort()[0];
}
export function customerJoinMonth(customer) {
  if (!customer) return null;
  return monthOfDate(customer.addedOn)
    ?? monthOfDate(customer.connectionDate)
    ?? (validMonthString(customer.billingStartMonth) ? customer.billingStartMonth : null)
    ?? earliestBillMonth(customer);
}
function summarizeOnboarding(customers) {
  let connectionFees = 0, routersIssued = 0, routerTotal = 0, fiberMeters = 0;
  for (const customer of customers) {
    const fee = Number(customer?.connectionFee);
    if (Number.isFinite(fee) && fee > 0) connectionFees += fee;
    if (String(customer?.routerModel ?? '').trim()) routersIssued += 1;
    const price = Number(customer?.routerPrice);
    if (Number.isFinite(price) && price > 0) routerTotal += price;
    const meters = Number(customer?.fiberMeters);
    if (Number.isFinite(meters) && meters > 0) fiberMeters += meters;
  }
  return {
    count: customers.length,
    connectionFees: Math.round(connectionFees * 100) / 100,
    routersIssued,
    routerTotal: Math.round(routerTotal * 100) / 100,
    fiberMeters: Math.round(fiberMeters * 10) / 10
  };
}
export function buildNewCustomerReport(customers, referenceDate = new Date()) {
  const list = Array.isArray(customers) ? customers : [];
  const byMonth = new Map();
  let undatedCount = 0;
  for (const customer of list) {
    const month = customerJoinMonth(customer);
    if (!month) { undatedCount += 1; continue; }
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(customer);
  }
  const months = [...byMonth.keys()].sort().reverse().map(month => {
    const monthCustomers = byMonth.get(month).slice()
      .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
    return { month, customers: monthCustomers, totals: summarizeOnboarding(monthCustomers) };
  });
  return { months, undatedCount, totalCustomers: list.length, currentMonth: monthKey(referenceDate) };
}
export function newCustomerQuickRanges(referenceDate = new Date()) {
  const current = monthKey(referenceDate);
  return {
    thisMonth: { start: current, end: current, label: 'This month' },
    lastMonth: { start: shiftMonth(current, -1), end: shiftMonth(current, -1), label: 'Last month' },
    last3Months: { start: shiftMonth(current, -2), end: current, label: 'Last 3 months' },
    last6Months: { start: shiftMonth(current, -5), end: current, label: 'Last 6 months' }
  };
}
export function filterNewCustomerMonths(months, startMonth, endMonth) {
  return (Array.isArray(months) ? months : [])
    .filter(entry => entry.month >= startMonth && entry.month <= endMonth);
}

/**
 * Recompute same-month receipt use and chronological carry-forward from the saved
 * actual payment entries. Allocations are derived, never duplicated as payments;
 * unused credit remains attached to its original receipt until a later bill exists.
 */
export function calculatePaymentAllocations(state) {
  const byPaymentId = new Map();
  const byCustomerMonth = new Map();
  for (const customer of state.customers) {
    const pendingCredits = [];
    // SISP-111: deduct one bill's credit-transfer-out stamps from the
    // pending-credit entries THIS bill's payments generated. Each
    // stamp names the exact source payment (credit-transfer.js
    // distributed the transfer over the payments holding unapplied
    // credit), so the transferred value leaves the pool at its
    // source and can never be spent twice by a later bill. A stamp
    // whose payment no longer holds credit here (the payment was
    // voided afterwards, or the data was edited) deducts nothing —
    // the pool simply reports what is really left, exactly like the
    // Khata Doctor's clamped deduction. Bills without the field
    // (every legacy bill) skip this entirely.
    const applyCreditTransferOutStamps = (stampedBill, summary) => {
      const stamps = Array.isArray(stampedBill?.creditTransferOut) ? stampedBill.creditTransferOut : [];
      for (const stamp of stamps) {
        const amountCents = moneyCents(stamp?.amount || 0);
        if (!(amountCents > 0) || typeof stamp?.paymentId !== 'string' || !stamp.paymentId) continue;
        const entry = pendingCredits.find((credit) => credit.sourceSummary === summary && credit.paymentLedger.paymentId === stamp.paymentId);
        if (!entry || entry.remainingCents <= 0) continue;
        const appliedCents = Math.min(entry.remainingCents, amountCents);
        entry.remainingCents -= appliedCents;
        entry.paymentLedger.creditTransferredOutCents = (entry.paymentLedger.creditTransferredOutCents ?? 0) + appliedCents;
      }
    };
    const bills = [...(customer.bills ?? [])].sort((a,b) => a.month.localeCompare(b.month));
    for (const bill of bills) {
      const key = monthAllocationKey(customer.id, bill.month);
      const summary = { customerId:customer.id, month:bill.month, billAmountCents:null, baseAmountCents:null, lateFeeCents:0, shiftingFeeCents:0, actualReceiptsCents:0, discountAppliedCents:0, sameMonthAppliedCents:0, creditAppliedCents:0, creditSources:[], balanceDueCents:null, excessGeneratedCents:0, creditForwardedCents:0, pendingCreditCents:0 };
      byCustomerMonth.set(key, summary);
      const payments = [...(bill.payments ?? [])].filter((p) => p?.voided !== true).sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      summary.actualReceiptsCents = payments.reduce((sum,payment) => sum + moneyCents(payment.amount), 0);
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        // Unpriced bill: nothing can be applied to this month yet, so the whole
        // receipt is unused credit. Hold it in pendingCredits exactly like a
        // priced bill's overpayment — otherwise an advance collected before
        // the bill was priced vanished from every later bill, the monthly
        // report and the dashboard pending-credit total.
        for (const payment of payments) {
          const amountCents = moneyCents(payment.amount);
          // SISP-43: the ticket-charge portion of the receipt is consumed
          // by the tickets — only the rest is unused credit here.
          const ticketChargeCents = paymentTicketChargeCents(payment);
          // SISP-106: the boost-charge portion is consumed by the boost
          // log the same way — it is never unused credit either.
          const addonChargeCents = paymentAddonChargeCents(payment);
          // Owner feature (2026-10-29): the manual baqaya portion of a
          // receipt is likewise consumed by the baqaya entries — only
          // the rest is unused credit here.
          const manualBaqayaCents = paymentManualBaqayaCents(payment);

          // SISP-61: on an unpriced bill a prepay's upfront discount is
          // pure coverage (nothing has been applied yet) — it joins the
          // credit in full, reserved for its target month below, so the
          // customer is credited cash + discount = the full gross.
          const prepayDiscountCents = prepayTermsOf(payment) ? moneyCents(payment.discount || 0) : 0;
          const creditCents = Math.max(0, amountCents - ticketChargeCents - addonChargeCents - manualBaqayaCents) + prepayDiscountCents;
          const paymentLedger = { paymentId:payment.id, customerId:customer.id, customerNumber:customer.customerNumber, customerName:customer.name, originMonth:bill.month, date:payment.date, method:payment.method, amount:Number(payment.amount), discount:payment.discount ? Number(payment.discount) : 0, discountReason:payment.discountReason || '', allocations:[], excessCents:creditCents, unappliedCreditCents:0, billUnpriced:true, ticketChargeCents, addonChargeCents, manualBaqayaCents, targetMonth:advancePaymentTargetMonth(payment), ...(prepayDiscountCents > 0 ? { prepayDiscountCreditCents:prepayDiscountCents } : {}) };

          byPaymentId.set(payment.id, paymentLedger);
          if (creditCents > 0) {
            summary.excessGeneratedCents += creditCents;
            pendingCredits.push({ paymentLedger, sourceSummary:summary, remainingCents:creditCents, targetMonth:paymentLedger.targetMonth });
          }
        }
        applyCreditTransferOutStamps(bill, summary);
        continue;
      }

      const baseAmountCents = moneyCents(amount);
      const lateFeeCents = moneyCents(bill.lateFee || 0);
      const shiftingFeeCents = moneyCents(bill.shiftingFee || 0);
      const billAmountCents = baseAmountCents + lateFeeCents + shiftingFeeCents;
      summary.billAmountCents = billAmountCents;
      summary.baseAmountCents = baseAmountCents;
      summary.lateFeeCents = lateFeeCents;
      summary.shiftingFeeCents = shiftingFeeCents;
      let dueRemainingCents = billAmountCents;
      // SISP-50: a disconnection security-deposit offset already waived
      // part of this bill (audited bill fields stamped by
      // hardware-custody.js applyDepositSettlement). It reduces the due
      // before advance credit and receipts apply — the same treatment
      // the Khata Doctor formula gives it. The field is absent on every
      // legacy bill, so all existing allocations are unchanged.
      dueRemainingCents -= Math.min(moneyCents(bill.depositOffsetAmount || 0), billAmountCents);
      // SISP-111: a cross-customer advance credit transfer stamped on
      // this bill (credit-transfer.js executeCreditTransfer) satisfies
      // part of the due with another customer's advance credit — no
      // cash moved and no payment was recorded, so collection and
      // drawer totals never see it. It reduces the due after the
      // deposit offset and before advance credit and receipts apply —
      // the same treatment the Khata Doctor formula gives it. The
      // field is absent on every legacy bill, so all existing
      // allocations are unchanged.
      dueRemainingCents -= Math.min(moneyCents(bill.creditTransferInAmount || 0), Math.max(0, dueRemainingCents));
      // SISP-64: a bad-debt write-off waives what is left of this bill
      // (audited bill fields stamped by bad-debt-ledger.js
      // writeOffBadDebt). It reduces the due after the deposit offset
      // and before advance credit and receipts apply — the same
      // treatment the Khata Doctor formula gives it — so collection
      // targets, the forecaster and defaulter lists stop counting
      // money the operator has declared uncollectible. The field is
      // absent on every legacy bill, so all existing allocations are
      // unchanged.
      dueRemainingCents -= Math.min(moneyCents(bill.badDebtWriteOffAmount || 0), Math.max(0, dueRemainingCents));
      // FU1b: the SISP-40 referral credit and the SISP-30 outage
      // concession ride as audited bill fields exactly like the
      // deposit offset — billing-cycle.js withReferralCredit and
      // applyConcessionToBill both stamp the field WITHOUT rewriting
      // dueAmount, and receipts/Doctor subtract them — so the engine
      // must subtract them here too, before advance credit and
      // receipts apply. Without this, a bill settled by credit +
      // cash stayed 'partial' and arrearsAndAdvance carried the
      // waived amount into the next cycle as phantom arrears. Each
      // is clamped to the remaining due (the deposit line's clamp
      // against billAmountCents is the same thing at its position,
      // where the remaining due IS the bill amount), so stacked
      // waivers can never drive the due negative or inflate the
      // excess credit a receipt generates. Both fields are absent
      // on legacy bills, so existing allocations are unchanged.
      dueRemainingCents -= Math.min(moneyCents(bill.referralCreditAmount || 0), dueRemainingCents);
      dueRemainingCents -= Math.min(moneyCents(bill.concessionAmount || 0), dueRemainingCents);
      // Merge reconciliation (lands with FU1b): the SISP-97 feeder-host
      // bijli credit rides as the same shape of audited bill field —
      // billing-cycle stamps feederHostCreditAmount WITHOUT rewriting
      // dueAmount and the receipt surfaces subtract it — so the engine
      // subtracts it here too, clamped to the remaining due, or the
      // host's next cycle would carry phantom arrears equal to the
      // credit. Absent on legacy bills, so existing allocations are
      // unchanged.
      dueRemainingCents -= Math.min(moneyCents(bill.feederHostCreditAmount || 0), dueRemainingCents);
      // Advance month targeting: a targeted credit is RESERVED for its
      // month — the loop below skips it while its target is still in
      // the future, so it can never settle an earlier bill. This bill
      // is the first priced bill at or after the target month, so the
      // reservation ends here (before any application): the credit
      // applies to this bill below like any other, and whatever
      // remains afterwards flows onward as ordinary credit — the
      // money was FOR this month, not locked to it forever.
      for (const credit of pendingCredits) {
        if (credit.targetMonth && credit.targetMonth <= bill.month) credit.targetMonth = null;
      }
      for (const credit of pendingCredits) {
        if (dueRemainingCents <= 0) break;
        if (credit.targetMonth) continue;
        const appliedCents = Math.min(credit.remainingCents, dueRemainingCents);
        if (appliedCents <= 0) continue;
        credit.remainingCents -= appliedCents;
        dueRemainingCents -= appliedCents;
        summary.creditAppliedCents += appliedCents;
        credit.sourceSummary.creditForwardedCents += appliedCents;
        credit.paymentLedger.allocations.push({ month:bill.month, amountCents:appliedCents, kind:'carry-forward' });
        summary.creditSources.push({ paymentId:credit.paymentLedger.paymentId, originMonth:credit.paymentLedger.originMonth, paymentDate:credit.paymentLedger.date, method:credit.paymentLedger.method, receiptAmount:credit.paymentLedger.amount, amountCents:appliedCents });
      }
      for (let index = pendingCredits.length - 1; index >= 0; index--) if (pendingCredits[index].remainingCents <= 0) pendingCredits.splice(index, 1);

      let sameMonthReceiptCapacityCents = dueRemainingCents;
      for (const payment of payments) {
        const amountCents = moneyCents(payment.amount);
        // SISP-43: only the bill portion of the receipt can settle this
        // bill or become credit — the ticket-charge portion is already
        // spent on the tickets named in the payment's stamp.
        // Owner feature (2026-10-29): the manual baqaya portion named in
        // the payment's stamp is likewise already spent on the baqaya
        // entries — it is never bill money and never becomes credit.
        const ticketChargeCents = paymentTicketChargeCents(payment);
        const manualBaqayaCents = paymentManualBaqayaCents(payment);
        // SISP-106: the boost-charge portion is spent on the boosts
        // named in the payment's stamp, exactly like the ticket portion.
        const addonChargeCents = paymentAddonChargeCents(payment);
        const billPortionCents = Math.max(0, amountCents - ticketChargeCents - addonChargeCents - manualBaqayaCents);
        const discountCents = moneyCents(payment.discount || 0);
        const paymentLedger = { paymentId:payment.id, customerId:customer.id, customerNumber:customer.customerNumber, customerName:customer.name, originMonth:bill.month, date:payment.date, method:payment.method, amount:Number(payment.amount), discount:payment.discount ? Number(payment.discount) : 0, discountReason:payment.discountReason || '', allocations:[], excessCents:0, unappliedCreditCents:0, billUnpriced:false, ticketChargeCents, addonChargeCents, manualBaqayaCents, targetMonth:advancePaymentTargetMonth(payment) };

        byPaymentId.set(payment.id, paymentLedger);

        // SISP-61: a prepay's upfront discount is NOT a discount on
        // this bill — it is part of the multi-month coverage the
        // customer bought. It is therefore never applied against the
        // origin bill's capacity (where any remainder would vanish);
        // instead it converts in full into reserved pending credit
        // below, alongside the cash excess, under the payment's month
        // reservation. That is what credits the FULL gross: cash
        // settles what it settles, and cash remainder + discount ride
        // forward as coverage. Every non-prepay payment keeps the
        // same-month discount rule exactly as before.
        const prepayDiscountCents = prepayTermsOf(payment) ? discountCents : 0;
        if (prepayDiscountCents > 0) paymentLedger.prepayDiscountCreditCents = prepayDiscountCents;
        const appliedDiscountCents = prepayDiscountCents > 0 ? 0 : Math.min(discountCents, sameMonthReceiptCapacityCents);
        if (appliedDiscountCents > 0) {
          paymentLedger.allocations.push({ month:bill.month, amountCents:appliedDiscountCents, kind:'discount' });
          summary.discountAppliedCents += appliedDiscountCents;
          sameMonthReceiptCapacityCents -= appliedDiscountCents;
          dueRemainingCents -= appliedDiscountCents;
        }

        const appliedCents = Math.min(billPortionCents, sameMonthReceiptCapacityCents);
        if (appliedCents > 0) {
          paymentLedger.allocations.push({ month:bill.month, amountCents:appliedCents, kind:'same-month' });
          summary.sameMonthAppliedCents += appliedCents;
          sameMonthReceiptCapacityCents -= appliedCents;
          dueRemainingCents -= appliedCents;
        }
        const excessCents = billPortionCents - appliedCents;
        const forwardedCents = excessCents + prepayDiscountCents;
        if (forwardedCents > 0) {
          paymentLedger.excessCents = excessCents;
          summary.excessGeneratedCents += forwardedCents;
          pendingCredits.push({ paymentLedger, sourceSummary:summary, remainingCents:forwardedCents, targetMonth:paymentLedger.targetMonth });
        }
      }
      applyCreditTransferOutStamps(bill, summary);
      summary.balanceDueCents = Math.max(0, dueRemainingCents);
    }
    for (const credit of pendingCredits) {
      if (credit.remainingCents <= 0) continue;
      credit.sourceSummary.pendingCreditCents += credit.remainingCents;
      credit.paymentLedger.unappliedCreditCents += credit.remainingCents;
    }
  }
  return { byPaymentId, byCustomerMonth, forMonth:(customerId, month) => byCustomerMonth.get(monthAllocationKey(customerId, month)) };
}

function billStatusWithAllocations(customer, bill, allocations) {
  return derivedBillStatus(customer, bill, allocations);
}

export function effectiveBillStatus(customer, bill, referenceDate = new Date()) {
  const status = billStatusWithAllocations(customer, bill, calculatePaymentAllocations({ customers:[customer] }));
  return status === 'paid' ? 'received' : status === 'not-set' ? 'not-recorded' : 'pending';
}

export function listTransactions(state, { customerQuery = '', date = '', recencyDays = null } = {}, referenceDate = new Date()) {
  const query = String(customerQuery).trim().toLocaleLowerCase();
  const windowDays = recencyDays === null || recencyDays === undefined || recencyDays === '' || recencyDays === 'all' ? null : Number(recencyDays);
  if (windowDays !== null && ![7, 30, 90].includes(windowDays)) throw new Error('Choose All history, Last 7 days, Last 30 days, or Last 90 days.');
  const throughDate = windowDays === null ? null : dateKey(referenceDate);
  const fromDate = windowDays === null ? null : offsetDateKey(throughDate, 1 - windowDays);
  const allocations = calculatePaymentAllocations(state);
  return state.customers.flatMap(customer => (customer.bills ?? []).flatMap(bill => (bill.payments ?? []).map(payment => ({
    id: payment.id,
    paymentId: payment.id,
    // SISP-34: voided rows stay listed as history; totals skip them.
    voided: payment.voided === true,
    // Advance tag (legacy payments carry no kind and read as normal).
    isAdvance: isAdvancePayment(payment),
    // Advance month target (sanitized; null when untargeted) so the
    // Transactions list can show "Advance · for November 2026".
    targetMonth: advancePaymentTargetMonth(payment),
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    customerServiceStatus: customer.serviceStatus ?? 'not-set',
    customerPhone: customer.phone,
    customerAddress: customer.address,
    month: bill.month,
    billAmount: bill.dueAmount ?? null,
    balanceDueCents: allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? null,
    billDueDate: bill.dueDate ?? null,
    status: billStatusWithAllocations(customer, bill, allocations),
    date: payment.date,
    amount: Number(payment.amount),
    method: payment.method,
    paidBy: String(payment.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100),
    allocation:allocations.byPaymentId.get(payment.id)
  })))).filter(row => transactionMatchesQuery(row, query) && (!date || row.date === date) && (windowDays === null || (row.date >= fromDate && row.date <= throughDate)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName) || b.month.localeCompare(a.month) || a.paymentId.localeCompare(b.paymentId));
}

export function buildMonthlyReport(state, { month = monthsForHistory()[0], statusFilter = 'all', customerQuery = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (statusFilter === 'unpaid') statusFilter = 'pending';
  if (!['all', 'paid', 'pending', 'partial', 'not-set'].includes(statusFilter)) throw new Error('Choose All, Paid, Pending, Partial, or Not set.');
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => customerMatchesQuery(customer, customerQuery, allocations)).map(customer => {
    const bill = customer.bills.find(item => item.month === month);
    const configuredAmount = bill?.dueAmount ?? null;
    const amountReceived = recordedAmount(bill);
    const allocation = bill ? allocations.byCustomerMonth.get(monthAllocationKey(customer.id, month)) : null;
    let status = 'not-set';
    let balanceDue = null;
    let billAmount = null;
    let excessAmount = null;
    const creditApplied = moneyValue(allocation?.creditAppliedCents ?? 0);
    const creditForwarded = moneyValue(allocation?.creditForwardedCents ?? 0);
    const pendingCreditSources = [...allocations.byPaymentId.values()]
      .filter(source => source.customerId === customer.id && source.unappliedCreditCents > 0)
      .map(source => ({ paymentId:source.paymentId, originMonth:source.originMonth, paymentDate:source.date, method:source.method, receiptAmount:source.amount, amountCents:source.unappliedCreditCents, targetMonth:source.targetMonth ?? null }));
    const creditPending = moneyValue(pendingCreditSources.reduce((sum, source) => sum + source.amountCents, 0));
    if (configuredAmount !== null && configuredAmount !== undefined && configuredAmount !== '') {
      billAmount = Number(configuredAmount);
      excessAmount = moneyValue(allocation?.excessGeneratedCents ?? 0);
      balanceDue = moneyValue(allocation?.balanceDueCents ?? moneyCents(billAmount));
      status = billStatusWithAllocations(customer, bill, allocations);
    }
    return {
      customerId:customer.id,
      customerNumber:customer.customerNumber,
      customerName:customer.name,
      archived:customer.archived === true,
      serviceStatus:customer.serviceStatus ?? 'not-set',
      packageSpeed:customer.packageSpeed || '',
      ispProvider:customer.ispProvider || '',
      monthlySellingAmount:customer.monthlySellingAmount,
      month,
      dueDate:bill?.dueDate ?? null,
      billAmount,
      amountReceived,
      balanceDue,
      excessAmount,
      creditApplied,
      creditSources:allocation?.creditSources ?? [],
      creditForwarded,
      creditPending,
      pendingCreditSources,
      status
    };
  }).filter(row => statusFilter === 'all' || row.status === statusFilter);
}

function monthlyClosingMetrics(state, month, allocations = calculatePaymentAllocations(state)) {
  const bills = state.customers.flatMap(customer => (customer.bills ?? []).filter(bill => bill.month === month).map(bill => ({ customer, bill })));
  const pricedBills = bills.filter(({ bill }) => bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== '' && Number.isFinite(Number(bill.dueAmount)) && Number(bill.dueAmount) > 0);
  const pendingCents = pricedBills.reduce((sum, { customer, bill }) => sum + (allocations.byCustomerMonth.get(monthAllocationKey(customer.id, month))?.balanceDueCents ?? moneyCents(bill.dueAmount)), 0);
  const pendingBillCount = pricedBills.filter(({ customer }) => (allocations.byCustomerMonth.get(monthAllocationKey(customer.id, month))?.balanceDueCents ?? 0) > 0).length;
  const payments = state.customers.flatMap(customer => (customer.bills ?? []).flatMap(bill => (bill.payments ?? []).filter(payment => !isVoidedPayment(payment) && typeof payment.date === 'string' && payment.date.slice(0, 7) === month)));
  const expenses = (state.expenses ?? []).filter(expense => typeof expense.date === 'string' && expense.date.slice(0, 7) === month);
  const collectionCents = payments.reduce((sum, payment) => sum + moneyCents(payment.amount), 0);
  const expenseCents = expenses.reduce((sum, expense) => sum + moneyCents(expense.amount), 0);
  return {
    totalCustomers:state.customers.filter(customer => customer.archived !== true).length,
    activeCustomerCount:state.customers.filter(customer => customer.archived !== true && customer.serviceStatus === 'active').length,
    offlineCustomerCount:state.customers.filter(customer => customer.archived !== true && customer.serviceStatus === 'offline').length,
    notSetCustomerCount:state.customers.filter(customer => customer.archived !== true && (customer.serviceStatus ?? 'not-set') === 'not-set').length,
    archivedCustomerCount:state.customers.filter(customer => customer.archived === true).length,
    billCount:bills.length,
    pricedBillCount:pricedBills.length,
    unpricedBillCount:bills.length - pricedBills.length,
    billedAmount:moneyValue(pricedBills.reduce((sum, row) => sum + moneyCents(row.bill.dueAmount), 0)),
    paymentCount:payments.length,
    collection:moneyValue(collectionCents),
    pendingBillCount,
    pending:moneyValue(pendingCents),
    expenseCount:expenses.length,
    expenses:moneyValue(expenseCents),
    profit:moneyValue(collectionCents - expenseCents)
  };
}

export function buildMonthlyClosingSnapshot(state, month, closedAt = new Date()) {
  if (!validMonthString(month)) throw new Error('Choose a valid month for the closing snapshot.');
  const allocations = calculatePaymentAllocations(state);
  const metrics = monthlyClosingMetrics(state, month, allocations);
  const previousMonth = shiftMonth(month, -1);
  const savedPrevious = (state.monthlyClosings ?? []).find(snapshot => snapshot.month === previousMonth);
  const previous = savedPrevious ?? monthlyClosingMetrics(state, previousMonth, allocations);
  const previousMonthComparison = {
    month:previousMonth,
    source:savedPrevious ? 'saved-snapshot' : 'local-ledger',
    activeCustomerCount:previous.activeCustomerCount,
    offlineCustomerCount:previous.offlineCustomerCount,
    notSetCustomerCount:previous.notSetCustomerCount,
    archivedCustomerCount:previous.archivedCustomerCount,
    billedAmount:previous.billedAmount,
    collection:previous.collection,
    pending:previous.pending,
    expenses:previous.expenses,
    profit:previous.profit
  };
  return { month, savedAt:localDateTimeValue(closedAt), ...metrics, previousMonthComparison };
}

export function saveMonthlyClosing(state, month, closedAt = new Date()) {
  const snapshot = buildMonthlyClosingSnapshot(state, month, closedAt);
  const monthlyClosings = [...(state.monthlyClosings ?? []).filter(row => row.month !== month), snapshot].sort((a, b) => b.month.localeCompare(a.month));
  return { ...state, monthlyClosings };
}

// Offline PWAs cannot run while closed: save the prior calendar month the first time
// the owner opens the app in a new month. Existing closes are immutable.
export function autoClosePreviousMonth(state, referenceDate = new Date()) {
  const previousMonth = shiftMonth(monthKey(referenceDate), -1);
  if ((state.monthlyClosings ?? []).some(snapshot => snapshot.month === previousMonth)) return state;
  return saveMonthlyClosing(state, previousMonth, referenceDate);
}

export function customerPackageProfit(customer) {
  if (customer?.monthlyPurchaseCost === null || customer?.monthlyPurchaseCost === undefined || customer?.monthlySellingAmount === null || customer?.monthlySellingAmount === undefined) return null;
  return moneyValue(moneyCents(customer.monthlySellingAmount) - moneyCents(customer.monthlyPurchaseCost));
}

/**
 * Collections count actual payment entries only and are grouped by their payment dates.
 * The 24-month window is based on retained bill months. Pending known bills are their stored
 * month-specific amount less payments recorded against that bill, floored at zero. Generated
 * bills retain price snapshots; derived credits from excess receipts roll forward to later
 * generated bills and are never counted as new cash. A bill marked received closes its due
 * but never creates a collection entry.
 * Expected monthly package profit is selling amount minus provider purchase cost for complete profiles.
 */
export function calculateDashboard(state, referenceDate = new Date()) {
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthKey(referenceDate);
  const previousMonth = shiftMonth(currentMonth, -1);
  const today = dateKey(referenceDate);
  let totalCollectionCents = 0;
  let todayCollectionCents = 0;
  let previousMonthCollectionCents = 0;
  let totalDueCents = 0;
  let currentMonthDueCents = 0;
  let expectedMonthlyPackageProfitCents = 0;
  let expectedMonthlyProviderCostCents = 0;
  const pendingCreditCents = [...allocations.byPaymentId.values()].reduce((sum, receipt) => sum + (receipt.unappliedCreditCents ?? 0), 0);
  let unpricedBillCount = 0;
  let completeProfitProfiles = 0;
  let customersMissingProviderCost = 0;
  const providerGroups = new Map();

  for (const customer of state.customers) {
    if (!customer.archived) {
      const profit = customerPackageProfit(customer);
      if (profit !== null) {
        completeProfitProfiles++;
        expectedMonthlyPackageProfitCents += moneyCents(profit);
      }
      const providerName = String(customer.ispProvider ?? '').trim();
      const cost = customer.monthlyPurchaseCost;
      const hasCost = !(cost === null || cost === undefined || cost === '' || !Number.isFinite(Number(cost)) || Number(cost) < 0);
      if (!hasCost) customersMissingProviderCost++;
      if (providerName || hasCost) {
        const provider = providerName || 'Provider name not set';
        const providerKey = provider.toLocaleLowerCase();
        const group = providerGroups.get(providerKey) ?? { provider, expectedMonthlyCostCents:0, profilesWithCost:0, profilesMissingCost:0 };
        if (!providerName && group.provider !== 'Provider name not set') group.provider = provider;
        if (hasCost) {
          const cents = moneyCents(cost);
          group.expectedMonthlyCostCents += cents;
          group.profilesWithCost++;
          expectedMonthlyProviderCostCents += cents;
        } else {
          group.profilesMissingCost++;
        }
        providerGroups.set(providerKey, group);
      }
    }

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const retainedBills = bills.filter(bill => retainedMonths.has(bill.month));
    for (const bill of bills) for (const payment of bill.payments ?? []) {
      // FU4: SISP-34 voided receipts are history, not collected cash.
      if (isVoidedPayment(payment)) continue;
      const paymentCents = moneyCents(payment.amount);
      if (retainedMonths.has(bill.month)) totalCollectionCents += paymentCents;
      if (payment.date === today) todayCollectionCents += paymentCents;
      if (typeof payment.date === 'string' && payment.date.slice(0, 7) === previousMonth) previousMonthCollectionCents += paymentCents;
    }
    for (const bill of retainedBills) {
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '') {
        unpricedBillCount++;
        continue;
      }
      const allocation = allocations.byCustomerMonth.get(monthAllocationKey(customer.id, bill.month));
      const outstandingCents = allocation?.balanceDueCents ?? moneyCents(amount);
      totalDueCents += outstandingCents;
      if (bill.month === currentMonth) currentMonthDueCents += outstandingCents;
    }

  }

  const activeCustomers = state.customers.filter(customer => !customer.archived);
  const incompleteProfitProfiles = activeCustomers.length - completeProfitProfiles;
  return {
    totalCustomers: activeCustomers.length,
    archivedCustomers:state.customers.length - activeCustomers.length,
    activeServiceCount:activeCustomers.filter(customer => customer.serviceStatus === 'active').length,
    offlineServiceCount:activeCustomers.filter(customer => customer.serviceStatus === 'offline').length,
    unsetServiceCount:activeCustomers.filter(customer => !['active','offline'].includes(customer.serviceStatus)).length,
    totalCollection: moneyValue(totalCollectionCents),
    totalDue: moneyValue(totalDueCents),
    todayCollection: moneyValue(todayCollectionCents),
    previousMonthCollection: moneyValue(previousMonthCollectionCents),
    currentMonthDue: moneyValue(currentMonthDueCents),
    pendingCredit: moneyValue(pendingCreditCents),
    expectedMonthlyPackageProfit: moneyValue(expectedMonthlyPackageProfitCents),
    expectedMonthlyProviderCost:moneyValue(expectedMonthlyProviderCostCents),
    customersMissingProviderCost,
    providerCostBreakdown:[...providerGroups.values()].sort((a,b) => a.provider.localeCompare(b.provider)).map(group => ({ provider:group.provider, expectedMonthlyCost:moneyValue(group.expectedMonthlyCostCents), profilesWithCost:group.profilesWithCost, profilesMissingCost:group.profilesMissingCost })),
    currentMonth,
    previousMonth,
    today,
    customersMissingSellingAmount: activeCustomers.filter(customer => customer.monthlySellingAmount === null || customer.monthlySellingAmount === undefined || customer.monthlySellingAmount === '').length,
    incompleteProfitProfiles,
    unpricedBillCount
  };
}

function paymentLines(customer, bill, allocations) {
  return (bill.payments ?? []).map(payment => {
    const allocation = allocations.byPaymentId.get(payment.id);
    const sameMonthCents = (allocation?.allocations ?? []).filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
    const carried = (allocation?.allocations ?? []).filter(item => item.kind === 'carry-forward');
    const serviceLabel = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[customer.serviceStatus] ?? 'Not set';
    const billingLabel = ({ paid:'Paid', pending:'Pending', partial:'Partial', 'not-set':'Not set' })[billStatusWithAllocations(customer, bill, allocations)];
    const lines = [`Customer number: ${customer.customerNumber}`, `Customer: ${customer.name}`, `Service status (manual, not billing status): ${serviceLabel}`, `Billing status: ${billingLabel}`, `Selected bill month: ${bill.month}`, `Actual payment date: ${payment.date}`, `Amount: ${formatPKR(payment.amount)} (actual receipt, counted once)`, `Method: ${payment.method}`];
    const paidBy = String(payment.paidBy ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
    if (paidBy) lines.push(`Paid by: ${paidBy}`);
    if (allocation?.billUnpriced) lines.push('Allocation: selected bill has no saved amount; the full receipt is held as credit for later bills.');
    else lines.push(`Applied to selected bill: ${formatPKR(moneyValue(sameMonthCents))}`);
    for (const item of carried) lines.push(`Auto-credit applied to ${item.month}: ${formatPKR(moneyValue(item.amountCents))} (allocation, not a new payment)`);
    if (allocation?.unappliedCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatPKR(moneyValue(allocation.unappliedCreditCents))}`);
    return `${lines.join('\n')}\n`;
  });
}

export function exportAllPayments(state) {
  const lines = ['Shahdara ISP Billing — payment details', 'Exported from this device only', ''];
  const allocations = calculatePaymentAllocations(state);
  let count = 0;
  for (const customer of state.customers) for (const bill of customer.bills) for (const line of paymentLines(customer, bill, allocations)) { lines.push(line); count++; }
  if (!count) lines.push('No payment entries have been recorded.');
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportCustomerHistory(state, customerId) {
  const customer = customerOrThrow(state, customerId);
  const allocations = calculatePaymentAllocations(state);
  const lines = [
    'Shahdara ISP Billing — customer history',
    `Customer number: ${customer.customerNumber ?? 'Not assigned'}`,
    `Customer: ${customer.name}`,
    `Mohalla: ${customer.mohalla || 'Not recorded'}`,
    `Address: ${customer.address || 'Not recorded'}`,
    `Phone: ${customer.phone || 'Not recorded'}`,
    `ISP/provider: ${customer.ispProvider || 'Not set'}`,
    `Manual service status (not billing status): ${({ active:'Active', offline:'Offline', 'not-set':'Not set' })[customer.serviceStatus] ?? 'Not set'}`,
    `Package / speed: ${customer.packageSpeed || 'Not set'}`,
    `Monthly provider purchase cost: ${formatPKR(customer.monthlyPurchaseCost)}`,
    `Monthly selling amount: ${formatPKR(customer.monthlySellingAmount)}`,
    `Expected monthly package profit: ${formatPKR(customerPackageProfit(customer))}`,
    `Archive status: ${customer.archived ? `Archived since ${customer.archivedAt ?? 'date not recorded'}` : 'Active'}`,
    `Automatic billing resumes from month: ${customer.billingStartMonth ?? 'Not limited by an archive resume date'}`,
    ''
  ];
  if (!customer.bills.length) lines.push('No billing details have been recorded.');
  for (const bill of [...customer.bills].sort((a,b) => a.month.localeCompare(b.month))) {
    const status = ({ paid:'Paid', pending:'Pending', partial:'Partial', 'not-set':'Not set' })[billStatusWithAllocations(customer, bill, allocations)];
    const allocation = allocations.forMonth(customer.id, bill.month);
    lines.push(`Month: ${bill.month}`, `Status: ${status}`, `Bill amount: ${formatPKR(bill.dueAmount)}`, `Optional due date: ${bill.dueDate ?? 'Not set — no due-date rule or penalty applied'}`, `Actual payments received: ${formatPKR(recordedAmount(bill))}`, `Carry-forward credit applied to this bill (not new cash): ${formatPKR(moneyValue(allocation?.creditAppliedCents ?? 0))}`, `Balance due after payments and credits: ${allocation?.balanceDueCents === null || allocation?.balanceDueCents === undefined ? 'Not recorded' : formatPKR(moneyValue(allocation.balanceDueCents))}`);
    for (const source of allocation?.creditSources ?? []) lines.push(`  Credit source: original ${formatPKR(source.receiptAmount)} receipt dated ${source.paymentDate} (${source.method}) from ${source.originMonth}; applied here=${formatPKR(moneyValue(source.amountCents))}`);
    if (bill.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined) lines.push(`Automatic monthly bill price snapshot: ${formatPKR(bill.priceSnapshot)}`);
    if (allocation?.excessGeneratedCents) lines.push(`Excess from this month's receipts: ${formatPKR(moneyValue(allocation.excessGeneratedCents))}`);
    if (allocation?.creditForwardedCents) lines.push(`Credit automatically applied to later generated bills: ${formatPKR(moneyValue(allocation.creditForwardedCents))}`);
    if (allocation?.pendingCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatPKR(moneyValue(allocation.pendingCreditCents))}`);
    for (const correction of bill.amountHistory ?? []) lines.push(`  Bill amount correction at ${correction.changedAt}: previous=${formatPKR(correction.previousAmount)}, new=${formatPKR(correction.newAmount)}`);
    for (const line of paymentLines(customer, bill, allocations)) lines.push(`  ${line.trim().replaceAll('\n',' | ')}`);
    lines.push('');
  }
  if (!(customer.incidents ?? []).length) lines.push('No complaint/outage records have been recorded.');
  else {
    lines.push('Manual complaint/outage records');
    for (const incident of [...customer.incidents].sort((a,b) => a.reportedAt.localeCompare(b.reportedAt))) {
      lines.push(
        `Reported at: ${incident.reportedAt}`,
        `Offline since: ${incident.offlineAt}`,
        `Restored online at: ${incident.restoredAt ?? 'Not restored'}`,
        `Incident state: ${incident.restoredAt ? 'Resolved' : 'Open'}`,
        `Complaint/resolution note: ${incident.note || 'Not recorded'}`
      );
      for (const correction of incident.corrections ?? []) lines.push(`  Correction at ${correction.recordedAt}: previous report=${correction.previous.reportedAt}, offline=${correction.previous.offlineAt}, restored=${correction.previous.restoredAt ?? 'Open'}, note=${correction.previous.note || 'Not recorded'}`);
      lines.push('');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}


export const BACKUP_FORMAT = 'shahdara-isp-billing-backup';
const MAX_BACKUP_CHARACTERS = 25 * 1024 * 1024;
const deepCopy = value => JSON.parse(JSON.stringify(value));
const isBlank = value => value === null || value === undefined || value === '';
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validMonthString(value) { return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
function validStoredDateTime(value, label) {
  if (value === null || value === undefined || value === '') return;
  if (parseLocalDateTime(value) === null) throw new Error(`Backup contains an invalid ${label}.`);
}
// FU5b: ledgers written before the FU5 writer fix carry referral-credit
// stamps that billing-cycle.js withReferralCredit produced via
// Date#toISOString() ("2026-10-02T12:00:00.000Z") — a shape the strict
// validation above has always rejected, so a backup exported from such
// a ledger could never be restored even though the stamp came from
// this app's own writer. Backup validation converts ONLY that one
// known writer's stamps back to the house local format: the history
// entry's type must be exactly 'referral_credit_applied' and the value
// must be a strict ISO-8601 UTC timestamp naming a real instant (the
// UTC components must survive a round trip, so rollovers like
// "2026-02-30…" and junk like "2026-13-45T99:99:99Z" stay invalid).
// Every other value passes through untouched and keeps failing
// validation exactly as before — a format conversion for one known
// stamp, not a loosening of the validator.
const LEGACY_ISO_UTC_STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;
function legacyIsoUtcToLocalDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = LEGACY_ISO_UTC_STAMP.exec(value);
  if (!match) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day
    || instant.getUTCHours() !== hour || instant.getUTCMinutes() !== minute || instant.getUTCSeconds() !== second) return null;
  return localDateTimeValue(instant);
}
// Returns normalized COPIES for one bill: any 'referral_credit_applied'
// amountHistory entry whose changedAt is a legacy ISO stamp is copied
// with the converted local stamp, and — when the bill carries such an
// entry — an ISO-shaped referralCreditAppliedAt (the same stamp, set
// by the same writer) is converted too. Entries that do not qualify
// keep their original object identity, so nothing else about the bill
// changes and strict validation still judges them as-is.
function normalizeLegacyReferralStamps(bill) {
  const sourceHistory = Array.isArray(bill.amountHistory) ? bill.amountHistory : [];
  let sawReferralEntry = false;
  const amountHistory = sourceHistory.map(entry => {
    if (!entry || typeof entry !== 'object' || entry.type !== 'referral_credit_applied') return entry;
    sawReferralEntry = true;
    const converted = legacyIsoUtcToLocalDateTime(entry.changedAt);
    return converted === null ? entry : { ...entry, changedAt: converted };
  });
  let referralCreditAppliedAt = bill.referralCreditAppliedAt;
  let appliedAtChanged = false;
  if (sawReferralEntry) {
    const converted = legacyIsoUtcToLocalDateTime(bill.referralCreditAppliedAt);
    if (converted !== null) { referralCreditAppliedAt = converted; appliedAtChanged = true; }
  }
  return { amountHistory, referralCreditAppliedAt, appliedAtChanged };
}
function validateMonthlyClosingSnapshots(value) {
  if (!Array.isArray(value) || value.length > 1200) throw new Error('Saved monthly closing snapshots have an invalid structure.');
  const months = new Set();
  return value.map(snapshot => {
    if (!snapshot || typeof snapshot !== 'object' || !validMonthString(snapshot.month) || months.has(snapshot.month)) throw new Error('Saved monthly closing snapshots contain an invalid or duplicate month.');
    months.add(snapshot.month);
    if (typeof snapshot.savedAt !== 'string' || parseLocalDateTime(snapshot.savedAt) === null) throw new Error(`Monthly closing ${snapshot.month} has an invalid saved date.`);
    for (const field of ['totalCustomers','activeCustomerCount','offlineCustomerCount','notSetCustomerCount','archivedCustomerCount','billCount','pricedBillCount','unpricedBillCount','paymentCount','pendingBillCount','expenseCount']) if (!Number.isSafeInteger(snapshot[field]) || snapshot[field] < 0) throw new Error(`Monthly closing ${snapshot.month} has an invalid ${field}.`);
    if (snapshot.pricedBillCount + snapshot.unpricedBillCount !== snapshot.billCount) throw new Error(`Monthly closing ${snapshot.month} has inconsistent bill counts.`);
    for (const field of ['billedAmount','collection','pending','expenses','profit']) if (!Number.isFinite(Number(snapshot[field])) || Math.abs(Number(snapshot[field])) > 1e12 || Math.abs(Number(snapshot[field]) * 100 - Math.round(Number(snapshot[field]) * 100)) > 1e-6) throw new Error(`Monthly closing ${snapshot.month} has an invalid ${field}.`);
    const previous = snapshot.previousMonthComparison;
    if (!previous || previous.month !== shiftMonth(snapshot.month, -1) || !['saved-snapshot','local-ledger'].includes(previous.source)) throw new Error(`Monthly closing ${snapshot.month} has an invalid previous-month comparison.`);
    for (const field of ['activeCustomerCount','offlineCustomerCount','notSetCustomerCount','archivedCustomerCount']) if (!Number.isSafeInteger(previous[field]) || previous[field] < 0) throw new Error(`Monthly closing ${snapshot.month} has an invalid previous-month ${field}.`);
    for (const field of ['billedAmount','collection','pending','expenses','profit']) if (!Number.isFinite(Number(previous[field])) || Math.abs(Number(previous[field])) > 1e12 || Math.abs(Number(previous[field]) * 100 - Math.round(Number(previous[field]) * 100)) > 1e-6) throw new Error(`Monthly closing ${snapshot.month} has an invalid previous-month ${field}.`);
    return { month:snapshot.month, savedAt:snapshot.savedAt, totalCustomers:snapshot.totalCustomers, activeCustomerCount:snapshot.activeCustomerCount, offlineCustomerCount:snapshot.offlineCustomerCount, notSetCustomerCount:snapshot.notSetCustomerCount, archivedCustomerCount:snapshot.archivedCustomerCount, billCount:snapshot.billCount, pricedBillCount:snapshot.pricedBillCount, unpricedBillCount:snapshot.unpricedBillCount, billedAmount:Number(snapshot.billedAmount), paymentCount:snapshot.paymentCount, collection:Number(snapshot.collection), pendingBillCount:snapshot.pendingBillCount, pending:Number(snapshot.pending), expenseCount:snapshot.expenseCount, expenses:Number(snapshot.expenses), profit:Number(snapshot.profit), previousMonthComparison:{ month:previous.month, source:previous.source, activeCustomerCount:previous.activeCustomerCount, offlineCustomerCount:previous.offlineCustomerCount, notSetCustomerCount:previous.notSetCustomerCount, archivedCustomerCount:previous.archivedCustomerCount, billedAmount:Number(previous.billedAmount), collection:Number(previous.collection), pending:Number(previous.pending), expenses:Number(previous.expenses), profit:Number(previous.profit) } };
  }).sort((a,b)=>b.month.localeCompare(a.month));
}
function validBackupAmount(value, label, allowZero = false) {
  if (isBlank(value)) return;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) throw new Error(`Backup contains an invalid ${label}.`);
}
function validateBackupState(source) {
  if (!source || typeof source !== 'object' || source.version !== 1 || !Array.isArray(source.customers)) throw new Error('Backup has an unsupported or incomplete state version. No local data has changed.');
  if (source.customers.length > 10000) throw new Error('Backup contains too many customer profiles.');
  const customerIds = new Set(); const customerNumbers = new Set(); const customerNames = new Set();
  const billIds = new Set(); const paymentIds = new Set(); const incidentIds = new Set();
  const customers = source.customers.map((customer, customerIndex) => {
    if (!customer || typeof customer !== 'object' || typeof customer.id !== 'string' || !customer.id || customer.id.length > 200) throw new Error(`Backup customer ${customerIndex + 1} has an invalid unique ID.`);
    if (customerIds.has(customer.id)) throw new Error(`Backup has a duplicate customer ID: ${customer.id}.`);
    customerIds.add(customer.id);
    if (!Number.isSafeInteger(customer.customerNumber) || customer.customerNumber < 1 || customerNumbers.has(customer.customerNumber)) throw new Error(`Backup has a missing or duplicate customer number near ${customer.name || customerIndex + 1}.`);
    customerNumbers.add(customer.customerNumber);
    if (typeof customer.name !== 'string' || !customer.name.trim() || customer.name.length > 100) throw new Error(`Backup customer #${customer.customerNumber} has an invalid name.`);
    const normalizedName = customer.name.trim().toLocaleLowerCase();
    if (customerNames.has(normalizedName)) throw new Error(`Backup has duplicate customer names matching “${customer.name.trim()}”.`);
    customerNames.add(normalizedName);
    for (const [field, limit, label] of [['mohalla',100,'mohalla'],['zone',100,'zone'],['address',200,'address'],['notes',1000,'customer notes'],['phone',40,'phone number'],['whatsappPhone',40,'WhatsApp number'],['alternatePhone',40,'alternate phone number'],['cnic',30,'CNIC'],['ispProvider',100,'ISP/provider name'],['packageSpeed',80,'package/speed'],['wifiSsid',64,'Wi-Fi SSID'],['wifiPassword',100,'Wi-Fi password'],['routerAdminPassword',100,'router admin password']]) {
      if (customer[field] !== undefined && (typeof customer[field] !== 'string' || customer[field].length > limit)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid ${label}.`);
    }
    // SISP-94: a stored router admin port must be a real TCP port.
    if (customer.routerAdminPort !== undefined && customer.routerAdminPort !== null && (!Number.isInteger(customer.routerAdminPort) || customer.routerAdminPort < 1 || customer.routerAdminPort > 65535)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid router admin port.`);
    if (customer.serviceStatus !== undefined && !['active','offline','not-set'].includes(customer.serviceStatus)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid manual service status.`);
    validBackupAmount(customer.monthlySellingAmount, `selling amount for customer #${customer.customerNumber}`);
    validBackupAmount(customer.monthlyPurchaseCost, `provider cost for customer #${customer.customerNumber}`, true);
    if (customer.archived !== undefined && typeof customer.archived !== 'boolean') throw new Error(`Backup customer #${customer.customerNumber} has an invalid archive status.`);
    if (customer.billingStartMonth !== null && customer.billingStartMonth !== undefined && !validMonthString(customer.billingStartMonth)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid billing resume month.`);
    validStoredDateTime(customer.archivedAt, 'archive date');
    if (customer.addedOn !== null && customer.addedOn !== undefined && customer.addedOn !== '') checkOptionalDate(customer.addedOn, 'Customer added date');
    for (const field of ['connectionDate','expiryDate','cancellationDate']) if (customer[field] !== null && customer[field] !== undefined && customer[field] !== '') checkOptionalDate(customer[field], `${field} date`);
    const schedule = customer.monthlyPriceSchedule ?? [];
    const packageHistory = customer.packageHistory ?? [];
    const sourceBills = customer.bills ?? [];
    const sourceIncidents = customer.incidents ?? [];
    if (!Array.isArray(schedule) || !Array.isArray(packageHistory) || !Array.isArray(sourceBills) || !Array.isArray(sourceIncidents)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid billing/history list.`);
    for (const change of packageHistory) {
      if (!change || typeof change !== 'object') throw new Error(`Backup customer #${customer.customerNumber} has an invalid package change.`);
      checkOptionalDate(change.date ?? null, 'Package change date');
      validStoredDateTime(change.recordedAt, 'package change record date');
      for (const field of ['oldPackage','newPackage','staffName']) if (change[field] !== undefined && (typeof change[field] !== 'string' || change[field].length > 100)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid package history field.`);
      validBackupAmount(change.oldMonthlyRate, 'previous monthly rate');
      validBackupAmount(change.newMonthlyRate, 'new monthly rate');
      if (change.monthlyRecurringPriceDelta !== null && change.monthlyRecurringPriceDelta !== undefined && !Number.isFinite(Number(change.monthlyRecurringPriceDelta))) throw new Error(`Backup customer #${customer.customerNumber} has an invalid package price delta.`);
      if (change.proRataAdjustment !== null && change.proRataAdjustment !== undefined && !Number.isFinite(Number(change.proRataAdjustment))) throw new Error(`Backup customer #${customer.customerNumber} has an invalid pro-rata adjustment.`);
      if (change.proRatedBillAmount !== null && change.proRatedBillAmount !== undefined && !Number.isFinite(Number(change.proRatedBillAmount))) throw new Error(`Backup customer #${customer.customerNumber} has an invalid pro-rated bill amount.`);
    }
    // SISP-28: relocation entries travel with the customer; old backups
    // without the field import as an empty log (backward compatible).
    const relocationLog = customer.relocationLog ?? [];
    if (!Array.isArray(relocationLog)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid relocation log.`);
    for (const entry of relocationLog) {
      if (!entry || typeof entry !== 'object') throw new Error(`Backup customer #${customer.customerNumber} has an invalid relocation entry.`);
      for (const field of ['fromAddress', 'toAddress', 'fromZone', 'toZone']) if (entry[field] !== undefined && (typeof entry[field] !== 'string' || entry[field].length > 200)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid relocation field.`);
      checkOptionalDate(entry.shiftedAt ?? null, 'Relocation date');
      validStoredDateTime(entry.recordedAt, 'relocation record date');
      if (entry.extraFiberMeters !== null && entry.extraFiberMeters !== undefined && !Number.isFinite(Number(entry.extraFiberMeters))) throw new Error(`Backup customer #${customer.customerNumber} has an invalid relocation fiber length.`);
      validBackupAmount(entry.shiftingFee, 'relocation shifting fee', true);
    }
    // OWNER-SIGNAL: signal readings travel with the customer; old backups
    // without the field import as an empty history (backward compatible).
    // Entries are cleaned by sanitizeSignalReadings in the return below —
    // a malformed reading is dropped there, never invented or fatal.
    const backupSignalReadings = customer.signalReadings ?? [];
    if (!Array.isArray(backupSignalReadings)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid signal reading history.`);
    for (const entry of backupSignalReadings) {
      if (!entry || typeof entry !== 'object') throw new Error(`Backup customer #${customer.customerNumber} has an invalid signal reading.`);
    }
    const scheduleMonths = new Set();
    for (const entry of schedule) {
      if (!entry || !validMonthString(entry.effectiveMonth) || scheduleMonths.has(entry.effectiveMonth)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate price-effective month.`);
      scheduleMonths.add(entry.effectiveMonth);
      validBackupAmount(entry.amount, 'scheduled selling amount');
      validStoredDateTime(entry.recordedAt, 'price schedule date');
    }
    const billMonths = new Set();
    const bills = sourceBills.map(bill => {
      if (!bill || typeof bill.id !== 'string' || !bill.id || billIds.has(bill.id)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate bill ID.`);
      billIds.add(bill.id);
      if (!validMonthString(bill.month) || billMonths.has(bill.month)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid or duplicate billing month.`);
      billMonths.add(bill.month);
      if (!['pending','received'].includes(bill.status)) throw new Error(`Backup bill ${bill.month} has an invalid status.`);
      validBackupAmount(bill.dueAmount, `bill amount for ${bill.month}`);
      validBackupAmount(bill.priceSnapshot, `price snapshot for ${bill.month}`);
      const dueDate = checkOptionalDate(bill.dueDate ?? null);
      const hasPackageSnapshot = Object.hasOwn(bill, 'packageSnapshot');
      const packageSnapshot = hasPackageSnapshot ? validateBillPackageSnapshot(bill.packageSnapshot) : undefined;
      if (hasPackageSnapshot && !packageSnapshot) throw new Error(`Backup bill ${bill.month} has an invalid package snapshot.`);
      if (!Array.isArray(bill.payments ?? []) || !Array.isArray(bill.amountHistory ?? [])) throw new Error(`Backup bill ${bill.month} has an invalid payment or correction list.`);
      const payments = bill.payments.map(payment => {
        if (!payment || typeof payment.id !== 'string' || !payment.id || paymentIds.has(payment.id)) throw new Error(`Backup has a missing or duplicate payment ID for ${bill.month}.`);
        paymentIds.add(payment.id);
        const validatedPayment = validatePayment(payment);
        const mergedPayment = { ...payment, ...validatedPayment };
        // The raw spread resurrects any field validatePayment chose to
        // OMIT as invalid. For the proof screenshot that must not
        // happen: a wrong-typed proof in a backup is dropped here, not
        // carried into the ledger. (Other omitted fields keep the
        // historical spread behaviour — void stamps and later fields
        // ride this spread on purpose.)
        if (!('screenshot' in validatedPayment)) delete mergedPayment.screenshot;
        // SISP-63: same rule for sender proof metadata — when
        // validatePayment drops the sender fields (cash method, blank,
        // digits with no digits), the raw backup values must not be
        // resurrected by the spread; when it keeps them, the SANITIZED
        // values in validatedPayment win over the raw backup ones.
        if (!('senderTitle' in validatedPayment)) delete mergedPayment.senderTitle;
        if (!('senderDigits' in validatedPayment)) delete mergedPayment.senderDigits;
        return mergedPayment;
      });
      // FU5b: convert this bill's pre-FU5 ISO referral-credit stamps to
      // the local format BEFORE the strict validation below runs, so a
      // legacy backup restores carrying house-format stamps instead of
      // failing forever (and instead of re-exporting the same broken
      // stamp). Only 'referral_credit_applied' stamps convert; every
      // other entry is validated untouched. The parsed backup object
      // is never mutated — the normalized copies ride the bill built
      // at the end of this map.
      const legacyReferral = normalizeLegacyReferralStamps(bill);
      for (const correction of legacyReferral.amountHistory) {
        if (!correction || typeof correction !== 'object') throw new Error(`Backup bill ${bill.month} has an invalid amount correction.`);
        validStoredDateTime(correction.changedAt, 'bill correction date');
        validBackupAmount(correction.previousAmount, 'previous bill amount');
        validBackupAmount(correction.newAmount, 'corrected bill amount');
      }
      // Zero is a real value here: a waived fee is stored as lateFee: 0
      // (SISP-101 / waiveLateFeeFromBill) and must round-trip like the
      // SISP-28 shifting fee below, which already allows zero.
      const lateFee = bill.lateFee !== undefined && bill.lateFee !== null ? (validBackupAmount(bill.lateFee, `late fee for ${bill.month}`, true), Number(bill.lateFee) || 0) : undefined;
      const lateFeeAppliedAt = bill.lateFeeAppliedAt ? String(bill.lateFeeAppliedAt) : undefined;
      const lateFeeReason = bill.lateFeeReason ? String(bill.lateFeeReason) : undefined;
      // SISP-28: shifting fees ride the bill like late fees; sanitize them
      // on backup import so a malformed fee can never corrupt the ledger.
      const shiftingFee = bill.shiftingFee !== undefined && bill.shiftingFee !== null ? (validBackupAmount(bill.shiftingFee, `shifting fee for ${bill.month}`, true), Number(bill.shiftingFee) || 0) : undefined;
      const shiftingFeeAppliedAt = bill.shiftingFeeAppliedAt ? String(bill.shiftingFeeAppliedAt) : undefined;
      // SISP-4: kist lines ride the bill; sanitize them on backup import so
      // a malformed line can never corrupt the ledger or the cycle.
      const kistLines = sanitizeBillKistLines(bill.kistLines);
      const kistTotal = kistLines.reduce((sum, line) => sum + line.amount, 0);
      return { ...bill, dueDate, payments, amountHistory:legacyReferral.amountHistory, ...(legacyReferral.appliedAtChanged ? { referralCreditAppliedAt:legacyReferral.referralCreditAppliedAt } : {}), ...(hasPackageSnapshot ? { packageSnapshot } : {}), ...(lateFee !== undefined ? { lateFee, lateFeeAppliedAt, lateFeeReason } : {}), ...(shiftingFee !== undefined ? { shiftingFee, shiftingFeeAppliedAt } : {}), kistLines, kistTotal: Math.round(kistTotal * 100) / 100 };
    });
    const incidents = sourceIncidents.map(incident => {
      if (!incident || typeof incident.id !== 'string' || !incident.id || incidentIds.has(incident.id)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate incident ID.`);
      incidentIds.add(incident.id);
      validateIncident(incident);
      if (!Array.isArray(incident.corrections ?? [])) throw new Error(`Backup incident on customer #${customer.customerNumber} has an invalid correction list.`);
      for (const correction of incident.corrections ?? []) {
        if (!correction || !correction.previous) throw new Error(`Backup incident on customer #${customer.customerNumber} has an invalid correction entry.`);
        validStoredDateTime(correction.recordedAt, 'incident correction date');
        const previous = validateIncident(correction.previous);
        if (previous.reportedAt === '' || previous.offlineAt === '') throw new Error(`Backup incident on customer #${customer.customerNumber} has incomplete prior dates.`);
      }
      return { ...incident, ...validateIncident(incident), corrections:incident.corrections ?? [] };
    });
    return {
      ...customer,
      id:customer.id,
      name:customer.name.trim(),
      addedOn:checkOptionalDate(customer.addedOn ?? null, 'Customer added date'),
      mohalla:customer.mohalla ?? '', zone:customer.zone ?? '', address:customer.address ?? '', phone:customer.phone ?? '', cnic:customer.cnic ?? '', ispProvider:customer.ispProvider ?? '', serviceStatus:customer.serviceStatus ?? 'not-set', serviceStatusHistory:sanitizeServiceStatusHistory(customer.serviceStatusHistory), packageSpeed:customer.packageSpeed ?? '',
      monthlySellingAmount:customer.monthlySellingAmount ?? null, monthlyPurchaseCost:customer.monthlyPurchaseCost ?? null,
      monthlyPriceSchedule:schedule, billingStartMonth:customer.billingStartMonth ?? null, archived:customer.archived === true, archivedAt:customer.archived === true ? customer.archivedAt ?? null : null,
      // SISP-108: disconnect capture travels with the customer in JSON
      // backups (sanitized — a corrupt reason imports as not recorded).
      disconnectReason:sanitizeDisconnectDetails(customer).disconnectReason, winBackEligible:customer.winBackEligible === true, disconnectNote:sanitizeDisconnectDetails(customer).disconnectNote, disconnectHistory:sanitizeDisconnectHistory(customer.disconnectHistory), winBackOfferSentAt:sanitizeDisconnectDateTime(customer.winBackOfferSentAt),
      connectionDate:customer.connectionDate ?? null, expiryDate:customer.expiryDate ?? null, cancellationDate:customer.cancellationDate ?? null,
      connectionFee:customer.connectionFee ?? null, routerModel:customer.routerModel ?? '', routerPrice:customer.routerPrice ?? null, fiberMeters:customer.fiberMeters ?? null, mediaConverterCost:customer.mediaConverterCost ?? null, linemanInstallFee:customer.linemanInstallFee ?? null, fiberPerMeterRate:customer.fiberPerMeterRate ?? null,
      // SISP-19: custody fields travel with the customer in JSON backups.
      routerOwnership:customer.routerOwnership ?? '', mediaConverterOwnership:customer.mediaConverterOwnership ?? '', serialNumber:customer.serialNumber ?? '', securityDeposit:customer.securityDeposit ?? null,
      // SISP-50: the deposit settlement stamp travels in JSON backups.
      depositSettlement:sanitizeDepositSettlement(customer.depositSettlement),
      hardwareRecovered:{ router:customer.hardwareRecovered?.router ?? null, mediaConverter:customer.hardwareRecovered?.mediaConverter ?? null },
      // SISP-32: pole & landmark fields travel with the customer in JSON backups.
      poleNumber:customer.poleNumber ?? '', boxLocationNote:customer.boxLocationNote ?? '', dropWireCoreColor:customer.dropWireCoreColor ?? '',
      // SISP-118: WhatsApp + alternate contact numbers travel with the
      // customer in JSON backups (old backups import them as empty).
      whatsappPhone:customer.whatsappPhone ?? '', alternatePhone:customer.alternatePhone ?? '',
      // SISP-94: router credential vault fields travel with the customer in JSON backups.
      wifiSsid:customer.wifiSsid ?? '', wifiPassword:customer.wifiPassword ?? '', routerAdminPort:customer.routerAdminPort ?? null, routerAdminPassword:customer.routerAdminPassword ?? '',
      packageHistory, relocationLog, bills, incidents,
      // OWNER-SIGNAL: the signal reading history travels with the
      // customer, sanitized to the same shape readState produces.
      signalReadings: sanitizeSignalReadings(customer.signalReadings),      // SISP-4: installment plans travel with the customer; old backups
      // without the field import as an empty plan list (backward compatible).
      installmentPlans: sanitizeInstallmentPlans(customer.installmentPlans),
      // Owner feature (2026-10-29): manual baqaya entries travel with
      // the customer in JSON backups; old backups without the field
      // import as no entries (backward compatible).
      manualBaqaya: sanitizeManualBaqayaEntries(customer.manualBaqaya)
    };
  });
  const highestNumber = Math.max(0, ...customers.map(customer => customer.customerNumber));
  const nextCustomerNumber = Number.isSafeInteger(source.nextCustomerNumber) && source.nextCustomerNumber > 0 ? Math.max(source.nextCustomerNumber, highestNumber + 1) : highestNumber + 1;
  const phase3 = validatePhase3State(source);
  const monthlyClosings = validateMonthlyClosingSnapshots(source.monthlyClosings ?? []);
  return { ...source, ...phase3, version:1, nextCustomerNumber, customers, monthlyClosings };
}

export function createJsonBackup(state, exportedAt = new Date(), options = {}) {
  const safeState = deepCopy(state);
  const document = { format:BACKUP_FORMAT, formatVersion:1, exportedAt:localDateTimeValue(exportedAt), state:safeState };
  // #359: the owner's digital payment settings (Raast/Till/bank/QR printed on
  // receipts and WhatsApp reminders) live outside the ledger state, so backups
  // used to lose them silently on a device change. They now travel in an
  // optional top-level "settings" section. It is written only when the owner
  // actually changed something (never for factory defaults), and readers that
  // predate it ignore the unknown field — old backups and old app versions
  // keep working in both directions.
  if (options && typeof options === 'object' && options.digitalPaymentsSettings && typeof options.digitalPaymentsSettings === 'object') {
    const cleaned = sanitizeDigitalPaymentsSettings(options.digitalPaymentsSettings);
    const factory = sanitizeDigitalPaymentsSettings(getDefaultDigitalPaymentsSettings());
    if (!sameJson(cleaned, factory)) document.settings = { digitalPayments:cleaned };
  }
  // SISP-1: shop settlement records live outside the ledger state (localStorage
  // key sisp_shop_settlements_v1), so they travel in an optional
  // `settings.shopSettlements` section. Written only when at least one
  // settlement exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.shopSettlements) && options.shopSettlements.length) {
    const cleaned = sanitizeShopSettlements(options.shopSettlements);
    if (cleaned.length) document.settings = { ...(document.settings || {}), shopSettlements: cleaned };
  }
  // SISP-15: complaint register records live outside the ledger state
  // (localStorage key sisp_complaints_ledger_v1), so they travel in an
  // optional `settings.complaints` section. Written only when at least one
  // complaint exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.complaints) && options.complaints.length) {
    const cleaned = sanitizeComplaints(options.complaints);
    if (cleaned.length) document.settings = { ...(document.settings || {}), complaints: cleaned };
  }
  // Home Budget: personal household records live outside the ledger state
  // (localStorage key sisp_home_budget_v1), so they travel in an optional
  // `settings.homeBudget` section. Written only when at least one home
  // entry exists; readers that predate it ignore the unknown field. Home
  // money never enters the business ledger, even inside a backup.
  if (options && typeof options === 'object' && Array.isArray(options.homeBudget) && options.homeBudget.length) {
    const cleaned = sanitizeHomeBudget(options.homeBudget);
    if (cleaned.length) document.settings = { ...(document.settings || {}), homeBudget: cleaned };
  }
  // SISP-11: roznamcha day records live outside the ledger state
  // (localStorage key sisp_roznamcha_v1), so they travel in an
  // optional `settings.roznamchaDays` section. Written only when at
  // least one day exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.roznamchaDays) && options.roznamchaDays.length) {
    const cleaned = sanitizeRoznamchaDays(options.roznamchaDays);
    if (cleaned.length) document.settings = { ...(document.settings || {}), roznamchaDays: cleaned };
  }
  // SISP-12: field ticket records live outside the ledger state
  // (localStorage key sisp_tickets_v1), so they travel in an optional
  // `settings.tickets` section. Written only when at least one ticket
  // exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.tickets) && options.tickets.length) {
    const cleaned = sanitizeTickets(options.tickets);
    if (cleaned.length) document.settings = { ...(document.settings || {}), tickets: cleaned };
  }
  // SISP-18: stock book movements live outside the ledger state
  // (localStorage key sisp_inventory_v1), so they travel in an
  // optional `settings.inventory` section. Written only when at least one
  // movement exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.inventory) && options.inventory.length) {
    const cleaned = sanitizeInventory(options.inventory);
    if (cleaned.length) document.settings = { ...(document.settings || {}), inventory: cleaned };
  }
  // Loan ledger: personal loan entries live outside the ledger state
  // (localStorage key loan_ledger_v1), so they travel in an optional
  // `settings.loans` section. Written only when at least one entry exists;
  // readers that predate it ignore the unknown field. Loan money never
  // mixes with business ledgers, so this section is adopted on its own.
  if (options && typeof options === 'object' && Array.isArray(options.loans) && options.loans.length) {
    const cleaned = sanitizeLoanEntries(options.loans);
    if (cleaned.length) document.settings = { ...(document.settings || {}), loans: cleaned };
  }
  // SISP-25: WhatsApp templates live outside the ledger state
  // (localStorage key sisp_wa_templates_v1), so they travel in an
  // optional `settings.waTemplates` section. Written only when at least
  // one customized template exists; readers that predate it ignore the
  // unknown field.
  if (options && typeof options === 'object' && Array.isArray(options.waTemplates) && options.waTemplates.length) {
    const cleaned = sanitizeWaTemplates(options.waTemplates);
    if (cleaned.length) document.settings = { ...(document.settings || {}), waTemplates: cleaned };
  }
  // Saad visit log: visits + payments live outside the ledger state
  // (localStorage keys sisp_saad_visits_v1 / sisp_saad_payments_v1), so
  // they travel in optional `settings.saadVisits` / `settings.saadPayments`
  // sections. Written only when at least one record exists; readers that
  // predate them ignore the unknown fields.
  if (options && typeof options === 'object' && Array.isArray(options.saadVisits) && options.saadVisits.length) {
    const cleaned = sanitizeSaadVisits(options.saadVisits);
    if (cleaned.length) document.settings = { ...(document.settings || {}), saadVisits: cleaned };
  }
  if (options && typeof options === 'object' && Array.isArray(options.saadPayments) && options.saadPayments.length) {
    const cleaned = sanitizeSaadPayments(options.saadPayments);
    if (cleaned.length) document.settings = { ...(document.settings || {}), saadPayments: cleaned };
  }
  // Installation tracker: requests live outside the ledger state
  // (localStorage key sisp_install_requests_v1), so they travel in an
  // optional `settings.installRequests` section. Written only when at
  // least one request exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.installRequests) && options.installRequests.length) {
    const cleaned = sanitizeInstallRequests(options.installRequests);
    if (cleaned.length) document.settings = { ...(document.settings || {}), installRequests: cleaned };
  }
  // Pending works: notes live outside the ledger state
  // (localStorage key sisp_pending_works_v1), so they travel in an
  // optional `settings.pendingWorks` section. Written only when at
  // least one note exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.pendingWorks) && options.pendingWorks.length) {
    const cleaned = sanitizePendingWorks(options.pendingWorks);
    if (cleaned.length) document.settings = { ...(document.settings || {}), pendingWorks: cleaned };
  }
  // SISP-35: billing groups live outside the ledger state
  // (localStorage key sisp_billing_groups_v1), so they travel in an
  // optional `settings.billingGroups` section. Written only when at
  // least one group exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.billingGroups) && options.billingGroups.length) {
    const cleaned = sanitizeBillingGroups(options.billingGroups);
    if (cleaned.length) document.settings = { ...(document.settings || {}), billingGroups: cleaned };
  }
  // SISP-37: suspense (unidentified) wallet transfers live outside the
  // ledger state (localStorage key sisp_suspense_payments_v1), so they
  // travel in an optional `settings.suspensePayments` section. Written
  // only when at least one entry exists; readers that predate it ignore
  // the field.
  if (options && typeof options === 'object' && Array.isArray(options.suspensePayments) && options.suspensePayments.length) {
    const cleaned = sanitizeSuspensePayments(options.suspensePayments);
    if (cleaned.length) document.settings = { ...(document.settings || {}), suspensePayments: cleaned };
  }
  // SISP-122: street pole registry lives outside the ledger state
  // (localStorage key sisp_poles_registry_v1), so it travels in an
  // optional `settings.polesRegistry` section. Written only when at
  // least one pole exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.polesRegistry) && options.polesRegistry.length) {
    const cleaned = sanitizePolesRegistry(options.polesRegistry);
    if (cleaned.length) document.settings = { ...(document.settings || {}), polesRegistry: cleaned };
  }
  // SISP-119: fiber drum records live outside the ledger state
  // (localStorage key sisp_fiber_drums_v1), so they travel in an
  // optional `settings.fiberDrums` section. Written only when at least
  // one drum exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.fiberDrums) && options.fiberDrums.length) {
    const cleaned = sanitizeFiberDrums(options.fiberDrums);
    if (cleaned.length) document.settings = { ...(document.settings || {}), fiberDrums: cleaned };
  }
  // SISP-109: post-storm inspection runs live outside the ledger state
  // (localStorage key sisp_storm_inspections_v1), so they travel in an
  // optional `settings.stormInspections` section. Written only when at
  // least one dated run exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && options.stormInspections) {
    const cleaned = sanitizeStormInspections(options.stormInspections);
    if (cleaned.runs.length) document.settings = { ...(document.settings || {}), stormInspections: cleaned };
  }
  // SISP-107: supplier credit purchases (payable khata) live outside
  // the ledger state (localStorage key sisp_supplier_khata_v1), so they
  // travel in an optional `settings.supplierKhata` section. Written
  // only when at least one purchase exists; readers that predate it
  // ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.supplierKhata) && options.supplierKhata.length) {
    const cleaned = sanitizeSupplierKhata(options.supplierKhata);
    if (cleaned.length) document.settings = { ...(document.settings || {}), supplierKhata: cleaned };
  }
  // SISP-93: collector commission rules live outside the ledger state
  // (localStorage key sisp_commission_rules_v1), so they travel in an
  // optional `settings.commissionRules` section. Written only when at
  // least one rule exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.commissionRules) && options.commissionRules.length) {
    const cleaned = sanitizeCommissionRules(options.commissionRules);
    if (cleaned.length) document.settings = { ...(document.settings || {}), commissionRules: cleaned };
  }
  // SISP-62: power backup nodes (OLT / feeder UPS registry + outage
  // timers) live outside the ledger state (localStorage key
  // sisp_ups_nodes_v1), so they travel in an optional
  // `settings.upsNodes` section — including any running outage, so a
  // restore mid-loadshedding keeps the battery timer honest. Written
  // only when at least one node exists; readers that predate it
  // ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.upsNodes) && options.upsNodes.length) {
    const cleaned = sanitizeUpsNodes(options.upsNodes);
    if (cleaned.length) document.settings = { ...(document.settings || {}), upsNodes: cleaned };
  }
  // SISP-40: referral credit queue entries live outside the ledger state
  // (localStorage key sisp_referral_credits_v1), so they travel in an
  // optional `settings.referralCredits` section. Written only when at
  // least one entry exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.referralCredits) && options.referralCredits.length) {
    const cleaned = sanitizeReferralCredits(options.referralCredits);
    if (cleaned.length) document.settings = { ...(document.settings || {}), referralCredits: cleaned };
  }
  // SISP-111: cross-customer credit transfer records live outside the
  // ledger state (localStorage key sisp_credit_transfers_v1), so they
  // travel in an optional `settings.creditTransfers` section. Written
  // only when at least one entry exists; readers that predate it
  // ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.creditTransfers) && options.creditTransfers.length) {
    const cleaned = sanitizeCreditTransfers(options.creditTransfers);
    if (cleaned.length) document.settings = { ...(document.settings || {}), creditTransfers: cleaned };
  }
  // SISP-82: field tool custody records live outside the ledger state
  // (localStorage key sisp_field_tools_v1), so they travel in an
  // optional `settings.fieldTools` section. Written only when at least
  // one tool exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.fieldTools) && options.fieldTools.length) {
    const cleaned = sanitizeFieldTools(options.fieldTools);
    if (cleaned.length) document.settings = { ...(document.settings || {}), fieldTools: cleaned };
  }
  // SISP-78: joint closure (JC box) splice maps live outside the
  // ledger state (localStorage key sisp_splice_closures_v1), so they
  // travel in an optional `settings.spliceClosures` section. Written
  // only when at least one closure exists; readers that predate it
  // ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.spliceClosures) && options.spliceClosures.length) {
    const cleaned = sanitizeSpliceClosures(options.spliceClosures);
    if (cleaned.length) document.settings = { ...(document.settings || {}), spliceClosures: cleaned };
  }
  // SISP-64: bad-debt write-off records live outside the ledger state
  // (localStorage key sisp_bad_debts_v1), so they travel in an optional
  // `settings.badDebts` section. Written only when at least one entry
  // exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && Array.isArray(options.badDebts) && options.badDebts.length) {
    const cleaned = sanitizeBadDebts(options.badDebts);
    if (cleaned.length) document.settings = { ...(document.settings || {}), badDebts: cleaned };
  }
  // SISP-20: monthly closing notes live outside the ledger state
  // (localStorage key sisp_monthly_closing_notes_v1), so they travel in an
  // optional `settings.monthlyClosingNotes` section. Written only when at
  // least one note exists; readers that predate it ignore the unknown field.
  if (options && typeof options === 'object' && options.monthlyClosingNotes && typeof options.monthlyClosingNotes === 'object' && !Array.isArray(options.monthlyClosingNotes)) {
    const cleaned = sanitizeMonthlyClosingNotes(options.monthlyClosingNotes);
    if (Object.keys(cleaned).length) document.settings = { ...(document.settings || {}), monthlyClosingNotes: cleaned };
  }
  // SISP-92: splitter-box GPS pins live outside the ledger state
  // (localStorage key sisp_splitter_box_gps_v1), so they travel in an
  // optional `settings.splitterBoxGps` section. Written only when at
  // least one pin exists; readers that predate it ignore the field.
  if (options && typeof options === 'object' && options.splitterBoxGps && typeof options.splitterBoxGps === 'object' && !Array.isArray(options.splitterBoxGps)) {
    const cleaned = sanitizeSplitterBoxGps(options.splitterBoxGps);
    if (Object.keys(cleaned).length) document.settings = { ...(document.settings || {}), splitterBoxGps: cleaned };
  }
  // SISP-27: fixed overhead templates + postings live outside the ledger
  // state (localStorage key sisp_overheads_v1), so they travel in an
  // optional `settings.overheads` section. Written only when a default
  // override or a posting exists; readers that predate it ignore the
  // unknown field. Placed before the checksum stamp so the stamp covers it.
  if (options && typeof options === 'object' && options.overheads && typeof options.overheads === 'object' && !Array.isArray(options.overheads)) {
    const cleaned = sanitizeOverheads(options.overheads);
    if (cleaned.templates.length || cleaned.postings.length) document.settings = { ...(document.settings || {}), overheads: cleaned };
  }
  // SISP-10: checksum-verified transfer. The stamp covers the canonical
  // (key-sorted) form of the document, so it survives re-formatting, and
  // readers that predate it ignore the unknown field — old backups and old
  // app versions keep working in both directions.
  // SISP-22: partner ledger entries + monthly settlement slips live outside
  // the ledger state (localStorage keys sisp_partner_ledger_v1 /
  // sisp_partner_settlements_v1), so they travel in optional
  // `settings.partnerLedger` / `settings.partnerSettlements` sections.
  // Written only when at least one record exists; readers that predate
  // them ignore the unknown fields.
  if (options && typeof options === 'object' && Array.isArray(options.partnerLedger) && options.partnerLedger.length) {
    const cleaned = sanitizePartnerLedgerEntries(options.partnerLedger);
    if (cleaned.length) document.settings = { ...(document.settings || {}), partnerLedger: cleaned };
  }
  if (options && typeof options === 'object' && Array.isArray(options.partnerSettlements) && options.partnerSettlements.length) {
    const cleaned = sanitizePartnerSettlements(options.partnerSettlements);
    if (cleaned.length) document.settings = { ...(document.settings || {}), partnerSettlements: cleaned };
  }
  // SISP-73: the partner settings object (the Installation CapEx split
  // toggle, localStorage key sisp_partner_settings_v1) travels in an
  // optional `settings.partnerSettings` section. Like the SISP-46
  // branch-guard stamp it is written whenever the caller supplies it —
  // the toggle IS the owner's split choice and must round-trip onto a
  // fresh device. Readers that predate it ignore the unknown field.
  // Placed before the checksum stamp so the checksum covers it.
  if (options && typeof options === 'object' && options.partnerSettings && typeof options.partnerSettings === 'object' && !Array.isArray(options.partnerSettings)) {
    document.settings = { ...(document.settings || {}), partnerSettings: sanitizePartnerSettings(options.partnerSettings) };
  }
  // SISP-114: the optional charity / sadqah reserve percentage (device
  // setting, localStorage key sisp_charity_reserve_v1) travels in an
  // optional `settings.charityReserve` section. Written only when the
  // percentage is above 0 — 0% is the default on every device, so
  // there is nothing to carry — and placed before the checksum stamp
  // so the stamp covers it. Readers that predate it ignore the field.
  if (options && typeof options === 'object' && options.charityReserve && typeof options.charityReserve === 'object' && !Array.isArray(options.charityReserve)) {
    const cleaned = sanitizeCharityReserveSettings(options.charityReserve);
    if (cleaned.charityReservePct > 0) document.settings = { ...(document.settings || {}), charityReserve: cleaned };
  }
  // SISP-34: voided payment records live outside the ledger state
  // (localStorage key sisp_voided_payments_v1), so they travel in an
  // optional `settings.voidPayments` section. Written only when at least
  // one void exists; readers that predate it ignore the unknown field.
  // Placed BEFORE the checksum stamp so the checksum covers it.
  if (options && typeof options === 'object' && Array.isArray(options.voidPayments) && options.voidPayments.length) {
    const cleaned = sanitizeVoidPayments(options.voidPayments);
    if (cleaned.length) document.settings = { ...(document.settings || {}), voidPayments: cleaned };
  }
  // SISP-96: the owner's receipt footer settings (custom footer text,
  // EasyPaisa/NayaPay numbers, helpline, shops list) live outside the
  // ledger state (localStorage key sisp_receipt_footer_v1), so they
  // travel in an optional `settings.receiptFooter` section. Written
  // only when at least one field is configured (never for the empty
  // factory default); readers that predate it ignore the unknown field.
  // Placed BEFORE the checksum stamp so the checksum covers it.
  if (options && typeof options === 'object' && options.receiptFooter && typeof options.receiptFooter === 'object' && !Array.isArray(options.receiptFooter)) {
    const cleaned = sanitizeReceiptFooter(options.receiptFooter);
    if (!sameJson(cleaned, sanitizeReceiptFooter(getDefaultReceiptFooter()))) document.settings = { ...(document.settings || {}), receiptFooter: cleaned };
  }
  // SISP-46: the Multi-Branch Merge Guard stamp travels in an optional
  // `settings.branchGuard` section. Unlike the record sections above it
  // is written whenever the caller supplies a stamp (even for an empty
  // ledger — the stamp IS the lineage identity, and it must round-trip
  // onto a fresh device). Readers that predate it ignore the field.
  // Placed before the checksum stamp so the checksum covers it.
  if (options && typeof options === 'object' && options.branchGuard && typeof options.branchGuard === 'object') {
    const stamp = sanitizeBranchGuardStamp(options.branchGuard);
    if (stamp) document.settings = { ...(document.settings || {}), branchGuard: stamp };
  }
  document.checksum = computeBackupChecksum(document);  return JSON.stringify(document, null, 2);}

/**
 * Validate a JSON backup and produce a preview-only, non-destructive merge. Existing
 * nonblank profile fields and conflicting bill values always win; unique receipts,
 * bills, incidents and profiles are added only after the user explicitly applies it.
 */
export function previewJsonBackupMerge(existingState, backupText, options = {}) {
  if (typeof backupText !== 'string' || backupText.length > MAX_BACKUP_CHARACTERS) throw new Error('Backup is too large or is not readable JSON. No local data has changed.');
  let document;
  try { document = JSON.parse(backupText); }
  catch { throw new Error('Backup is not valid JSON. No local data has changed.'); }
  if (!document || typeof document !== 'object') throw new Error('Backup is not valid JSON. No local data has changed.');
  if (document.format !== BACKUP_FORMAT) throw new Error('This is not a supported Shahdara ISP Billing JSON backup. No local data has changed.');
  const formatVer = Number(document.formatVersion);
  if (formatVer > 1) throw new Error('Backup format version is newer than supported by this app. No local data has changed.');
  if (!formatVer || formatVer < 1) document.formatVersion = 1;
  // SISP-10: checksum verification runs AFTER deep validation, not before
  // it. A mismatch means the file was corrupted or edited in transit, so
  // the preview is apply-blocked (canApply false) and the UI warns — but
  // validation errors (duplicate IDs, invalid snapshots, bad expenses)
  // still surface with their specific messages instead of being masked.
  // A missing checksum means a legacy backup: it still merges, reported
  // as 'unverified' so the preview can warn.
  const checksum = verifyBackupChecksum(backupText);
  // SISP-46: Multi-Branch Merge Guard. The incoming backup's lineage
  // stamp (settings.branchGuard) is classified against this device's
  // guard record (options.currentBranchGuard). The classification runs
  // only when the caller supplies that option — older callers keep the
  // pre-guard behaviour exactly. A blocked verdict (foreign or diverged
  // lineage) forces canApply false unless the operator armed the
  // explicit override (options.branchGuardOverride === true); the
  // merge computation itself is never altered by the guard, and the
  // existing state is never mutated by a preview.
  const branchGuardStamp = sanitizeBranchGuardStamp(
    (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
      ? document.settings.branchGuard
      : undefined
  );
  const hasLocalGuardOption = Boolean(options && typeof options === 'object' && Object.hasOwn(options, 'currentBranchGuard'));
  const localBranchGuard = hasLocalGuardOption ? sanitizeBranchGuard(options.currentBranchGuard) : null;
  const branchGuardVerdict = !hasLocalGuardOption
    ? { status:'not-checked', blocked:false, requiresOverride:false, silent:true }
    : classifyBranchGuardRestore({ guard: localBranchGuard, stamp: branchGuardStamp, localCustomerCount: Array.isArray(existingState?.customers) ? existingState.customers.length : 0, localFingerprint: fingerprintState(existingState) });
  const branchGuard = { ...branchGuardVerdict, stamp: branchGuardStamp };
  const branchGuardOverrideApplied = branchGuard.blocked && options?.branchGuardOverride === true;
  const incomingState = validateBackupState(document.state);
  const current = deepCopy(existingState);
  const conflicts = [];
  const counts = { addedCustomers:0, mergedCustomers:0, addedBills:0, addedPayments:0, addedIncidents:0, addedInventoryItems:0, addedInventoryMovements:0, addedExpenses:0, addedSaadAttendanceDays:0, addedUmairWorkdays:0, addedMonthlyClosings:0, filledProfileFields:0, digitalPaymentsSettingsRestored:0, receiptFooterRestored:0, shopSettlementsRestored:0, complaintsRestored:0, roznamchaDaysRestored:0, ticketsRestored:0, monthlyClosingNotesRestored:0, splitterBoxGpsRestored:0, partnerLedgerRestored:0, partnerSettlementsRestored:0, charityReserveRestored:0, partnerSettingsRestored:0, voidPaymentsRestored:0, homeBudgetRestored:0, waTemplatesRestored:0, commissionRulesRestored:0, changes:0 };  const addConflict = (customer, field) => conflicts.push({ customerNumber:customer.customerNumber, name:customer.name, field });  const nonempty = value => !(value === null || value === undefined || value === '');  const mergeField = (target, source, key, customer) => {

    const oldValue = target[key]; const newValue = source[key];
    if (sameJson(oldValue, newValue) || (!nonempty(oldValue) && !nonempty(newValue))) return;
    if (key === 'serviceStatus' && (!oldValue || oldValue === 'not-set') && newValue !== 'not-set') { target[key] = newValue; counts.filledProfileFields++; counts.changes++; return; }
    if (!nonempty(oldValue) && nonempty(newValue)) { target[key] = deepCopy(newValue); counts.filledProfileFields++; counts.changes++; return; }
    if (nonempty(oldValue) && !nonempty(newValue)) return;
    addConflict(customer, key);
  };
  for (const backupCustomer of incomingState.customers) {
    const byId = current.customers.find(customer => customer.id === backupCustomer.id);
    const byNumber = current.customers.find(customer => customer.customerNumber === backupCustomer.customerNumber);
    const byName = current.customers.find(customer => customer.name.trim().toLocaleLowerCase() === backupCustomer.name.trim().toLocaleLowerCase());
    if (!byId) {
      if (byNumber || byName) {
        addConflict(backupCustomer, byNumber ? 'customer number belongs to a different profile' : 'customer name belongs to a different profile');
        continue;
      }
      current.customers.push(deepCopy(backupCustomer));
      counts.addedCustomers++; counts.addedBills += backupCustomer.bills.length; counts.addedPayments += backupCustomer.bills.reduce((sum,bill)=>sum+bill.payments.length,0); counts.addedIncidents += backupCustomer.incidents.length; counts.changes++;
      continue;
    }
    if (byId.customerNumber !== backupCustomer.customerNumber || byId.name.trim().toLocaleLowerCase() !== backupCustomer.name.trim().toLocaleLowerCase()) {
      addConflict(backupCustomer, 'customer ID, number, or name identity differs');
      continue;
    }
    counts.mergedCustomers++;
    const customer = byId;
    for (const key of ['mohalla','zone','address','phone','whatsappPhone','alternatePhone','cnic','ispProvider','serviceStatus','packageSpeed','monthlySellingAmount','monthlyPurchaseCost','billingStartMonth','connectionDate','expiryDate','cancellationDate','connectionFee','routerModel','routerPrice','fiberMeters','mediaConverterCost','linemanInstallFee','fiberPerMeterRate','routerOwnership','mediaConverterOwnership','serialNumber','securityDeposit','depositSettlement','addedOn','archived','archivedAt','promiseDate','promiseAmount','promiseNote','nameUrdu','upstreamCustomerId','fiberZone','feederHostCreditPKR','paused','pauseStartDate','autoResumeDate','pppoeUsername','pppoePassword','staticIp','macAddress','wifiSsid','wifiPassword','routerAdminPort','routerAdminPassword','poleNumber','boxLocationNote','dropWireCoreColor','referredByCustomerId','disconnectReason','disconnectNote','winBackOfferSentAt']) mergeField(customer, backupCustomer, key, backupCustomer);
    // SISP-84: connection type merges like serviceStatus's default —
    // 'commercial_vip' fills a local 'residential', and a local VIP tag
    // is never stripped by a merge. (The load sanitizer stamps
    // 'residential' on every legacy record, so the plain field merge
    // would report a conflict against that stamped default forever.)
    if (customer.connectionType !== 'commercial_vip' && backupCustomer.connectionType === 'commercial_vip') {
      customer.connectionType = 'commercial_vip'; counts.filledProfileFields++; counts.changes++;
    }
    // SISP-8: skipped months merge by union (a skipped month only ever
    // means "never backfill this month") — never a conflict, never lost.
    {
      const localSkipped = Array.isArray(customer.pauseSkippedMonths) ? customer.pauseSkippedMonths : [];
      const incomingSkipped = Array.isArray(backupCustomer.pauseSkippedMonths) ? backupCustomer.pauseSkippedMonths : [];
      const merged = [...new Set([...localSkipped, ...incomingSkipped].filter((month) => validMonthString(month)))].sort();
      if (!sameJson(localSkipped, merged)) { customer.pauseSkippedMonths = merged; counts.changes++; }
    }
    // SISP-19: recovery dates merge per item, not as a plain field fill:
    // a recovered item never becomes unrecovered, so when either side
    // holds a recovery date, the dated copy wins (first date kept when
    // both sides hold one — recovery history only moves forward).
    if (backupCustomer.hardwareRecovered && typeof backupCustomer.hardwareRecovered === 'object') {
      customer.hardwareRecovered = customer.hardwareRecovered && typeof customer.hardwareRecovered === 'object' ? customer.hardwareRecovered : { router:null, mediaConverter:null };
      for (const itemKey of ['router','mediaConverter']) {
        const incoming = backupCustomer.hardwareRecovered[itemKey];
        if (incoming && !customer.hardwareRecovered[itemKey]) { customer.hardwareRecovered[itemKey] = incoming; counts.changes++; }
      }
    }
    // SISP-4: installment plans merge by plan id (not a plain field fill):
    // a missing plan is adopted, and when both sides hold the same plan
    // the further-billed copy wins — plan progress only ever moves
    // forward, so taking the max monthsBilled never loses a billed kist.
    customer.installmentPlans = customer.installmentPlans ?? [];
    for (const incomingPlan of backupCustomer.installmentPlans ?? []) {
      const existingPlan = customer.installmentPlans.find((plan) => plan.id === incomingPlan.id);
      if (!existingPlan) { customer.installmentPlans.push(deepCopy(incomingPlan)); counts.changes++; continue; }
      if (sameJson(existingPlan, incomingPlan)) continue;
      const mergedPlan = sanitizeInstallmentPlans([{
        ...existingPlan,
        ...incomingPlan,
        monthsBilled: Math.max(existingPlan.monthsBilled ?? 0, incomingPlan.monthsBilled ?? 0),
        monthsPaid: Math.max(existingPlan.monthsPaid ?? 0, incomingPlan.monthsPaid ?? 0)
      }])[0];
      if (mergedPlan && !sameJson(existingPlan, mergedPlan)) {
        Object.assign(existingPlan, mergedPlan);
        counts.changes++;
      }
    }
    customer.packageHistory = customer.packageHistory ?? [];
    for (const change of backupCustomer.packageHistory ?? []) if (!customer.packageHistory.some(existing=>sameJson(existing,change))) { customer.packageHistory.push(deepCopy(change)); counts.changes++; }
    // SISP-108: win-back eligibility merges as an explicit boolean, NOT
    // a mergeField fill: a legacy record without the field reads as
    // false, so adopting an incoming false is shape normalization (no
    // change counted — the hardwareRecovered container precedent);
    // two explicit but different values conflict, local wins (the
    // 'archived' boolean precedent).
    if (customer.winBackEligible === undefined && backupCustomer.winBackEligible !== undefined) {
      customer.winBackEligible = backupCustomer.winBackEligible === true;
    } else if (customer.winBackEligible !== undefined && backupCustomer.winBackEligible !== undefined && (customer.winBackEligible === true) !== (backupCustomer.winBackEligible === true)) {
      addConflict(backupCustomer, 'winBackEligible');
    }
    // SISP-108: disconnect history merges by union — an archive event
    // recorded on either device stays recorded, and the same event is
    // never stored twice.
    {
      const mergedDisconnectHistory = sanitizeDisconnectHistory(customer.disconnectHistory ?? []);
      for (const entry of sanitizeDisconnectHistory(backupCustomer.disconnectHistory ?? [])) if (!mergedDisconnectHistory.some(existing => sameJson(existing, entry))) mergedDisconnectHistory.push(entry);
      const cappedDisconnectHistory = mergedDisconnectHistory.slice(-DISCONNECT_HISTORY_LIMIT);
      if (!sameJson(customer.disconnectHistory ?? [], cappedDisconnectHistory)) { customer.disconnectHistory = cappedDisconnectHistory; counts.changes++; }
    }
    // Uptime tracking: service-status history merges by union on
    // (status, at) — a restore never loses a recorded status flip from
    // either side, and the same flip is never stored twice.
    const mergedStatusHistory = sanitizeServiceStatusHistory([...(customer.serviceStatusHistory ?? []), ...(backupCustomer.serviceStatusHistory ?? [])]);
    const dedupedStatusHistory = [...new Map(mergedStatusHistory.map(entry => [`${entry.status}|${entry.at}`, entry])).values()];
    if (!sameJson(dedupedStatusHistory, sanitizeServiceStatusHistory(customer.serviceStatusHistory ?? []))) { customer.serviceStatusHistory = dedupedStatusHistory; counts.changes++; }
    // SISP-28: relocation entries merge by entry id (never duplicated, and
    // a differing entry with an id already on this device keeps the local
    // copy — relocation history only ever grows).
    customer.relocationLog = customer.relocationLog ?? [];
    for (const incomingEntry of backupCustomer.relocationLog ?? []) {
      if (!customer.relocationLog.some(existing => String(existing.id) === String(incomingEntry.id))) { customer.relocationLog.push(deepCopy(incomingEntry)); counts.changes++; }
    }
    // OWNER-SIGNAL: signal readings merge by reading id (never
    // duplicated, and a differing reading with an id already on this
    // device keeps the local copy — measurement history only ever grows).
    customer.signalReadings = customer.signalReadings ?? [];
    for (const incomingReading of backupCustomer.signalReadings ?? []) {
      if (!customer.signalReadings.some(existing => String(existing.id) === String(incomingReading.id))) { customer.signalReadings.push(deepCopy(incomingReading)); counts.changes++; }
    }
    // Owner feature (2026-10-29): manual baqaya entries merge by entry
    // id — an entry only the backup holds is adopted; an entry both
    // sides hold with different amount/date is a money conflict the
    // owner must see (the local copy is kept, like the price schedule).
    customer.manualBaqaya = sanitizeManualBaqayaEntries(customer.manualBaqaya);
    for (const incomingEntry of sanitizeManualBaqayaEntries(backupCustomer.manualBaqaya)) {
      const existingEntry = customer.manualBaqaya.find(entry => entry.id === incomingEntry.id);
      if (!existingEntry) { customer.manualBaqaya.push(deepCopy(incomingEntry)); counts.changes++; continue; }
      if (!sameJson(existingEntry, incomingEntry)) addConflict(backupCustomer, `manual baqaya ${incomingEntry.id}`);
    }
    for (const incomingEntry of backupCustomer.monthlyPriceSchedule) {
      const existingEntry = customer.monthlyPriceSchedule.find(entry => entry.effectiveMonth === incomingEntry.effectiveMonth);
      if (!existingEntry) { customer.monthlyPriceSchedule.push(deepCopy(incomingEntry)); counts.changes++; }
      else if (Number(existingEntry.amount) !== Number(incomingEntry.amount)) addConflict(backupCustomer, `price schedule ${incomingEntry.effectiveMonth}`);
    }
    customer.monthlyPriceSchedule.sort((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth));
    for (const incomingBill of backupCustomer.bills) {
      let existingBill = customer.bills.find(bill => bill.month === incomingBill.month);
      if (!existingBill) {
        customer.bills.push(deepCopy(incomingBill)); counts.addedBills++; counts.addedPayments+=incomingBill.payments.length; counts.changes++;
        continue;
      }
      for (const key of ['dueAmount','dueDate','status','generated','priceSnapshot','packageSnapshot','lateFee','lateFeeAppliedAt','lateFeeReason','concessionAmount','concessionReason','concessionAppliedAt','referralCreditAmount','referralCreditReason','referralCreditAppliedAt','depositOffsetAmount','depositOffsetReason','depositOffsetAppliedAt','creditTransferInAmount','creditTransferInReason','creditTransferInAppliedAt','creditTransferOut','badDebtWriteOffAmount','badDebtWriteOffReason','badDebtWriteOffAt','feederHostCreditAmount','feederHostCreditReason','feederHostCreditAppliedAt']) {
        const oldValue = existingBill[key] ?? null; const newValue = incomingBill[key] ?? null;
        if (sameJson(oldValue,newValue)) continue;
        if (!nonempty(oldValue) && nonempty(newValue)) { existingBill[key]=deepCopy(newValue); counts.changes++; }
        else if (nonempty(oldValue) && !nonempty(newValue)) continue;
        else addConflict(backupCustomer, `bill ${incomingBill.month} ${key}`);
      }
      // SISP-4: kist lines merge by plan + installment (a billed kist is
      // never dropped by a restore), and kistTotal is recomputed from the
      // union so it can never drift from its lines.
      existingBill.kistLines = existingBill.kistLines ?? [];
      for (const incomingLine of sanitizeBillKistLines(incomingBill.kistLines)) {
        const key = `${incomingLine.planId}:${incomingLine.installmentNumber}`;
        if (!sanitizeBillKistLines(existingBill.kistLines).some((line) => `${line.planId}:${line.installmentNumber}` === key)) {
          existingBill.kistLines.push(deepCopy(incomingLine));
          counts.changes++;
        }
      }
      existingBill.kistLines = sanitizeBillKistLines(existingBill.kistLines);
      existingBill.kistTotal = Math.round(existingBill.kistLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
      existingBill.amountHistory = existingBill.amountHistory ?? [];
      for (const correction of incomingBill.amountHistory) if (!existingBill.amountHistory.some(item=>sameJson(item,correction))) { existingBill.amountHistory.push(deepCopy(correction)); counts.changes++; }
      existingBill.payments = existingBill.payments ?? [];
      for (const incomingPayment of incomingBill.payments) {
        const existingPayment = existingBill.payments.find(payment=>payment.id===incomingPayment.id);
        if (!existingPayment) { existingBill.payments.push(deepCopy(incomingPayment)); counts.addedPayments++; counts.changes++; }
        else if (!sameJson(existingPayment,incomingPayment)) addConflict(backupCustomer, `payment ${incomingPayment.id}`);
      }
    }
    customer.bills.sort((a,b)=>b.month.localeCompare(a.month));
    for (const incomingIncident of backupCustomer.incidents) {
      const existingIncident = customer.incidents.find(incident=>incident.id===incomingIncident.id);
      if (!existingIncident) { customer.incidents.push(deepCopy(incomingIncident)); counts.addedIncidents++; counts.changes++; }
      else if (!sameJson(existingIncident,incomingIncident)) addConflict(backupCustomer, `incident ${incomingIncident.id}`);
    }
    customer.incidents.sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt)||a.id.localeCompare(b.id));
  }
  for (const [key,countKey,label] of [['inventoryItems','addedInventoryItems','inventory item'],['inventoryMovements','addedInventoryMovements','inventory movement'],['expenses','addedExpenses','expense']]) {
    current[key] = current[key] ?? [];
    for (const incoming of incomingState[key] ?? []) {
      const existing = current[key].find(entry=>entry.id===incoming.id);
      if (!existing) { current[key].push(deepCopy(incoming)); counts[countKey]++; counts.changes++; }
      else if (!sameJson(existing,incoming)) conflicts.push({customerNumber:null,name:'',field:`${label} ${incoming.id}`});
    }
  }
  for (const [key,countKey] of [['saadAttendanceDays','addedSaadAttendanceDays'],['umairWorkdays','addedUmairWorkdays']]) {
    current[key]=current[key]??[];
    const known=new Set(current[key]);
    for(const date of incomingState[key]??[])if(!known.has(date)){known.add(date);counts[countKey]++;counts.changes++;}
    current[key]=[...known].sort();
  }
  current.monthlyClosings=current.monthlyClosings??[];
  for (const snapshot of incomingState.monthlyClosings) {
    const existing=current.monthlyClosings.find(row=>row.month===snapshot.month);
    if (!existing) { current.monthlyClosings.push(deepCopy(snapshot)); counts.addedMonthlyClosings++; counts.changes++; }
    else if (!sameJson(existing,snapshot)) conflicts.push({customerNumber:null,name:'',field:`monthly closing ${snapshot.month}`});
  }
  current.monthlyClosings.sort((a,b)=>b.month.localeCompare(a.month));
  current.customers.sort((a,b)=>a.customerNumber-b.customerNumber);
  current.nextCustomerNumber = Math.max(existingState.nextCustomerNumber ?? 1, incomingState.nextCustomerNumber, ...current.customers.map(customer=>customer.customerNumber+1));
  // #359: optional digital-payments settings section (see createJsonBackup).
  // Safe-merge rule, same as the ledger: adopt the backup's settings only when
  // this device has none stored yet (fresh device / never opened the dialog)
  // or still holds the factory defaults; when both sides hold different real
  // settings, the existing ones are kept and the difference is a conflict.
  let digitalPaymentsSettings = null;
  const rawIncomingSettings = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.digitalPayments
    : undefined;
  if (rawIncomingSettings && typeof rawIncomingSettings === 'object' && !Array.isArray(rawIncomingSettings)) {
    const incomingSettings = sanitizeDigitalPaymentsSettings(rawIncomingSettings);
    const currentSettings = (options && typeof options === 'object' && options.currentDigitalPaymentsSettings && typeof options.currentDigitalPaymentsSettings === 'object')
      ? sanitizeDigitalPaymentsSettings(options.currentDigitalPaymentsSettings)
      : null;
    const factorySettings = sanitizeDigitalPaymentsSettings(getDefaultDigitalPaymentsSettings());
    if (currentSettings && sameJson(incomingSettings, currentSettings)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (!options?.currentDigitalPaymentsStored || (currentSettings && sameJson(currentSettings, factorySettings))) {
      digitalPaymentsSettings = incomingSettings;
      counts.digitalPaymentsSettingsRestored = 1;
      counts.changes++;
    } else {
      conflicts.push({ customerNumber:null, name:'', field:'Digital payment settings differ from this device' });
    }
  }
  // SISP-96: optional receipt footer settings section (see
  // createJsonBackup). Safe-merge rule, same as the digital-payments
  // settings: adopt the backup's footer only when this device has none
  // stored yet or still holds the empty default; when both sides hold
  // different real footers, keep existing + conflict (a restore never
  // silently overwrites the device's configured footer). An incoming
  // all-empty section carries nothing and is ignored.
  let receiptFooter = null;
  const rawIncomingReceiptFooter = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.receiptFooter
    : undefined;
  if (rawIncomingReceiptFooter && typeof rawIncomingReceiptFooter === 'object' && !Array.isArray(rawIncomingReceiptFooter)) {
    const incomingReceiptFooter = sanitizeReceiptFooter(rawIncomingReceiptFooter);
    const emptyReceiptFooter = sanitizeReceiptFooter(getDefaultReceiptFooter());
    if (!sameJson(incomingReceiptFooter, emptyReceiptFooter)) {
      const currentReceiptFooter = (options && typeof options === 'object' && options.currentReceiptFooter && typeof options.currentReceiptFooter === 'object')
        ? sanitizeReceiptFooter(options.currentReceiptFooter)
        : null;
      if (currentReceiptFooter && sameJson(incomingReceiptFooter, currentReceiptFooter)) {
        // Identical on both sides — nothing to restore, no conflict.
      } else if (!options?.currentReceiptFooterStored || (currentReceiptFooter && sameJson(currentReceiptFooter, emptyReceiptFooter))) {
        receiptFooter = incomingReceiptFooter;
        counts.receiptFooterRestored = 1;
        counts.changes++;
      } else {
        conflicts.push({ customerNumber:null, name:'', field:'Receipt footer settings differ from this device' });
      }
    }
  }
  // SISP-1: optional shop settlement records section (see createJsonBackup).
  // Safe-merge rule, same as the ledger and the digital-payments settings:
  // adopt the backup's records only when this device has none stored yet;
  // when both sides hold different real records, keep existing + conflict.
  let shopSettlements = null;
  const rawIncomingShop = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.shopSettlements
    : undefined;
  if (Array.isArray(rawIncomingShop) && rawIncomingShop.length) {
    const incomingShop = sanitizeShopSettlements(rawIncomingShop);
    const currentShop = (options && typeof options === 'object' && Array.isArray(options.currentShopSettlements))
      ? sanitizeShopSettlements(options.currentShopSettlements)
      : [];
    if (incomingShop.length && sameJson(incomingShop, currentShop)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingShop.length && (!options?.currentShopSettlementsStored || currentShop.length === 0)) {
      shopSettlements = incomingShop;
      counts.shopSettlementsRestored = 1;
      counts.changes++;
    } else if (incomingShop.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Shop settlement records differ from this device' });
    }
  }
  // SISP-15: optional complaint register records section (see createJsonBackup).
  // Safe-merge rule, same as shop settlements: adopt the backup's records
  // only when this device has none stored yet; when both sides hold
  // different real records, keep existing + conflict.
  let complaints = null;
  const rawIncomingComplaints = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.complaints
    : undefined;
  if (Array.isArray(rawIncomingComplaints) && rawIncomingComplaints.length) {
    const incomingComplaints = sanitizeComplaints(rawIncomingComplaints);
    const currentComplaints = (options && typeof options === 'object' && Array.isArray(options.currentComplaints))
      ? sanitizeComplaints(options.currentComplaints)
      : [];
    if (incomingComplaints.length && sameJson(incomingComplaints, currentComplaints)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingComplaints.length && (!options?.currentComplaintsStored || currentComplaints.length === 0)) {
      complaints = incomingComplaints;
      counts.complaintsRestored = 1;
      counts.changes++;
    } else if (incomingComplaints.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Complaint register records differ from this device' });
    }
  }
  // Home Budget: optional home expense records section (see createJsonBackup).
  // Safe-merge rule, same as complaints: adopt the backup's records only
  // when this device has none stored yet; when both sides hold different
  // real records, keep existing + conflict.
  let homeBudget = null;
  const rawIncomingHomeBudget = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.homeBudget
    : undefined;
  if (Array.isArray(rawIncomingHomeBudget) && rawIncomingHomeBudget.length) {
    const incomingHomeBudget = sanitizeHomeBudget(rawIncomingHomeBudget);
    const currentHomeBudget = (options && typeof options === 'object' && Array.isArray(options.currentHomeBudget))
      ? sanitizeHomeBudget(options.currentHomeBudget)
      : [];
    if (incomingHomeBudget.length && sameJson(incomingHomeBudget, currentHomeBudget)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingHomeBudget.length && (!options?.currentHomeBudgetStored || currentHomeBudget.length === 0)) {
      homeBudget = incomingHomeBudget;
      counts.homeBudgetRestored = 1;
      counts.changes++;
    } else if (incomingHomeBudget.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Home budget records differ from this device' });
    }
  }
  // SISP-11: optional roznamcha day records section (see createJsonBackup).
  // Safe-merge rule, same as shop settlements: adopt the backup's records
  // only when this device has none stored yet; when both sides hold
  // different real records, keep existing + conflict.
  let roznamchaDays = null;
  const rawIncomingRoznamcha = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.roznamchaDays
    : undefined;
  if (Array.isArray(rawIncomingRoznamcha) && rawIncomingRoznamcha.length) {
    const incomingRoznamcha = sanitizeRoznamchaDays(rawIncomingRoznamcha);
    const currentRoznamcha = (options && typeof options === 'object' && Array.isArray(options.currentRoznamchaDays))
      ? sanitizeRoznamchaDays(options.currentRoznamchaDays)
      : [];
    if (incomingRoznamcha.length && sameJson(incomingRoznamcha, currentRoznamcha)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingRoznamcha.length && (!options?.currentRoznamchaDaysStored || currentRoznamcha.length === 0)) {
      roznamchaDays = incomingRoznamcha;
      counts.roznamchaDaysRestored = 1;
      counts.changes++;
    } else if (incomingRoznamcha.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Roznamcha day records differ from this device' });
    }
  }
  // SISP-12: optional field ticket records section (see createJsonBackup).
  // Safe-merge rule, same as the complaint register: adopt the backup's
  // records only when this device has none stored yet; when both sides
  // hold different real records, keep existing + conflict.
  let tickets = null;
  const rawIncomingTickets = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.tickets
    : undefined;
  if (Array.isArray(rawIncomingTickets) && rawIncomingTickets.length) {
    const incomingTickets = sanitizeTickets(rawIncomingTickets);
    const currentTickets = (options && typeof options === 'object' && Array.isArray(options.currentTickets))
      ? sanitizeTickets(options.currentTickets)
      : [];
    if (incomingTickets.length && sameJson(incomingTickets, currentTickets)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingTickets.length && (!options?.currentTicketsStored || currentTickets.length === 0)) {
      tickets = incomingTickets;
      counts.ticketsRestored = 1;
      counts.changes++;
    } else if (incomingTickets.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Field ticket records differ from this device' });
    }
  }
  // SISP-18: optional stock book movements section (see createJsonBackup).
  // Safe-merge rule, same as shop settlements and complaints: adopt the
  // backup's records only when this device has none stored yet; when both
  // sides hold different real records, keep existing + conflict.
  let inventory = null;
  const rawIncomingInventory = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.inventory
    : undefined;
  if (Array.isArray(rawIncomingInventory) && rawIncomingInventory.length) {
    const incomingInventory = sanitizeInventory(rawIncomingInventory);
    const currentInventory = (options && typeof options === 'object' && Array.isArray(options.currentInventory))
      ? sanitizeInventory(options.currentInventory)
      : [];
    if (incomingInventory.length && sameJson(incomingInventory, currentInventory)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingInventory.length && (!options?.currentInventoryStored || currentInventory.length === 0)) {
      inventory = incomingInventory;
      counts.inventoryRestored = 1;
      counts.changes++;
    } else if (incomingInventory.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Stock book records differ from this device' });
    }
  }
  // Loan ledger: optional loan entries section (see createJsonBackup).
  // Safe-merge rule, same as the stock book: adopt the backup's records
  // only when this device has none stored yet; when both sides hold
  // different real records, keep existing + conflict.
  let loans = null;
  const rawIncomingLoans = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.loans
    : undefined;
  if (Array.isArray(rawIncomingLoans) && rawIncomingLoans.length) {
    const incomingLoans = sanitizeLoanEntries(rawIncomingLoans);
    const currentLoans = (options && typeof options === 'object' && Array.isArray(options.currentLoans))
      ? sanitizeLoanEntries(options.currentLoans)
      : [];
    if (incomingLoans.length && sameJson(incomingLoans, currentLoans)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingLoans.length && (!options?.currentLoansStored || currentLoans.length === 0)) {
      loans = incomingLoans;
      counts.loansRestored = 1;
      counts.changes++;
    } else if (incomingLoans.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Loan ledger records differ from this device' });
    }
  }
  // SISP-25: optional WhatsApp template section (see createJsonBackup).
  // Safe-merge rule, same as the stock book: adopt the backup's templates
  // only when this device has none stored yet; when both sides hold
  // different real templates, keep existing + conflict.
  let waTemplates = null;
  const rawIncomingWaTemplates = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.waTemplates
    : undefined;
  if (Array.isArray(rawIncomingWaTemplates) && rawIncomingWaTemplates.length) {
    const incomingWaTemplates = sanitizeWaTemplates(rawIncomingWaTemplates);
    const currentWaTemplates = (options && typeof options === 'object' && Array.isArray(options.currentWaTemplates))
      ? sanitizeWaTemplates(options.currentWaTemplates)
      : [];
    if (incomingWaTemplates.length && sameJson(incomingWaTemplates, currentWaTemplates)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingWaTemplates.length && (!options?.currentWaTemplatesStored || currentWaTemplates.length === 0)) {
      waTemplates = incomingWaTemplates;
      counts.waTemplatesRestored = 1;
      counts.changes++;
    } else if (incomingWaTemplates.length) {
      conflicts.push({ customerNumber:null, name:'', field:'WhatsApp templates differ from this device' });
    }
  }
  // Saad visit log: optional visit + payment sections (see createJsonBackup).
  // Safe-merge rule, same as the stock book: adopt the backup's records
  // only when this device has none stored yet; when both sides hold
  // different real records, keep existing + conflict.
  let saadVisits = null;
  const rawIncomingSaadVisits = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.saadVisits
    : undefined;
  if (Array.isArray(rawIncomingSaadVisits) && rawIncomingSaadVisits.length) {
    const incomingSaadVisits = sanitizeSaadVisits(rawIncomingSaadVisits);
    const currentSaadVisits = (options && typeof options === 'object' && Array.isArray(options.currentSaadVisits))
      ? sanitizeSaadVisits(options.currentSaadVisits)
      : [];
    if (incomingSaadVisits.length && sameJson(incomingSaadVisits, currentSaadVisits)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSaadVisits.length && (!options?.currentSaadVisitsStored || currentSaadVisits.length === 0)) {
      saadVisits = incomingSaadVisits;
      counts.saadVisitsRestored = 1;
      counts.changes++;
    } else if (incomingSaadVisits.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Saad visit records differ from this device' });
    }
  }
  let saadPayments = null;
  const rawIncomingSaadPayments = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.saadPayments
    : undefined;
  if (Array.isArray(rawIncomingSaadPayments) && rawIncomingSaadPayments.length) {
    const incomingSaadPayments = sanitizeSaadPayments(rawIncomingSaadPayments);
    const currentSaadPayments = (options && typeof options === 'object' && Array.isArray(options.currentSaadPayments))
      ? sanitizeSaadPayments(options.currentSaadPayments)
      : [];
    if (incomingSaadPayments.length && sameJson(incomingSaadPayments, currentSaadPayments)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSaadPayments.length && (!options?.currentSaadPaymentsStored || currentSaadPayments.length === 0)) {
      saadPayments = incomingSaadPayments;
      counts.saadPaymentsRestored = 1;
      counts.changes++;
    } else if (incomingSaadPayments.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Saad payment records differ from this device' });
    }
  }
  // Installation tracker: optional request section (see createJsonBackup).
  // Safe-merge rule, same as the Saad visit log: adopt the backup's
  // records only when this device has none stored yet; when both sides
  // hold different real records, keep existing + conflict.
  let installRequests = null;
  const rawIncomingInstallRequests = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.installRequests
    : undefined;
  if (Array.isArray(rawIncomingInstallRequests) && rawIncomingInstallRequests.length) {
    const incomingInstallRequests = sanitizeInstallRequests(rawIncomingInstallRequests);
    const currentInstallRequests = (options && typeof options === 'object' && Array.isArray(options.currentInstallRequests))
      ? sanitizeInstallRequests(options.currentInstallRequests)
      : [];
    if (incomingInstallRequests.length && sameJson(incomingInstallRequests, currentInstallRequests)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingInstallRequests.length && (!options?.currentInstallRequestsStored || currentInstallRequests.length === 0)) {
      installRequests = incomingInstallRequests;
      counts.installRequestsRestored = 1;
      counts.changes++;
    } else if (incomingInstallRequests.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Installation request records differ from this device' });
    }
  }
  // Pending works: optional note section (see createJsonBackup).
  // Safe-merge rule, same as the Saad visit log: adopt the backup's
  // records only when this device has none stored yet; when both sides
  // hold different real records, keep existing + conflict.
  let pendingWorks = null;
  const rawIncomingPendingWorks = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.pendingWorks
    : undefined;
  if (Array.isArray(rawIncomingPendingWorks) && rawIncomingPendingWorks.length) {
    const incomingPendingWorks = sanitizePendingWorks(rawIncomingPendingWorks);
    const currentPendingWorks = (options && typeof options === 'object' && Array.isArray(options.currentPendingWorks))
      ? sanitizePendingWorks(options.currentPendingWorks)
      : [];
    if (incomingPendingWorks.length && sameJson(incomingPendingWorks, currentPendingWorks)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingPendingWorks.length && (!options?.currentPendingWorksStored || currentPendingWorks.length === 0)) {
      pendingWorks = incomingPendingWorks;
      counts.pendingWorksRestored = 1;
      counts.changes++;
    } else if (incomingPendingWorks.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Pending work records differ from this device' });
    }
  }
  // SISP-35 billing groups: optional link section (see createJsonBackup).
  // Safe-merge rule, same as Pending Works: adopt the backup's groups
  // only when this device has none stored yet; when both sides hold
  // different real groups, keep existing + conflict.
  let billingGroups = null;
  const rawIncomingBillingGroups = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.billingGroups
    : undefined;
  if (Array.isArray(rawIncomingBillingGroups) && rawIncomingBillingGroups.length) {
    const incomingBillingGroups = sanitizeBillingGroups(rawIncomingBillingGroups);
    const currentBillingGroups = (options && typeof options === 'object' && Array.isArray(options.currentBillingGroups))
      ? sanitizeBillingGroups(options.currentBillingGroups)
      : [];
    if (incomingBillingGroups.length && sameJson(incomingBillingGroups, currentBillingGroups)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingBillingGroups.length && (!options?.currentBillingGroupsStored || currentBillingGroups.length === 0)) {
      billingGroups = incomingBillingGroups;
      counts.billingGroupsRestored = 1;
      counts.changes++;
    } else if (incomingBillingGroups.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Billing group records differ from this device' });
    }
  }
  // SISP-37 suspense payments: optional register section (see
  // createJsonBackup). Safe-merge rule, same as billing groups: adopt
  // the backup's entries only when this device has none stored yet;
  // when both sides hold different real entries, keep existing +
  // conflict (a claimed entry must never be silently overwritten).
  let suspensePayments = null;
  const rawIncomingSuspensePayments = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.suspensePayments
    : undefined;
  if (Array.isArray(rawIncomingSuspensePayments) && rawIncomingSuspensePayments.length) {
    const incomingSuspensePayments = sanitizeSuspensePayments(rawIncomingSuspensePayments);
    const currentSuspensePayments = (options && typeof options === 'object' && Array.isArray(options.currentSuspensePayments))
      ? sanitizeSuspensePayments(options.currentSuspensePayments)
      : [];
    if (incomingSuspensePayments.length && sameJson(incomingSuspensePayments, currentSuspensePayments)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSuspensePayments.length && (!options?.currentSuspensePaymentsStored || currentSuspensePayments.length === 0)) {
      suspensePayments = incomingSuspensePayments;
      counts.suspensePaymentsRestored = 1;
      counts.changes++;
    } else if (incomingSuspensePayments.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Suspense payment records differ from this device' });
    }
  }
  // SISP-122 pole registry: optional register section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments:
  // adopt the backup's poles only when this device has none stored
  // yet; when both sides hold different real poles, keep existing +
  // conflict (attachments must never be silently overwritten).
  let polesRegistry = null;
  const rawIncomingPoles = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.polesRegistry
    : undefined;
  if (Array.isArray(rawIncomingPoles) && rawIncomingPoles.length) {
    const incomingPoles = sanitizePolesRegistry(rawIncomingPoles);
    const currentPoles = (options && typeof options === 'object' && Array.isArray(options.currentPolesRegistry))
      ? sanitizePolesRegistry(options.currentPolesRegistry)
      : [];
    if (incomingPoles.length && sameJson(incomingPoles, currentPoles)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingPoles.length && (!options?.currentPolesRegistryStored || currentPoles.length === 0)) {
      polesRegistry = incomingPoles;
      counts.polesRegistryRestored = 1;
      counts.changes++;
    } else if (incomingPoles.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Pole registry records differ from this device' });
    }
  }
  // SISP-119 fiber drums: optional registry section (see
  // createJsonBackup). Safe-merge rule, same as the stock book: adopt
  // the backup's drums only when this device has none stored yet; when
  // both sides hold different real drums, keep existing + conflict (a
  // drum's cut history must never be silently overwritten).
  let fiberDrums = null;
  const rawIncomingFiberDrums = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.fiberDrums
    : undefined;
  if (Array.isArray(rawIncomingFiberDrums) && rawIncomingFiberDrums.length) {
    const incomingFiberDrums = sanitizeFiberDrums(rawIncomingFiberDrums);
    const currentFiberDrums = (options && typeof options === 'object' && Array.isArray(options.currentFiberDrums))
      ? sanitizeFiberDrums(options.currentFiberDrums)
      : [];
    if (incomingFiberDrums.length && sameJson(incomingFiberDrums, currentFiberDrums)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingFiberDrums.length && (!options?.currentFiberDrumsStored || currentFiberDrums.length === 0)) {
      fiberDrums = incomingFiberDrums;
      counts.fiberDrumsRestored = 1;
      counts.changes++;
    } else if (incomingFiberDrums.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Fiber drum records differ from this device' });
    }
  }
  // SISP-109 storm inspections: optional runs section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments: adopt
  // the backup's runs only when this device has none stored yet; when
  // both sides hold different real runs, keep existing + conflict (one
  // device's inspection progress must never silently overwrite the
  // other's).
  let stormInspections = null;
  const rawIncomingStormInspections = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.stormInspections
    : undefined;
  if (rawIncomingStormInspections && typeof rawIncomingStormInspections === 'object') {
    const incomingStormInspections = sanitizeStormInspections(rawIncomingStormInspections);
    const currentStormInspections = (options && typeof options === 'object' && options.currentStormInspections)
      ? sanitizeStormInspections(options.currentStormInspections)
      : { runs: [] };
    if (incomingStormInspections.runs.length && sameJson(incomingStormInspections, currentStormInspections)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingStormInspections.runs.length && (!options?.currentStormInspectionsStored || currentStormInspections.runs.length === 0)) {
      stormInspections = incomingStormInspections;
      counts.stormInspectionsRestored = 1;
      counts.changes++;
    } else if (incomingStormInspections.runs.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Storm inspection records differ from this device' });
    }
  }
  // SISP-107 supplier khata: optional register section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments:
  // adopt the backup's records only when this device has none stored
  // yet; when both sides hold different real records, keep existing +
  // conflict (a recorded supplier payment must never be silently
  // overwritten or duplicated).
  let supplierKhata = null;
  const rawIncomingSupplierKhata = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.supplierKhata
    : undefined;
  if (Array.isArray(rawIncomingSupplierKhata) && rawIncomingSupplierKhata.length) {
    const incomingSupplierKhata = sanitizeSupplierKhata(rawIncomingSupplierKhata);
    const currentSupplierKhata = (options && typeof options === 'object' && Array.isArray(options.currentSupplierKhata))
      ? sanitizeSupplierKhata(options.currentSupplierKhata)
      : [];
    if (incomingSupplierKhata.length && sameJson(incomingSupplierKhata, currentSupplierKhata)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSupplierKhata.length && (!options?.currentSupplierKhataStored || currentSupplierKhata.length === 0)) {
      supplierKhata = incomingSupplierKhata;
      counts.supplierKhataRestored = 1;
      counts.changes++;
    } else if (incomingSupplierKhata.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Supplier khata records differ from this device' });
    }
  }
  // SISP-93 commission rules: optional section (see createJsonBackup).
  // Safe-merge rule, same as suspense payments: adopt the backup's rules
  // only when this device has none stored yet; when both sides hold
  // different real rules, keep existing + conflict (a configured rule
  // must never be silently overwritten).
  let commissionRules = null;
  const rawIncomingCommissionRules = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.commissionRules
    : undefined;
  if (Array.isArray(rawIncomingCommissionRules) && rawIncomingCommissionRules.length) {
    const incomingCommissionRules = sanitizeCommissionRules(rawIncomingCommissionRules);
    const currentCommissionRules = (options && typeof options === 'object' && Array.isArray(options.currentCommissionRules))
      ? sanitizeCommissionRules(options.currentCommissionRules)
      : [];
    if (incomingCommissionRules.length && sameJson(incomingCommissionRules, currentCommissionRules)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingCommissionRules.length && (!options?.currentCommissionRulesStored || currentCommissionRules.length === 0)) {
      commissionRules = incomingCommissionRules;
      counts.commissionRulesRestored = 1;
      counts.changes++;
    } else if (incomingCommissionRules.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Commission rule records differ from this device' });
    }
  }
  // SISP-62 power backup nodes: optional registry section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments:
  // adopt the backup's nodes only when this device has none stored
  // yet; when both sides hold different real nodes, keep existing +
  // conflict (a running outage timer must never be silently replaced).
  let upsNodes = null;
  const rawIncomingUpsNodes = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.upsNodes
    : undefined;
  if (Array.isArray(rawIncomingUpsNodes) && rawIncomingUpsNodes.length) {
    const incomingUpsNodes = sanitizeUpsNodes(rawIncomingUpsNodes);
    const currentUpsNodes = (options && typeof options === 'object' && Array.isArray(options.currentUpsNodes))
      ? sanitizeUpsNodes(options.currentUpsNodes)
      : [];
    if (incomingUpsNodes.length && sameJson(incomingUpsNodes, currentUpsNodes)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingUpsNodes.length && (!options?.currentUpsNodesStored || currentUpsNodes.length === 0)) {
      upsNodes = incomingUpsNodes;
      counts.upsNodesRestored = 1;
      counts.changes++;
    } else if (incomingUpsNodes.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Power backup node records differ from this device' });
    }
  }
  // SISP-40 referral credits: optional queue section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments: adopt
  // the backup's entries only when this device has none stored yet; when
  // both sides hold different real entries, keep existing + conflict (a
  // queued credit must never be silently overwritten or duplicated).
  let referralCredits = null;
  const rawIncomingReferralCredits = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.referralCredits
    : undefined;
  if (Array.isArray(rawIncomingReferralCredits) && rawIncomingReferralCredits.length) {
    const incomingReferralCredits = sanitizeReferralCredits(rawIncomingReferralCredits);
    const currentReferralCredits = (options && typeof options === 'object' && Array.isArray(options.currentReferralCredits))
      ? sanitizeReferralCredits(options.currentReferralCredits)
      : [];
    if (incomingReferralCredits.length && sameJson(incomingReferralCredits, currentReferralCredits)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingReferralCredits.length && (!options?.currentReferralCreditsStored || currentReferralCredits.length === 0)) {
      referralCredits = incomingReferralCredits;
      counts.referralCreditsRestored = 1;
      counts.changes++;
    } else if (incomingReferralCredits.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Referral credit records differ from this device' });
    }
  }
  // SISP-111 credit transfers: optional register section (see
  // createJsonBackup). Safe-merge rule, same as referral credits: adopt
  // the backup's entries only when this device has none stored yet;
  // when both sides hold different real entries, keep existing +
  // conflict (a transfer audit record must never be silently
  // overwritten or duplicated).
  let creditTransfers = null;
  const rawIncomingCreditTransfers = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.creditTransfers
    : undefined;
  if (Array.isArray(rawIncomingCreditTransfers) && rawIncomingCreditTransfers.length) {
    const incomingCreditTransfers = sanitizeCreditTransfers(rawIncomingCreditTransfers);
    const currentCreditTransfers = (options && typeof options === 'object' && Array.isArray(options.currentCreditTransfers))
      ? sanitizeCreditTransfers(options.currentCreditTransfers)
      : [];
    if (incomingCreditTransfers.length && sameJson(incomingCreditTransfers, currentCreditTransfers)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingCreditTransfers.length && (!options?.currentCreditTransfersStored || currentCreditTransfers.length === 0)) {
      creditTransfers = incomingCreditTransfers;
      counts.creditTransfersRestored = 1;
      counts.changes++;
    } else if (incomingCreditTransfers.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Credit transfer records differ from this device' });
    }
  }
  // SISP-82 field tools: optional custody section (see
  // createJsonBackup). Safe-merge rule, same as suspense payments:
  // adopt the backup's records only when this device has none stored
  // yet; when both sides hold different real records, keep existing +
  // conflict (a custody history must never be silently overwritten).
  let fieldTools = null;
  const rawIncomingFieldTools = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.fieldTools
    : undefined;
  if (Array.isArray(rawIncomingFieldTools) && rawIncomingFieldTools.length) {
    const incomingFieldTools = sanitizeFieldTools(rawIncomingFieldTools);
    const currentFieldTools = (options && typeof options === 'object' && Array.isArray(options.currentFieldTools))
      ? sanitizeFieldTools(options.currentFieldTools)
      : [];
    if (incomingFieldTools.length && sameJson(incomingFieldTools, currentFieldTools)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingFieldTools.length && (!options?.currentFieldToolsStored || currentFieldTools.length === 0)) {
      fieldTools = incomingFieldTools;
      counts.fieldToolsRestored = 1;
      counts.changes++;
    } else if (incomingFieldTools.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Field tool records differ from this device' });
    }
  }
  // SISP-78 splice closures: optional map section (see
  // createJsonBackup). Safe-merge rule, same as referral credits:
  // adopt the backup's closures only when this device has none stored
  // yet; when both sides hold different real closures, keep existing +
  // conflict (a recorded splice map must never be silently replaced).
  let spliceClosures = null;
  const rawIncomingSpliceClosures = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.spliceClosures
    : undefined;
  if (Array.isArray(rawIncomingSpliceClosures) && rawIncomingSpliceClosures.length) {
    const incomingSpliceClosures = sanitizeSpliceClosures(rawIncomingSpliceClosures);
    const currentSpliceClosures = (options && typeof options === 'object' && Array.isArray(options.currentSpliceClosures))
      ? sanitizeSpliceClosures(options.currentSpliceClosures)
      : [];
    if (incomingSpliceClosures.length && sameJson(incomingSpliceClosures, currentSpliceClosures)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSpliceClosures.length && (!options?.currentSpliceClosuresStored || currentSpliceClosures.length === 0)) {
      spliceClosures = incomingSpliceClosures;
      counts.spliceClosuresRestored = 1;
      counts.changes++;
    } else if (incomingSpliceClosures.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Splice closure records differ from this device' });
    }
  }
  // SISP-64 bad debts: optional register section (see
  // createJsonBackup). Safe-merge rule, same as referral credits: adopt
  // the backup's entries only when this device has none stored yet;
  // when both sides hold different real entries, keep existing +
  // conflict (a write-off must never be silently overwritten).
  let badDebts = null;
  const rawIncomingBadDebts = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.badDebts
    : undefined;
  if (Array.isArray(rawIncomingBadDebts) && rawIncomingBadDebts.length) {
    const incomingBadDebts = sanitizeBadDebts(rawIncomingBadDebts);
    const currentBadDebts = (options && typeof options === 'object' && Array.isArray(options.currentBadDebts))
      ? sanitizeBadDebts(options.currentBadDebts)
      : [];
    if (incomingBadDebts.length && sameJson(incomingBadDebts, currentBadDebts)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingBadDebts.length && (!options?.currentBadDebtsStored || currentBadDebts.length === 0)) {
      badDebts = incomingBadDebts;
      counts.badDebtsRestored = 1;
      counts.changes++;
    } else if (incomingBadDebts.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Bad debt records differ from this device' });
    }
  }
  let monthlyClosingNotes = null;
  const rawIncomingNotes = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.monthlyClosingNotes
    : undefined;
  if (rawIncomingNotes && typeof rawIncomingNotes === 'object' && !Array.isArray(rawIncomingNotes) && Object.keys(rawIncomingNotes).length) {
    const incomingNotes = sanitizeMonthlyClosingNotes(rawIncomingNotes);
    const currentNotes = (options && typeof options === 'object' && options.currentMonthlyClosingNotes && typeof options.currentMonthlyClosingNotes === 'object')
      ? sanitizeMonthlyClosingNotes(options.currentMonthlyClosingNotes)
      : {};
    if (Object.keys(incomingNotes).length && sameJson(incomingNotes, currentNotes)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (Object.keys(incomingNotes).length && (!options?.currentMonthlyClosingNotesStored || Object.keys(currentNotes).length === 0)) {
      monthlyClosingNotes = incomingNotes;
      counts.monthlyClosingNotesRestored = 1;
      counts.changes++;
    } else if (Object.keys(incomingNotes).length) {
      conflicts.push({ customerNumber:null, name:'', field:'Monthly closing notes differ from this device' });
    }
  }
  // SISP-92 splitter-box GPS pins: optional map section (see
  // createJsonBackup). Safe-merge rule, same as monthly closing notes:
  // adopt the backup's pins only when this device has none stored yet;
  // when both sides hold different real pins, keep existing + conflict
  // (a box pin must never be silently replaced). A backup without the
  // section leaves this device's pins completely untouched.
  let splitterBoxGps = null;
  const rawIncomingSplitterBoxGps = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.splitterBoxGps
    : undefined;
  if (rawIncomingSplitterBoxGps && typeof rawIncomingSplitterBoxGps === 'object' && !Array.isArray(rawIncomingSplitterBoxGps) && Object.keys(rawIncomingSplitterBoxGps).length) {
    const incomingSplitterBoxGps = sanitizeSplitterBoxGps(rawIncomingSplitterBoxGps);
    const currentSplitterBoxGps = (options && typeof options === 'object' && options.currentSplitterBoxGps && typeof options.currentSplitterBoxGps === 'object')
      ? sanitizeSplitterBoxGps(options.currentSplitterBoxGps)
      : {};
    if (Object.keys(incomingSplitterBoxGps).length && sameJson(incomingSplitterBoxGps, currentSplitterBoxGps)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (Object.keys(incomingSplitterBoxGps).length && (!options?.currentSplitterBoxGpsStored || Object.keys(currentSplitterBoxGps).length === 0)) {
      splitterBoxGps = incomingSplitterBoxGps;
      counts.splitterBoxGpsRestored = 1;
      counts.changes++;
    } else if (Object.keys(incomingSplitterBoxGps).length) {
      conflicts.push({ customerNumber:null, name:'', field:'Splitter box GPS pins differ from this device' });
    }
  }
  // SISP-27: optional fixed-overheads section (see createJsonBackup).
  // Safe-merge rule, same as the monthly closing notes: adopt the
  // backup's records only when this device has none stored yet; when
  // both sides hold different real records, keep existing + conflict.
  let overheads = null;
  const rawIncomingOverheads = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.overheads
    : undefined;
  if (rawIncomingOverheads && typeof rawIncomingOverheads === 'object' && !Array.isArray(rawIncomingOverheads)) {
    const incomingOverheads = sanitizeOverheads(rawIncomingOverheads);
    const currentOverheads = (options && typeof options === 'object' && options.currentOverheads && typeof options.currentOverheads === 'object')
      ? sanitizeOverheads(options.currentOverheads)
      : { templates: [], postings: [] };
    const incomingHasRecords = incomingOverheads.templates.length > 0 || incomingOverheads.postings.length > 0;
    const currentHasRecords = currentOverheads.templates.length > 0 || currentOverheads.postings.length > 0;
    if (incomingHasRecords && sameJson(incomingOverheads, currentOverheads)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingHasRecords && (!options?.currentOverheadsStored || !currentHasRecords)) {
      overheads = incomingOverheads;
      counts.overheadsRestored = 1;
      counts.changes++;
    } else if (incomingHasRecords) {
      conflicts.push({ customerNumber:null, name:'', field:'Fixed overhead records differ from this device' });
    }
  }
  // SISP-22: optional partner ledger + settlement slip sections (see
  // createJsonBackup). Safe-merge rule, same as shop settlements: adopt
  // the backup's records only when this device has none stored yet;
  // when both sides hold different real records, keep existing + conflict.
  let partnerLedger = null;
  const rawIncomingLedger = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.partnerLedger
    : undefined;
  if (Array.isArray(rawIncomingLedger) && rawIncomingLedger.length) {
    const incomingLedger = sanitizePartnerLedgerEntries(rawIncomingLedger);
    const currentLedger = (options && typeof options === 'object' && Array.isArray(options.currentPartnerLedger))
      ? sanitizePartnerLedgerEntries(options.currentPartnerLedger)
      : [];
    if (incomingLedger.length && sameJson(incomingLedger, currentLedger)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingLedger.length && (!options?.currentPartnerLedgerStored || currentLedger.length === 0)) {
      partnerLedger = incomingLedger;
      counts.partnerLedgerRestored = 1;
      counts.changes++;
    } else if (incomingLedger.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Partner ledger records differ from this device' });
    }
  }
  let partnerSettlements = null;
  const rawIncomingSettlements = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.partnerSettlements
    : undefined;
  if (Array.isArray(rawIncomingSettlements) && rawIncomingSettlements.length) {
    const incomingSettlements = sanitizePartnerSettlements(rawIncomingSettlements);
    const currentSettlements = (options && typeof options === 'object' && Array.isArray(options.currentPartnerSettlements))
      ? sanitizePartnerSettlements(options.currentPartnerSettlements)
      : [];
    if (incomingSettlements.length && sameJson(incomingSettlements, currentSettlements)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingSettlements.length && (!options?.currentPartnerSettlementsStored || currentSettlements.length === 0)) {
      partnerSettlements = incomingSettlements;
      counts.partnerSettlementsRestored = 1;
      counts.changes++;
    } else if (incomingSettlements.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Partner settlement records differ from this device' });
    }
  }
  // SISP-73: optional partner settings section (see createJsonBackup).
  // Safe-merge rule, same as the fixed overheads: adopt the backup's
  // settings only when this device has none stored yet; when both sides
  // hold a stored settings object and they differ, keep existing +
  // conflict — a restore must never silently flip how profit is split.
  let partnerSettings = null;
  const rawIncomingPartnerSettings = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.partnerSettings
    : undefined;
  if (rawIncomingPartnerSettings && typeof rawIncomingPartnerSettings === 'object' && !Array.isArray(rawIncomingPartnerSettings)) {
    const incomingSettings = sanitizePartnerSettings(rawIncomingPartnerSettings);
    const currentSettings = (options && typeof options === 'object' && options.currentPartnerSettings && typeof options.currentPartnerSettings === 'object')
      ? sanitizePartnerSettings(options.currentPartnerSettings)
      : sanitizePartnerSettings(null);
    if (sameJson(incomingSettings, currentSettings)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (!options?.currentPartnerSettingsStored) {
      partnerSettings = incomingSettings;
      counts.partnerSettingsRestored = 1;
      counts.changes++;
    } else {
      conflicts.push({ customerNumber:null, name:'', field:'Partner settings differ from this device' });
    }
  }
  // SISP-114: optional charity / sadqah reserve setting (see
  // createJsonBackup). STRICT safe-merge for a device setting: adopt
  // the backup's percentage ONLY when this device has no charity
  // setting stored at all. When a setting is already stored here and
  // the backup's differs, the local value is kept and a conflict is
  // reported — a restore can never silently enable, change or disable
  // the reserve percentage.
  let charityReserve = null;
  const rawIncomingCharity = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.charityReserve
    : undefined;
  if (rawIncomingCharity && typeof rawIncomingCharity === 'object' && !Array.isArray(rawIncomingCharity)) {
    const incomingCharity = sanitizeCharityReserveSettings(rawIncomingCharity);
    const currentCharity = sanitizeCharityReserveSettings(
      options && typeof options === 'object' ? options.currentCharityReserve : null
    );
    if (incomingCharity.charityReservePct > 0 && sameJson(incomingCharity, currentCharity)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingCharity.charityReservePct > 0 && !(options && options.currentCharityReserveStored)) {
      charityReserve = incomingCharity;
      counts.charityReserveRestored = 1;
      counts.changes++;
    } else if (incomingCharity.charityReservePct > 0) {
      conflicts.push({ customerNumber:null, name:'', field:'Charity / Sadqah reserve setting differs from this device' });
    }
  }
  // SISP-34: optional voided payment records section (see
  // createJsonBackup). Safe-merge rule, same as shop settlements: adopt
  // the backup's records only when this device has none stored yet;
  // when both sides hold different real records, keep existing + conflict.
  let voidPayments = null;
  const rawIncomingVoids = (document.settings && typeof document.settings === 'object' && !Array.isArray(document.settings))
    ? document.settings.voidPayments
    : undefined;
  if (Array.isArray(rawIncomingVoids) && rawIncomingVoids.length) {
    const incomingVoids = sanitizeVoidPayments(rawIncomingVoids);
    const currentVoids = (options && typeof options === 'object' && Array.isArray(options.currentVoidPayments))
      ? sanitizeVoidPayments(options.currentVoidPayments)
      : [];
    if (incomingVoids.length && sameJson(incomingVoids, currentVoids)) {
      // Identical on both sides — nothing to restore, no conflict.
    } else if (incomingVoids.length && (!options?.currentVoidPaymentsStored || currentVoids.length === 0)) {
      voidPayments = incomingVoids;
      counts.voidPaymentsRestored = 1;
      counts.changes++;
    } else if (incomingVoids.length) {
      conflicts.push({ customerNumber:null, name:'', field:'Voided payment records differ from this device' });
    }
  }
  const state = counts.changes ? current : existingState;
  return { state, counts, conflicts, canApply: checksum.status === 'mismatch' ? false : (branchGuard.blocked && !branchGuardOverrideApplied) ? false : counts.changes > 0, backupCustomerCount:incomingState.customers.length, exportedAt:document.exportedAt ?? '', digitalPaymentsSettings, receiptFooter, shopSettlements, complaints, roznamchaDays, tickets, inventory, loans, saadVisits, saadPayments, installRequests, pendingWorks, billingGroups, suspensePayments, polesRegistry, fiberDrums, stormInspections, supplierKhata, commissionRules, upsNodes, referralCredits, creditTransfers, fieldTools, badDebts, spliceClosures, monthlyClosingNotes, splitterBoxGps, overheads, partnerLedger, partnerSettlements, charityReserve, partnerSettings, voidPayments, homeBudget, waTemplates, checksumStatus:checksum.status, branchGuard, branchGuardOverrideApplied };

}
