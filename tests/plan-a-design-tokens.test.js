// Plan A — Design-system foundations (Plan A–Z programme).
// Token coverage for the customer, payment, dashboard, and profile
// screens. CSS only: no behaviour or logic change is asserted here,
// only that colours, type, radius, and spacing resolve to tokens and
// that the new tokens are actually used (no dead tokens).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

const NEW_TOKENS = [
  '--text-2xs', '--radius-xs',
  '--color-danger', '--color-danger-strong', '--color-danger-bg', '--color-danger-light',
  '--color-success', '--color-success-bg',
  '--color-warning', '--color-warning-bg',
  '--color-info-strong', '--color-info-bg', '--color-info-soft', '--color-info-dark',
  '--color-emerald', '--color-emerald-light', '--color-emerald-dark',
  '--color-dark-surface', '--color-muted-soft', '--color-ink-soft',
  '--color-slate-50', '--color-slate-100', '--color-slate-300', '--color-slate-400',
  '--color-slate-500', '--color-slate-600', '--color-slate-700', '--color-slate-900',
];
const SCREEN_FILES = [
  'payments-list.css', 'payments-inbox.css', 'dashboard.css',
  'customer-import.css', 'bulk-collect.css', 'profile-ui.css', 'components.css',
];
const screenCss = () => SCREEN_FILES.map(read).join('\n');

test('Plan A tokens.css defines the type and radius steps the screens use', () => {
  const css = read('tokens.css');
  assert.ok(css.includes('--text-2xs: 10px'), '10px step exists');
  assert.ok(css.includes('--radius-xs: 8px'), '8px radius step exists');
});

test('Plan A tokens.css defines the status tokens', () => {
  const css = read('tokens.css');
  for (const [token, value] of [
    ['--color-danger', '#b42318'], ['--color-danger-strong', '#a8190e'],
    ['--color-danger-bg', '#fdecea'], ['--color-danger-light', '#fca5a5'],
    ['--color-success', '#059669'], ['--color-success-bg', '#d1fae5'],
    ['--color-warning', '#92400e'], ['--color-warning-bg', '#fef3c7'],
  ]) assert.ok(css.includes(`${token}: ${value}`), `${token} = ${value}`);
});

test('Plan A tokens.css defines the info and emerald scales', () => {
  const css = read('tokens.css');
  for (const [token, value] of [
    ['--color-info-strong', '#2563eb'], ['--color-info-bg', '#dbeafe'],
    ['--color-info-soft', '#e0f2fe'], ['--color-info-dark', '#0369a1'],
    ['--color-emerald', '#10b981'], ['--color-emerald-light', '#34d399'],
    ['--color-emerald-dark', '#047857'],
    ['--color-dark-surface', '#24463b'], ['--color-muted-soft', '#5d7a6f'],
    ['--color-ink-soft', '#36564b'],
  ]) assert.ok(css.includes(`${token}: ${value}`), `${token} = ${value}`);
});

test('Plan A tokens.css defines the slate scale used by the payments inbox', () => {
  const css = read('tokens.css');
  for (const [token, value] of [
    ['--color-slate-50', '#f8fafc'], ['--color-slate-100', '#f1f5f9'],
    ['--color-slate-300', '#cbd5e1'], ['--color-slate-400', '#94a3b8'],
    ['--color-slate-500', '#64748b'], ['--color-slate-600', '#475569'],
    ['--color-slate-700', '#334155'], ['--color-slate-900', '#0f172a'],
  ]) assert.ok(css.includes(`${token}: ${value}`), `${token} = ${value}`);
});

// One test per new token: every token added by Plan A is used by a
// screen stylesheet or components.css (unused-token scan).
for (const token of NEW_TOKENS) {
  test(`Plan A token ${token} is used by a screen stylesheet`, () => {
    assert.ok(screenCss().includes(`var(${token})`), `${token} must be referenced, not dead`);
  });
}

test('Plan A new tokens carry dark values in both dark blocks', () => {
  const css = read('tokens.css');
  const attrDark = css.slice(css.indexOf('[data-theme="dark"]'));
  const systemDark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
  for (const [token, value] of [
    ['--color-danger', '#ffb4a8'], ['--color-danger-bg', '#3a1513'],
    ['--color-warning', '#f6cf7a'], ['--color-warning-bg', '#3a2c10'],
    ['--color-info-bg', '#26344d'], ['--color-info-strong', '#d5e2ff'],
    ['--color-slate-900', '#f8fafc'],
  ]) {
    assert.ok(attrDark.includes(`${token}: ${value}`), `attribute dark block defines ${token}`);
    assert.ok(systemDark.includes(`${token}: ${value}`), `system dark block defines ${token}`);
  }
});

