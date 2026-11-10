// Installation-nav fix — the dashboard Installation tile must land on the
// Customer installation dashboard section every time.
//
// Two defects, both pinned here:
//  1. Boot-time TDZ abort: `let qaModalsPromise` used to be declared with
//     ensureQaModals() far below the top-level boot call renderDetail(),
//     which reads it (via ensureQaModals) during module evaluation. The
//     read threw `ReferenceError: Cannot access 'qaModalsPromise' before
//     initialization`, aborting module evaluation on EVERY load, so
//     `let latestAnalyticsData` never initialised and renderAnalytics()
//     threw before the tile handler's scrollIntoView ever ran.
//  2. Router reset: switchView() pushes '#/analytics', and the router's
//     patched pushState schedules instantTop() on the next animation
//     frame, which cancels any in-progress smooth scroll and parks the
//     page at scroll 0 — the Area Analytics header + Pucho box the user
//     saw. The handler must therefore scroll AFTER the router's rAF,
//     and instantly (the panel sits ~190,000px down).
//
// The fix: the `let` moved up with the other top-level state, and the
// handler scrolls on a double requestAnimationFrame with behavior
// 'instant'. Pattern-fake data only: no fixtures here, source pins only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const appSrc = read('app.js');
const routerSrc = read('screen-router.js');
const appLines = appSrc.split('\n');

// 1-based line number of the first line matching re, or -1.
const lineNo = (re, from = 0) => {
  const i = appLines.findIndex((line, idx) => idx >= from && re.test(line));
  return i < 0 ? -1 : i + 1;
};

// The onInstallationDashboard handler block, from its key line to the
// closing `},` of that object entry.
function handlerBlock() {
  const start = lineNo(/^\s*onInstallationDashboard: \(\) => \{$/);
  assert.notEqual(start, -1, 'onInstallationDashboard handler must exist in app.js');
  const end = lineNo(/^    \},$/, start);
  assert.notEqual(end, -1, 'onInstallationDashboard handler must close with `},`');
  return appLines.slice(start - 1, end).join('\n');
}

test('qaModalsPromise is declared before the boot-time renderDetail() call', () => {
  // Exactly one top-level declaration — a second one would be a syntax error.
  const declarations = appLines.filter((line) => line === 'let qaModalsPromise = null;');
  assert.equal(declarations.length, 1, 'exactly one `let qaModalsPromise = null;` must exist');
  const declarationLine = lineNo(/^let qaModalsPromise = null;$/);
  // The boot call is the column-0 `renderDetail();` in the top-level boot
  // block (indented calls inside functions are post-evaluation).
  const bootCallLine = lineNo(/^renderDetail\(\);$/);
  assert.notEqual(bootCallLine, -1, 'top-level renderDetail() boot call must exist');
  assert.ok(
    declarationLine < bootCallLine,
    `let qaModalsPromise (line ${declarationLine}) must execute before the boot call (line ${bootCallLine}), or the boot read throws a TDZ ReferenceError`,
  );
});

test('latestAnalyticsData is a top-level declaration whose assignment only runs post-evaluation', () => {
  // Why not "declaration before assignment" in source order: the
  // assignment sits inside the hoisted function renderAnalytics(), so
  // source order is irrelevant — what matters is that no code executed
  // during module evaluation can reach the assignment before the
  // declaration at the end of the top-level block has run.
  const declarationLine = lineNo(/^let latestAnalyticsData = null;$/);
  assert.notEqual(declarationLine, -1, 'top-level `let latestAnalyticsData = null;` must exist');
  const fnLine = lineNo(/^function renderAnalytics\(\) \{$/);
  assert.notEqual(fnLine, -1, 'function renderAnalytics must exist');
  const assignmentLine = lineNo(/^\s+latestAnalyticsData = data;$/);
  assert.notEqual(assignmentLine, -1, 'renderAnalytics must assign latestAnalyticsData');
  assert.ok(
    assignmentLine > fnLine,
    'the latestAnalyticsData assignment must sit inside function renderAnalytics, not at top level',
  );
  // No column-0 (top-level, evaluation-time) renderAnalytics() call may
  // exist before the declaration line — every call site must be inside a
  // callback or handler that only runs after evaluation completes.
  const earlyTopLevelCall = appLines
    .slice(0, declarationLine)
    .findIndex((line) => /^renderAnalytics\(\);$/.test(line));
  assert.equal(
    earlyTopLevelCall,
    -1,
    'no top-level renderAnalytics() call may run before the latestAnalyticsData declaration executes',
  );
});

test('onInstallationDashboard still switches, renders, then scrolls — in that order', () => {
  const block = handlerBlock();
  const switchAt = block.indexOf("switchView('analytics')");
  const renderAt = block.indexOf('renderAnalytics()');
  const scrollAt = block.indexOf('scrollIntoView');
  assert.ok(switchAt >= 0, 'handler must call switchView(\'analytics\')');
  assert.ok(renderAt >= 0, 'handler must call renderAnalytics()');
  assert.ok(scrollAt >= 0, 'handler must scroll to the installation heading');
  assert.ok(switchAt < renderAt, 'switchView must run before renderAnalytics');
  assert.ok(renderAt < scrollAt, 'renderAnalytics must run before the scroll');
});

test('the heading scroll runs on a double requestAnimationFrame, instantly', () => {
  const block = handlerBlock();
  const rafCount = (block.match(/requestAnimationFrame\(/g) || []).length;
  assert.equal(
    rafCount,
    2,
    'the scroll must be nested in two requestAnimationFrame callbacks so it runs after the router\'s single-rAF instantTop',
  );
  assert.ok(
    block.includes("document.getElementById('idaHeading')"),
    'the scroll must target #idaHeading by id',
  );
  assert.ok(
    block.includes("scrollIntoView({ behavior: 'instant', block: 'start' })"),
    'the scroll must be instant with block start (the panel sits ~190,000px down)',
  );
  assert.ok(
    !block.includes("behavior: 'smooth'"),
    'the handler must not use a smooth scroll — the router cancels it on the next frame',
  );
  const firstRaf = block.indexOf('requestAnimationFrame(');
  const scrollAt = block.indexOf('scrollIntoView');
  assert.ok(
    firstRaf >= 0 && firstRaf < scrollAt,
    'the scrollIntoView call must sit inside the requestAnimationFrame callbacks',
  );
});

test('the router still parks other screens at the top (non-regression)', () => {
  // Part B must not neuter instantTop: other screens rely on it.
  assert.ok(
    routerSrc.includes('win.scrollTo({ top: 0, left: 0, behavior: \'instant\' })'),
    'instantTop must still scroll to top: 0 instantly',
  );
  assert.ok(
    routerSrc.includes('if (!scroll) return;'),
    'apply must still return early when scroll is false',
  );
  const applyRaf = routerSrc.indexOf('win.requestAnimationFrame(() => {');
  const instantTopCall = routerSrc.indexOf('instantTop();');
  assert.ok(applyRaf >= 0, 'apply must still schedule work on requestAnimationFrame');
  assert.ok(instantTopCall > applyRaf, 'apply must still schedule instantTop on the animation frame');
});
