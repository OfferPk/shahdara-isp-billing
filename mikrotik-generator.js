// SISP-13: MikroTik RouterOS PPPoE Script and Defaulter Walled-Garden
// Command Generator.
//
// Pure functions only — this module never reads or writes the ledger, so
// generated scripts can never change bills, payments, or customer records.
// The operator reviews the text and pastes it into WinBox Terminal.
//
// ADAPTATION (disclosed): the spec says customer profiles "store usernames,
// passwords, static IPs, and packages", but on main only packageSpeed exists
// as free text — there are no PPPoE/static-IP/MAC fields. SISP-13 therefore
// adds four OPTIONAL fields to the customer record (pppoeUsername,
// pppoePassword, staticIp, macAddress; see core.js addCustomer /
// updateCustomerProfile / backup merge list, plus the profile edit form).
// When a field is absent the generator still produces a usable script:
// the username is derived deterministically (cust-<customerNumber>), the
// password is the literal placeholder CHANGE-ME with a TODO comment, the
// queue line is commented out until a static IP is set, and the ARP line is
// omitted until both static IP and MAC are set. Nothing is invented silently
// — every fallback is visible in the generated text.
//
// Speed resolution order: package-catalog label match (3/5/15 Mbps plans),
// then a "<number> Mbps" parse of the free-text packageSpeed, else unknown.

import { billPackageByLabel } from './package-catalog.js';

export const DEFAULTER_PROFILE = 'payment-reminder-pool';
export const ACTIVE_PROFILE = 'default';
export const DEFAULTER_RATE_LIMIT = '128k/128k';
export const PASSWORD_PLACEHOLDER = 'CHANGE-ME';

/**
 * Escape a value for use inside a double-quoted RouterOS string.
 * RouterOS: backslash escapes itself and the quote; a newline would end
 * the command, so CR/LF are flattened to spaces first.
 */
