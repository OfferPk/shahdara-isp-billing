// Plan 19 (Plan 1-100) — New-customer welcome pack draft.
//
// A new customer is connected and then left to guess how to pay, whom
// to call, and when the bill falls due, so the first month starts with
// avoidable questions. This module is the ready-made bilingual draft
// that answers those questions once, at activation: package, monthly
// amount, due date, payment methods, support contact, and the
// receipt/Waada basics. It is a DRAFT only, plus a send log. It sends
// nothing by itself: the operator taps Send on the customer profile,
// the existing WhatsApp route opens with the draft prefilled, and only
// then is the send logged (time, channel) in a log that lives apart
// from every payment, bill, Waada, and lifecycle record. Sending it
// never alters any record, and an incomplete draft (package, amount,
// or due date not recorded on the profile) is never filled with an
// invented figure: the missing field is listed, and the draft shows
// "Not set" for it, so the operator fixes the profile first.
//
// What is new here, stated plainly against the existing welcome
// material (welcome-agreement-slip.js, SISP-110): that slip is a
// 1-page printable/WhatsApp agreement — custody terms, hardware
// deposit, QR Khata deep link, payment shops. This pack is the short
// activation MESSAGE instead: no custody terms, no QR, no deposit
// line, no printable agreement. It is offered once at activation
// (the profile shows "not sent yet" until the first send) and can be
// re-sent from the profile any time after that. The two documents
// share only the profile's own package/amount figures; neither
// rewrites the other.
//
// How the profile-matching fields are resolved (welcomePackFromCustomer):
//   - package ....... customer.packageSpeed, verbatim
//   - monthly amount  customer.monthlySellingAmount, verbatim
//   - due date ...... the latest valid dueDate on the customer's
//     bills, if any bill exists; otherwise the caller supplies
//     dueDay (the app's billing cycle stamps every generated bill
//     due `${month}-05`, billing-cycle.js, so the profile wiring
//     passes 5) and the draft states the rule — "5th of every
//     month" — instead of a specific date that does not exist yet.
//     When neither a bill due date nor a due day is supplied, the
//     due date is missing, never guessed.
//   - payment methods / support contact are caller-supplied (the
//     app's payment-method list and the owner's saved support phone);
//     an absent support contact omits that line, it is never invented.
//
// Plan 15 contact preferences are respected by the CALLER, not here:
// this module never reads a preference. The profile wiring picks the
// draft variant from the customer's preferred language (Urdu script
// or Roman Urdu, default Roman), sends to the preferred WhatsApp
// number first, and refuses to send at all for a do-not-message
// customer — exactly as Plans 11–13 do.
//
// The module is import-free by design (like pre-due-reminders.js and
// first-bill-preview.js): the caller supplies every figure, and the
// module never reads storage, the clock, or the network. Every
// timestamp in the send log is caller-supplied, so a logged send
// always carries a real send time.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const WELCOME_PACK_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const WELCOME_PACK_NOT_SET = 'Not set';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function isValidWelcomePackDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function validDateOrNull(value) {
  return isValidWelcomePackDate(text(value)) ? text(value) : null;
}

function moneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function validDueDayOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const day = Math.floor(number);
  return day >= 1 && day <= 31 ? day : null;
}

function cleanMethodList(value) {
  if (!Array.isArray(value)) return [];
  const methods = [];
  for (const method of value) {
    const clean = text(method);
    if (clean && !methods.includes(clean)) methods.push(clean);
  }
  return methods;
}

export function normalizeWelcomePackVariant(value) {
  return value === WELCOME_PACK_VARIANTS.URDU
    ? WELCOME_PACK_VARIANTS.URDU
    : WELCOME_PACK_VARIANTS.ROMAN;
}

export function formatWelcomePackAmount(value) {
  const amount = moneyOrNull(value);
  if (amount === null) return '';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `PKR ${formatter.format(amount)}`;
}

