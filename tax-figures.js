// Plan 186 (Plan 101-202) — Tax-Season Figures Pack.
//
// At tax time the owner hunts through separate reports for the
// figures an accountant needs, and it is unclear which figures are
// ready and which are still missing. This module is a checklist
// only: each figure needed, the source report it comes from, the
// period it covers, a status of ready or missing, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not a second export. Plan 32's accountant export pack
//     already exports the raw rows and totals; this checklist only
//     names which figures the accountant still needs and whether
//     each one is ready. It never exports, re-derives, or totals
//     anything itself.
//   - It is not a tax calculation. No tax, rate, deduction, or
//     liability is computed here, and no figure amount is stored:
//     the checklist records only that a figure is needed, where it
//     comes from, and whether it is ready. The accountant still
//     does the actual tax work.
//   - It is not an edit of any record. Creating a pack never
//     changes any bill, payment, expense, or past total; it only
//     records the checklist the operator wrote.
//   - It is not silently editable history. There is no edit
//     function: a pack is recorded or removed, never quietly
//     rewritten, so an incomplete pack stays visibly incomplete
//     until its figures are marked ready.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, expense,
//     customer, or sending field can ever creep into a pack.
//   - A status that is not exactly "ready" is stored as "missing":
//     an unknown status can never make a pack look complete.
//   - A pack is complete only when it has at least one figure and
//     every figure is ready and names a source report. Anything
//     else is plainly marked incomplete, with the missing and
//     sourceless figures named.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
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

function normalizeStatus(value) {
  return lower(value) === 'ready' ? 'ready' : 'missing';
}

function normalizeFigure(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const figure = text(raw.figure);
  if (!figure) return null;
  return {
    figure,
    source: text(raw.source),
    status: normalizeStatus(raw.status),
    note: text(raw.note),
  };
}

function normalizeFigures(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const entry = normalizeFigure(item);
    if (!entry) continue;
    const dedupe = lower(entry.figure);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(entry);
  }
  return out;
}

export function normalizeTaxPack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const period = text(raw.period);
  if (!id || !name || !period) return null;
  const figures = normalizeFigures(raw.figures);
  if (!figures.length) return null;
  return { id, name, period, figures };
}

export function normalizeTaxPackList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const entry = normalizeTaxPack(item);
    if (!entry) continue;
    const dedupe = lower(entry.id);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(entry);
  }
  return out;
}

export function findTaxPack(list, id) {
  const wanted = lower(id);
  if (!wanted) return null;
  for (const entry of normalizeTaxPackList(list)) {
    if (lower(entry.id) === wanted) return entry;
  }
  return null;
}

