import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const STRAY_I = /^\s*i\s*$/;

// Regression: stray lone `i` lines in app.js threw "i is not defined" at
// runtime and failed the button audit (#216) with a page error on every
// flow that ran the QA modal wiring. The line is syntactically valid, so
// node --check cannot catch it — only this scan can. A bare `i` line is
// never legitimate here: every real loop index is declared with let/const
// or arrives as a callback parameter.
test('no stray lone-i lines in app sources', () => {
  const offenders = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.js')) continue;
    const lines = fs.readFileSync(path.join(root, name), 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (STRAY_I.test(line)) offenders.push(`${name}:${idx + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
