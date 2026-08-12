import React from 'react';
import { buildWhatsAppUrl } from '../utils/whatsapp';

const WhatsAppButton: React.FC = () => {
  const url = buildWhatsAppUrl();

  // wa.me already handles the "app if installed, else web.whatsapp.com"
  // fallback on its own (that's the whole point of the wa.me domain) — the
  // only thing this needs to work around is that window.open's new-tab
  // behavior is unreliable inside an installed/standalone PWA (no real
  // "tab" concept there, some WebViews just swallow it). Falling back to a
  // same-window navigation covers browser, installed PWA, Android, and iOS.
  const handleClick = () => {
    if (!url) return;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = url;
    }
  };

  if (!url) return null;

  return (
    <button className="whatsapp-button" onClick={handleClick}>
      <span>💬</span>
      Chat with us on WhatsApp
    </button>
  );
};

export default WhatsAppButton;
