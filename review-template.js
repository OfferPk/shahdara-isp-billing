// Plan 185 (Plan 101-202) — Monthly Business Review Template (Composition Only).
//
// A monthly review is assembled from memory each time, so some months
// cover collections and others cover faults, and months cannot be
// compared fairly. This module is the template only: which existing
// sections to include, in what order, and with what headings. It
// composes links/references to existing reports and computes no new
// figure and no new rating.
//
// What this module is NOT, stated plainly:
//   - It is not a report. It holds no collected amount, no arrears
//     figure, no count, and no score. A composed review lists
//     section headings and their source reports, nothing more.
//   - It is not an edit of any past report. Using a template never
//     changes any bill, payment, or past report; it only reads the
//     template the operator recorded.
//   - It is not a silently editable history. There is no edit
//     function: a template is recorded or removed, never quietly
//     rewritten, so a month's review follows the same section
//     order every time.
//   - It is not proof that a section's source report exists or is
//     true. A section with no source states plainly that it has
//     no source, instead of inventing one.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, package,
//     customer, or sending field can ever creep into a template.
//   - A bad month is refused outright, never stored as a
//     neighbouring month.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function slug(value) {
  return lower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isReviewMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value.trim());
}

function normalizeSection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const heading = text(raw.heading);
  if (!heading) return null;
  const key = text(raw.key) || slug(heading);
  if (!key) return null;
  return { key, heading, source: text(raw.source) };
}

function normalizeSections(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const section = normalizeSection(item);
    if (!section) continue;
    const dedupe = lower(section.key);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(section);
  }
  return out;
}

export function normalizeReviewTemplate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;
  const sections = normalizeSections(raw.sections);
  if (!sections.length) return null;
  return { id, name, sections };
}

export function normalizeReviewTemplateList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const entry = normalizeReviewTemplate(item);
    if (!entry) continue;
    const dedupe = lower(entry.id);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(entry);
  }
  return out;
}

export function findReviewTemplate(list, id) {
  const wanted = lower(id);
  if (!wanted) return null;
  for (const entry of normalizeReviewTemplateList(list)) {
    if (lower(entry.id) === wanted) return entry;
  }
  return null;
}

function sameTemplate(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function recordReviewTemplate(list, raw) {
  const clean = normalizeReviewTemplateList(list);
  const entry = normalizeReviewTemplate(raw);
  if (!entry) return clean;
  const existing = findReviewTemplate(clean, entry.id);
  if (existing) {
    if (sameTemplate(existing, entry)) return clean;
    return clean;
  }
  return [...clean, entry];
}

export function removeReviewTemplate(list, id) {
  const wanted = lower(id);
  if (!wanted) return normalizeReviewTemplateList(list);
  return normalizeReviewTemplateList(list).filter((entry) => lower(entry.id) !== wanted);
}

export function reviewTemplateSections(template) {
  const entry = normalizeReviewTemplate(template);
  if (!entry) return [];
  return entry.sections.map((section, index) => ({ ...section, position: index + 1 }));
}

export function composeReview(template, month) {
  const entry = normalizeReviewTemplate(template);
  if (!entry || !isReviewMonth(month)) return null;
  const sections = reviewTemplateSections(entry).map((section) => ({
    position: section.position,
    heading: section.heading,
    source: section.source,
    sourceNote: section.source
      ? `Source report: ${section.source}.`
      : 'No source report for this section — fill in by hand.',
  }));
  return { templateId: entry.id, templateName: entry.name, month: month.trim(), sections };
}

export function reviewTemplateStarters() {
  return [
    {
      id: 'RT-DEFAULT',
      name: 'Monthly business review',
      sections: [
        { key: 'collections', heading: 'Collections', source: 'Owner Khata report' },
        { key: 'bills', heading: 'Bills issued', source: 'Billing run log' },
        { key: 'arrears', heading: 'Arrears and write-offs', source: 'Arrears write-off record' },
        { key: 'field', heading: 'Faults and field work', source: 'Fault parts-used log' },
        { key: 'trust', heading: 'Customer trust and communication', source: 'Customer communication history timeline' },
        { key: 'shop', heading: 'Shop and owner operations', source: 'Shop inventory audit cycle' },
        { key: 'growth', heading: 'Growth readiness', source: 'Migration checklist' },
        { key: 'notes', heading: 'Owner notes', source: '' },
      ],
    },
  ];
}

export function reviewTemplateSummaryText(list) {
  const entries = normalizeReviewTemplateList(list);
  const word = entries.length === 1 ? 'template' : 'templates';
  return `${entries.length} review ${word}`;
}

export function reviewTemplateText(template, month) {
  const review = composeReview(template, month);
  if (!review) return '';
  const lines = [`Monthly business review — ${review.month} (${review.templateName})`];
  for (const section of review.sections) {
    lines.push(`${section.position}. ${section.heading} — ${section.sourceNote}`);
  }
  return lines.join('\n');
}

export function reviewTemplateHtml(template) {
  const entry = normalizeReviewTemplate(template);
  if (!entry) return '';
  const rows = reviewTemplateSections(entry)
    .map((section) => `<li>${section.position}. ${escapeHtml(section.heading)} — ${section.source ? `Source report: ${escapeHtml(section.source)}.` : 'No source report for this section.'}</li>`)
    .join('');
  return `<div><strong>${escapeHtml(entry.name)}</strong><ol>${rows}</ol></div>`;
}

export function reviewTemplateAllHtml(list) {
  return normalizeReviewTemplateList(list).map((entry) => reviewTemplateHtml(entry)).join('');
}

export function reviewTemplateCsv(list) {
  const rows = ['id,name,position,heading,source'];
  for (const entry of normalizeReviewTemplateList(list)) {
    for (const section of reviewTemplateSections(entry)) {
      rows.push([entry.id, entry.name, section.position, section.heading, section.source].map(escapeCsv).join(','));
    }
  }
  return rows.join('\n');
}

export function reviewTemplateFilename() {
  return 'review-templates.csv';
}
