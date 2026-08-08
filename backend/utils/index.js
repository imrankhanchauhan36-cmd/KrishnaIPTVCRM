// General utility functions

// Strips everything except digits, e.g. "+1 (971) 470-9567" -> "19714709567".
const normalizeDigits = (value) => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
};

// Minimum number of trailing digits required to treat two phone numbers as
// the same customer. Prevents short/garbage values from falsely matching.
const MIN_PHONE_MATCH_LENGTH = 7;

// Two phone numbers are the same customer if the shorter one's digits are a
// trailing match of the longer one's digits. This is what lets
// "+1 (971) 470-9567", "+1-971-470-9567", "+1 971 470 9567", "19714709567"
// and a bare legacy number like "9714709567" (no country code, as stored by
// the old CSV import) all resolve to the same customer without touching any
// stored data.
const phonesMatch = (a, b) => {
  const digitsA = normalizeDigits(a);
  const digitsB = normalizeDigits(b);
  if (!digitsA || !digitsB) return false;

  const minLength = Math.min(digitsA.length, digitsB.length);
  if (minLength < MIN_PHONE_MATCH_LENGTH) return false;

  return digitsA.slice(-minLength) === digitsB.slice(-minLength);
};

// Typical local mobile-number length (digits, country code excluded) for
// each calling code offered in the app's country picker. Used only to
// safely detect and strip a duplicated/leading country code from pasted
// input — never to reject or validate a number.
const LOCAL_LENGTH_BY_CALLING_CODE = {
  '1': 10,   // USA / Canada
  '91': 10,  // India
  '44': 10,  // UK
  '971': 9,  // UAE
  '61': 9,   // Australia
  '92': 10,  // Pakistan
  '880': 10, // Bangladesh
  '27': 9,   // South Africa
  '65': 8,   // Singapore
  '974': 8,  // Qatar
};

// THE single canonical save-time formatter. The selected country code is
// the source of truth; rawNumber is whatever the user pasted or typed, in
// any format — spaces, brackets, hyphens, duplicated "+" signs, or even a
// redundant country code already embedded in the pasted text. Always
// returns "+<callingCode><localDigits>" and nothing else.
//
// Every create, every update, every future client goes through this exact
// function — there is no second implementation of this rule anywhere.
const buildCanonicalPhone = (countryCode, rawNumber) => {
  const ccDigits = normalizeDigits(countryCode);
  let localDigits = normalizeDigits(rawNumber);

  if (!ccDigits) return localDigits ? `+${localDigits}` : '';
  if (!localDigits) return `+${ccDigits}`;

  const expectedLocalLength = LOCAL_LENGTH_BY_CALLING_CODE[ccDigits] || null;

  // Strip one leading occurrence of the selected country code from the
  // pasted digits, but only when doing so leaves exactly the expected
  // local-number length. That guard is what stops this from mangling a
  // real local number that happens to start with the same digits as the
  // country code (e.g. an Indian mobile number starting with "91").
  const stripOnce = (digits) => {
    if (!digits.startsWith(ccDigits) || digits.length <= ccDigits.length) return digits;
    const withoutCc = digits.slice(ccDigits.length);
    if (!expectedLocalLength || withoutCc.length === expectedLocalLength) {
      return withoutCc;
    }
    return digits;
  };

  localDigits = stripOnce(localDigits);

  // Handles a doubled country code (e.g. pasting "+1 +1 (727) 614-2230"),
  // where a single strip still leaves a leftover leading country code.
  while (
    expectedLocalLength &&
    localDigits.length > expectedLocalLength &&
    localDigits.startsWith(ccDigits)
  ) {
    localDigits = localDigits.slice(ccDigits.length);
  }

  return `+${ccDigits}${localDigits}`;
};

module.exports = {
  normalizeDigits,
  phonesMatch,
  buildCanonicalPhone,
  LOCAL_LENGTH_BY_CALLING_CODE,
  MIN_PHONE_MATCH_LENGTH,
};
