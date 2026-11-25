// Mensuração de eventos (GA4 / Google Tag Manager).
// - Nada é enviado se os identificadores não estiverem configurados (.env) ou sem consentimento.
// - Nunca transmite nome, telefone, e-mail ou outros dados pessoais.
// - Todo evento também é emitido como CustomEvent "nexus:track" (útil para testes e depuração).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __NEXUS_ANALYTICS__?: { ga4: string; gtm: string };
  }
}

const ALLOWED = new Set(['item_id', 'item_name', 'item_category', 'item_list_name', 'search_term', 'results', 'location', 'link_url', 'method', 'document_type', 'ata_id']);
const PII = /[\w.+-]+@[\w-]+\.[\w.]+|\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

export const CONSENT_KEY = 'nexus-consent';

export function consentGranted(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
}

function sanitize(params: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!ALLOWED.has(k) || v == null || v === '') continue;
    out[k] = typeof v === 'number' ? v : String(v).replace(PII, '[removido]').slice(0, 100);
  }
  return out;
}

export function track(event: string, params: Record<string, unknown> = {}) {
  const clean = sanitize(params);
  document.dispatchEvent(new CustomEvent('nexus:track', { detail: { event, params: clean } }));
  if (!window.__NEXUS_ANALYTICS__ || !consentGranted()) return;
  if (typeof window.gtag === 'function') window.gtag('event', event, clean);
  else (window.dataLayer = window.dataLayer || []).push({ event, ...clean });
}

/** Cliques em elementos com data-track="nome_do_evento" e data-track-* como parâmetros. */
export function bindClickTracking(root: Document = document) {
  root.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest<HTMLElement>('[data-track]');
    if (!el) return;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(el.dataset)) {
      if (k.startsWith('track') && k !== 'track') {
        const key = k.slice(5).replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()).replace(/^_/, '');
        params[key] = v ?? '';
      }
    }
    for (const name of (el.dataset.track || '').split(/\s+/).filter(Boolean)) track(name, params);
  });
}
