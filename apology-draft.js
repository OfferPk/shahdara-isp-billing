// Plan 179 (Plan 101-202) — Service-experience apology and explanation
// draft library.
//
// When service is slow or confusing, the operator improvises an
// apology each time, so some customers get a clear explanation and
// others get a shrug. This module adds only a small library of short
// apology and explanation drafts for common service experiences —
// slow speed, confusion about a bill, a missed visit — each in plain
// words, stating what happened, what happens next, and what the
// customer should do. The operator picks, adjusts, and sends a draft
// by hand; no draft promises a credit, refund, or fix date.
//
// Scope fence, stated plainly:
//   - One draft per service experience: id, topic, what happened,
//     what happens next, and what the customer should do, plus a
//     sent flag and sent date marked by the operator only.
//   - A draft that promises a credit, refund, discount, waiver, or
//     compensation in any of its three text fields is refused
//     outright — the library can never hold such a promise. Drafts
//     carry no date field of their own at all, so no fix date can
//     ever be promised by a draft; the only date on a draft is the
//     date the operator marked it sent.
//   - Sending is marked by the operator only, with a strict sent
//     date. Marking a draft sent never changes anything else.
//   - It is import-free (like testimonial-consent.js): the caller
//     supplies every record, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - These drafts never change any bill, payment, fault, or
//     goodwill record, and never send anything automatically.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Words that would turn a draft into a promise of money back or money
// off. Any of these, as a whole word, in any of the three text
// fields refuses the draft outright.
const PROMISE_WORDS = ['credit', 'refund', 'discount', 'waiver', 'waive', 'compensation'];

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

// True when none of the three text fields promises money back or
// money off. The check is on the stored fields only, never on text
// the module itself adds around them.
export function draftPromisesNothing(whatHappened, whatNext, customerAction) {
  const joined = [whatHappened, whatNext, customerAction].join(' ');
  return !PROMISE_WORDS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(joined));
}

// Normalize one draft. Returns null when the draft is half-formed:
// no id, no topic, no what-happened, no what-next, or no
// what-the-customer-should-do; or when any text field promises a
// credit, refund, discount, waiver, or compensation. A sent draft
// with a bad sent date keeps its sent flag but no sent date, so a
// bad date can never be mistaken for a real one. Unknown fields are
// dropped.
export function normalizeApologyDraft(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const topic = text(value.topic);
  const whatHappened = text(value.whatHappened);
  const whatNext = text(value.whatNext);
  const customerAction = text(value.customerAction);
  if (!id || !topic || !whatHappened || !whatNext || !customerAction) return null;
  if (!draftPromisesNothing(whatHappened, whatNext, customerAction)) return null;
  const sent = value.sent === true;
  const sentDate = sent && isStrictDate(text(value.sentDate)) ? text(value.sentDate) : '';
  return { id, topic, whatHappened, whatNext, customerAction, sent, sentDate };
}

export function normalizeApologyDraftList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const draft = normalizeApologyDraft(item);
    if (draft) out.push(draft);
  }
  return out;
}

export function findApologyDraft(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  for (const draft of normalizeApologyDraftList(list)) {
    if (draft.id === wanted) return draft;
  }
  return null;
}

// A draft is never rewritten by recording: an identical re-save
// leaves the list unchanged, different figures are refused. Returns
// a new list; the input list and its records are never mutated.
export function upsertApologyDraft(list, record) {
  const base = normalizeApologyDraftList(list);
  const draft = normalizeApologyDraft(record);
  if (!draft) return base;
  const sameId = base.find((item) => item.id === draft.id);
  if (sameId) {
    if (JSON.stringify(sameId) === JSON.stringify(draft)) return base;
    return base;
  }
  return [...base, draft];
}

export function removeApologyDraft(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeApologyDraftList(list);
  return normalizeApologyDraftList(list).filter((draft) => draft.id !== wanted);
}

// Marking sent is operator-only: it sets only the sent flag and the
// sent date, and only with a strict date. A bad sent date, or an
// unknown id, leaves the list unchanged.
export function markApologyDraftSent(list, id, sentDate) {
  const base = normalizeApologyDraftList(list);
  const wanted = text(id);
  if (!wanted || !isStrictDate(text(sentDate))) return base;
  let changed = false;
  const next = base.map((draft) => {
    if (draft.id === wanted && (!draft.sent || draft.sentDate !== text(sentDate))) {
      changed = true;
      return { ...draft, sent: true, sentDate: text(sentDate) };
    }
    return draft;
  });
  return changed ? next : base;
}

// Marking not sent clears both the flag and the date, so a draft
// marked not sent can never still look sent.
export function markApologyDraftUnsent(list, id) {
  const base = normalizeApologyDraftList(list);
  const wanted = text(id);
  if (!wanted) return base;
  let changed = false;
  const next = base.map((draft) => {
    if (draft.id === wanted && (draft.sent || draft.sentDate)) {
      changed = true;
      return { ...draft, sent: false, sentDate: '' };
    }
    return draft;
  });
  return changed ? next : base;
}

