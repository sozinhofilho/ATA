#!/usr/bin/env node
// Testes ponta a ponta no navegador (Playwright + Chromium) sobre o build estático em dist/.
// Uso: npm run build && npm run test:e2e
//   CAPTURAS=0  -> não gera capturas de tela
// Requer Playwright: `npm i -D playwright && npx playwright install chromium` (ou instalação global).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(root, 'dist');
const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright/index.js']) { try { playwright = require(p); break; } catch { /* tenta o próximo */ } }
if (!playwright) { console.error('Playwright não encontrado. Instale com: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
if (!existsSync(resolve(dist, 'index.html'))) { console.error('Execute "npm run build" antes dos testes.'); process.exit(1); }

const cfg = JSON.parse(readFileSync(resolve(root, 'src/config/site.json'), 'utf8'));
const index = JSON.parse(readFileSync(resolve(dist, 'indice-busca.json'), 'utf8'));
const WA = `https://wa.me/${cfg.contato.whatsapp}`;
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const capDir = resolve(root, 'docs/capturas');
const repDir = resolve(root, 'docs/relatorios');
mkdirSync(capDir, { recursive: true });
mkdirSync(repDir, { recursive: true });

const { server, url: BASE } = await startServer(dist);
const browser = await playwright.chromium.launch();
const results = [];
let current = '';
async function t(group, name, fn) {
  current = `${group} › ${name}`;
  const start = Date.now();
  try { await fn(); results.push({ group, name, ok: true, ms: Date.now() - start }); process.stdout.write(`  ✔ ${current}\n`); }
  catch (e) { results.push({ group, name, ok: false, ms: Date.now() - start, error: String(e.message || e).split('\n').slice(0, 4).join(' ') }); process.stdout.write(`  ✖ ${current}\n     ${String(e.message).split('\n')[0]}\n`); }
}
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { p.__errors = [...(p.__errors || []), e.message]; });
  // registra eventos de mensuração emitidos pelo site
  await p.addInitScript(() => { window.__events = []; document.addEventListener('nexus:track', (e) => window.__events.push(e.detail)); window.open = (u) => { window.__opened = u; return null; }; });
  return p;
}
const decodeWa = (href) => decodeURIComponent(href.split('?text=')[1] || '');
const visibleCards = (p) => p.$$eval('[data-grid] .pcard:not([hidden])', (els) => els.map((e) => e.querySelector('.pcard__title a').textContent.trim()));

const MAIN = ['/', '/produtos/', '/categorias/', '/solucoes/', '/atas/', '/como-comprar/', '/sobre/', '/contato/', '/politica-de-privacidade/', '/termos-de-uso/'];
const prod = index.produtos.find((p) => p.renem === '1981') || index.produtos[0];
const PRODUCT = prod.url;
const firstCat = index.categorias[0];

// ---------------------------------------------------------------- 1, 2. Navegação e links internos
await t('Navegação', 'menu principal leva às páginas com H1 e sem erros de JavaScript', async () => {
  const p = await page();
  await p.goto(BASE + '/');
  const links = await p.$$eval('.site-nav a', (as) => as.map((a) => a.getAttribute('href')));
  assert.ok(links.length >= 6, 'menu com itens');
  for (const href of links) {
    const r = await p.goto(BASE + href);
    assert.equal(r.status(), 200, href);
    assert.equal(await p.locator('h1').count(), 1, `H1 em ${href}`);
  }
  assert.ok(!p.__errors, `erros JS: ${p.__errors}`);
  await p.context().close();
});

await t('Navegação', 'todas as páginas e recursos internos rastreados a partir da home respondem 200', async () => {
  const seen = new Set(['/']); const queue = ['/']; const broken = [];
  while (queue.length) {
    const path = queue.shift();
    const res = await fetch(BASE + path);
    if (res.status !== 200) { broken.push(`${path} → ${res.status}`); continue; }
    if (!(res.headers.get('content-type') || '').includes('html')) continue;
    const html = await res.text();
    for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) if (!m[1].startsWith('//') && !seen.has(m[1])) { seen.add(m[1]); queue.push(m[1]); }
  }
  assert.deepEqual(broken, []);
  assert.ok(seen.size > 60, `rastreadas ${seen.size} URLs`);
});

