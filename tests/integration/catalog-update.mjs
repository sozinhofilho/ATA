#!/usr/bin/env node
// Teste de integração: simula a rotina de atualização do catálogo pelo proprietário.
// Copia o projeto para uma pasta temporária, altera a planilha (inclui, edita e inativa produtos),
// executa o build completo e confere o site gerado. Também confirma a trava do build de produção.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, symlinkSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseCsv, toCsv } from '../../scripts/lib/csv.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'nexus-int-'));
cpSync(root, work, { recursive: true, filter: (src) => !/\/(node_modules|dist|\.git|\.astro|docs\/capturas)(\/|$)/.test(src.slice(root.length)) });
symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'));
const run = (cmd, env = {}) => spawnSync('npm', ['run', cmd], { cwd: work, encoding: 'utf8', env: { ...process.env, ...env } });
const results = [];
const t = (name, fn) => { try { fn(); results.push([name, true]); console.log(`  ✔ ${name}`); } catch (e) { results.push([name, false, e.message]); console.log(`  ✖ ${name}\n     ${e.message.split('\n')[0]}`); } };

try {
  // 1) altera a planilha: novo produto, renomeia um existente e inativa outro, e inclui coluna privada
  const csvPath = join(work, 'data/catalog/produtos.csv');
  const { header, records } = parseCsv(readFileSync(csvPath, 'utf8'));
  const cols = [...header, 'preco_interno'];
  const novo = { ...records[0], id: 'NX-TESTE-900', slug: '', nome: 'Foco clínico de LED (teste)', categoria: 'Acessórios e outros equipamentos', subcategoria: 'Equipamentos complementares', renem: '99999', destaque: 'nao', relacionados: '', imagens_adicionais: '', sinonimos: 'luminária clínica', preco_interno: 'R$ 1.234,56' };
  const editado = records.find((r) => r.id === 'NX-DEMO-012'); editado.nome = 'Monitor multiparamétrico de 12 polegadas';
  const inativado = records.find((r) => r.id === 'NX-DEMO-027'); inativado.status = 'inativo';
  const vinculado = records.find((r) => r.id === 'NX-DEMO-001'); vinculado.disponibilidade_ata = 'confirmada'; vinculado.referencia_ata = 'ATA-TESTE-1';
  writeFileSync(csvPath, toCsv(cols, [...records, novo], ';')); // exportação com ponto e vírgula (Excel/Planilhas pt-BR)
  // atas de teste: uma vigente e publicada, uma vencida (não deve aparecer)
  const ata = (id, numero, fim) => ({ id, numero, orgaoGerenciador: 'Órgão Gerenciador de Teste', uf: 'MG', fornecedorBeneficiario: 'Fornecedor de Teste', objeto: 'Mobiliário hospitalar', categorias: ['mobiliario-hospitalar'], vigenciaInicio: '2026-01-10', vigenciaFim: fim, situacaoAdesao: 'Prevê adesões; saldo a confirmar', linkOficial: 'https://www.gov.br/pncp/pt-br', dataConferencia: '2026-11-20', publicar: true });
  writeFileSync(join(work, 'src/data/atas.json'), JSON.stringify({ atas: [ata('ATA-TESTE-1', '12/2026', '2099-01-09'), ata('ATA-VENCIDA', '01/2020', '2021-01-01')] }, null, 2));

  const b = run('build');
  t('build após atualização da planilha conclui sem erros', () => assert.equal(b.status, 0, b.stderr.slice(-800)));
  const dist = join(work, 'dist');
  const idx = JSON.parse(readFileSync(join(dist, 'indice-busca.json'), 'utf8'));
  t('produto novo ganha página própria e slug gerado automaticamente', () => assert.ok(existsSync(join(dist, 'produtos/foco-clinico-de-led-teste/index.html'))));
  t('produto novo entra no índice de busca e no sitemap', () => {
    assert.ok(idx.produtos.some((p) => p.id === 'NX-TESTE-900' && p.renem === '99999'));
    assert.match(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), /foco-clinico-de-led-teste/);
  });
  t('categoria antes vazia passa a ser publicada', () => assert.ok(existsSync(join(dist, 'categorias/acessorios-e-outros/index.html'))));
  t('alteração de nome reflete na página e no índice', () => {
    assert.ok(idx.produtos.some((p) => p.nome === 'Monitor multiparamétrico de 12 polegadas'));
    assert.ok(existsSync(join(dist, 'produtos/monitor-multiparametrico-de-12-polegadas/index.html')));
  });
  t('produto inativado sai do site', () => {
    assert.ok(!idx.produtos.some((p) => p.id === 'NX-DEMO-027'));
    assert.ok(!existsSync(join(dist, 'produtos/estetoscopio/index.html')));
  });
  t('coluna privada (preço interno) não é publicada', () => {
    const all = spawnSync('grep', ['-rl', '1.234,56', dist], { encoding: 'utf8' }).stdout.trim();
    assert.equal(all, '');
  });

  t('ata vigente e publicada aparece na página de atas; ata vencida não', () => {
    const html = readFileSync(join(dist, 'atas/index.html'), 'utf8');
    assert.match(html, /Ata nº 12\/2026/); assert.match(html, /Fonte oficial/);
    assert.ok(!html.includes('01/2020'));
  });
  t('produto vinculado a ata vigente exibe "Disponível para consulta em ata"', () => {
    const html = readFileSync(join(dist, 'produtos/cama-hospitalar-tipo-fowler/index.html'), 'utf8');
    assert.match(html, /Disponível para consulta em ata/); assert.match(html, /Ata nº 12\/2026/);
    const outro = readFileSync(join(dist, 'produtos/carro-maca-simples/index.html'), 'utf8');
    assert.ok(!/Disponível para consulta em ata/.test(outro));
  });

  // 2) erro de validação interrompe o build (protege a publicação)
  writeFileSync(csvPath, readFileSync(csvPath, 'utf8').replace('99999', '9A999'));
  const bad = run('build');
  t('erro na planilha (RENEM inválido) bloqueia o build', () => { assert.notEqual(bad.status, 0); assert.match(bad.stderr + bad.stdout, /renem deve conter apenas números/); });

  // 3) trava de produção com dados demonstrativos/provisórios
  const prod = run('build', { SITE_MODE: 'production' });
  t('build de produção é bloqueado com produtos demonstrativos e dados provisórios', () => { assert.notEqual(prod.status, 0); assert.match(prod.stderr + prod.stdout, /DEMONSTRATIVO|PRODUÇÃO bloqueado/); });
} finally {
  rmSync(work, { recursive: true, force: true });
}
const ok = results.filter((r) => r[1]).length;
console.log(`\n${ok}/${results.length} verificações de integração aprovadas.`);
writeFileSync(join(root, 'docs/relatorios/relatorio-integracao-catalogo.md'), ['# Integração: atualização do catálogo', '', `Executado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Resultado: **${ok}/${results.length}**.`, '', '| Verificação | Resultado |', '|---|---|', ...results.map((r) => `| ${r[0]} | ${r[1] ? '✅' : '❌ ' + r[2]} |`), ''].join('\n'));
process.exit(ok === results.length ? 0 : 1);
