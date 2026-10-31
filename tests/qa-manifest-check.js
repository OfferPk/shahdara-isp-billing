// qa-manifest-check.js — SISP-89 Build & Bundle Manifest Completeness Verifier.
//
// QA/TOOLING ONLY. This file is never imported by app code, is not listed in
// build.mjs ENTRY_FILES, and must never enter the app bundle or the service
// worker precache. It lives with the Node-side test tooling and is wired into
// the suite by tests/manifest-verifier.test.js; it can also be run directly:
//
//   node tests/qa-manifest-check.js
//
// It proves three things about the runtime module graph (the same graph the
// production build ships, walked from build.mjs ENTRY_FILES):
//   1. EXISTENCE  — every file referenced by index.html / the graph exists on
//      disk (a missing module is a live-site 404 that kills the whole graph,
//      issue #208).
//   2. SYNTAX     — every runtime .js/.mjs module passes `node --check`.
//   3. BUNDLED    — every runtime JS module is reachable from the module
//      entries index.html actually loads (so esbuild bundles it into dist/),
//      or is sw.js, which ships standalone as the generated service worker.
//      A module that sits in ENTRY_FILES but is imported by nothing would be
//      walked by the build yet silently absent from dist/ — this check is
//      what catches that omission.
// The dist-level half of the guarantee (precache list == published files) is
// asserted against a real build in tests/manifest-verifier.test.js.
//
// The traversal below is deliberately independent of build.mjs's
// collectRuntimeFiles (same low-level reference primitives, own walk), so a
// bug in the build's walker cannot rubber-stamp itself.
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRY_FILES, extractReferences, resolveLocal, indexAssetRefs } from '../build.mjs';

const TEXT_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.webmanifest', '.json']);
const JS_RE = /\.m?js$/;

// JS files that ship standalone instead of inside an esbuild bundle: the
// service worker source, which build.mjs rewrites into dist/sw.js (#210).
export const STANDALONE_SHIPPED_JS = new Set(['sw.js']);

// Walk the runtime graph from `seeds`, following references in text files.
// Returns { files, missing } with repo-relative posix paths, sorted.
export async function collectGraph(root, seeds = ENTRY_FILES) {
  const seen = new Set();
  const missing = [];
  const queue = seeds.map(file => ({ file, from: '(entry)' }));
  while (queue.length) {
    const { file, from } = queue.shift();
    if (seen.has(file)) continue;
    let info;
    try { info = await stat(path.join(root, file)); } catch { missing.push(`${file} (referenced from ${from})`); continue; }
    if (!info.isFile()) continue;
    seen.add(file);
    const ext = path.extname(file).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const source = await readFile(path.join(root, file), 'utf8');
    for (const ref of extractReferences(source, ext)) {
      const local = resolveLocal(ref, file);
      if (local && !seen.has(local)) queue.push({ file: local, from: file });
    }
  }
  return { files: [...seen].sort(), missing: missing.sort() };
}

// Files esbuild will actually bundle: the transitive import closure of the
// module entries named by index.html. Dynamic import() specifiers are string
// literals in this codebase by design (see lazy-qa.js), so the static walk
// covers lazy chunks too.
export async function collectEntryReachable(root) {
  const indexSource = await readFile(path.join(root, 'index.html'), 'utf8');
  const { js: entries } = indexAssetRefs(indexSource);
  const reachable = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.shift();
    if (reachable.has(file)) continue;
    reachable.add(file);
    if (!JS_RE.test(file)) continue;
    let source;
    try { source = await readFile(path.join(root, file), 'utf8'); } catch { continue; }
    for (const ref of extractReferences(source, '.js')) {
      const local = resolveLocal(ref, file);
      if (local && !reachable.has(local)) queue.push(local);
    }
  }
  return { entries, reachable };
}

// Run `node --check` over every file with a small concurrency pool.
// Returns [{ file, message }] for the files that fail to parse.
export async function checkModuleSyntax(root, files, { concurrency = 16 } = {}) {
  const failures = [];
  const targets = files.filter(file => JS_RE.test(file));
  let next = 0;
  async function worker() {
    while (next < targets.length) {
      const file = targets[next++];
      const result = await new Promise(resolve => {
        const child = spawn(process.execPath, ['--check', path.join(root, file)], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', err => resolve({ code: -1, stderr: String(err) }));
        child.on('close', code => resolve({ code, stderr }));
      });
      if (result.code !== 0) {
        const message = result.stderr.split('\n').map(line => line.trim()).find(Boolean) ?? `node --check exited ${result.code}`;
        failures.push({ file, message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return failures.sort((a, b) => a.file.localeCompare(b.file));
}

// Full verification report for a tree. `seeds` overrides the graph entry
// points (used by the negative fixture tests); production callers take the
// build's real ENTRY_FILES.
export async function verifyManifest(root, { seeds = ENTRY_FILES, syntax = true, concurrency = 16 } = {}) {
  const { files, missing } = await collectGraph(root, seeds);
  const jsModules = files.filter(file => JS_RE.test(file));
  const { entries, reachable } = await collectEntryReachable(root);
  const unbundled = jsModules.filter(file => !reachable.has(file) && !STANDALONE_SHIPPED_JS.has(file));
  const syntaxFailures = syntax ? await checkModuleSyntax(root, jsModules, { concurrency }) : [];
  return {
    root,
    graphFiles: files,
    jsModules,
    entries,
    missing,
    unbundled,
    syntaxFailures,
    ok: missing.length === 0 && unbundled.length === 0 && syntaxFailures.length === 0,
  };
}

export function formatReport(report) {
  const lines = [
    `qa-manifest-check: ${report.jsModules.length} runtime JS modules across ${report.graphFiles.length} graph files, ${report.entries.length} index.html entries`,
    `  missing references: ${report.missing.length}`,
    ...report.missing.map(file => `    MISSING ${file}`),
    `  unbundled modules: ${report.unbundled.length}`,
    ...report.unbundled.map(file => `    UNBUNDLED ${file}`),
    `  syntax failures: ${report.syntaxFailures.length}`,
    ...report.syntaxFailures.map(({ file, message }) => `    SYNTAX ${file}: ${message}`),
    report.ok ? 'qa-manifest-check: OK — manifest complete' : 'qa-manifest-check: FAILED — manifest gaps found',
  ];
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const report = await verifyManifest(root);
  console.log(formatReport(report));
  if (!report.ok) process.exitCode = 1;
}