await t('Navegação', 'links externos abrem em nova aba com rel="noopener"', async () => {
  const p = await page();
  for (const path of ['/', PRODUCT, '/como-comprar/', '/atas/']) {
    await p.goto(BASE + path);
    const bad = await p.$$eval('a[href^="http"]', (as) => as.filter((a) => a.target !== '_blank' || !/noopener/.test(a.rel)).map((a) => a.href));
    assert.deepEqual(bad, [], path);
  }
  await p.context().close();
});

// ---------------------------------------------------------------- 4. Menu mobile
await t('Mobile', 'menu abre, recebe foco, fecha com Esc e mantém aria-expanded', async () => {
  const p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(BASE + '/');
  const btn = p.locator('[data-menu-toggle]');
  assert.equal(await p.locator('#menu-mobile').isVisible(), false);
  await btn.click();
  assert.equal(await p.locator('#menu-mobile').isVisible(), true);
  assert.equal(await btn.getAttribute('aria-expanded'), 'true');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#menu-mobile').isVisible(), false);
  await btn.click();
  await p.locator('#menu-mobile a[href="/produtos/"]').click();
  await p.waitForURL('**/produtos/');
  await p.context().close();
});

// ---------------------------------------------------------------- 5-9. Pesquisa
await t('Pesquisa', 'sugestões durante a digitação e navegação por teclado até o produto', async () => {
  const p = await page();
  await p.goto(BASE + '/');
  await p.fill('#busca-home', 'Fowler');
  await p.waitForSelector('#busca-home-lista:not([hidden]) li');
  const sug = await p.$$eval('#busca-home-lista li strong', (s) => s.map((x) => x.textContent));
  assert.ok(sug.some((s) => /Fowler/.test(s)), sug.join(' | '));
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await p.waitForURL('**/produtos/cama-hospitalar-tipo-fowler/');
  const ev = await p.evaluate(() => window.__events);
  await p.context().close();
  assert.ok(Array.isArray(ev));
});

await t('Pesquisa', 'sugere categorias pelo nome ("macas")', async () => {
  const p = await page();
  await p.goto(BASE + '/');
  await p.fill('#busca-home', 'macas');
  await p.waitForSelector('#busca-home-lista li.sug--cat');
  assert.match(await p.textContent('#busca-home-lista li.sug--cat'), /Macas e transporte/);
  await p.context().close();
});

for (const [q, expected, label] of [
  ['1981', 'Cama hospitalar tipo Fowler', 'código RENEM'],
  ['berco', 'Berço', 'sem acento'],
  ['BERÇOS', 'Berço', 'plural e maiúsculas'],
  ['aparelho de pressão', 'Esfigmomanômetro', 'sinônimo'],
  ['DEA', 'Desfibrilador externo automático (DEA)', 'sigla'],
  ['cama hospitalar', 'Cama hospitalar', 'expressão'],
  ['monitor', 'Monitor multiparamétrico', 'termo simples'],
  ['maca', 'Carro maca simples', 'maca'],
]) {
  await t('Pesquisa', `catálogo encontra por ${label}: "${q}"`, async () => {
    const p = await page();
    await p.goto(`${BASE}/produtos/?q=${encodeURIComponent(q)}`);
    await p.waitForSelector('[data-catalog][data-ready]');
    const names = await visibleCards(p);
    assert.ok(names.length > 0, 'sem resultados');
    assert.ok(names[0].startsWith(expected), `primeiro: ${names[0]}`);
    await p.context().close();
  });
}

