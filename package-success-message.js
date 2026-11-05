/**
 * package-success-message.js — amount to package message for the Quick
 * Collect success screen.
 *
 * Pure and import-free: given the amount just collected, it returns the
 * Urdu package message for that exact package price, or null when the
 * amount matches no package (the caller then keeps the existing English
 * line, so part-payments and other amounts never break the screen).
 * A package lasts thirty days; only the Rs 3000 package is unlimited.
 */

export const DEFAULT_SUCCESS_MESSAGE =
  'The transaction is saved locally and ledger balances are updated.';

export const PACKAGE_SUCCESS_MESSAGES = Object.freeze([
  Object.freeze({
    price: 1000,
    message: 'آپ کا ایک ہزار والا پیکج لگ گیا ہے، ڈیٹا سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  }),
  Object.freeze({
    price: 1500,
    message: 'آپ کا پندرہ سو والا پیکج لگ گیا ہے، ڈیٹا ڈیڑھ سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  }),
  Object.freeze({
    price: 1600,
    message: 'آپ کا سولہ سو والا پیکج لگ گیا ہے، ڈیٹا تین سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  }),
  Object.freeze({
    price: 2000,
    message: 'آپ کا دو ہزار والا پیکج لگ گیا ہے، ڈیٹا دو سو جی بی ہے، ختم ہونے پہ پیکج دوبارہ کروانا پڑ سکتا ہے۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  }),
  Object.freeze({
    price: 2500,
    message: 'آپ کا پچیس سو والا پیکج لگ گیا ہے، ڈیٹا پانچ سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  }),
  Object.freeze({
    price: 3000,
    message: 'آپ کا تین ہزار والا پیکج لگ گیا ہے — جتنا چاہیں انٹرنیٹ استعمال کریں۔ پیکج کی مدت تیس دن ہوتی ہے۔'
  })
]);

/**
 * The package message for an amount collected, or null when the amount
 * matches no package price. Numeric strings are accepted ('2000' counts);
 * anything non-numeric, non-positive, or fractional never matches.
 *
 * @param {number|string} amount
 * @returns {string|null}
 */
export function packageSuccessMessage(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const hit = PACKAGE_SUCCESS_MESSAGES.find((entry) => entry.price === value);
  return hit ? hit.message : null;
}

/**
 * The package message for an amount collected, falling back to the
 * existing English success line when the amount matches no package.
 *
 * @param {number|string} amount
 * @returns {string}
 */
export function packageSuccessMessageOrDefault(amount) {
  return packageSuccessMessage(amount) ?? DEFAULT_SUCCESS_MESSAGE;
}
