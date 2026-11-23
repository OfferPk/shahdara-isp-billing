// Plan 581 — Dashboard "Print summary" prints the summary, not a blank
// page: the EFFECTIVE print cascade, not rule strings.
//
// Plan 486's print-rules test pins styles.css STRINGS and passed on a
// blank page, because it never read dashboard.css and never computed
// a cascade. This file asserts the cascade itself: Selectors Level 4
// specificity (:not() takes its argument's specificity) plus an
// effective-display evaluator over every @media print display rule in
// dashboard.css and styles.css, evaluated under each flow's real body
// classes, with the DOM ancestry read from index.html line positions.
//
// The engine below is ported from repro-581.mjs (the prep's cascade
// model), with one deliberate difference: CSS comments are stripped
// before parsing. The repro's naive brace-based parser misreads a
// comment's braces as rule braces — Plan 581's own why-comments were
// rewritten for exactly that reason — so the shipped engine strips
// comments first and a future comment can never silently unparse a
// rule. The two engines agree on every current file (repro 19/0/1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatePrintSummary, renderPrintSummary } from '../dashboard-print-summary.js';

const root = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dashboardCss = root('dashboard.css');
const stylesCss = root('styles.css');
const page = root('index.html');

// ---- Selectors Level 4 specificity: :not() takes its argument's ----
// ---- specificity (CSSWG draft §4.3); :where() is always zero. ----
function specificityOfCompound(compound) {
  let a = 0, b = 0, c = 0;
  let rest = compound;
  rest = rest.replace(/:(not|is|has)\(([^()]*)\)/g, (_, _fn, arg) => {
    const parts = arg.split(',').map((s) => s.trim()).filter(Boolean);
    let best = [0, 0, 0];
    for (const p of parts) {
      const s = specificityOfCompound(p);
      if (cmpSpec(s, best) > 0) best = s;
    }
    a += best[0]; b += best[1]; c += best[2];
    return '';
  });
  rest = rest.replace(/:where\([^()]*\)/g, '');
  rest = rest.replace(/::[a-zA-Z-]+/g, () => { c += 1; return ''; });
  rest = rest.replace(/:[a-zA-Z-]+(\([^()]*\))?/g, () => { b += 1; return ''; });
  rest = rest.replace(/#[\w-]+/g, () => { a += 1; return ''; });
  rest = rest.replace(/\.[\w-]+/g, () => { b += 1; return ''; });
  rest = rest.replace(/\[[^\]]+\]/g, () => { b += 1; return ''; });
  rest = rest.replace(/\*/g, '');
  const types = rest.split(/[\s>+~]+/).map((s) => s.trim()).filter(Boolean);
  c += types.length;
  return [a, b, c];
}
function specificity(selector) {
  let a = 0, b = 0, c = 0;
  for (const compound of selector.split(/[\s>+~]+/).filter(Boolean)) {
    const s = specificityOfCompound(compound);
    a += s[0]; b += s[1]; c += s[2];
  }
  return [a, b, c];
}
function cmpSpec(x, y) {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// ---- tiny matcher for the selector shapes used by the print rules ----
// Element: { tag, id, classes:Set, open:boolean, parent }
// Supports: type, #id, .class, *, :not(simple), [open], descendant ' ', child '>'.
function matchCompound(el, compound) {
  let rest = compound;
  const nots = [...rest.matchAll(/:not\(([^()]*)\)/g)].map((m) => m[1]);
  rest = rest.replace(/:not\([^()]*\)/g, '');
  const openAttr = /\[open\]/.test(rest);
  rest = rest.replace(/\[[^\]]+\]/g, '');
  const idM = rest.match(/#([\w-]+)/);
  const clsM = [...rest.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const typeM = rest.replace(/#[\w-]+/g, '').replace(/\.[\w-]+/g, '').replace(/\*/g, '').trim();
  if (typeM && el.tag !== typeM) return false;
  if (idM && el.id !== idM[1]) return false;
  for (const cl of clsM) if (!el.classes.has(cl)) return false;
  if (openAttr && !el.open) return false;
  for (const n of nots) {
    const probe = { tag: el.tag, id: el.id, classes: el.classes, open: el.open };
    if (matchCompound(probe, n.trim())) return false;
  }
  return true;
}
function matchSelector(el, selector) {
  const tokens = selector.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
  let current = el;
  let i = tokens.length - 1;
  if (!matchCompound(current, tokens[i])) return false;
  i--;
  while (i >= 0) {
    if (tokens[i] === '>') {
      i--;
      const parent = current.parent;
      if (!parent) return false;
      if (!matchCompound(parent, tokens[i])) return false;
      current = parent;
      i--;
    } else {
      const want = tokens[i];
      let found = false;
      let node = current.parent;
      while (node) {
        if (matchCompound(node, want)) { found = true; current = node; break; }
        node = node.parent;
      }
      if (!found) return false;
      i--;
    }
  }
  return true;
}

// ---- @media print display rules (comments stripped first) ----
function printBlocks(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let i = 0;
  while (true) {
    const at = stripped.indexOf('@media print', i);
    if (at < 0) break;
    const open = stripped.indexOf('{', at);
    let depth = 1, j = open + 1;
    while (j < stripped.length && depth > 0) {
      if (stripped[j] === '{') depth++;
      else if (stripped[j] === '}') depth--;
      j++;
    }
    blocks.push(stripped.slice(open + 1, j - 1));
    i = j;
  }
  return blocks;
}
function displayRules(css) {
  const out = [];
  for (const block of printBlocks(css)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(block))) {
      const dm = m[2].match(/display\s*:\s*([^;!]+)\s*(!important)?/);
      if (!dm) continue;
      for (const sel of m[1].split(',')) {
        const selector = sel.trim().replace(/\s+/g, ' ');
        if (selector) out.push({ selector, display: dm[1].trim(), important: !!dm[2] });
      }
    }
  }
  return out;
}
// dashboard.css loads AFTER styles.css, so it wins an equal-specificity
// !important tie — dashboard-first ordering + strict > keeps the first.
const allPrintDisplayRules = [...displayRules(dashboardCss), ...displayRules(stylesCss)];

// Effective display of an element in print under a body class set:
// among !important display rules that match, the highest specificity
// wins; non-important rules never beat an !important one.
function effectiveDisplay(el, bodyClasses) {
  const bodyEl = { tag: 'body', id: null, classes: new Set(bodyClasses), open: false, parent: null };
  const elWithBody = { ...el, parent: el.parent === 'body' ? bodyEl : el.parent };
  let node = elWithBody;
  while (node.parent && node.parent !== bodyEl) {
    node = node.parent;
    if (!node.parent) node.parent = bodyEl;
  }
  let best = null;
  for (const r of allPrintDisplayRules) {
    if (!matchSelector(elWithBody, r.selector)) continue;
    const s = specificity(r.selector);
    const cand = { display: r.display, important: r.important, spec: s, selector: r.selector };
    if (!best) { best = cand; continue; }
    if (cand.important && !best.important) { best = cand; continue; }
    if (cand.important === best.important && cmpSpec(cand.spec, best.spec) > 0) best = cand;
  }
  return best;
}

// ---- DOM facts from index.html (line positions, not hardcoded) ----
const lines = page.split('\n');
const lineOf = (needle) => lines.findIndex((l) => l.includes(needle)) + 1;
const mainOpen = lineOf('<main id="main">');
const mainClose = lineOf('</main>');
const inMain = (ln) => ln > mainOpen && ln < mainClose;
assert.ok(inMain(lineOf('id="printSummarySection"')), 'test setup: #printSummarySection sits inside <main>');
assert.ok(inMain(lineOf('id="dashboardBriefingModal"')), 'test setup: the briefing dialog sits inside <main>');
assert.ok(!inMain(lineOf('id="receiptPrintArea"')), 'test setup: #receiptPrintArea is a direct body child');

const bodyEl = (classes) => ({ tag: 'body', id: null, classes: new Set(classes), open: false, parent: null });
const mainEl = (classes) => ({ tag: 'main', id: 'main', classes: new Set(), open: false, parent: bodyEl(classes) });
const sectionEl = (classes) => ({
  tag: 'section', id: 'printSummarySection', classes: new Set(), open: false,
  parent: { tag: 'section', id: 'billingDashboard', classes: new Set(), open: false, parent: mainEl(classes) },
});
const areaEl = (classes) => ({ tag: 'section', id: 'receiptPrintArea', classes: new Set(), open: false, parent: bodyEl(classes) });
const dialogEl = (id, classes, open = true) => ({ tag: 'dialog', id, classes: new Set(), open, parent: bodyEl(classes) });

// The blanket rule, found by its dead #dashboardView exclusion.
const blanketRules = allPrintDisplayRules.filter((r) => r.selector.includes('#dashboardView'));
assert.equal(blanketRules.length, 1, 'exactly one blanket rule carries the #dashboardView exclusion');
const blanket = blanketRules[0];

// The seven live print-flow classes the guard must exempt (Plan 581
// D2(a)/D8(a)). Thermal variants always ride with printing-receipt
// and statement-58 always rides with printing-statement (app.js),
// so the base classes cover them; any future printing-* flow class
// must be added to the guard list.
const FLOW_CLASSES = [
  'printing-dashboard-summary', 'printing-receipt', 'printing-reminder',
  'printing-batch', 'printing-statement', 'printing-invoice', 'printing-audit',
];

// ---- G1 — the cascade ----
test('cascade: the guarded blanket scores (1,8,2) and outranks the summary display rule (1,1,1)', () => {
  // Plan 581: the guard lists the seven flow classes explicitly, so
  // each :not(.printing-*) contributes one class to the specificity.
  assert.deepEqual(specificity(blanket.selector), [1, 8, 2], `blanket specificity, got ${JSON.stringify(specificity(blanket.selector))}`);
  const summaryRule = allPrintDisplayRules.find((r) => r.selector === 'body.printing-dashboard-summary #printSummarySection');
  assert.ok(summaryRule, 'the summary display rule exists');
  assert.deepEqual(specificity(summaryRule.selector), [1, 1, 1]);
  assert.ok(cmpSpec(specificity(blanket.selector), specificity(summaryRule.selector)) > 0, 'the blanket outranks the summary rule where both match');
  assert.equal(blanket.display, 'none', 'the blanket still hides');
  assert.ok(blanket.important, 'the blanket is still !important');
});

test('cascade: the :not() specificity rule itself — the unguarded blanket scores (1,1,2)', () => {
  // Selectors Level 4 §4.3: :not() takes its most specific argument,
  // so :not(#dashboardView) contributes a full ID. This is why the
  // blanket used to beat every body.printing-* #id display rule.
  assert.deepEqual(specificity('body > *:not(#dashboardView):not(dialog[open])'), [1, 1, 2]);
  assert.deepEqual(specificity('body.printing-receipt #receiptPrintArea'), [1, 1, 1]);
});

test('cascade: under body.printing-dashboard-summary no display:none applies to <main>', () => {
  const disp = effectiveDisplay(mainEl(['printing-dashboard-summary']), ['printing-dashboard-summary']);
  assert.ok(!disp || disp.display !== 'none', `main must not be display:none under the summary class, got ${disp ? `${disp.display} via ${disp.selector}` : 'no rule'}`);
});

test('cascade: under the class the summary section is display:block and effectively visible', () => {
  const classes = ['printing-dashboard-summary'];
  const disp = effectiveDisplay(sectionEl(classes), classes);
  assert.ok(disp, 'a print display rule must resolve the section');
  assert.equal(disp.display, 'block', `section display, got ${disp.display} via ${disp.selector}`);
  // Effective visibility respects the ancestor chain: no ancestor may
  // resolve display:none (the B2-pass/B3-fail trap on the base).
  const mainDisp = effectiveDisplay(mainEl(classes), classes);
  assert.ok(!mainDisp || mainDisp.display !== 'none', 'no ancestor hides the section');
});

test('cascade: the guard exempts every live print-flow class', () => {
  for (const flow of FLOW_CLASSES) {
    assert.ok(blanket.selector.includes(`:not(.${flow})`), `the guard must exempt ${flow}`);
  }
  // And the guard is the ONLY thing standing between the blanket and
  // the flows: under each flow class the blanket must not match <main>.
  for (const flow of FLOW_CLASSES) {
    assert.ok(!matchSelector(mainEl([flow]), blanket.selector), `the blanket must not match <main> under ${flow}`);
  }
});

// ---- G2 — guards ----
test('guards: #ppsPrintBtn stays hidden on paper under the summary class', () => {
  const btn = {
    tag: 'button', id: 'ppsPrintBtn', classes: new Set(), open: false,
    parent: sectionEl(['printing-dashboard-summary']).parent,
  };
  const disp = effectiveDisplay(btn, ['printing-dashboard-summary']);
  assert.ok(disp, 'a print display rule must resolve the button');
  assert.equal(disp.display, 'none', `button display, got ${disp.display} via ${disp.selector}`);
});

test('guards: plain dashboard print (no class) still hides <main> — the blanket survives, guarded not deleted', () => {
  const disp = effectiveDisplay(mainEl([]), []);
  assert.ok(disp, 'a print display rule must resolve <main> on a plain print');
  assert.equal(disp.display, 'none', `main display on a plain print, got ${disp.display}`);
  assert.ok(disp.selector.includes('#dashboardView'), `the winning rule must be the blanket, got ${disp.selector}`);
});

test('guards: the briefing-dialog print rule is intact (open dialog resolves display:block)', () => {
  const disp = effectiveDisplay(dialogEl('dashboardBriefingModal', []), []);
  assert.ok(disp, 'a print display rule must resolve the open briefing dialog');
  assert.equal(disp.display, 'block', `dialog display, got ${disp.display} via ${disp.selector}`);
});

test('guards: the five figures still render (empty business: PKR 0 x5, dated)', () => {
  const summary = calculatePrintSummary({ customers: [] }, new Date('2026-11-08T07:00:00Z'), null);
  const els = {};
  const doc = { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) };
  renderPrintSummary(doc, summary);
  for (const id of ['ppsTodayCollected', 'ppsMonthCollected', 'ppsTotalDues', 'ppsOverdueTotal', 'ppsCashInHand']) {
    assert.equal(els[id]?.textContent, 'PKR 0', `${id} must read PKR 0 on the empty business`);
  }
  assert.equal(els.ppsPrintDate?.textContent, 'Printed 2026-11-08');
});

