#!/usr/bin/env node
// Importa a planilha de produtos (CSV exportado do Google Planilhas ou Excel),
// valida, normaliza e gera src/data/generated/products.json, usado pelo site.
//
// Uso:
//   npm run catalog                      -> lê data/catalog/produtos.csv
//   node scripts/import-catalog.mjs arquivo.csv
//   CATALOG_CSV=arquivo.csv npm run build
//   SITE_MODE=production ...             -> bloqueia produtos demonstrativos

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { buildCatalog, PRIVATE_COLUMN_PATTERN, COLUMN_NAMES, slugify } from './lib/catalog-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = resolve(root, process.argv[2] || process.env.CATALOG_CSV || 'data/catalog/produtos.csv');
const outDir = resolve(root, process.env.CATALOG_OUT_DIR || 'src/data/generated');
const atasPath = resolve(root, process.env.ATAS_FILE || 'src/data/atas.json');
const mode = process.env.SITE_MODE === 'production' ? 'production' : 'homologacao';
const today = process.env.CATALOG_TODAY || new Date().toISOString().slice(0, 10);

if (!existsSync(csvPath)) {
  console.error(`✖ Planilha não encontrada: ${csvPath}`);
  process.exit(1);
}

const categories = JSON.parse(readFileSync(resolve(root, 'src/data/categories.json'), 'utf8'));
const atasFile = JSON.parse(readFileSync(atasPath, 'utf8'));
const atas = atasFile.atas ?? [];
const { header, records } = parseCsv(readFileSync(csvPath, 'utf8'));

const privateCols = header.filter((h) => !COLUMN_NAMES.includes(slugify(h).replace(/-/g, '_')) && PRIVATE_COLUMN_PATTERN.test(h));
const result = buildCatalog(records, { categories, atas, mode, today });

mkdirSync(outDir, { recursive: true });
// Com erros, o catálogo publicado anteriormente é mantido (não é sobrescrito).
if (!result.errors.length) writeFileSync(resolve(outDir, 'products.json'), JSON.stringify(result.products, null, 2) + '\n');
writeFileSync(
  resolve(outDir, 'catalog-report.json'),
  JSON.stringify({ geradoEm: new Date().toISOString(), modo: mode, origem: csvPath.replace(root + '/', ''), total: result.total, porStatus: result.counts, publicados: result.products.length, demonstrativos: result.products.filter((p) => p.demonstrativo).length, colunasPrivadasDescartadas: privateCols, avisos: result.warnings, erros: result.errors }, null, 2) + '\n',
);

console.log(`Catálogo: ${result.total} linha(s) lidas de ${csvPath.replace(root + '/', '')}`);
console.log(`  por status: ${Object.entries(result.counts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(`  publicados no site: ${result.products.length} (demonstrativos: ${result.products.filter((p) => p.demonstrativo).length})`);
if (privateCols.length) console.log(`  colunas privadas descartadas: ${privateCols.join(', ')}`);
if (result.warnings.length) {
  console.log(`  ${result.warnings.length} aviso(s):`);
  for (const w of result.warnings.slice(0, 40)) console.log(`   ⚠ ${w}`);
}
if (result.errors.length) {
  console.error(`✖ ${result.errors.length} erro(s) no catálogo:`);
  for (const e of result.errors) console.error(`   ✖ ${e}`);
  process.exit(1);
}
console.log('✔ Catálogo gerado em ' + resolve(outDir, 'products.json').replace(root + '/', ''));
