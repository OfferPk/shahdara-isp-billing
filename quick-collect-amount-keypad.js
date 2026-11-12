// Plan 442 — Quick Collect on-screen numeric keypad for the amount:
// the phone's own keyboard is small and easy to mistype on, and it
// covers half the screen, so the amount field gets big one-thumb
// keys instead. The keypad enters digits only: every digit key
// appends exactly its digit to the whole-rupee figure, backspace
// drops the last digit, and clear empties the field. It posts
// nothing and changes no bill, payment, or customer record — the
// caller writes the returned figure into the amount field and the
// ordinary form submit records it, exactly like a typed amount.
// A figure is read as its whole-rupee digit string: a paisa tail
// is dropped, never rounded up and never guessed, and a missing or
// unusable figure reads as no digits at all.
export const AMOUNT_KEYPAD_KEYS = Object.freeze([
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  'clear', '0', 'backspace',
]);

export const AMOUNT_KEYPAD_CLEAR_KEY = 'clear';

export const AMOUNT_KEYPAD_BACKSPACE_KEY = 'backspace';

/** True only for a single digit character, '0' through '9'. */
export function amountKeypadIsDigit(key) {
  return typeof key === 'string' && /^[0-9]$/.test(key);
}

/**
 * The whole-rupee digit string of a field value: the digits before
 * any decimal point, with separators stripped. A paisa tail is
 * dropped, never rounded; a missing, empty, or boolean figure is
 * not a number and reads as no digits at all.
 */
export function amountKeypadDigitsOf(value) {
  if (typeof value === 'boolean' || value === null || value === undefined) return '';
  const whole = String(value).split('.')[0];
  return whole.replace(/\D/g, '');
}

/**
 * The digit string with one digit appended. A key that is not a
 * digit leaves the figure as it is (normalised to its digit
 * string); it never invents a digit.
 */
export function amountKeypadAppendDigit(current, digit) {
  if (!amountKeypadIsDigit(digit)) return amountKeypadDigitsOf(current);
  return amountKeypadDigitsOf(current) + digit;
}

/** The digit string with its last digit dropped; empty stays empty. */
export function amountKeypadBackspace(current) {
  return amountKeypadDigitsOf(current).slice(0, -1);
}

/** The digit string cleared: no figure at all. */
export function amountKeypadClear() {
  return '';
}

/**
 * One key press applied to the current figure: a digit appends,
 * backspace drops the last digit, clear empties the field, and any
 * other key leaves the figure exactly as it is.
 */
export function amountKeypadApplyKey(current, key) {
  if (key === AMOUNT_KEYPAD_CLEAR_KEY) return amountKeypadClear();
  if (key === AMOUNT_KEYPAD_BACKSPACE_KEY) return amountKeypadBackspace(current);
  return amountKeypadAppendDigit(current, key);
}

/** The label printed on a key: the digit itself, 'C' to clear, the
 *  backspace mark, or '' for a key the keypad does not carry. */
export function amountKeypadLabel(key) {
  if (key === AMOUNT_KEYPAD_BACKSPACE_KEY) return '⌫';
  if (key === AMOUNT_KEYPAD_CLEAR_KEY) return 'C';
  return amountKeypadIsDigit(key) ? key : '';
}

/**
 * The keypad's buttons, in reading order — three columns of digits,
 * then clear, zero, and backspace. Each button carries its key in
 * `data-kpd-key` and is a plain button, never a submit: pressing
 * one can only change the amount field, never post a payment.
 * QC Modal Fix: each key carries its kind class (digit / clear /
 * backspace) so the one screen can style them apart — digits as
 * elevated tactile keys, C rose, backspace slate — while the keys
 * themselves stay exactly the same.
 */
export function amountKeypadHtml() {
  return AMOUNT_KEYPAD_KEYS.map((key) => {
    const label = amountKeypadLabel(key);
    const spoken = key === AMOUNT_KEYPAD_BACKSPACE_KEY
      ? 'backspace'
      : key === AMOUNT_KEYPAD_CLEAR_KEY
        ? 'clear'
        : key;
    const kind = key === AMOUNT_KEYPAD_BACKSPACE_KEY
      ? 'kpd-key--backspace'
      : key === AMOUNT_KEYPAD_CLEAR_KEY
        ? 'kpd-key--clear'
        : 'kpd-key--digit';
    return `<button type="button" class="kpd-key ${kind}" data-kpd-key="${key}" aria-label="Amount key ${spoken}">${label}</button>`;
  }).join('');
}
