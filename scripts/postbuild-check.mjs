#!/usr/bin/env node
// Verificações automáticas sobre a pasta dist/ gerada:
// 1) links e recursos internos existem; 2) metadados SEO básicos; 3) ausência de dados confidenciais;
// 4) em produção, ausência de conteúdo demonstrativo/provisório.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.env.DIST_DIR || 'dist');
const production = process.env.SITE_MODE === 'production';
const errors = [];
const warnings = [];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const textFiles = files.filter((f) => /\.(html|js|json|xml|txt|css|webmanifest)$/.test(f));

function resolveInternal(url) {
  const clean = decodeURIComponent(url.split('#')[0].split('?')[0]);
  if (!clean) return true;
  const p = join(dist, clean);
  return existsSync(p) && statSync(p).isFile() ? true : existsSync(join(p, 'index.html'));
}

// 1 + 2: links e SEO
let linkCount = 0;
for (const f of htmlFiles) {
  const rel = '/' + relative(dist, f).replace(/index\.html$/, '');
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
    const url = m[1];
    if (url.startsWith('//')) continue;
    linkCount++;
    if (!resolveInternal(url)) errors.push(`link interno quebrado em ${rel}: ${url}`);
  }
  if (rel === '/404.html') continue;
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${rel}: ${h1} elementos <h1> (esperado 1)`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) errors.push(`${rel}: <title> ausente ou curto`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (desc.length < 50) errors.push(`${rel}: meta description ausente ou curta`);
  else if (desc.replace(/&[a-z#0-9]+;/g, 'x').length > 170) warnings.push(`${rel}: meta description com mais de 170 caracteres`);
  if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) errors.push(`${rel}: canonical ausente`);
  if (!/<html lang="pt-BR"/.test(html)) errors.push(`${rel}: atributo lang ausente`);
  for (const img of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(img[0])) errors.push(`${rel}: imagem sem atributo alt`);
}
// títulos duplicados
const titles = new Map();
for (const f of htmlFiles) {
  const t = readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)?.[1];
  if (!t) continue;
  if (titles.has(t)) warnings.push(`título duplicado: "${t}" (${relative(dist, f)} e ${titles.get(t)})`);
  else titles.set(t, relative(dist, f));
}

// 3: dados confidenciais
const SECRET_PATTERNS = [
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, 'CPF'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'chave AWS'],
  [/\b(sk|pk)_(live|test)_[0-9a-zA-Z]{10,}/, 'chave de API'],
  [/\bghp_[0-9a-zA-Z]{30,}/, 'token GitHub'],
  [/AIza[0-9A-Za-z\-_]{35}/, 'chave Google API'],
  [/preco_interno|margem_|comissao|comissão|conta[_ ]corrente|ag[eê]ncia banc/i, 'campo comercial interno'],
  [/contrato n[ºo°]?\s*147\/2026/i, 'referência ao contrato confidencial'],
];
for (const f of textFiles) {
  const txt = readFileSync(f, 'utf8');
  for (const [re, label] of SECRET_PATTERNS) if (re.test(txt)) errors.push(`possível dado confidencial (${label}) em ${relative(dist, f)}`);
}
for (const f of files) if (/\.(csv|xlsx|env)$|produtos\.csv|catalog-report/.test(f)) errors.push(`arquivo interno publicado: ${relative(dist, f)}`);

// 4: produção sem conteúdo provisório
if (production) {
  const PROVISIONAL = [/badge--demo/, /homolog-bar/, /placeholder-field/, /nexushospitalar\.example/, /wa\.me\/5500000000000/, /class="pending"/];
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8');
    for (const re of PROVISIONAL) if (re.test(html)) errors.push(`conteúdo provisório (${re.source}) em ${relative(dist, f)}`);
  }
}

// sitemap
const sitemap = existsSync(join(dist, 'sitemap.xml')) ? readFileSync(join(dist, 'sitemap.xml'), 'utf8') : '';
const sitemapUrls = (sitemap.match(/<loc>/g) || []).length;
if (!sitemapUrls) errors.push('sitemap.xml ausente ou vazio');

console.log(`Verificação pós-build: ${htmlFiles.length} páginas HTML, ${linkCount} links/recursos internos, ${sitemapUrls} URLs no sitemap.`);
for (const w of warnings) console.log(`   ⚠ ${w}`);
if (errors.length) {
  console.error(`✖ ${errors.length} problema(s):`);
  for (const e of errors.slice(0, 60)) console.error(`   ✖ ${e}`);
  process.exit(1);
}
console.log('✔ Nenhum link quebrado, metadados presentes e nenhum dado confidencial detectado.');
