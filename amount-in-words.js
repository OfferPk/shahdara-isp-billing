// Transaction amount in words (Plan 377): the amount typed on the
// transaction entry form, written out in plain words beside the
// amount field, live as the operator types. "Fifteen thousand"
// beside "15000" catches the extra zero before the receipt is
// printed, when it is still cheap to fix.
//
// Words use the South Asian grouping the shop speaks in — thousand,
// lakh, crore — so 100000 reads "One lakh", not "One hundred
// thousand". A whole-rupee amount reads as rupees only; a fractional
// amount adds the paisa after "and" ("One thousand five hundred and
// fifty paisa"). Zero reads "Zero". Clearing the field clears the
// words: an empty, non-numeric, or negative value has no words.
//
// The module only converts. It displays nothing, posts nothing, and
// it changes no bill, payment, or customer record by itself.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

const AMOUNT_IN_WORDS_ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const AMOUNT_IN_WORDS_TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety',
];

// Groups after the first three digits are two digits wide:
// thousands, then lakhs, crores, arabs, and so on.
const AMOUNT_IN_WORDS_SCALES = [
  '', 'thousand', 'lakh', 'crore', 'arab', 'kharab', 'neel', 'padma',
];

const AMOUNT_IN_WORDS_MAX = 999999999999999;

function amountInWordsTwoDigits(value) {
  if (value < 20) return AMOUNT_IN_WORDS_ONES[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones === 0
    ? AMOUNT_IN_WORDS_TENS[tens]
    : `${AMOUNT_IN_WORDS_TENS[tens]} ${AMOUNT_IN_WORDS_ONES[ones]}`;
}

function amountInWordsThreeDigits(value) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts = [];
  if (hundreds > 0) parts.push(`${AMOUNT_IN_WORDS_ONES[hundreds]} hundred`);
  if (rest > 0) parts.push(amountInWordsTwoDigits(rest));
  return parts.join(' ');
}

function amountInWordsInteger(value) {
  if (value === 0) return 'zero';
  if (!Number.isInteger(value) || value < 0 || value > AMOUNT_IN_WORDS_MAX) return '';
  const groups = [value % 1000];
  let rest = Math.floor(value / 1000);
  while (rest > 0) {
    groups.push(rest % 100);
    rest = Math.floor(rest / 100);
  }
  if (groups.length > AMOUNT_IN_WORDS_SCALES.length) return '';
  const parts = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;
    const words = index === 0 ? amountInWordsThreeDigits(group) : amountInWordsTwoDigits(group);
    const scale = AMOUNT_IN_WORDS_SCALES[index];
    parts.push(scale ? `${words} ${scale}` : words);
  }
  return parts.join(' ');
}

function capitaliseFirst(value) {
  return value === '' ? '' : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The typed amount in plain words. Accepts a number or the raw typed
 * string. Returns '' when there is nothing to say: an empty field, a
 * non-numeric value, a negative amount, or an amount beyond the
 * supported range. The fractional part is read as paisa (two digits,
 * extra digits dropped); a whole amount carries no paisa part.
 */
export function amountInWords(value) {
  let text = '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    text = String(value);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return '';
  }
  // A trailing dot with no digits yet (mid-typing) still reads as the
  // whole amount, so the words do not vanish while the operator types
  // the decimal part.
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return '';
  const rupees = Number(match[1]);
  if (!Number.isSafeInteger(rupees)) return '';
  const rupeesWords = amountInWordsInteger(rupees);
  if (rupeesWords === '') return '';
  const paisaDigits = (match[2] || '').slice(0, 2).padEnd(2, '0');
  const paisa = Number(paisaDigits);
  if (paisa === 0) return capitaliseFirst(rupeesWords);
  const paisaWords = amountInWordsTwoDigits(paisa);
  return capitaliseFirst(`${rupeesWords} and ${paisaWords} paisa`);
}

/**
 * The live words line beside the amount field: the words for the
 * digits currently typed, or '' when the field is empty or invalid —
 * clearing the field clears the words.
 */
export function amountInWordsLineText(value) {
  return amountInWords(value);
}
