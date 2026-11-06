// Transaction collected-by and collection place note (Plan 379):
// one collection note on the transaction — who collected the payment,
// where it was taken (shop counter or field), and the mohalla where it
// was collected — recorded with the payment, in plain words. The note
// records the collection only: it never changes any bill, payment
// total, handover, or settlement record by itself. A transaction
// without a note shows the customer only.
//
// The note rides the payment record itself (the same three fields the
// payment validator keeps), so it needs no store of its own: the
// record is the note. Place folds to exactly two values, shop or
// field; anything else is dropped, never stored raw, so a damaged
// record can never claim a third place.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const COLLECTION_PLACE_SHOP = 'shop';
export const COLLECTION_PLACE_FIELD = 'field';
export const COLLECTION_NOTE_COLLECTED_BY_MAX_LENGTH = 100;
export const COLLECTION_NOTE_MOHALLA_MAX_LENGTH = 60;

function cleanCollectionNoteText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

function cleanCollectionNoteKey(value) {
  return cleanCollectionNoteText(value).toLowerCase();
}

/** The only two collection places: the shop counter or the field. */
export function isCollectionPlace(value) {
  const place = cleanCollectionNoteKey(value);
  return place === COLLECTION_PLACE_SHOP || place === COLLECTION_PLACE_FIELD;
}

/**
 * Fold a place to 'shop' or 'field'; anything else reads as no place,
 * never stored raw.
 */
export function normalizeCollectionPlace(value) {
  const place = cleanCollectionNoteKey(value);
  if (place === COLLECTION_PLACE_SHOP) return COLLECTION_PLACE_SHOP;
  if (place === COLLECTION_PLACE_FIELD) return COLLECTION_PLACE_FIELD;
  return '';
}

/**
 * Normalize one collection note. A note with no collector, no place,
 * and no mohalla is not a note at all and reads as null, so a
 * transaction without one shows the customer only.
 */
export function normalizeCollectionNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const collectedBy = cleanCollectionNoteText(raw.collectedBy).slice(0, COLLECTION_NOTE_COLLECTED_BY_MAX_LENGTH);
  const place = normalizeCollectionPlace(raw.place ?? raw.collectionPlace);
  const mohalla = cleanCollectionNoteText(raw.mohalla ?? raw.collectionMohalla).slice(0, COLLECTION_NOTE_MOHALLA_MAX_LENGTH);
  if (!collectedBy && !place && !mohalla) return null;
  return {
    ...(collectedBy ? { collectedBy } : {}),
    ...(place ? { place } : {}),
    ...(mohalla ? { mohalla } : {}),
  };
}

/**
 * The collection note on a payment record, or null when the payment
 * carries none. Reads the same three fields the payment validator
 * keeps, so a note recorded with the payment is the note shown.
 */
export function collectionNoteOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  return normalizeCollectionNote({
    collectedBy: payment.collectedBy,
    place: payment.collectionPlace,
    mohalla: payment.collectionMohalla,
  });
}

const COLLECTION_NOTE_DEFAULT_LABELS = {
  collectedBy: 'Collected by {name}',
  shop: 'Shop',
  field: 'Field',
};

/**
 * The note in plain words — collector, place, mohalla, each shown only
 * when given, joined with ' · '. Empty when the note has nothing to
 * say. The caller supplies labels (the profile passes translated
 * ones); the plain defaults are used otherwise. The returned text is
 * unescaped: callers that put it in HTML must escape it, as the
 * markup helper below does.
 */
export function collectionNoteLineText(note, labels = {}) {
  const normalized = normalizeCollectionNote(note);
  if (!normalized) return '';
  const collectedByLabel = typeof labels.collectedBy === 'string' && labels.collectedBy ? labels.collectedBy : COLLECTION_NOTE_DEFAULT_LABELS.collectedBy;
  const shopLabel = typeof labels.shop === 'string' && labels.shop ? labels.shop : COLLECTION_NOTE_DEFAULT_LABELS.shop;
  const fieldLabel = typeof labels.field === 'string' && labels.field ? labels.field : COLLECTION_NOTE_DEFAULT_LABELS.field;
  const parts = [];
  if (normalized.collectedBy) parts.push(collectedByLabel.replace('{name}', normalized.collectedBy));
  if (normalized.place) parts.push(normalized.place === COLLECTION_PLACE_SHOP ? shopLabel : fieldLabel);
  if (normalized.mohalla) parts.push(normalized.mohalla);
  return parts.join(' · ');
}

function escapeCollectionNoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The note as it appears on the transaction: a ' · …' suffix for the
 * payment-meta line, or '' when the payment carries no note, so a
 * transaction without one shows the customer only. The collector name
 * and mohalla are always escaped.
 */
export function collectionNoteMarkup(payment, labels = {}) {
  const text = collectionNoteLineText(collectionNoteOf(payment), labels);
  return text ? ` · ${escapeCollectionNoteHtml(text)}` : '';
}
