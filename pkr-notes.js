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