// ---- G3 — blast radius (Plan 581 D2(a) wide branch) ----
test('blast radius: #receiptPrintArea is display:block under printing-receipt', () => {
  const disp = effectiveDisplay(areaEl(['printing-receipt']), ['printing-receipt']);
  assert.ok(disp, 'a print display rule must resolve the area under printing-receipt');
  assert.equal(disp.display, 'block', `area display, got ${disp.display} via ${disp.selector}`);
});

test('blast radius: #receiptPrintArea is display:block under printing-receipt + printing-thermal', () => {
  const classes = ['printing-receipt', 'printing-thermal', 'printing-thermal-80'];
  const disp = effectiveDisplay(areaEl(classes), classes);
  assert.ok(disp, 'a print display rule must resolve the area under the thermal classes');
  assert.equal(disp.display, 'block', `area display, got ${disp.display} via ${disp.selector}`);
});

test('blast radius: #receiptPrintArea is display:block under printing-reminder', () => {
  // The third layer (Plan 581): the base .receipt-print-area
  // display-none rule hid the area even with the blanket guarded
  // off, so the reminder flow carries its own display:block in
  // styles.css — without it this resolves to no rule at all.
  const disp = effectiveDisplay(areaEl(['printing-reminder']), ['printing-reminder']);
  assert.ok(disp, 'a print display rule must resolve the area under printing-reminder');
  assert.equal(disp.display, 'block', `area display, got ${disp.display} via ${disp.selector}`);
  assert.ok(disp.selector.includes('printing-reminder'), `the winning rule must be the reminder rule, got ${disp.selector}`);
});

