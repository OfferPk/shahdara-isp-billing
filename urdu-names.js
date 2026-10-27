// Profile UI polish: Roman → Urdu customer-name transliteration (DISPLAY ONLY).
//
// When the app language is Urdu, customer names shown on screen (dashboard
// overdue lists, customer list, profile header) render in Urdu script, e.g.
// RAJA FAISAL → راجہ فیصل. Receipt drafts, WhatsApp drafts and exports keep
// the saved Roman name so records always match.
//
// Two layers, in order:
//   1. A per-customer manual override (customer.nameUrdu) always wins.
//   2. Otherwise a rule-based transliterator: a common-name/word dictionary
//      override first, then phoneme rules for anything else. Transliteration
//      is best-effort — when it yields nothing (empty / digits-only names)
//      the caller falls back to the Roman name.

export const URDU_NAME_WORDS = {
  // People — common first names
  RAJA: 'راجہ', FAISAL: 'فیصل', ALI: 'علی', KHAN: 'خان', AHMED: 'احمد',
  AHMAD: 'احمد', HUSSAIN: 'حسین', HASSAN: 'حسن', MUHAMMAD: 'محمد',
  MOHAMMAD: 'محمد', MOHAMED: 'محمد', USMAN: 'عثمان', UMAR: 'عمر',
  OMAR: 'عمر', BILAL: 'بلال', HAMZA: 'حمزہ', TALHA: 'طلحہ',
  ZAIN: 'زین', ABDULLAH: 'عبداللہ', ABDUL: 'عبد', REHMAN: 'رحمان',
  RAHMAN: 'رحمان', KARIM: 'کریم', RAZA: 'رضا', NAWAZ: 'نواز',
  SHARIF: 'شریف', ANWAR: 'انور', AKHTER: 'اختر', AKHTAR: 'اختر',
  JAVED: 'جاوید', ASLAM: 'اسلم', ARSHAD: 'ارشد', SHAFIQ: 'شفیق',
  LATIF: 'لطیف', HABIB: 'حبیب', YOUSUF: 'یوسف', YUSUF: 'یوسف',
  ISMAIL: 'اسماعیل', IBRAHIM: 'ابراہیم', SULEMAN: 'سلیمان',
  DAWOOD: 'داؤد', HAROON: 'ہارون', MUSA: 'موسیٰ', ISA: 'عیسیٰ',
  IQBAL: 'اقبال', AZHAR: 'اظہر', NASIR: 'ناصر', SAAD: 'سعد',
  AQIB: 'عاقب', WASEEM: 'وسیم',
  // People — common family / caste names
  ABBASI: 'عباسی', MALIK: 'ملک', CHAUDHRY: 'چوہدری', CHAUDRY: 'چوہدری',
  CH: 'چوہدری', BAJWA: 'باجوہ', DARBAR: 'دربار', PATHAN: 'پٹھان',
  SHAH: 'شاہ', MIRZA: 'مرزا', QURESHI: 'قریشی', ANSARI: 'انصاری',
  SHEIKH: 'شیخ', SYED: 'سید', BUKHARI: 'بخاری', GILLANI: 'گیلانی',
  NAQVI: 'نقوی', ZAIDI: 'زیدی', KAZMI: 'کاظمی', RIZVI: 'رضوی',
  SARDAR: 'سردار', NAWAB: 'نواب', JAN: 'جان', GUL: 'گل', SHER: 'شیر',
  BANGISH: 'بنگش', BANGASH: 'بنگش',
  // Women — common first names
  MARYAM: 'مریم', FATIMA: 'فاطمہ', AYESHA: 'عائشہ', ZAINAB: 'زینب',
  HAFSA: 'حفصہ', KHADIJA: 'خدیجہ', AMNA: 'آمنہ', AAMNA: 'آمنہ',
  NOOR: 'نور', SHABANA: 'شبانہ', RUKHSANA: 'رخسانہ', NASEEM: 'نسیم',
  FARIDA: 'فریدہ', SALMA: 'سلمیٰ', BANO: 'بانو', BIBI: 'بی بی',
  // Places / areas / generic words (Shahdara mohallas + common suffixes)
  MOHALLA: 'محلہ', SHAHDARA: 'شاہدرہ', PALALIYAA: 'پلالیہ',
  PALALIYA: 'پلالیہ', CHAMYAA: 'چمیہ', CHARYAA: 'چڑیہ',
  KISHTI: 'کشتی', BARRIAN: 'بریاں', MALLA: 'ملہ', THALII: 'تھلی',
  NAKAR: 'نکر', BANI: 'بنی', SODAA: 'سوڈا', HAVELI: 'حویلی',
  CHUDRIYAA: 'چوڑیہ', PULL: 'پل', PARK: 'پارک', TOWN: 'ٹاؤن',
  HOUSE: 'ہاؤس', SHOP: 'دکان', STORE: 'اسٹور', MASJID: 'مسجد',
  MOSQUE: 'مسجد'
};

