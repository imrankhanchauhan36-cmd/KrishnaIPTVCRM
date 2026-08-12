// WhatsApp quick-action helpers: turning a customer's already-stored,
// canonical whatsappNumber (+<callingCode><digits>, the same format the
// backend's buildCanonicalPhone always saves) into a wa.me deep link, plus
// the message templates it can be pre-filled with. Nothing here ever sends
// anything — it only builds a URL the operator still has to review and
// press Send on inside WhatsApp.

// wa.me requires digits only (no "+", spaces, or punctuation) but DOES
// require the country code to be included. A real WhatsApp-capable number
// is always at least 8 digits total (shortest real country code + local
// number combinations) — this is a sanity floor, not a strict validator,
// so it never rejects a real number but does catch obviously-broken data
// (empty, or a handful of stray digits) before ever building a link.
const MIN_WHATSAPP_DIGITS = 8;

// Returns a bare digit string ready for wa.me, or null if the stored number
// isn't usable — never guesses or invents a number from other fields.
export const normalizePhoneForWhatsApp = (rawPhone) => {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length < MIN_WHATSAPP_DIGITS) return null;
  return digits;
};

// Builds the standard wa.me universal link — works identically whether the
// operator is on the mobile app (opens the WhatsApp app) or the web build
// (opens web.whatsapp.com), so it's the right "deep link" for this CRM's
// actual runtime, unlike a whatsapp:// scheme URL which only works on
// native. Returns null (never a broken link) if the phone is unusable.
export const buildWhatsAppUrl = (rawPhone, message) => {
  const digits = normalizePhoneForWhatsApp(rawPhone);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
};

const SIGNATURE = 'Thank you,\nKrishna IPTV';

// planClause / dateClause helpers so a template never renders a literal
// "undefined" or an empty {{variable}} — a missing field just drops that
// clause instead of fabricating a value.
const planClause = (activePlan) => (activePlan ? ` (${activePlan})` : '');

// This CRM's stored customer names already carry the "ji" honorific as part
// of fullName (e.g. "Mr Sivan Raghavan ji") — confirmed across real records,
// not assumed. Appending " ji" unconditionally would render "...ji ji" for
// every customer, so the greeting only adds it when the name doesn't
// already end with one.
const greetingName = (fullName) => {
  const name = (fullName || '').trim();
  return /\bji$/i.test(name) ? name : `${name} ji`;
};

// Every template is only ever built from the real customer object passed
// in — fullName/activePlan/renewalDate/panelExpiryDate all come straight
// from the CRM's own customer/subscription records.
export const WHATSAPP_MESSAGE_TEMPLATES = [
  {
    key: 'general',
    label: 'General Message',
    // Always available — needs nothing but the customer's name.
    isAvailable: () => true,
    build: ({ fullName }) =>
      `Hi ${greetingName(fullName)},\n\nThis is Krishna IPTV. How can we help you today?\n\n${SIGNATURE}`,
  },
  {
    key: 'renewal',
    label: 'Renewal Reminder',
    // Only meaningful when there's a real renewal date to reference.
    isAvailable: ({ renewalDate }) => !!renewalDate,
    build: ({ fullName, activePlan, renewalDate }) =>
      `Hi ${greetingName(fullName)},\n\nYour IPTV subscription${planClause(activePlan)} is due for renewal on ${new Date(renewalDate).toDateString()}.\n\nPlease contact us if you would like to renew your subscription.\n\n${SIGNATURE}`,
  },
  {
    key: 'expiry',
    label: 'Expiry Reminder',
    isAvailable: ({ panelExpiryDate }) => !!panelExpiryDate,
    build: ({ fullName, activePlan, panelExpiryDate }) =>
      `Hi ${greetingName(fullName)},\n\nYour IPTV subscription${planClause(activePlan)} is expiring on ${new Date(panelExpiryDate).toDateString()}. Please renew soon to avoid any interruption in service.\n\n${SIGNATURE}`,
  },
  {
    key: 'payment',
    label: 'Payment Reminder',
    // Available whenever there's a plan to reference — this CRM has no
    // "amount due" concept (payments are only ever recorded after being
    // received), so the message deliberately never states a figure.
    isAvailable: () => true,
    build: ({ fullName, activePlan }) =>
      `Hi ${greetingName(fullName)},\n\nThis is a reminder regarding your pending payment for your IPTV subscription${planClause(activePlan)}. Please let us know if you have any questions.\n\n${SIGNATURE}`,
  },
];