test('blast radius: the four dialog flows are still exempt via dialog[open]', () => {
  for (const [id, flow] of [
    ['batchReceiptModal', 'printing-batch'],
    ['accountStatementModal', 'printing-statement'],
    ['customerBillInvoiceModal', 'printing-invoice'],
    ['customerLedgerAuditModal', 'printing-audit'],
  ]) {
    const el = dialogEl(id, [flow]);
    assert.ok(!matchSelector(el, blanket.selector), `the blanket must not match the open ${id}`);
    const disp = effectiveDisplay(el, [flow]);
    assert.ok(!disp || disp.display !== 'none', `${id} must not resolve display:none under ${flow}`);
  }
});

// ---- G4 — fences ----
test('fences: dashboard.css distinct hex stays 84 (no colour smuggled into the fix)', () => {
  const stripped = dashboardCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  // 85 → 84 with the Delinquency Recovery Pipeline mobile fit: the
  // .dashboard-chart-card background #fafcfb was tokenized to
  // var(--surface-soft) — one distinct hex leaves, none added. The
  // fence's intent (no colour smuggled in) is preserved; the count
  // only decreases.
  assert.equal(distinct.size, 84, `dashboard.css must stay at 84 distinct hex colours, got ${distinct.size}`);
});

test('fences: styles.css distinct hex stays 610 (the reminder display line adds no colour; 608 → 610 is the Customers List Cards polish)', () => {
  const stripped = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  // 608 → 610 with the Customers List Cards polish (D2): exactly the
  // two spec-literal name colours #1E3A5F (navy) + #9f1239 (rose-800).
  assert.equal(distinct.size, 610, `styles.css must stay at 610 distinct hex colours, got ${distinct.size}`);
});

test('fences: @media print blocks stay balanced and dashboard.css gains no page: assignment', () => {
  for (const [name, css] of [['dashboard.css', dashboardCss], ['styles.css', stylesCss]]) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(printBlocks(css).length >= 1, `${name} must keep at least one @media print block`);
    assert.equal((stripped.match(/\{/g) || []).length, (stripped.match(/\}/g) || []).length, `${name} braces must balance`);
  }
  const dashPrint = printBlocks(dashboardCss).join('\n');
  assert.ok(!/page\s*:/.test(dashPrint), 'the dashboard.css print block must carry no page: assignment (Plan 572 owns @page)');
});

test('fences: the print block keeps the briefing-slip rules and the dashboard-chrome hide list', () => {
  const dashPrint = printBlocks(dashboardCss).join('\n');
  assert.ok(dashPrint.includes('dialog#dashboardBriefingModal'), 'the briefing-dialog print rule must survive the edit');
  assert.ok(dashPrint.includes('.briefing-modal-card'), 'the briefing-slip presentation rules must survive the edit');
  assert.ok(dashPrint.includes('.view-nav'), 'the dashboard-chrome hide list must survive the edit');
  assert.ok(dashPrint.includes('.summary-grid'), 'the chrome hide list must still name .summary-grid');
});
