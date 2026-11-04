// Plan 178 (Plan 101-202) — Testimonial consent note.
//
// The owner would like to share a happy customer's words with others,
// but there is no record of whether the customer agreed, so a story
// is either never used or used without clear permission. This module
// adds only that consent note; it never publishes or sends anything,
// and it never changes any bill, payment, or customer record beyond
// the consent note itself.
//
// Scope fence, stated plainly:
//   - One consent note per customer. It records only whether the
//     customer agreed to have their words shared, in what form
//     (name, mohalla, or anonymous), and the date of agreement, plus
//     the customer's own words exactly as given. The note stores no
//     words beyond what the customer gave — the module never invents,
//     paraphrases, or embellishes words.
//   - A testimonial is usable only while its consent note says
//     agreed. Withdrawing consent immediately marks it unusable:
//     agreed becomes false and the agreed form and agreement date
//     are cleared, so nothing about a withdrawn testimonial can be
//     mistaken for a usable one.
//   - It is import-free (like new-customer-checkin.js): the caller
//     supplies every record, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - Dates are strict YYYY-MM-DD calendar dates. A date that is not
//     real becomes null, never a guessed date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const FORMS = ['name', 'mohalla', 'anonymous'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function normalizeForm(value) {
  const form = text(value).toLowerCase();
  return FORMS.includes(form) ? form : 'anonymous';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

// Normalize one consent note. Returns null when the note is
// half-formed: no id, no customer, or (for an agreed note) no strict
// agreement date. An agreed note with a missing or unrecognised form
// falls back to anonymous, the safest form. A note that does not say
// agreed keeps no form and no agreement date, so it can never be
// mistaken for a usable testimonial. Unknown fields are dropped.
export function normalizeTestimonialConsent(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const customerId = text(value.customerId);
  if (!id || !customerId) return null;
  const agreed = value.agreed === true;
  const words = text(value.words);
  if (!agreed) {
    return { id, customerId, agreed: false, form: '', agreementDate: '', words };
  }
  const agreementDate = text(value.agreementDate);
  if (!isStrictDate(agreementDate)) return null;
  return { id, customerId, agreed: true, form: normalizeForm(value.form), agreementDate, words };
}

export function normalizeTestimonialConsentList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const note = normalizeTestimonialConsent(item);
    if (note) out.push(note);
  }
  return out;
}

export function findTestimonialConsent(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  for (const note of normalizeTestimonialConsentList(list)) {
    if (note.id === wanted) return note;
  }
  return null;
}

// One consent note per customer (case-insensitive). A second note
// for the same customer with a different id is refused, and a
// duplicate id is never rewritten: an identical re-save leaves the
// list unchanged, different figures are refused. Returns a new list;
// the input list and its records are never mutated.
export function upsertTestimonialConsent(list, record) {
  const base = normalizeTestimonialConsentList(list);
  const note = normalizeTestimonialConsent(record);
  if (!note) return base;
  const sameId = base.find((item) => item.id === note.id);
  if (sameId) {
    if (JSON.stringify(sameId) === JSON.stringify(note)) return base;
    return base;
  }
  const sameCustomer = base.find(
    (item) => item.customerId.toLowerCase() === note.customerId.toLowerCase(),
  );
  if (sameCustomer) return base;
  return [...base, note];
}

export function removeTestimonialConsent(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeTestimonialConsentList(list);
  return normalizeTestimonialConsentList(list).filter((note) => note.id !== wanted);
}

// Withdrawing consent immediately marks the testimonial unusable:
// agreed becomes false and the agreed form and agreement date are
// cleared. The customer's own words stay exactly as given, so the
// record still shows what was withdrawn. Withdrawing an unknown id,
// or a note that already says not agreed, leaves the list unchanged.
export function withdrawTestimonialConsent(list, id) {
  const base = normalizeTestimonialConsentList(list);
  const wanted = text(id);
  if (!wanted) return base;
  let changed = false;
  const next = base.map((note) => {
    if (note.id === wanted && note.agreed) {
      changed = true;
      return { ...note, agreed: false, form: '', agreementDate: '' };
    }
    return note;
  });
  return changed ? next : base;
}

