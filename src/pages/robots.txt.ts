import { absoluteUrl, IS_PRODUCTION } from '../lib/site';

// Homologação: bloqueia indexação (dados demonstrativos). Produção: libera, exceto o índice de busca.
export function GET() {
  const body = IS_PRODUCTION
    ? `User-agent: *\nAllow: /\nDisallow: /indice-busca.json\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
    : `# Versão de homologação: não indexar.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
