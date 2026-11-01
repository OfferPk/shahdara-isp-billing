/**
 * fuzzy-alias-search.js — SISP-165: Father / reference name, search aliases
 * and Roman-Urdu phonetic fuzzy name search.
 *
 * Field linemen rarely know how a customer's name is spelled in the ledger:
 * the same man is "Faisal" in one mouth and "Fesal" in another, and half the
 * village knows him only as "Haji Sahab" or by his father's name. This module
 * gives the record two extra FINDING fields and a phonetic matcher for them:
 *
 *   customer.fatherOrReferenceName — free text, e.g. the father's name the
 *     customer is known by ("Muhammad Aslam" for his son).
 *   customer.searchAliases — a short list of nicknames / landmarks
 *     ("Haji Sahab", "Corner Medical Store").
 *
 * Both are search data only: they never enter duplicate detection, the
 * SISP-74 identity guard, billing, or any printed record.
 *
 * The matcher is pure and import-free so core.js can use its sanitizers
 * without an import cycle (the sibling-sanitizer pattern used by
 * shop-settlement.js, suspense-payments.js, ...).
 */

export const FATHER_OR_REFERENCE_NAME_MAX_LENGTH = 100;
export const SEARCH_ALIAS_MAX_LENGTH = 40;
export const SEARCH_ALIASES_MAX_COUNT = 5;

/** Lenient load-path sanitizer: trimmed text, capped, '' when absent. */
export function sanitizeFatherOrReferenceName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, FATHER_OR_REFERENCE_NAME_MAX_LENGTH);
}

/**
 * Sanitizes the alias list. Accepts the stored array form OR the profile
 * form's single comma-separated input string. Rules: each alias is trimmed,
 * internal whitespace collapsed, capped at SEARCH_ALIAS_MAX_LENGTH chars,
 * empties dropped, duplicates removed case-insensitively (first spelling
 * wins), and at most SEARCH_ALIASES_MAX_COUNT aliases are kept.
 */
export function sanitizeSearchAliases(value) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set();
  const aliases = [];
  for (const item of rawItems) {
    if (typeof item !== 'string') continue;
    const cleaned = item.trim().replace(/\s+/g, ' ').slice(0, SEARCH_ALIAS_MAX_LENGTH).trim();
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(cleaned);
    if (aliases.length >= SEARCH_ALIASES_MAX_COUNT) break;
  }
  return aliases;
}

/** The profile form renders the stored list back as one comma-joined input. */
export function formatSearchAliasesInput(aliases) {
  return sanitizeSearchAliases(aliases).join(', ');
}

/** The Latin-only canonicalizer never touches Urdu/Arabic script text. */
export function hasUrduScript(text) {
  return /[\u0600-\u06FF]/.test(String(text ?? ''));
}

/**
 * Canonical phonetic key for a Roman-Urdu name. Transforms, applied in this
 * exact order:
 *   1. NFKC-normalize + lowercase.
 *   2. Apostrophes are deleted (they join letters: "Qur'ban" -> "qurban").
 *   3. Every other punctuation mark becomes a space (token boundary:
 *      "M." -> "m", "Aslam," -> "aslam").
 *   4. Whitespace runs collapse to one space; ends trimmed.
 *   5. Digraph fold: 'ph' -> 'f' ("Philip" is read "Filip" here).
 *   6. Long-vowel folds: 'ee' -> 'i', 'ai' -> 'e', 'oo' -> 'u'.
 *   7. Runs of the same letter collapse to one ("hussain" -> "husen" after
 *      the vowel folds, "allah" -> "alah" — acceptable for a search key).
 * Net effect: "Waseem" and "Wasim" both key to "wasim"; "Faisal" and
 * "Fesal" both key to "fesal". "M. Aslam" keys to "m aslam" while
 * "Muhammad Aslam" keys to "muhamad aslam" — NOT equal, by design: the
 * initial-expansion rule in the token matcher below bridges that gap
 * instead of mangling the key.
 */