// The note for one customer (case-insensitive), or null. This is the
// only view the operator checks before sharing words: a null, or a
// note that does not say agreed, means the words must not be used.
export function testimonialForCustomer(list, customerId) {
  const wanted = text(customerId).toLowerCase();
  if (!wanted) return null;
  for (const note of normalizeTestimonialConsentList(list)) {
    if (note.customerId.toLowerCase() === wanted) return note;
  }
  return null;
}

// Usable testimonials only: notes that currently say agreed,
// customer A-Z. Anything else is never listed here.
export function usableTestimonials(list) {
  return normalizeTestimonialConsentList(list)
    .filter((note) => note.agreed)
    .sort((a, b) => {
      const ca = a.customerId.toLowerCase();
      const cb = b.customerId.toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

export function testimonialsForCustomer(list, customerId) {
  const wanted = text(customerId).toLowerCase();
  if (!wanted) return [];
  return normalizeTestimonialConsentList(list).filter(
    (note) => note.customerId.toLowerCase() === wanted,
  );
}

// Customers with a consent note, first spelling kept, A-Z.
export function customersWithConsent(list) {
  const seen = new Map();
  for (const note of normalizeTestimonialConsentList(list)) {
    const key = note.customerId.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.customerId);
  }
  return [...seen.values()].sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

function formLabel(form) {
  if (form === 'name') return 'with name';
  if (form === 'mohalla') return 'with mohalla';
  return 'anonymously';
}

// Plain-words text for one note. A usable note states the agreed
// form, the agreement date, and the customer's own words exactly as
// given; an unusable note says so plainly and shows no sharing form.
export function testimonialConsentText(note) {
  const clean = normalizeTestimonialConsent(note);
  if (!clean) return '';
  if (!clean.agreed) {
    return `Testimonial for ${clean.customerId}: not usable — consent not agreed or withdrawn.`;
  }
  const words = clean.words ? ` Words: "${clean.words}"` : '';
  return `Testimonial for ${clean.customerId}: agreed to share ${formLabel(clean.form)} on ${clean.agreementDate}.${words}`;
}

export function testimonialConsentSummaryText(list) {
  const notes = normalizeTestimonialConsentList(list);
  const usable = notes.filter((note) => note.agreed).length;
  const unusable = notes.length - usable;
  return `${notes.length} consent notes, ${usable} usable, ${unusable} not usable`;
}

export function testimonialConsentHtml(note) {
  const clean = normalizeTestimonialConsent(note);
  if (!clean) return '';
  const status = clean.agreed ? `Usable — agreed ${formLabel(clean.form)} on ${escapeHtml(clean.agreementDate)}` : 'Not usable — consent not agreed or withdrawn';
  const words = clean.words ? `<br>Words: &quot;${escapeHtml(clean.words)}&quot;` : '';
  return `<p><strong>${escapeHtml(clean.customerId)}</strong> — ${status}${words}</p>`;
}

export function testimonialConsentAllHtml(list) {
  const notes = normalizeTestimonialConsentList(list);
  if (!notes.length) return '<p>No testimonial consent notes.</p>';
  return notes.map((note) => testimonialConsentHtml(note)).join('');
}

export function testimonialConsentCsv(list) {
  const rows = [['id', 'customerId', 'agreed', 'form', 'agreementDate', 'words']];
  for (const note of normalizeTestimonialConsentList(list)) {
    rows.push([
      csvCell(note.id),
      csvCell(note.customerId),
      csvCell(note.agreed ? 'yes' : 'no'),
      csvCell(note.form),
      csvCell(note.agreementDate),
      csvCell(note.words),
    ]);
  }
  return rows.map((row) => row.join(',')).join('\n');
}

export function testimonialConsentFilename() {
  return 'testimonial-consents.csv';
}