await t('Pesquisa', 'termo inexistente mostra estado vazio com CTA personalizado', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/?q=xyzqwe`);
  await p.waitForSelector('[data-empty]:not([hidden])');
  const href = await p.getAttribute('[data-empty-wa]', 'href');
  assert.match(decodeWa(href), /xyzqwe/);
  await p.click('.empty [data-clear]');
  assert.equal((await visibleCards(p)).length, 12);
  await p.context().close();
});

await t('Pesquisa', 'busca dentro do catálogo atualiza resultados sem recarregar e registra evento "search"', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/`);
  await p.waitForSelector('[data-catalog][data-ready]');
  await p.fill('#busca-catalogo', 'desfibrilador');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'desfibrilador');
  const names = await visibleCards(p);
  assert.ok(names[0].startsWith('Desfibrilador'));
  const ev = await p.evaluate(() => window.__events.map((e) => e.event));
  assert.ok(ev.includes('search'));
  await p.context().close();
});

// ---------------------------------------------------------------- 10-12. Filtros, ordenação e paginação
await t('Catálogo', 'filtro por categoria, subcategoria, marca e chips removíveis', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/`);
  await p.waitForSelector('[data-catalog][data-ready]');
  await p.check('input[name="categoria"][value="mobiliario-hospitalar"]');
  const expected = index.produtos.filter((x) => x.categoriaSlug === 'mobiliario-hospitalar' || x.catsSecundarias.includes('mobiliario-hospitalar')).length;
  assert.match(await p.textContent('[data-count]'), new RegExp(`${expected} produtos`));
  assert.ok(await p.isVisible('[data-subcats]'), 'subcategorias visíveis');
  await p.check('input[name="subcategoria"][value="camas-fowler"]');
  assert.deepEqual(await visibleCards(p), ['Cama hospitalar tipo Fowler']);
  assert.ok((await p.$$('.chip')).length >= 2);
  await p.click('.chip--clear');
  assert.match(await p.textContent('[data-count]'), new RegExp(`${index.produtos.length} produtos`));
  await p.selectOption('#f-marca', 'Marca Exemplo C');
  const c = index.produtos.filter((x) => x.marca === 'Marca Exemplo C').length;
  assert.equal((await visibleCards(p)).length, c);
  assert.match(p.url(), /marca=Marca/);
  await p.context().close();
});

await t('Catálogo', 'filtros por ambiente e RENEM; estado restaurado pela URL', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/?ambiente=lavanderia`);
  await p.waitForSelector('[data-catalog][data-ready]');
  const lav = index.produtos.filter((x) => x.ambientes.includes('lavanderia')).length;
  assert.equal((await visibleCards(p)).length, lav);
  assert.equal(await p.isChecked('input[name="ambiente"][value="lavanderia"]'), true);
  await p.goto(`${BASE}/produtos/?renem=10798`);
  await p.waitForSelector('[data-catalog][data-ready]');
  assert.deepEqual(await visibleCards(p), ['Carro de emergência']);
  await p.context().close();
});

