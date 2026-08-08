// customer service
const Customer = require('../models/Customer');
const { phonesMatch, buildCanonicalPhone } = require('../utils');

const findByExactEmail = (email) => {
  if (!email) return null;
  return Customer.findOne({ email: String(email).toLowerCase(), isDeleted: false });
};

const findByExactCustomerId = (customerId) => {
  if (!customerId) return null;
  return Customer.findOne({ customerId: String(customerId).toUpperCase(), isDeleted: false });
};

// Fuzzy phone lookup: pulls the active customers' phone numbers and compares
// digit-by-digit via phonesMatch, so it works no matter how the number was
// originally formatted (with/without country code, spaces, dashes,
// parentheses) or whether it's a legacy CSV-imported record.
const findByPhone = async (rawPhone) => {
  if (!rawPhone) return null;

  const candidates = await Customer.find({ isDeleted: false }, '_id whatsappNumber').lean();

  const match = candidates.find((c) => phonesMatch(c.whatsappNumber, rawPhone));
  if (!match) return null;

  return Customer.findOne({ _id: match._id, isDeleted: false });
};

// Single canonical "does this customer already exist" lookup, shared by the
// search screen (check-duplicate) and customer creation, so the two can
// never disagree with each other.
const findExistingCustomer = async ({ query, email, phone } = {}) => {
  const trimmedQuery = (query || '').trim();

  if (trimmedQuery) {
    if (trimmedQuery.includes('@')) return findByExactEmail(trimmedQuery);
    if (trimmedQuery.toUpperCase().startsWith('KRISH')) return findByExactCustomerId(trimmedQuery);
    return findByPhone(trimmedQuery);
  }

  if (email) {
    const byEmail = await findByExactEmail(email);
    if (byEmail) return byEmail;
  }

  if (phone) {
    return findByPhone(phone);
  }

  return null;
};

// Turns whatever shape a client sends — the country picker's countryCode
// plus a raw pasted phoneNumber (preferred), or a legacy pre-combined
// whatsappNumber string — into the one canonical save format, via the
// single buildCanonicalPhone formatter in utils. This is the only place
// that decides what actually gets written to Customer.whatsappNumber, so
// the mobile app, any future web app, and any other API caller all end up
// with the exact same saved value for the exact same phone number.
const resolveCanonicalWhatsapp = ({ countryCode, phoneNumber, whatsappNumber } = {}) => {
  if (phoneNumber) {
    return buildCanonicalPhone(countryCode || '+1', phoneNumber);
  }
  if (whatsappNumber) {
    const match = String(whatsappNumber).match(/^\s*(\+\d{1,4})\s*(.*)$/);
    if (match) return buildCanonicalPhone(match[1], match[2]);
    return buildCanonicalPhone(countryCode || '+1', whatsappNumber);
  }
  return '';
};

module.exports = {
  findExistingCustomer,
  findByPhone,
  findByExactEmail,
  findByExactCustomerId,
  resolveCanonicalWhatsapp,
};
