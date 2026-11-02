// Profile UI polish: PKR banknote breakdown for Collect rows (DISPLAY ONLY).
//
// The due amount itself never changes — this only renders it as the
// Pakistani banknotes the owner would actually hand over, greedy over the
// circulating denominations 5000 / 1000 / 500 / 100 / 50 / 20 / 10.
//   3000 → 1000 ×3
//   6000 → one 5000 + one 1000
// A remainder under Rs 10 (no such note exists) shows as a tiny "+ PKR X".

export const PKR_DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10];

// Returns { notes: [{ denomination, count }], remainder } for a PKR amount.
// Non-positive / non-numeric amounts yield no notes and no remainder.
export function breakdownPkrNotes(amount) {
  let remaining = Math.round(Number(amount) || 0);
  if (!(remaining > 0)) return { notes: [], remainder: 0 };
  const notes = [];
  for (const denomination of PKR_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      notes.push({ denomination, count });
      remaining -= denomination * count;
    }
  }
  return { notes, remainder: remaining };
}

// Compact note-styled chips for a due amount, e.g. "₨1000 ×3".
// Returns '' when there is nothing to show (zero / negative amount).
export function pkrNoteChipsMarkup(amount) {
  const { notes, remainder } = breakdownPkrNotes(amount);
  if (notes.length === 0 && remainder === 0) return '';
  const chips = notes
    .map(note => `<span class="pkr-note-chip">₨${note.denomination} ×${note.count}</span>`)
    .join('');
  const rest = remainder > 0 ? `<span class="pkr-note-remainder">+ PKR ${remainder}</span>` : '';
  return `<span class="pkr-note-chips">${chips}${rest}</span>`;
}

// SISP-198: Daily Cash Closing physical note counter (the reverse
// direction of the breakdown above: counts -> total). The closing dialog
// counts the notes physically in the drawer over exactly the five
// denominations below. Smaller notes and coins (20 / 10 and coins) are
// deliberately NOT counted here — the counted-cash box in the closing
// dialog stays directly editable, so the owner adjusts it for those and
// the box always holds the final figure that gets recorded.
// (form-validation.js's calculateDenominationTotal serves the Daily
// Register audit instead: it spans all seven denominations and does not
// floor fractional counts, so the closing counter keeps this stricter
// core — a count here is a non-negative whole number of notes.)
export const PKR_COUNT_DENOMINATIONS = Object.freeze([5000, 1000, 500, 100, 50]);

// One note count, clamped at the seam: non-numeric or non-finite input
// counts as 0, fractions floor to whole notes, negatives clamp to 0.
export function sanitizePkrNoteCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// Total PKR for a counts map like { 5000: 2, 1000: 3 } — always a
// non-negative integer; denominations outside the five count nothing.
export function countPkrNotesTotal(counts) {
  if (!counts || typeof counts !== 'object') return 0;
  let total = 0;
  for (const denomination of PKR_COUNT_DENOMINATIONS) {
    total += sanitizePkrNoteCount(counts[denomination]) * denomination;
  }
  return total;
}

// Counted − Expected for the closing dialog, rounded to paisa like the
// ledger (negative = SHORT, positive = EXTRA, 0 = tally). Non-finite
// inputs count as 0.
export function noteCountDiscrepancy(counted, expected) {
  const c = Number(counted);
  const e = Number(expected);
  const diff = (Number.isFinite(c) ? c : 0) - (Number.isFinite(e) ? e : 0);
  return Math.round(diff * 100) / 100;
}
