import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog, normalizeRow, slugify, parseSpecs, parseDate, isSafeUrl, cleanText } from '../../scripts/lib/catalog-core.mjs';

const categories = JSON.parse(readFileSync(new URL('../../src/data/categories.json', import.meta.url)));
const base = (o = {}) => ({ __linha: 2, id: 'T-1', nome: 'Cama Fowler', categoria: 'mobiliario-hospitalar', status: 'publicado', autorizacao_publicacao: 'sim', descricao_resumida: 'Teste', ...o });

test('slugify remove acentos e caracteres especiais', () => {
  assert.equal(slugify('Mesa Ginecológica — Aço Inox (2 gavetas)'), 'mesa-ginecologica-aco-inox-2-gavetas');
  assert.equal(slugify('Sofás & Poltronas'), 'sofas-e-poltronas');
});

test('cleanText remove HTML e caracteres de controle (proteção contra injeção)', () => {
  assert.equal(cleanText('<script>alert(1)</script>Cama <b>Fowler</b>\u0007'), 'alert(1)Cama Fowler');
});

test('apenas URLs seguras são aceitas', () => {
  assert.ok(isSafeUrl('/images/produtos/cama.webp'));
  assert.ok(isSafeUrl('ilustracao:cama'));
  assert.ok(isSafeUrl('https://fabricante.com.br/ficha.pdf'));
  assert.ok(!isSafeUrl('javascript:alert(1)'));
  assert.ok(!isSafeUrl('/../segredo'));
  assert.ok(!isSafeUrl('http://inseguro.com/x.pdf'));
  assert.ok(!isSafeUrl('//evil.com/x'));
});

test('especificações e datas são normalizadas', () => {
  assert.deepEqual(parseSpecs('Altura: 50 cm | Largura: 90 cm | inválido'), [{ label: 'Altura', value: '50 cm' }, { label: 'Largura', value: '90 cm' }]);
  assert.equal(parseDate('05/03/2026'), '2026-03-05');
  assert.equal(parseDate('2026-03-05'), '2026-03-05');
  assert.equal(parseDate('ontem'), null);
});

test('aceita categoria por nome e subcategoria por nome', () => {
  const { product, errors } = normalizeRow(base({ categoria: 'Mobiliário hospitalar', subcategoria: 'Camas Fowler' }), { categories });
  assert.deepEqual(errors, []);
  assert.equal(product.categoria, 'mobiliario-hospitalar');
  assert.equal(product.subcategoria, 'camas-fowler');
  assert.equal(product.slug, 'cama-fowler');
});

test('somente status "publicado" com autorização aparece no site', () => {
  const rows = [
    base({ id: 'A' }),
    base({ id: 'B', nome: 'Rascunho', status: 'rascunho' }),
    base({ id: 'C', nome: 'Pendente', status: 'Pendente de validação comercial' }),
    base({ id: 'D', nome: 'Inativo', status: 'inativo' }),
  ];
  const r = buildCatalog(rows, { categories });
  assert.deepEqual(r.products.map((p) => p.id), ['A']);
  assert.deepEqual(r.counts, { rascunho: 1, pendente: 1, publicado: 1, inativo: 1 });
});

test('publicado sem autorização de publicação gera erro e não é exibido', () => {
  const r = buildCatalog([base({ autorizacao_publicacao: 'nao' })], { categories });
  assert.equal(r.products.length, 0);
  assert.ok(r.errors.some((e) => e.includes('autorizacao_publicacao')));
});

test('colunas privadas (preço, margem, comissão) nunca chegam aos dados publicados', () => {
  const r = buildCatalog([base({ preco_interno: '1000', margem: '20%', comissao: '5%', fonte: 'Contrato X' })], { categories });
  const json = JSON.stringify(r.products);
  assert.ok(!json.includes('1000') && !json.includes('20%') && !json.includes('Contrato X'));
  assert.ok(r.warnings.some((w) => w.includes('colunas ignoradas')));
});

test('produtos demonstrativos bloqueiam o modo produção', () => {
  const ok = buildCatalog([base({ demonstrativo: 'sim' })], { categories, mode: 'homologacao' });
  assert.equal(ok.errors.length, 0);
  const prod = buildCatalog([base({ demonstrativo: 'sim' })], { categories, mode: 'production' });
  assert.ok(prod.errors.some((e) => e.includes('DEMONSTRATIVO')));
});

test('IDs duplicados geram erro; slugs repetidos recebem sufixo', () => {
  const dup = buildCatalog([base(), base()], { categories });
  assert.ok(dup.errors.some((e) => e.includes('ID duplicado')));
  const slug = buildCatalog([base({ id: 'X1' }), base({ id: 'X2' })], { categories });
  assert.deepEqual(slug.products.map((p) => p.slug), ['cama-fowler', 'cama-fowler-2']);
});

test('RENEM/CATMAT aceitam apenas números; categoria desconhecida gera erro', () => {
  const r = buildCatalog([base({ renem: '19A1' }), base({ id: 'Z', categoria: 'inexistente' })], { categories });
  assert.ok(r.errors.some((e) => e.includes('renem')));
  assert.ok(r.errors.some((e) => e.includes('categoria desconhecida')));
});

test('indicador de ata só com ata publicada e vigente', () => {
  const atas = [
    { id: 'ATA-OK', publicar: true, vigenciaFim: '2027-12-31' },
    { id: 'ATA-VENCIDA', publicar: true, vigenciaFim: '2025-01-01' },
    { id: 'ATA-NAO-PUB', publicar: false, vigenciaFim: '2027-12-31' },
  ];
  const rows = ['ATA-OK', 'ATA-VENCIDA', 'ATA-NAO-PUB', 'INEXISTENTE'].map((ref, i) => base({ id: `P${i}`, nome: `P${i}`, disponibilidade_ata: 'confirmada', referencia_ata: ref }));
  const r = buildCatalog(rows, { categories, atas, today: '2026-11-25' });
  assert.deepEqual(r.products.map((p) => p.ata_confirmada), [true, false, false, false]);
});

test('relacionados não publicados são removidos', () => {
  const r = buildCatalog([base({ id: 'A', relacionados: 'B|C' }), base({ id: 'B', nome: 'B' }), base({ id: 'C', nome: 'C', status: 'rascunho' })], { categories });
  assert.deepEqual(r.products.find((p) => p.id === 'A').relacionados, ['B']);
});

test('sem imagem: usa ilustração da categoria', () => {
  const { product } = normalizeRow(base({ categoria: 'macas-e-transporte' }), { categories });
  assert.equal(product.imagem_principal, 'ilustracao:maca');
});

test('a planilha de exemplo do projeto é válida', async () => {
  const { parseCsv } = await import('../../scripts/lib/csv.mjs');
  const { records } = parseCsv(readFileSync(new URL('../../data/catalog/produtos.csv', import.meta.url), 'utf8'));
  const r = buildCatalog(records, { categories });
  assert.deepEqual(r.errors, []);
  assert.ok(r.products.length >= 30);
  assert.ok(r.products.every((p) => p.status === 'publicado'));
  assert.ok(!r.products.some((p) => /pendente|rascunho|inativo/.test(p.nome)));
});
