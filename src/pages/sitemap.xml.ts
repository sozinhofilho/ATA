import { products, categories, solutions, productUrl } from '../lib/catalog';
import { absoluteUrl } from '../lib/site';

const today = new Date().toISOString().slice(0, 10);
const staticPages = ['/', '/produtos/', '/categorias/', '/solucoes/', '/atas/', '/como-comprar/', '/sobre/', '/contato/', '/politica-de-privacidade/', '/termos-de-uso/'];

export function GET() {
  const urls: { loc: string; lastmod: string }[] = [
    ...staticPages.map((p) => ({ loc: p, lastmod: today })),
    ...categories.map((c) => ({ loc: `/categorias/${c.slug}/`, lastmod: today })),
    ...solutions.map((s) => ({ loc: `/solucoes/${s.slug}/`, lastmod: today })),
    ...products.map((p) => ({ loc: productUrl(p), lastmod: p.data_atualizacao || today })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${absoluteUrl(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