// Drafts for one topic (case-insensitive), topic A-Z is not needed
// here: drafts keep the order they were recorded in, so the operator
// sees the library in the order it was built.
export function apologyDraftsForTopic(list, topic) {
  const wanted = text(topic).toLowerCase();
  if (!wanted) return [];
  return normalizeApologyDraftList(list).filter(
    (draft) => draft.topic.toLowerCase() === wanted,
  );
}

// Topics in the library, first spelling kept, A-Z.
export function apologyDraftTopics(list) {
  const seen = new Map();
  for (const draft of normalizeApologyDraftList(list)) {
    const key = draft.topic.toLowerCase();
    if (!seen.has(key)) seen.set(key, draft.topic);
  }
  return [...seen.values()].sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

export function sentApologyDrafts(list) {
  return normalizeApologyDraftList(list).filter((draft) => draft.sent);
}

export function unsentApologyDrafts(list) {
  return normalizeApologyDraftList(list).filter((draft) => !draft.sent);
}

// Three starter drafts for the common experiences named in the plan:
// slow speed, confusion about a bill, and a missed visit. Each states
// what happened, what happens next, and what the customer should do,
// and promises no credit or refund. Recording them twice changes
// nothing, because their ids are fixed.
export function apologyDraftStarters() {
  return [
    {
      id: 'APO-SLOW-SPEED',
      topic: 'Slow speed',
      whatHappened: 'We are sorry your connection has been slower than usual.',
      whatNext: 'We will check the line and let you know what we find.',
      customerAction: 'Please restart your router once and tell us if the speed is still slow.',
      sent: false,
      sentDate: '',
    },
    {
      id: 'APO-BILL-CONFUSION',
      topic: 'Confusion about a bill',
      whatHappened: 'We are sorry your bill was confusing to read.',
      whatNext: 'We will go through the bill with you line by line.',
      customerAction: 'Please keep the bill handy and ask us about any line that is unclear.',
      sent: false,
      sentDate: '',
    },
    {
      id: 'APO-MISSED-VISIT',
      topic: 'Missed visit',
      whatHappened: 'We are sorry we missed the visit we had planned.',
      whatNext: 'We will agree a new visit time with you.',
      customerAction: 'Please tell us a time that suits you for the new visit.',
      sent: false,
      sentDate: '',
    },
  ];
}

// Plain-words text for one draft. It always states what happened,
// what happens next, and what the customer should do, and it says
// plainly that no credit or refund is promised, so the promise-free
// rule is visible in the text itself, not only in the refusal rule.
export function apologyDraftText(draft) {
  const clean = normalizeApologyDraft(draft);
  if (!clean) return '';
  const sent = clean.sent
    ? ` Sent on ${clean.sentDate}.`
    : ' Not sent yet.';
  return `We are sorry. What happened: ${clean.whatHappened} What happens next: ${clean.whatNext} What you should do: ${clean.customerAction} No credit or refund is promised by this note.${sent}`;
}

export function apologyDraftSummaryText(list) {
  const drafts = normalizeApologyDraftList(list);
  const sent = drafts.filter((draft) => draft.sent).length;
  return `${drafts.length} apology drafts, ${sent} marked sent, ${drafts.length - sent} not sent`;
}

export function apologyDraftHtml(draft) {
  const clean = normalizeApologyDraft(draft);
  if (!clean) return '';
  const status = clean.sent ? `Sent on ${escapeHtml(clean.sentDate)}` : 'Not sent yet';
  return `<p><strong>${escapeHtml(clean.topic)}</strong> — ${status}<br>What happened: ${escapeHtml(clean.whatHappened)}<br>What happens next: ${escapeHtml(clean.whatNext)}<br>What you should do: ${escapeHtml(clean.customerAction)}</p>`;
}

export function apologyDraftAllHtml(list) {
  const drafts = normalizeApologyDraftList(list);
  if (!drafts.length) return '<p>No apology drafts.</p>';
  return drafts.map((draft) => apologyDraftHtml(draft)).join('');
}

export function apologyDraftCsv(list) {
  const rows = [['id', 'topic', 'whatHappened', 'whatNext', 'customerAction', 'sent', 'sentDate']];
  for (const draft of normalizeApologyDraftList(list)) {
    rows.push([
      csvCell(draft.id),
      csvCell(draft.topic),
      csvCell(draft.whatHappened),
      csvCell(draft.whatNext),
      csvCell(draft.customerAction),
      csvCell(draft.sent ? 'yes' : 'no'),
      csvCell(draft.sentDate),
    ]);
  }
  return rows.map((row) => row.join(',')).join('\n');
}

export function apologyDraftFilename() {
  return 'apology-drafts.csv';
}