// Digraphs first (longest match wins), then single letters. These are the
// standard Urdu phonemes; anything unlisted falls back letter by letter.
const URDU_DIGRAPHS = [
  ['KH', 'خ'], ['GH', 'غ'], ['SH', 'ش'], ['CH', 'چ'], ['ZH', 'ژ'],
  ['TH', 'تھ'], ['PH', 'پھ'], ['DH', 'دھ'], ['BH', 'بھ'], ['JH', 'جھ'],
  ['NG', 'نگ']
];

const URDU_LETTERS = {
  A: 'ا', B: 'ب', C: 'ک', D: 'د', E: 'ے', F: 'ف', G: 'گ', H: 'ہ',
  I: 'ی', J: 'ج', K: 'ک', L: 'ل', M: 'م', N: 'ن', O: 'و', P: 'پ',
  Q: 'ق', R: 'ر', S: 'س', T: 'ت', U: 'و', V: 'و', W: 'و', X: 'کس',
  Y: 'ی', Z: 'ز'
};

function transliterateWord(word) {
  const upper = word.toUpperCase();
  if (URDU_NAME_WORDS[upper]) return URDU_NAME_WORDS[upper];
  let out = '';
  let i = 0;
  while (i < upper.length) {
    let matched = false;
    for (const [pair, urdu] of URDU_DIGRAPHS) {
      if (upper.startsWith(pair, i)) { out += urdu; i += pair.length; matched = true; break; }
    }
    if (!matched) {
      out += URDU_LETTERS[upper[i]] ?? '';
      i += 1;
    }
  }
  return out;
}

// Transliterates a Roman-script name to Urdu script. Returns '' when the
// input yields no Urdu letters at all (empty / digits-only / symbols-only),
// so callers can fall back to the Roman name.
export function transliterateRomanToUrdu(name) {
  const input = String(name ?? '').trim();
  if (!input) return '';
  const parts = input.split(/([^A-Za-z]+)/);
  const rendered = parts.map(part => (/^[A-Za-z]+$/.test(part) ? transliterateWord(part) : part)).join('');
  return /[\u0600-\u06FF]/.test(rendered) ? rendered : '';
}

// The name to SHOW on screen for a customer in the given language.
// 'ur': manual nameUrdu override wins, then auto-transliteration, then Roman.
// Anything else: the saved Roman name, untouched.
export function displayCustomerName(customer, lang) {
  const roman = String(customer?.name ?? '').trim();
  if (lang !== 'ur') return roman;
  const override = String(customer?.nameUrdu ?? '').trim();
  if (override) return override;
  return transliterateRomanToUrdu(roman) || roman;
}

// Reads the app's current language without depending on one accessor: the
// language controller (getCurrentLanguage, else getLanguage), then the
// document language. Safe to call in node (no window) — returns 'en'.
export function currentAppLanguage(win) {
  try {
    const w = win ?? (typeof window !== 'undefined' ? window : null);
    const fromController = w?.languageController?.getCurrentLanguage?.()
      ?? w?.languageController?.getLanguage?.();
    if (fromController === 'ur' || fromController === 'en') return fromController;
    if (w?.document?.documentElement?.lang === 'ur') return 'ur';
  } catch { /* fall through to 'en' */ }
  return 'en';
}