export function formatWelcomePackDate(value) {
  if (!isValidWelcomePackDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function ordinalDay(day) {
  if (day === 1 || day === 21 || day === 31) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

// The welcome pack model for ONE customer. status is 'ready' only
// when package, monthly amount, and a due date (specific date, or a
// due-day rule) are all recorded; otherwise status is 'incomplete'
// and `missing` names exactly what is absent. Nothing is invented:
// a missing field stays null in the model.
export function buildWelcomePack(input = {}) {
  const source = input ?? {};
  const customerId = text(source.customerId ?? source.id);
  const customerName = text(source.customerName ?? source.name);
  const packageName = text(source.package ?? source.packageSpeed);
  const monthlyAmount = moneyOrNull(source.monthlyAmount ?? source.monthlySellingAmount);
  const dueDate = validDateOrNull(source.dueDate);
  const dueDay = validDueDayOrNull(source.dueDay);
  const paymentMethods = cleanMethodList(source.paymentMethods);
  const supportContact = text(source.supportContact ?? source.supportPhone);

  const missing = [];
  if (!packageName) missing.push('package');
  if (monthlyAmount === null) missing.push('monthly-amount');
  if (!dueDate && dueDay === null) missing.push('due-date');

  return {
    customerId,
    customerName,
    package: packageName,
    monthlyAmount,
    dueDate,
    dueDay,
    paymentMethods,
    supportContact,
    status: missing.length === 0 ? 'ready' : 'incomplete',
    missing,
  };
}

// Map a customer record to a welcome pack, the way
// previewFromCustomer maps one to a first-bill preview: package and
// monthly amount come from the profile's own fields, and the due date
// comes from the customer's latest bill that carries a valid due
// date, if any. Caller options override: dueDate, dueDay,
// paymentMethods, supportContact.
export function welcomePackFromCustomer(customer = {}, options = {}) {
  const source = customer ?? {};
  const opts = options ?? {};
  let latestDueDate = null;
  for (const bill of Array.isArray(source.bills) ? source.bills : []) {
    const due = validDateOrNull(bill?.dueDate);
    if (due) latestDueDate = due;
  }
  return buildWelcomePack({
    customerId: source.id ?? source.customerId,
    customerName: source.name ?? source.customerName,
    package: source.packageSpeed ?? source.package,
    monthlyAmount: source.monthlySellingAmount ?? source.monthlyAmount,
    dueDate: opts.dueDate ?? latestDueDate,
    dueDay: opts.dueDay ?? null,
    paymentMethods: opts.paymentMethods ?? [],
    supportContact: opts.supportContact ?? opts.supportPhone ?? '',
  });
}

function dueLineRoman(pack) {
  if (pack.dueDate) return `Aap ka bill ${formatWelcomePackDate(pack.dueDate)} tak ada karna hai.`;
  if (pack.dueDay !== null) return `Bill har mahine ki ${ordinalDay(pack.dueDay)} tareekh tak ada karna hai.`;
  return `Due date: ${WELCOME_PACK_NOT_SET} — please confirm before sending.`;
}

function dueLineUrdu(pack) {
  if (pack.dueDate) return `آپ کا بل ${formatWelcomePackDate(pack.dueDate)} تک ادا کرنا ہے۔`;
  if (pack.dueDay !== null) return `بل ہر مہینے کی ${pack.dueDay} تاریخ تک ادا کرنا ہے۔`;
  return `آخری تاریخ: درج نہیں — بھیجنے سے پہلے تصدیق کر لیں۔`;
}

// The draft text itself, in the requested variant. A missing field
// renders as "Not set" in the preview text — the operator sees the
// gap before sending instead of the customer receiving a guessed
// figure. The receipt/Waada lines are fixed guidance, never a record:
// they promise nothing and change no promise.
export function buildWelcomePackDraft(pack, variant = WELCOME_PACK_VARIANTS.ROMAN) {
  const model = pack && typeof pack === 'object' ? pack : buildWelcomePack(pack);
  const name = model.customerName || '—';
  const packageLine = model.package || WELCOME_PACK_NOT_SET;
  const amountLine = model.monthlyAmount === null
    ? WELCOME_PACK_NOT_SET
    : formatWelcomePackAmount(model.monthlyAmount);
  const methodsLine = model.paymentMethods.length > 0
    ? model.paymentMethods.join(', ')
    : WELCOME_PACK_NOT_SET;
  if (variant === WELCOME_PACK_VARIANTS.URDU) {
    const lines = [
      `السلام علیکم ${name}، شاہدرہ فائبر نیٹ میں خوش آمدید!`,
      `آپ کا پیکیج: ${packageLine}۔ ماہانہ رقم: ${amountLine}۔`,
      dueLineUrdu(model),
      `ادائیگی کے طریقے: ${methodsLine}۔`,
      'رسید ضرور سنبھال کر رکھیں — یہی آپ کی ادائیگی کا ثبوت ہے۔ اگر وقت پر ادا نہ کر سکیں تو آخری تاریخ سے پہلے ہمیں بتا دیں، ہم وعدہ (Waada) کی تاریخ طے کر سکتے ہیں۔',
    ];
    if (model.supportContact) lines.push(`رابطہ: ${model.supportContact}۔`);
    lines.push('شکریہ!');
    return { variant: WELCOME_PACK_VARIANTS.URDU, text: lines.join(' ') };
  }
  const lines = [
    `Assalam-o-Alaikum ${name}, Shahdara Fiber Net mein khush aamdeed!`,
    `Aap ka package: ${packageLine}. Monthly amount: ${amountLine}.`,
    dueLineRoman(model),
    `Payment methods: ${methodsLine}.`,
    'Receipt zaroor sambhal kar rakhein — yehi aap ki adaigi ka saboot hai. Agar waqt par ada na kar sakein to due date se pehle humein batayein, hum Waada (promise) date tay kar sakte hain.',
  ];
  if (model.supportContact) lines.push(`Support ke liye rabta karein: ${model.supportContact}.`);
  lines.push('Shukriya!');
  return { variant: WELCOME_PACK_VARIANTS.ROMAN, text: lines.join(' ') };
}

export function welcomePackSummaryText(pack) {
  if (!pack || typeof pack !== 'object') return 'Welcome pack unavailable.';
  if (pack.status === 'ready') {
    return `Welcome pack ready for ${pack.customerName || 'this customer'} — ${pack.package}, ${formatWelcomePackAmount(pack.monthlyAmount)}.`;
  }
  return `Welcome pack incomplete — missing: ${pack.missing.join(', ')}.`;
}

// Append a send to the log (time, channel), returning a new list.
// Entries without a customer id or a send time are ignored: a logged
// send always carries a real send time. The log never touches a
// payment, bill, Waada, or lifecycle record.
export function logWelcomePackSent(log, { customerId, sentAt, channel, variant } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(customerId);
  const time = text(sentAt);
  if (!id || !time) return list;
  list.push({
    customerId: id,
    sentAt: time,
    channel: text(channel) || 'whatsapp',
    variant: normalizeWelcomePackVariant(variant),
  });
  return list;
}

export function findWelcomePackSends(log, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(log)) return [];
  return log.filter((entry) => text(entry?.customerId) === id);
}

export function welcomePackSentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Welcome pack not sent yet — send it once at activation.';
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = formatWelcomePackDate(datePart) || datePart;
  if (list.length === 1) return `Welcome pack sent on ${shown}.`;
  return `Welcome pack sent on ${shown} and ${list.length - 1} more time${list.length - 1 === 1 ? '' : 's'} — re-send anytime from here.`;
}

export function welcomePackHtml(pack, { draftText = '', sends = [] } = {}) {
  if (!pack || typeof pack !== 'object') return '<p class="empty-state">Welcome pack unavailable.</p>';
  const fields = [
    `Package: ${pack.package ? escapeHtml(pack.package) : WELCOME_PACK_NOT_SET}`,
    `Monthly amount: ${pack.monthlyAmount === null ? WELCOME_PACK_NOT_SET : escapeHtml(formatWelcomePackAmount(pack.monthlyAmount))}`,
    `Due: ${pack.dueDate ? escapeHtml(formatWelcomePackDate(pack.dueDate)) : pack.dueDay !== null ? `${ordinalDay(pack.dueDay)} of every month` : WELCOME_PACK_NOT_SET}`,
    `Payment methods: ${pack.paymentMethods.length > 0 ? escapeHtml(pack.paymentMethods.join(', ')) : WELCOME_PACK_NOT_SET}`,
  ];
  if (pack.supportContact) fields.push(`Support: ${escapeHtml(pack.supportContact)}`);
  const missingNote = pack.missing.length > 0
    ? `<p class="welcome-pack-missing">Missing on the profile: ${escapeHtml(pack.missing.join(', '))} — set it on the profile before sending, so the customer never receives a guessed figure.</p>`
    : '';
  return `<p>${escapeHtml(welcomePackSummaryText(pack))}</p>`
    + `<ul class="welcome-pack-fields">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + missingNote
    + (draftText ? `<p class="welcome-pack-draft">${escapeHtml(draftText)}</p>` : '')
    + `<p id="welcomePackSent">${escapeHtml(welcomePackSentText(sends))}</p>`;
}