test('Plan A new tokens are defined in tokens.css only', () => {
  for (const file of SCREEN_FILES) {
    const css = read(file);
    for (const token of NEW_TOKENS) {
      const def = new RegExp(`^\\s*${token.replace(/[-]/g, '\\-')}\\s*:`, 'm');
      assert.ok(!def.test(css), `${file} must not define ${token}`);
    }
  }
});

test('Plan A components.css completes the shared status-chip set, token-only', () => {
  const css = stripComments(read('components.css'));
  for (const cls of ['.ds-chip--danger', '.ds-chip--success', '.ds-chip--warning', '.ds-btn--success']) {
    assert.ok(css.includes(cls), `components.css missing ${cls}`);
  }
  assert.ok(css.includes('.ds-chip--danger { background: var(--color-danger-bg); color: var(--color-danger); }'));
  assert.ok(!/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(css), 'components.css stays hex-free');
});

test('Plan A payment method chips use the same status tokens on the payments screen', () => {
  const css = read('payments-list.css');
  assert.ok(css.includes('.tx-method-cash { background: var(--color-paid-bg); color: var(--color-paid); }'));
  assert.ok(css.includes('.tx-method-easypaisa { background: var(--color-paid-bg); color: var(--color-paid); }'));
  assert.ok(css.includes('.tx-method-jazzcash { background: var(--color-danger-bg); color: var(--color-danger); }'));
  assert.ok(css.includes('.tx-method-bank-transfer, .tx-method-bank { background: var(--color-info-bg); color: var(--color-info-strong); }'));
});

test('Plan A same component matches: paid chip token is shared by ds-chip and tx-method', () => {
  assert.ok(read('components.css').includes('.ds-chip--paid { background: var(--color-paid-bg); color: var(--color-paid); }'));
  assert.ok(read('payments-list.css').includes('background: var(--color-paid-bg); color: var(--color-paid);'));
});

test('Plan A touched screens use tokens for font sizes on the scale', () => {
  for (const file of ['payments-list.css', 'payments-inbox.css', 'dashboard.css', 'customer-import.css', 'bulk-collect.css', 'profile-ui.css']) {
    const css = stripComments(read(file));
    const hard = css.match(/font-size:\s*(10|12|14|16|20|24|32)px/g) || [];
    assert.deepEqual(hard, [], `${file} still has hard-coded scale font sizes: ${hard.join(', ')}`);
  }
});

test('Plan A touched screens use tokens for radii on the scale', () => {
  for (const file of ['payments-list.css', 'payments-inbox.css', 'dashboard.css', 'customer-import.css', 'bulk-collect.css', 'profile-ui.css']) {
    const css = stripComments(read(file));
    const hard = css.match(/border-radius:\s*(8|10|14|18|999)px(?=\s*[;}\n])/g) || [];
    assert.deepEqual(hard, [], `${file} still has hard-coded scale radii: ${hard.join(', ')}`);
  }
});

test('Plan A touched screens keep the lowered hex ratchet (no new hard-coded colours)', () => {
  const max = {
    'payments-list.css': 12, 'payments-inbox.css': 25, 'dashboard.css': 87,
    'customer-import.css': 29, 'bulk-collect.css': 37,
  };
  for (const [file, limit] of Object.entries(max)) {
    const distinct = new Set(read(file).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
    assert.ok(distinct.size <= limit, `${file} has ${distinct.size} distinct hex colours, Plan A cap is ${limit}`);
  }
});

test('Plan A touched screens resolve spacing through space tokens', () => {
  for (const file of ['payments-list.css', 'payments-inbox.css', 'dashboard.css', 'customer-import.css', 'bulk-collect.css', 'profile-ui.css']) {
    assert.ok(read(file).includes('var(--space-'), `${file} must use space tokens`);
  }
});

test('Plan A profile screen stays hex-free in code', () => {
  const css = stripComments(read('profile-ui.css'));
  assert.deepEqual(css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [], [], 'profile-ui.css must have no hard-coded hex');
});

test('Plan A dashboard uses the surface token for its white panels', () => {
  assert.ok((read('dashboard.css').match(/var\(--surface\)/g) || []).length > 20, 'dashboard must reference --surface');
});