export function escapeRouterOs(value) {
  return String(value ?? '')
    .replace(/\r\n?|\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

export function routerOsQuoted(value) {
  return `"${escapeRouterOs(value)}"`;
}

/** Queue / secret name derived from the customer — stable across runs. */
export function derivePppoeUsername(customer) {
  const stored = String(customer?.pppoeUsername ?? '').trim();
  if (stored) return stored;
  const num = customer?.customerNumber;
  if (Number.isSafeInteger(num)) return `cust-${num}`;
  return 'cust-unknown';
}

export function queueNameFor(customer) {
  return `q-${derivePppoeUsername(customer)}`;
}

/** "3Mbps / 100GB" -> 3; "10 Mbps" -> 10; anything else -> null. */
export function resolvePackageSpeedMbps(customer) {
  const label = String(customer?.packageSpeed ?? '').trim();
  if (!label) return null;
  const preset = billPackageByLabel(label);
  if (preset && Number.isFinite(preset.speedMbps)) return preset.speedMbps;
  const match = label.match(/(\d+(?:\.\d+)?)\s*(?:mbps|mb)\b/i);
  if (match) {
    const mbps = Number(match[1]);
    if (Number.isFinite(mbps) && mbps > 0) return mbps;
  }
  return null;
}

/** 3 -> "3M"; 2.5 -> "2.5M" (RouterOS accepts decimal rates). */
export function formatRateLimitMbps(mbps) {
  const n = Number(mbps);
  if (!Number.isFinite(n) || n <= 0) return null;
  const text = Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}M`;
}

/** Strict YYYY-MM-DD calendar validation (leap-aware), no Date parsing. */
export function isValidYmd(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInMonth = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= daysInMonth;
}

/**
 * "Active future Waada" (spec wording): a calendar-valid promiseDate
 * strictly AFTER today. A promise dated today is due, not future, so it
 * does NOT exclude the customer from the lock script. SISP-3 clears the
 * promise on full payment, so a present future date means still unpaid.
 */
export function hasFutureWaada(customer, todayStr) {
  const promiseDate = typeof customer?.promiseDate === 'string' ? customer.promiseDate.trim() : '';
  if (!promiseDate || !isValidYmd(promiseDate)) return false;
  if (!isValidYmd(todayStr)) return false;
  return promiseDate > todayStr.trim();
}

function customerComment(customer) {
  const name = String(customer?.name ?? '').trim();
  const num = customer?.customerNumber;
  const parts = [`customerId: ${customer?.id ?? 'unknown'}`];
  if (name) parts.push(name);
  if (Number.isSafeInteger(num)) parts.push(`#${num}`);
  return parts.join(' ');
}

/**
 * Per-customer RouterOS snippet: /ppp secret add, /queue simple add
 * (symmetric up/down at the package speed), and /ip arp add when both
 * static IP and MAC are stored. Read-only: returns text only.
 */
export function buildCustomerMikrotikSnippet(customer) {
  const c = customer ?? {};
  const username = derivePppoeUsername(c);
  const password = String(c.pppoePassword ?? '').trim();
  const staticIp = String(c.staticIp ?? '').trim();
  const mac = String(c.macAddress ?? '').trim();
  const mbps = resolvePackageSpeedMbps(c);
  const rate = mbps === null ? null : formatRateLimitMbps(mbps);
  const comment = customerComment(c);

  const lines = [];
  lines.push(`# MikroTik RouterOS — ${String(c.name ?? '').trim() || 'Unnamed subscriber'} (${comment})`);
  lines.push('# Generated by Shahdara ISP billing. Review before pasting into WinBox Terminal.');
  lines.push('# This script never changes bills, payments, or customer records.');
  if (!password) {
    lines.push(`# TODO: no PPPoE password is stored for this customer — replace ${PASSWORD_PLACEHOLDER} below.`);
  }
  if (!String(c.pppoeUsername ?? '').trim()) {
    lines.push(`# NOTE: no PPPoE username is stored — using derived username ${username}. Save one in the profile to use it instead.`);
  }
  lines.push(`/ppp secret add name=${routerOsQuoted(username)} password=${routerOsQuoted(password || PASSWORD_PLACEHOLDER)} service=pppoe profile=${ACTIVE_PROFILE} comment=${routerOsQuoted(comment)}`);
  if (rate && staticIp) {
    lines.push(`/queue simple add name=${routerOsQuoted(queueNameFor(c))} target=${staticIp}/32 max-limit=${rate}/${rate} comment=${routerOsQuoted(comment)}`);
  } else if (!rate && !staticIp) {
    lines.push('# TODO: package speed not recognized and no static IP stored — set both in the profile, then regenerate for the /queue simple line.');
  } else if (!rate) {
    lines.push('# TODO: package speed not recognized — set a 3/5/15 Mbps package (or "<number> Mbps" text) in the profile, then regenerate for the /queue simple line.');
  } else {
    lines.push(`# TODO: no static IP stored — set one in the profile, then add: /queue simple add name=${routerOsQuoted(queueNameFor(c))} target=<static-ip>/32 max-limit=${rate}/${rate} comment=${routerOsQuoted(comment)}`);
  }
  if (staticIp && mac) {
    lines.push(`/ip arp add address=${staticIp} mac-address=${mac} comment=${routerOsQuoted(comment)}`);
  } else if (staticIp || mac) {
    lines.push('# NOTE: ARP/MAC binding omitted — both a static IP and a MAC address are needed.');
  }
  return lines.join('\n');
}

/**
 * Bulk defaulter lock script for the CURRENTLY VISIBLE top-defaulters list.
 * Customers with an active future Waada are excluded (returned in
 * skippedWaada); everyone else gets a profile switch to
 * payment-reminder-pool plus a 128k/128k queue cap on the queue name this
 * module generates (a find that matches nothing errors only on that line;
 * the profile switch still applies — stated in the header).
 */
export function buildDefaulterLockScript(customers, { todayStr = '' } = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const locked = [];
  const skippedWaada = [];
  const lines = [];
  lines.push('# MikroTik RouterOS — Defaulter lock / walled-garden script');
  lines.push('# Generated by Shahdara ISP billing from the visible Top Defaulters list.');
  lines.push('# Review before pasting into WinBox Terminal. Customers with an active future Waada are excluded below.');
  for (const c of list) {
    if (hasFutureWaada(c, todayStr)) {
      skippedWaada.push(c);
      continue;
    }
    locked.push(c);
  }
  if (skippedWaada.length) {
    lines.push(`# Excluded (active future Waada): ${skippedWaada.map((c) => `${String(c?.name ?? '').trim() || 'Unnamed'} (${customerComment(c)})`).join('; ')}`);
  }
  if (!locked.length) {
    lines.push('# No customers to lock — every visible defaulter has an active future Waada.');
    return { script: lines.join('\n'), locked, skippedWaada };
  }
  for (const c of locked) {
    const username = derivePppoeUsername(c);
    const comment = customerComment(c);
    lines.push(`# Lock: ${String(c?.name ?? '').trim() || 'Unnamed'} (${comment})`);
    lines.push(`/ppp secret set [find name=${routerOsQuoted(username)}] profile=${DEFAULTER_PROFILE} comment=${routerOsQuoted(`${comment} locked`)}`);
    lines.push(`/queue simple set [find name=${routerOsQuoted(queueNameFor(c))}] max-limit=${DEFAULTER_RATE_LIMIT} comment=${routerOsQuoted(`${comment} locked`)}`);
  }
  return { script: lines.join('\n'), locked, skippedWaada };
}

/**
 * SISP-38: suspension script for a pre-filtered Lock Due (15th+) set —
 * the customers the grace-period filter selected in the Top Defaulters
 * modal. The future-Waada guard is re-checked here as defense in depth,
 * so a stale selection can never lock a customer who has since promised
 * a payment date: such customers land in skippedWaada, never in the
 * script body. Only the header differs from the general lock script.
 */
export function buildLockDueSuspensionScript(customers, { todayStr = '' } = {}) {
  const { script, locked, skippedWaada } = buildDefaulterLockScript(customers, { todayStr });
  const header = script
    .replace(
      '# MikroTik RouterOS — Defaulter lock / walled-garden script',
      '# MikroTik RouterOS — Lock Due (15th+) suspension script'
    )
    .replace(
      '# Generated by Shahdara ISP billing from the visible Top Defaulters list.',
      '# Generated by Shahdara ISP billing from the Lock Due (15th+) filter (SISP-38).'
    );
  return { script: header, locked, skippedWaada };
}

/**
 * Restore script for the same selection, once paid: PPPoE profile back to
 * default and the queue cap back to the package speed. No Waada filter —
 * SISP-3 clears the promise on full payment, so a paid customer has none.
 * Customers with an unrecognized speed get a TODO comment line instead of
 * a queue command (the profile switch still restores full access via the
 * profile, and the operator sets the queue by hand).
 */
export function buildDefaulterRestoreScript(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const lines = [];
  lines.push('# MikroTik RouterOS — Restore active speed script');
  lines.push('# Generated by Shahdara ISP billing. Paste after the customer has paid in full.');
  if (!list.length) {
    lines.push('# No customers selected.');
    return { script: lines.join('\n'), restored: [] };
  }
  for (const c of list) {
    const username = derivePppoeUsername(c);
    const comment = customerComment(c);
    const mbps = resolvePackageSpeedMbps(c);
    const rate = mbps === null ? null : formatRateLimitMbps(mbps);
    lines.push(`# Restore: ${String(c?.name ?? '').trim() || 'Unnamed'} (${comment})`);
    lines.push(`/ppp secret set [find name=${routerOsQuoted(username)}] profile=${ACTIVE_PROFILE} comment=${routerOsQuoted(comment)}`);
    if (rate) {
      lines.push(`/queue simple set [find name=${routerOsQuoted(queueNameFor(c))}] max-limit=${rate}/${rate} comment=${routerOsQuoted(comment)}`);
    } else {
      lines.push(`# TODO: package speed not recognized for this customer — set the queue max-limit by hand after restoring the profile.`);
    }
  }
  return { script: lines.join('\n'), restored: list };
}