function samePack(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function recordTaxPack(list, raw) {
  const clean = normalizeTaxPackList(list);
  const entry = normalizeTaxPack(raw);
  if (!entry) return clean;
  const existing = findTaxPack(clean, entry.id);
  if (existing) {
    if (samePack(existing, entry)) return clean;
    return clean;
  }
  return [...clean, entry];
}

export function removeTaxPack(list, id) {
  const wanted = lower(id);
  if (!wanted) return normalizeTaxPackList(list);
  return normalizeTaxPackList(list).filter((entry) => lower(entry.id) !== wanted);
}

export function markTaxFigure(list, packId, figureName, status) {
  const clean = normalizeTaxPackList(list);
  const wanted = lower(figureName);
  if (!wanted) return clean;
  return clean.map((entry) => {
    if (lower(entry.id) !== lower(packId)) return entry;
    return {
      ...entry,
      figures: entry.figures.map((item) =>
        lower(item.figure) === wanted ? { ...item, status: normalizeStatus(status) } : item,
      ),
    };
  });
}

export function taxPackFigures(pack) {
  const entry = normalizeTaxPack(pack);
  if (!entry) return [];
  return entry.figures;
}

export function figuresByStatus(pack, status) {
  const wanted = normalizeStatus(status);
  return taxPackFigures(pack).filter((item) => item.status === wanted);
}

export function incompleteFigures(pack) {
  return taxPackFigures(pack).filter((item) => item.status !== 'ready' || !item.source);
}

export function taxPackStatus(pack) {
  const entry = normalizeTaxPack(pack);
  if (!entry) return 'incomplete';
  return incompleteFigures(entry).length === 0 ? 'complete' : 'incomplete';
}

export function taxPackStatusText(pack) {
  const entry = normalizeTaxPack(pack);
  if (!entry) return 'Incomplete pack — no usable pack recorded.';
  const bad = incompleteFigures(entry);
  if (bad.length === 0) return `Complete pack — all ${entry.figures.length} figures ready with sources named.`;
  const missing = bad.filter((item) => item.status !== 'ready').map((item) => item.figure);
  const sourceless = bad.filter((item) => item.status === 'ready' && !item.source).map((item) => item.figure);
  const parts = [`Incomplete pack — ${bad.length} of ${entry.figures.length} figures not ready to hand over.`];
  if (missing.length) parts.push(`Still missing: ${missing.join(', ')}.`);
  if (sourceless.length) parts.push(`No source named: ${sourceless.join(', ')}.`);
  return parts.join(' ');
}

export function taxPacksSorted(list) {
  return normalizeTaxPackList(list).sort((a, b) => {
    if (a.period !== b.period) return a.period < b.period ? -1 : 1;
    return lower(a.name) < lower(b.name) ? -1 : lower(a.name) > lower(b.name) ? 1 : 0;
  });
}

export function taxPackStarters() {
  return [
    {
      id: 'TF-DEFAULT',
      name: 'Tax-season figures',
      period: 'Tax year',
      figures: [
        { figure: 'Total collections', source: 'Owner Khata report', status: 'missing', note: '' },
        { figure: 'Total bills issued', source: 'Billing run log', status: 'missing', note: '' },
        { figure: 'Total expenses', source: 'Expense ledger', status: 'missing', note: '' },
        { figure: 'Arrears written off', source: 'Arrears write-off record', status: 'missing', note: '' },
        { figure: 'Refunds issued', source: 'Refund record', status: 'missing', note: '' },
        { figure: 'Deposits held', source: 'Security deposit record', status: 'missing', note: '' },
      ],
    },
  ];
}

export function taxPackSummaryText(list) {
  const entries = normalizeTaxPackList(list);
  const complete = entries.filter((entry) => taxPackStatus(entry) === 'complete').length;
  const word = entries.length === 1 ? 'pack' : 'packs';
  return `${entries.length} tax ${word}, ${complete} complete`;
}

export function taxPackText(pack) {
  const entry = normalizeTaxPack(pack);
  if (!entry) return '';
  const lines = [`Tax figures pack — ${entry.name} (${entry.period})`, taxPackStatusText(entry)];
  for (const item of entry.figures) {
    const source = item.source ? `Source report: ${item.source}.` : 'No source report named.';
    const note = item.note ? ` Note: ${item.note}` : '';
    lines.push(`- ${item.figure} — ${item.status}. ${source}${note}`);
  }
  return lines.join('\n');
}

export function taxPackHtml(pack) {
  const entry = normalizeTaxPack(pack);
  if (!entry) return '';
  const rows = entry.figures
    .map((item) => {
      const source = item.source ? `Source report: ${escapeHtml(item.source)}.` : 'No source report named.';
      const note = item.note ? ` Note: ${escapeHtml(item.note)}` : '';
      return `<li>${escapeHtml(item.figure)} — ${item.status}. ${source}${note}</li>`;
    })
    .join('');
  return `<div><strong>${escapeHtml(entry.name)} (${escapeHtml(entry.period)})</strong><p>${escapeHtml(taxPackStatusText(entry))}</p><ul>${rows}</ul></div>`;
}

export function taxPackAllHtml(list) {
  return normalizeTaxPackList(list).map((entry) => taxPackHtml(entry)).join('');
}

export function taxPackCsv(list) {
  const rows = ['id,name,period,figure,source,status,note'];
  for (const entry of normalizeTaxPackList(list)) {
    for (const item of entry.figures) {
      rows.push([entry.id, entry.name, entry.period, item.figure, item.source, item.status, item.note].map(escapeCsv).join(','));
    }
  }
  return rows.join('\n');
}

export function taxPackFilename() {
  return 'tax-figures.csv';
}