await t('Catálogo', 'ordenação A–Z, Z–A e recentes', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/`);
  await p.waitForSelector('[data-catalog][data-ready]');
  const sorted = index.produtos.map((x) => x.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  await p.selectOption('[data-sort]', 'az');
  assert.deepEqual(await visibleCards(p), sorted.slice(0, 12));
  await p.selectOption('[data-sort]', 'za');
  assert.deepEqual(await visibleCards(p), [...sorted].reverse().slice(0, 12));
  await p.selectOption('[data-sort]', 'recentes');
  const recent = [...index.produtos].sort((a, b) => b.atualizado.localeCompare(a.atualizado) || a.nome.localeCompare(b.nome, 'pt-BR'))[0].nome;
  assert.equal((await visibleCards(p))[0], recent);
  await p.context().close();
});

await t('Catálogo', 'paginação de 12 em 12 com contador', async () => {
  const p = await page();
  await p.goto(`${BASE}/produtos/`);
  await p.waitForSelector('[data-catalog][data-ready]');
  const total = index.produtos.length;
  const pages = Math.ceil(total / 12);
  assert.equal(await p.locator('[data-pagination] button[aria-label^="Página "]:not([aria-label="Página anterior"])').count(), pages);
  await p.click('[data-pagination] button[aria-label="Página 2"]');
  assert.match(await p.textContent('[data-count]'), new RegExp(`13–${Math.min(24, total)} de ${total}`));
  assert.equal((await visibleCards(p)).length, Math.min(12, total - 12));
  assert.match(p.url(), /pagina=2/);
  await p.context().close();
});

await t('Catálogo', 'painel de filtros no celular abre como diálogo e fecha', async () => {
  const p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(`${BASE}/produtos/`);
  await p.waitForSelector('[data-catalog][data-ready]');
  await p.click('[data-filters-open]');
  assert.equal(await p.getAttribute('#filtros', 'role'), 'dialog');
  await p.check('input[name="categoria"][value="urgencia-e-emergencia"]');
  await p.click('.filters__apply');
  assert.equal(await p.getAttribute('[data-filters-open]', 'aria-expanded'), 'false');
  assert.equal(await p.textContent('[data-filter-n]'), '1');
  await p.context().close();
});

// ---------------------------------------------------------------- 13-17. Produto, galeria, relacionados, WhatsApp
await t('Produto', 'página individual com breadcrumb, códigos, CTAs e especificações confirmadas', async () => {
  const p = await page();
  await p.goto(BASE + PRODUCT);
  assert.equal(await p.textContent('h1'), prod.nome);
  const crumbs = await p.$$eval('.breadcrumb li', (l) => l.map((x) => x.textContent.trim()));
  assert.deepEqual(crumbs, ['Início', prod.categoria, prod.nome]);
  assert.match(await p.textContent('.product__codes'), new RegExp(`RENEM\\s*${prod.renem}`));
  assert.ok(await p.isVisible('text=Solicitar proposta pelo WhatsApp'));
  assert.ok(await p.isVisible('text=Consultar disponibilidade em ata'));
  assert.ok(await p.isVisible('text=Solicitar documentação técnica'));
  const rows = await p.$$eval('.spec th', (t) => t.map((x) => x.textContent));
  assert.ok(rows.includes('Código RENEM') && !rows.includes('Garantia'), 'garantia não confirmada não aparece');
  const ev = await p.evaluate(() => window.__events.map((e) => e.event));
  assert.ok(ev.includes('view_item'));
  await p.context().close();
});

await t('Produto', 'galeria troca imagem pela miniatura e amplia em diálogo', async () => {
  const p = await page();
  await p.goto(BASE + PRODUCT);
  const before = await p.getAttribute('[data-gallery-main]', 'src');
  await p.click('.gallery__thumb >> nth=1');
  const after = await p.getAttribute('[data-gallery-main]', 'src');
  assert.notEqual(before, after);
  await p.click('[data-gallery-open]');
  assert.ok(await p.isVisible('[data-lightbox]'));
  await p.keyboard.press('Escape');
  assert.ok(!(await p.isVisible('[data-lightbox]')));
  await p.context().close();
});

await t('Produto', 'exibe de 4 a 8 produtos relacionados', async () => {
  const p = await page();
  await p.goto(BASE + PRODUCT);
  const n = await p.locator('.related .pcard').count();
  assert.ok(n >= 4 && n <= 8, `relacionados: ${n}`);
  await p.context().close();
});

await t('WhatsApp', 'mensagem do produto inclui nome, RENEM e URL; clique registra eventos', async () => {
  const p = await page();
  await p.goto(BASE + PRODUCT);
  const a = p.locator('.product__cta a.btn--whatsapp');
  const href = await a.getAttribute('href');
  assert.ok(href.startsWith(WA + '?text='));
  const msg = decodeWa(href);
  assert.match(msg, new RegExp(prod.nome.replace(/[()]/g, '.')));
  assert.match(msg, /código RENEM 1981/);
  assert.match(msg, /Ata de Registro de Preços/);
  assert.match(msg, /Produto: https?:\/\/.+\/produtos\/cama-hospitalar-tipo-fowler\//);
  await p.evaluate(() => document.querySelectorAll('a[target=_blank]').forEach((x) => x.addEventListener('click', (e) => e.preventDefault())));
  await a.click();
  const ev = await p.evaluate(() => window.__events.map((e) => e.event));
  assert.ok(ev.includes('whatsapp_click') && ev.includes('quote_request_click'), ev.join(','));
  await p.context().close();
});

await t('WhatsApp', 'mensagens específicas por origem (home, categoria, atas, solução)', async () => {
  const p = await page();
  const check = async (path, sel, re) => { await p.goto(BASE + path); const h = await p.getAttribute(sel, 'href'); assert.ok(h.startsWith(WA), path); assert.match(decodeWa(h), re, path); };
  await check('/', '.wa-float', /consultar informações sobre equipamentos hospitalares e possibilidades de fornecimento por atas/);
  await check(`/categorias/${firstCat.slug}/`, '.wa-float', new RegExp(`categoria ${firstCat.nome} para uma aquisição pública`));
  await check('/atas/', '.wa-float', /Atas de Registro de Preços disponíveis para aquisição de mobiliário/);
  await check('/solucoes/ubs/', '.wa-float', /estruturação de Unidade Básica de Saúde/);
  await p.context().close();
});

await t('WhatsApp', 'todos os links wa.me do site usam o número central e texto codificado', async () => {
  const p = await page();
  for (const path of [...MAIN, PRODUCT, `/categorias/${firstCat.slug}/`]) {
    await p.goto(BASE + path);
    const hrefs = await p.$$eval('a[href*="wa.me"]', (as) => as.map((a) => a.getAttribute('href')));
    for (const h of hrefs) { assert.ok(h.startsWith(WA + '?text='), `${path}: ${h}`); assert.ok(!/\s/.test(h), 'texto codificado'); }
  }
  await p.context().close();
});

// ---------------------------------------------------------------- 18. Formulários
await t('Formulário', 'validação acessível e geração da mensagem (WhatsApp e e-mail) sem enviar dados ao site', async () => {
  const p = await page();
  const requests = [];
  p.on('request', (r) => { if (r.method() !== 'GET') requests.push(r.url()); });
  await p.goto(BASE + '/contato/');
  await p.click('#form-contato button[data-channel="whatsapp"]');
  assert.equal(await p.getAttribute('#form-contato-nome', 'aria-invalid'), 'true');
  assert.ok(await p.isVisible('#form-contato-nome-err'));
  assert.equal(await p.evaluate(() => document.activeElement.id), 'form-contato-nome');
  await p.fill('#form-contato-nome', 'Maria Teste');
  await p.fill('#form-contato-orgao', 'Secretaria Municipal de Saúde');
  await p.fill('#form-contato-municipio', 'Cidade Exemplo');
  await p.selectOption('#form-contato-uf', 'MG');
  await p.fill('#form-contato-email', 'invalido');
  await p.fill('#form-contato-mensagem', '10 camas Fowler');
  await p.click('#form-contato button[data-channel="whatsapp"]');
  assert.equal(await p.getAttribute('#form-contato-email', 'aria-invalid'), 'true');
  await p.fill('#form-contato-email', 'compras@prefeitura.example');
  await p.click('#form-contato button[data-channel="whatsapp"]');
  const opened = await p.evaluate(() => window.__opened);
  assert.ok(opened.startsWith(WA));
  const msg = decodeWa(opened);
  assert.match(msg, /Maria Teste/); assert.match(msg, /Cidade Exemplo\/MG/); assert.match(msg, /10 camas Fowler/);
  const ev = await p.evaluate(() => window.__events.filter((e) => e.event === 'generate_lead'));
  assert.ok(ev.length && !JSON.stringify(ev).includes('Maria'), 'evento sem dados pessoais');
  await p.click('#form-contato button[data-channel="email"]').catch(() => {});
  const last = await p.getAttribute('#form-contato', 'data-last-url');
  assert.match(last, /^mailto:/);
  assert.deepEqual(requests, [], 'nenhuma requisição POST/externa');
  await p.context().close();
});

await t('Formulário', 'consulta de ata gera mensagem de consulta com produtos e município', async () => {
  const p = await page();
  await p.goto(BASE + '/atas/');
  await p.fill('#form-consulta-ata-nome', 'João'); await p.fill('#form-consulta-ata-orgao', 'Fundo Municipal de Saúde');
  await p.fill('#form-consulta-ata-municipio', 'Teste'); await p.selectOption('#form-consulta-ata-uf', 'BA');
  await p.fill('#form-consulta-ata-mensagem', '2 desfibriladores');
  await p.click('#form-consulta-ata button[data-channel="whatsapp"]');
  const msg = decodeWa(await p.evaluate(() => window.__opened));
  assert.match(msg, /consulta de Ata de Registro de Preços/); assert.match(msg, /Produtos e quantidades: 2 desfibriladores/);
  await p.context().close();
});

// ---------------------------------------------------------------- 21-25. Publicação, 404, sitemap
await t('Publicação', 'produtos pendentes, rascunhos e inativos não geram página nem aparecem na busca', async () => {
  for (const slug of ['calandra-para-lavanderia-pendente', 'sofa-cama-para-acompanhante-rascunho', 'diva-clinico-antigo-inativo']) {
    const r = await fetch(`${BASE}/produtos/${slug}/`);
    assert.equal(r.status, 404, slug);
  }
  const names = index.produtos.map((p) => p.nome).join(' ');
  assert.ok(!/pendente|rascunho|inativo/i.test(names));
  const idx = JSON.stringify(index);
  assert.ok(!/"fonte"|autorizacao_publicacao|preco/i.test(idx), 'índice sem campos internos');
});

await t('Publicação', 'categorias sem produtos publicados não são exibidas', async () => {
  const r = await fetch(`${BASE}/categorias/acessorios-e-outros/`);
  assert.equal(r.status, 404);
  const html = await (await fetch(`${BASE}/categorias/`)).text();
  assert.ok(!html.includes('/categorias/acessorios-e-outros/'));
});

await t('404', 'URL inválida exibe página 404 personalizada com busca e noindex', async () => {
  const p = await page();
  const r = await p.goto(BASE + '/produtos/nao-existe/');
  assert.equal(r.status(), 404);
  assert.match(await p.textContent('h1'), /Página não encontrada/);
  assert.ok(await p.isVisible('#busca-404'));
  assert.match(await p.getAttribute('meta[name=robots]', 'content'), /noindex/);
  await p.context().close();
});

await t('SEO', 'sitemap.xml válido com páginas, categorias, soluções e produtos publicados', async () => {
  const xml = await (await fetch(BASE + '/sitemap.xml')).text();
  assert.match(xml, /^<\?xml/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const p of index.produtos) assert.ok(locs.includes(p.url), p.url);
  for (const m of MAIN) assert.ok(locs.includes(m), m);
  assert.ok(!locs.some((l) => /pendente|rascunho|inativo|404/.test(l)));
  const robots = await (await fetch(BASE + '/robots.txt')).text();
  assert.ok(/Disallow: \/|Sitemap:/.test(robots));
});

// ---------------------------------------------------------------- 26. Metadados SEO
await t('SEO', 'títulos únicos, description, canonical, Open Graph e dados estruturados válidos', async () => {
  const p = await page();
  const titles = new Set();
  for (const path of [...MAIN, PRODUCT, `/categorias/${firstCat.slug}/`, '/solucoes/upa/']) {
    await p.goto(BASE + path);
    const title = await p.title();
    assert.ok(!titles.has(title), `título duplicado ${title}`); titles.add(title);
    assert.ok(title.length <= 90, `título longo em ${path}: ${title.length}`);
    const desc = await p.getAttribute('meta[name=description]', 'content');
    assert.ok(desc.length >= 50 && desc.length <= 170, `description em ${path}: ${desc.length}`);
    assert.ok((await p.getAttribute('link[rel=canonical]', 'href')).endsWith(path));
    assert.ok(await p.getAttribute('meta[property="og:image"]', 'content'));
    const lds = await p.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)));
    if (path === PRODUCT) {
      const prodLd = lds.find((l) => l['@type'] === 'Product');
      assert.ok(prodLd, 'Product');
      assert.ok(!prodLd.offers && !prodLd.aggregateRating && !prodLd.review, 'sem ofertas/avaliações fictícias');
      assert.ok(lds.some((l) => l['@type'] === 'BreadcrumbList'));
    }
    if (path === '/') assert.ok(lds.some((l) => l['@type'] === 'Organization'));
    const hs = await p.$$eval('h1, h2, h3', (h) => h.map((x) => Number(x.tagName[1])));
    for (let i = 1; i < hs.length; i++) assert.ok(hs[i] - hs[i - 1] <= 1, `salto de cabeçalho em ${path}: h${hs[i - 1]}→h${hs[i]}`);
  }
  await p.context().close();
});

// ---------------------------------------------------------------- 27. Responsividade
const WIDTHS = [360, 390, 768, 1024, 1440];
await t('Responsividade', `sem rolagem horizontal em ${WIDTHS.join(', ')} px nas páginas principais`, async () => {
  const problems = [];
  for (const w of WIDTHS) {
    const p = await page({ viewport: { width: w, height: 900 } });
    for (const path of [...MAIN, PRODUCT, `/categorias/${firstCat.slug}/`, '/solucoes/hospitais/', '/rota-inexistente/']) {
      await p.goto(BASE + path);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) problems.push(`${w}px ${path}: +${over}px`);
    }
    await p.context().close();
  }
  assert.deepEqual(problems, []);
});

await t('Responsividade', 'áreas de toque dos botões principais com pelo menos 44 px no celular', async () => {
  const p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(BASE + PRODUCT);
  const small = await p.$$eval('.product__cta .btn, .site-header .icon-btn, .wa-float', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.className));
  assert.deepEqual(small, []);
  await p.context().close();
});

// ---------------------------------------------------------------- 28. Acessibilidade (axe-core, WCAG 2.2 AA)
const a11yReport = [];
await t('Acessibilidade', 'axe-core (WCAG 2.0/2.1/2.2 A e AA) sem violações sérias ou críticas', async () => {
  const issues = [];
  for (const [w, paths] of [[1440, [...MAIN, PRODUCT, `/categorias/${firstCat.slug}/`, '/solucoes/ubs/', '/rota-inexistente/']], [390, ['/', '/produtos/', PRODUCT]]]) {
    const p = await page({ viewport: { width: w, height: 900 } });
    for (const path of paths) {
      await p.goto(BASE + path);
      await p.addScriptTag({ content: axeSource });
      const r = await p.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
      for (const v of r.violations) {
        a11yReport.push({ path, width: w, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
        if (['serious', 'critical'].includes(v.impact)) issues.push(`${w}px ${path}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`);
      }
    }
    await p.context().close();
  }
  assert.deepEqual(issues, []);
});

await t('Acessibilidade', 'navegação por teclado: link "pular para o conteúdo" e foco visível', async () => {
  const p = await page();
  await p.goto(BASE + '/');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.className), 'skip-link');
  const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none');
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'conteudo');
  await p.context().close();
});

// ---------------------------------------------------------------- 30-31. Segurança e privacidade
await t('Segurança', 'sem mensuração ativa sem identificadores/consentimento e sem requisições a terceiros', async () => {
  const p = await page();
  const external = [];
  p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) external.push(r.url()); });
  for (const path of ['/', PRODUCT, '/produtos/']) await p.goto(BASE + path, { waitUntil: 'networkidle' });
  assert.deepEqual(external, []);
  assert.equal(await p.evaluate(() => typeof window.gtag), 'undefined');
  assert.equal(await p.locator('[data-consent]').count(), 0);
  await p.context().close();
});

await t('Segurança', 'arquivos internos (planilha, relatórios, .env) não são publicados', async () => {
  for (const f of ['/data/catalog/produtos.csv', '/produtos.csv', '/catalog-report.json', '/.env', '/src/config/site.json', '/package.json']) {
    assert.equal((await fetch(BASE + f)).status, 404, f);
  }
  assert.ok(existsSync(resolve(dist, '_headers')), 'cabeçalhos de segurança');
});

await t('Segurança', 'conteúdo do catálogo é exibido como texto (sem HTML injetado)', async () => {
  const html = await (await fetch(BASE + PRODUCT)).text();
  assert.ok(!/<script>alert/i.test(html));
  const scripts = (html.match(/<script\b/g) || []).length;
  assert.ok(scripts < 10, `scripts na página: ${scripts}`);
});

// ---------------------------------------------------------------- Capturas
if (process.env.CAPTURAS !== '0') {
  await t('Capturas', 'gera capturas desktop (1440) e mobile (iPhone 13 / 390)', async () => {
    const shots = [['inicio', '/'], ['catalogo', '/produtos/'], ['produto', PRODUCT], ['categoria', `/categorias/${firstCat.slug}/`], ['solucao-ubs', '/solucoes/ubs/'], ['atas', '/atas/'], ['como-comprar', '/como-comprar/'], ['contato', '/contato/'], ['404', '/rota-inexistente/']];
    const desk = await page({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    for (const [n, path] of shots) { await desk.goto(BASE + path, { waitUntil: 'networkidle' }); await desk.screenshot({ path: `${capDir}/desktop-${n}.png`, fullPage: n === 'inicio' }); }
    await desk.context().close();
    const mob = await page({ ...playwright.devices['iPhone 13'] });
    for (const [n, path] of shots) { await mob.goto(BASE + path, { waitUntil: 'networkidle' }); await mob.screenshot({ path: `${capDir}/mobile-${n}.png` }); }
    await mob.click('[data-menu-toggle]'); await mob.screenshot({ path: `${capDir}/mobile-menu-aberto.png` });
    await mob.goto(`${BASE}/produtos/`); await mob.waitForSelector('[data-catalog][data-ready]');
    await mob.click('[data-filters-open]'); await mob.waitForTimeout(400); await mob.screenshot({ path: `${capDir}/mobile-filtros.png` });
    await mob.goto(`${BASE}/`); await mob.$eval('.home-search', (e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 80)); await mob.fill('#busca-home', 'cama'); await mob.waitForSelector('#busca-home-lista:not([hidden]) li'); await mob.waitForTimeout(200);
    await mob.screenshot({ path: `${capDir}/mobile-busca-sugestoes.png` });
    await mob.context().close();
  });
}

await browser.close();
server.close();

// ---------------------------------------------------------------- Relatório
const ok = results.filter((r) => r.ok).length;
const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const md = [
  '# Relatório de testes ponta a ponta', '',
  `Executado em ${date} (America/Sao_Paulo), Chromium ${browser.version?.() ?? ''} via Playwright, sobre o build estático de \`dist/\`.`, '',
  `**Resultado: ${ok} de ${results.length} testes aprovados.**`, '',
  '| Grupo | Teste | Resultado | Tempo |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.group} | ${r.name.replace(/\|/g, '\\|')} | ${r.ok ? '✅ aprovado' : '❌ ' + r.error.replace(/\|/g, '\\|')} | ${r.ms} ms |`),
  '', '## Achados do axe-core (todas as severidades)', '',
  a11yReport.length ? ['| Página | Largura | Regra | Impacto | Ocorrências |', '|---|---|---|---|---|', ...a11yReport.map((a) => `| ${a.path} | ${a.width} | ${a.id} — ${a.help} | ${a.impact} | ${a.nodes} |`)].join('\n') : 'Nenhuma violação encontrada nas páginas auditadas.',
  '',
].join('\n');
writeFileSync(resolve(repDir, 'relatorio-testes-e2e.md'), md);
console.log(`\n${ok}/${results.length} testes aprovados. Relatório: docs/relatorios/relatorio-testes-e2e.md`);
process.exit(ok === results.length ? 0 : 1);
