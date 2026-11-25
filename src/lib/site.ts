import cfg from '../config/site.json';

export const config = cfg;
export const marca = cfg.marca;
export const contato = cfg.contato;
export const empresa = cfg.empresa;

/** URL base do site (definida em SITE_URL ou em site.json). */
export const SITE_URL = String(import.meta.env.SITE || cfg.site.urlPadrao).replace(/\/$/, '');

/** "production" bloqueia dados provisórios e libera indexação. Qualquer outro valor = homologação. */
export const SITE_MODE: 'production' | 'homologacao' = process.env.SITE_MODE === 'production' ? 'production' : 'homologacao';
export const IS_PRODUCTION = SITE_MODE === 'production';

export const analytics = {
  ga4Id: (import.meta.env.PUBLIC_GA4_ID || '').trim(),
  gtmId: (import.meta.env.PUBLIC_GTM_ID || '').trim(),
  gscVerification: (import.meta.env.PUBLIC_GSC_VERIFICATION || '').trim(),
};
export const ANALYTICS_ENABLED = /^G-[A-Z0-9]+$/.test(analytics.ga4Id) || /^GTM-[A-Z0-9]+$/.test(analytics.gtmId);

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : '/' + path);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const NAV = [
  { href: '/', label: 'Início' },
  { href: '/produtos/', label: 'Produtos' },
  { href: '/categorias/', label: 'Categorias' },
  { href: '/solucoes/', label: 'Soluções' },
  { href: '/atas/', label: 'Atas disponíveis' },
  { href: '/como-comprar/', label: 'Como comprar' },
  { href: '/sobre/', label: 'Sobre nós' },
  { href: '/contato/', label: 'Contato' },
];
