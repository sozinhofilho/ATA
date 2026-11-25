#!/usr/bin/env node
// Auditoria Lighthouse (desempenho, acessibilidade, boas práticas, SEO) das páginas principais.
// Uso: npm run build && npm i --no-save lighthouse@12 && node tests/perf/lighthouse.mjs
// Variável opcional: LIGHTHOUSE_DIR (pasta onde o pacote lighthouse está instalado).
// O Chromium é aberto pelo Playwright e o Lighthouse se conecta a ele pela porta de depuração.
// Observação: o build de homologação usa noindex de propósito; por isso o SEO é medido também com o HTML
// de produção simulado (sem a meta robots noindex) e informado separadamente.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startServer } from '../e2e/server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(process.env.LIGHTHOUSE_DIR ? join(process.env.LIGHTHOUSE_DIR, 'package.json') : import.meta.url);
const lhPath = req.resolve('lighthouse');
const { default: lighthouse } = await import(pathToFileURL(lhPath).href);
const { default: desktopConfig } = await import(pathToFileURL(join(dirname(lhPath), 'config/desktop-config.js')).href);
let pw; for (const p of ['playwright', '/opt/node-tools/node_modules/playwright/index.js']) { try { pw = createRequire(import.meta.url)(p); break; } catch {} }
const PORT = 9333;
const browser = await pw.chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'nexus-lh-'));

// cópia do dist sem "noindex" (simula robots de produção apenas para a categoria SEO)
const dist = join(tmp, 'dist');
cpSync(resolve(root, 'dist'), dist, { recursive: true });
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const cfgUrl = JSON.parse(readFileSync(resolve(root, 'src/config/site.json'), 'utf8')).site.urlPadrao;
const LOCAL = 'http://127.0.0.1:4455';
for (const f of walk(dist).filter((f) => f.endsWith('.html'))) writeFileSync(f, readFileSync(f, 'utf8').replace('content="noindex, nofollow"', 'content="index, follow"').replaceAll(process.env.SITE_URL || cfgUrl, LOCAL));
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${LOCAL}/sitemap.xml\n`);

const index = JSON.parse(readFileSync(join(dist, 'indice-busca.json'), 'utf8'));
const pages = [['Início', '/'], ['Catálogo', '/produtos/'], ['Produto', index.produtos[0].url], ['Categoria', `/categorias/${index.categorias[0].slug}/`], ['Atas', '/atas/'], ['Como comprar', '/como-comprar/']];
const { server, url: BASE } = await startServer(dist, 4455);
const rows = [];
for (const preset of ['mobile', 'desktop']) {
  for (const [name, path] of pages) {
    const flags = { port: PORT, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
    let j;
    try { j = (await lighthouse(BASE + path, flags, preset === 'desktop' ? desktopConfig : undefined)).lhr; }
    catch (e) { console.error(`falha em ${path}: ${e.message}`); continue; }
    const s = (k) => Math.round(j.categories[k].score * 100);
    const a = (k) => j.audits[k]?.displayValue ?? '';
    rows.push({ preset, name, path, perf: s('performance'), a11y: s('accessibility'), bp: s('best-practices'), seo: s('seo'), lcp: a('largest-contentful-paint'), cls: a('cumulative-layout-shift'), tbt: a('total-blocking-time'), fcp: a('first-contentful-paint'), weight: a('total-byte-weight') });
    console.log(`${preset.padEnd(7)} ${name.padEnd(13)} perf ${s('performance')} a11y ${s('accessibility')} bp ${s('best-practices')} seo ${s('seo')}  LCP ${a('largest-contentful-paint')} CLS ${a('cumulative-layout-shift')} TBT ${a('total-blocking-time')}`);
  }
}
await browser.close();
server.close();
rmSync(tmp, { recursive: true, force: true });
mkdirSync(resolve(root, 'docs/relatorios'), { recursive: true });
const md = ['# Relatório de desempenho (Lighthouse)', '',
  `Executado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} com Lighthouse 12, Chromium headless, servidor estático local (sem CDN e sem compressão Brotli/Gzip, que a hospedagem aplica). Perfil "mobile" simula celular de gama média com rede 4G lenta; "desktop" usa o preset padrão de desktop.`, '',
  'A versão de homologação tem `noindex` e `robots.txt` bloqueados de propósito; para medir SEO, a auditoria usou uma cópia do build com robots e domínio canônico simulando a produção.', '',
  '| Perfil | Página | Desempenho | Acessibilidade | Boas práticas | SEO | FCP | LCP | TBT | CLS | Peso total |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.preset} | ${r.name} (\`${r.path}\`) | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.fcp} | ${r.lcp} | ${r.tbt} | ${r.cls} | ${r.weight} |`), ''].join('\n');
writeFileSync(resolve(root, 'docs/relatorios/relatorio-performance.md'), md);
console.log('Relatório: docs/relatorios/relatorio-performance.md');
