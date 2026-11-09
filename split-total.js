/*
 * Plan 533 — Split total, live on the form and on the confirm step.
 *
 * A split payment is two legs — leg 1 in the amount field, leg 2 in
 * the split block — and until this plan neither leg's input refreshed
 * anything live: the operator typed leg 2 and saw no total, no words,
 * no preview, and even the confirm summary listed the two legs
 * without ever adding them. This module is the total only: leg 1 +
 * leg 2, in PKR, as the operator reads it.
 *
 * Calculates ONLY. It posts nothing, reserves nothing, and changes no
 * bill, payment, or customer record by itself. It keeps no store: the
 * figures come from the two fields on the form, and the answer is
 * computed fresh on every render. The line text carries only the
 * module's own fixed words and figures the module itself formatted
 * from parsed numbers, so raw typed text never reaches any markup.
 *
 * What this module does NOT do: it never decides whether a split is
 * valid — leg recording, validation, and allocation stay exactly
 * where they are (SISP-121 split-tender-collect.js and the submit
 * handler). A leg figure that is missing or unusable contributes
 * nothing to the total; a negative figure contributes nothing
 * either, so a mistyped minus can never shrink the total below the
 * other leg.
 */

// PKR amounts use the app's min-0 decimals: whole rupees print with
// no decimals, a paisa figure prints only the decimals it has.
export function formatSplitTotalAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return `PKR ${value.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// One leg's figure as a usable number: a finite, non-negative figure
// in rupees. Null, undefined, blank, boolean, and non-numeric input
// contribute nothing — a leg not yet typed must never read as a
// negative or as a free payment — and neither does a negative figure.
export function splitTotalLegAmount(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return 0;
  const text = String(value).trim().replace(/[,\\s]/g, '');
  if (text === '') return 0;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

// The split total in rupees: leg 1 + leg 2, each as parsed above.
export function splitTotalAmount(leg1Amount, leg2Amount) {
  return splitTotalLegAmount(leg1Amount) + splitTotalLegAmount(leg2Amount);
}

// The line the operator reads, in plain words and figures: the split
// total, with the two legs named. '' while neither leg has a positive
// figure — the line stays hidden until there is something to show.
export function splitTotalLineText(leg1Amount, leg2Amount) {
  const total = splitTotalAmount(leg1Amount, leg2Amount);
  if (total <= 0) return '';
  return `Split total: ${formatSplitTotalAmount(total)} (leg 1 + leg 2)`;
}
