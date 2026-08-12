// The ONE place the business WhatsApp number is read from — every WhatsApp
// button in the app must call buildWhatsAppUrl(), never hardcode a number.
const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string) || '';

const DEFAULT_MESSAGE = 'Hello, I need help with my IPTV subscription.';

export const buildWhatsAppUrl = (message: string = DEFAULT_MESSAGE) => {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};