/** Steps 1–4 only: the raw tokens a person actually typed / stored. */
export function romanUrduRawTokens(text) {
  let cleaned = String(text ?? '').normalize('NFKC').toLocaleLowerCase();
  cleaned = cleaned.replace(/['\u2018\u2019\u02BC\u0060]/g, '');
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.split(' ').filter(Boolean) : [];
}

/** Steps 5–7 on ONE raw token (the folds never cross a token boundary). */
function foldRomanUrduToken(token) {
  return token
    .replace(/ph/g, 'f')
    .replace(/ee/g, 'i').replace(/ai/g, 'e').replace(/oo/g, 'u')
    .replace(/(.)\1+/gu, '$1');
}

export function romanUrduNameKey(text) {
  return romanUrduRawTokens(text).map(foldRomanUrduToken).join(' ');
}

/** Canonical tokens of one name text. */
export function romanUrduNameTokens(text) {
  const key = romanUrduNameKey(text);
  return key ? key.split(' ').filter(Boolean) : [];
}

/** The raw texts the fuzzy matcher searches, in display order. */
export function fuzzySearchFieldTexts(customer) {
  if (!customer || typeof customer !== 'object') return [];
  return [
    customer.name,
    customer.fatherOrReferenceName,
    ...sanitizeSearchAliases(customer.searchAliases),
  ].map((value) => String(value ?? '')).filter((value) => value.trim());
}

/**
 * One query token (kept as a { raw, key } pair) against the pooled field
 * token pairs. Equality and the initial rule run on canonical keys;
 * prefix tolerance runs on BOTH tracks, because an owner types the start
 * of the spelling he knows ("wase" for "Waseem") while the stored key is
 * the folded form ("wasim") — either prefix must find it.
 */
function tokenMatchesFieldTokens(queryToken, fieldTokenPairs) {
  for (const fieldToken of fieldTokenPairs) {
    if (fieldToken.key === queryToken.key) return true;
    // Initial rule: a single-letter query token matches any field token
    // starting with it — "M." finds "Muhammad".
    if (queryToken.key.length === 1 && fieldToken.key.startsWith(queryToken.key)) return true;
    // Prefix tolerance: a typed start of a name (3+ letters) matches the
    // full token, on the canonical key or on the raw spelling.
    if (queryToken.key.length >= 3 && fieldToken.key.startsWith(queryToken.key)) return true;
    if (queryToken.raw.length >= 3 && fieldToken.raw.startsWith(queryToken.raw)) return true;
  }
  return false;
}

const tokenPairsOf = (text) => romanUrduRawTokens(text).map((raw) => ({ raw, key: foldRomanUrduToken(raw) }));

/**
 * Does `query` find this customer by name, father's/reference name, or any
 * alias?
 *
 * Latin queries go through the phonetic canonicalizer: the query is
 * tokenized and EVERY query token must match some field token (pooled
 * across name + father name + all aliases) by canonical equality, the
 * single-letter initial rule, or the >= 3-letter prefix rule. One
 * unmatched token fails the whole query, so "Fesal Ahmed" never matches
 * a "Faisal Raza".
 *
 * Urdu-script queries take the plain contains path against the stored
 * name, Urdu name, father name and aliases — exactly how Urdu names are
 * matched elsewhere in the app; the canonicalizer is Latin-only.
 */
export function fuzzyCustomerNameMatches(customer, query) {
  const raw = String(query ?? '').normalize('NFKC').trim();
  if (!raw || !customer || typeof customer !== 'object') return false;
  if (hasUrduScript(raw)) {
    const needle = raw.toLocaleLowerCase();
    const texts = [customer.name, customer.nameUrdu, ...fuzzySearchFieldTexts(customer).slice(1)];
    return texts.some((value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(needle));
  }
  const queryTokens = tokenPairsOf(raw);
  if (!queryTokens.length) return false;
  const fieldTokens = [];
  for (const text of fuzzySearchFieldTexts(customer)) {
    fieldTokens.push(...tokenPairsOf(text));
  }
  if (!fieldTokens.length) return false;
  return queryTokens.every((queryToken) => tokenMatchesFieldTokens(queryToken, fieldTokens));
}
