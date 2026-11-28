/** Testes unitários offline (sem rede). Uso: TZ=America/Sao_Paulo node test/unit.js */
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ctx = { console, Date, JSON, Math, RegExp, Object, Array, String, Number, Utilities: { formatDate: (d) => d.toISOString().slice(0, 10).replace(/-/g, '') } };
vm.createContext(ctx);
for (const f of ['Config', 'CatalogData', 'Catalog', 'Classify', 'Pncp', 'Store']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script', f + '.gs'), 'utf8'), ctx);
const m = ctx.buildMatcher(ctx.defaultCatalogRows_().map((v, i) => ({ id: v[0], categoria: v[1], produto: v[2], renem: v[3], catmat: v[2] === 'Cama Hospitalar' ? '123456' : '',
  sinonimos: v[7], palavras: v[8], ativo: true, exigeSaude: v[13] === 'SIM' })));
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('ok -', name); };
const prods = (s, code) => ctx.matchProducts(m, s, code, false).map(h => h.row.produto);

t('sinônimos e plural', () => {
  assert.deepStrictEqual(prods('Aquisição de CAMAS FOWLER'), ['Cama Hospitalar']);
  assert.deepStrictEqual(prods('suportes para soro'), ['Suporte de Soro']);
  assert.deepStrictEqual(prods('Monitor multiparamétrico de sinais vitais'), ['Monitor Multiparâmetros']);
  assert.ok(prods('DEA - desfibrilador externo automático').includes('DEA - Desfibrilador Externo Automático'));
  assert.deepStrictEqual(prods('poltrona de acompanhante reclinável'), ['Poltrona Hospitalar']);
  assert.deepStrictEqual(prods('Berços aquecidos'), ['Berço Aquecido']);
  assert.deepStrictEqual(prods('Esfigmomanômetro infantil'), ['Esfigmomanômetro']);
  assert.deepStrictEqual(prods('Cadeira de rodas para obeso'), ['Cadeira de Rodas']);
});
t('nível 1 por nome do produto e por CATMAT', () => {
  assert.strictEqual(ctx.matchProducts(m, 'cama hospitalar elétrica')[0].level, 1);
  assert.strictEqual(ctx.matchProducts(m, 'item qualquer', '123456')[0].level, 1);
  assert.strictEqual(ctx.matchProducts(m, 'cama fowler')[0].level, 2);
  assert.strictEqual(ctx.matchProducts(m, 'Cama Hospitalar Tipo Fawler Mecânica')[0].row.renem, '765; 1002; 1981');
});
t('catálogo RENEM: 840 itens, produtos genéricos exigem contexto de saúde', () => {
  const codes = ctx.RENEM_CATALOG.reduce((a, r) => a.concat(r[3] ? r[3].split('; ') : []), []);
  assert.strictEqual(codes.length, 840);
  // computador / ar-condicionado / cadeira só contam em contratação da saúde
  assert.deepStrictEqual(ctx.matchProducts(m, 'Aquisição de computadores e ar condicionado', '', false).map(h => h.row.produto), []);
  assert.ok(ctx.matchProducts(m, 'Aquisição de computadores', '', true).length);
  assert.ok(!ctx.preClassify(m, 'Aquisição de cadeiras para a Secretaria de Educação', 'MUNICIPIO DE X').hits.length);
  assert.ok(ctx.preClassify(m, 'Aquisição de cadeiras e armários para UBS', 'MUNICIPIO DE X').hits.length >= 2);
  // com equipamento de saúde no mesmo processo, o genérico também conta
  assert.strictEqual(ctx.matchProducts(m, 'camas hospitalares e televisores', '', false).length, 2);
});
t('falsos positivos', () => {
  assert.deepStrictEqual(prods('maçã gala para merenda escolar'), []);
  assert.deepStrictEqual(ctx.matchProducts(m, 'monitor de vídeo 24 polegadas', '', false), []);
  assert.deepStrictEqual(prods('incubadora de CO2 laboratório'), []);
  assert.deepStrictEqual(prods('balança de cozinha'), []);
  const pre = ctx.preClassify(m, 'Aquisição de equipamento veterinário - anestesia com ventilador mecânico', '');
  assert.ok(pre.excluded && !pre.hits.length);
  assert.ok(!ctx.preClassify(m, 'Aquisição de material de ocupação e subsídios', 'Prefeitura').contextual);
});
t('serviço e peças reduzem prioridade', () => {
  const pre = ctx.preClassify(m, 'Manutenção preventiva e corretiva de camas hospitalares', '');
  assert.ok(pre.service);
  const c = ctx.classifyOpportunity(pre, null, 'Licitação aberta', new Date(), new Date());
  assert.strictEqual(c.prioridade, 'Baixa');
  assert.ok(ctx.preClassify(m, 'Aquisição de peças para autoclave', '').parts);
  assert.ok(!ctx.preClassify(m, 'Aquisição de equipamentos e insumos para UBS: camas e macas', '').parts);
});
t('contextual exige saúde + equipamento; descartado se itens não batem', () => {
  const pre = ctx.preClassify(m, 'Aquisição de equipamentos e materiais permanentes', 'FUNDO MUNICIPAL DE SAUDE DE X');
  assert.ok(pre.contextual);
  const empty = []; empty._itemsChecked = true; empty._itemCount = 5;
  assert.strictEqual(ctx.classifyOpportunity(pre, empty, 'Licitação aberta', new Date(), new Date()).keep, false);
  const c = ctx.classifyOpportunity(pre, null, 'Licitação aberta', new Date(), new Date());
  assert.strictEqual(c.nivel, 3); assert.strictEqual(c.prioridade, 'Baixa');
});
t('prioridade alta = produto + aberta + recente', () => {
  const pre = ctx.preClassify(m, 'Aquisição de camas hospitalares', 'Município');
  assert.strictEqual(ctx.classifyOpportunity(pre, null, 'Licitação aberta', new Date(), new Date()).prioridade, 'Alta');
  assert.strictEqual(ctx.classifyOpportunity(pre, null, 'Licitação em julgamento', new Date(), new Date()).prioridade, 'Média');
  assert.strictEqual(ctx.classifyOpportunity(pre, null, 'Revogada', new Date(), new Date()).prioridade, 'Baixa');
});
t('itens gerais da RENEM (ar-condicionado, computador) em compra da saúde = prioridade média', () => {
  const pre = ctx.preClassify(m, 'Aquisição de ar condicionado e computadores para a UBS', 'MUNICIPIO DE X');
  assert.ok(pre.hits.length >= 2);
  assert.strictEqual(ctx.classifyOpportunity(pre, null, 'Licitação aberta', new Date(), new Date()).prioridade, 'Média');
  assert.deepStrictEqual(ctx.preClassify(m, 'Aquisição de telha trapézio para serviços urbanos', 'MUNICIPIO DE X').hits, []);
});
t('situação interpretada (aberta, julgamento, concluída, cancelada, revogada, suspensa)', () => {
  const now = new Date(2026, 10, 25, 12);
  const f = (o) => ctx.interpretStatus(Object.assign({ situacaoId: 1, prazo: null, valorHomologado: null }, o), now);
  assert.strictEqual(f({ prazo: new Date(2026, 11, 1) }), 'Licitação aberta');
  assert.strictEqual(f({ prazo: new Date(2026, 10, 20) }), 'Licitação em julgamento');
  assert.strictEqual(f({ prazo: new Date(2026, 10, 20), valorHomologado: 1000 }), 'Contratação concluída');
  assert.strictEqual(f({ situacaoId: 2 }), 'Revogada');
  assert.strictEqual(f({ situacaoId: 3 }), 'Cancelada');
  assert.strictEqual(f({ situacaoId: 4, prazo: new Date(2026, 11, 1) }), 'Situação a validar');
  assert.strictEqual(f({}), 'Situação a validar');
});
t('sanitização contra fórmulas', () => {
  assert.strictEqual(ctx.sanitize_('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
  assert.strictEqual(ctx.sanitize_('+55 48'), "'+55 48");
  assert.strictEqual(ctx.sanitize_('Aquisição'), 'Aquisição');
  assert.strictEqual(ctx.safeUrl_('javascript:alert(1)'), '');
  assert.strictEqual(ctx.safeUrl_('https://pncp.gov.br/app/editais/1/2026/3'), 'https://pncp.gov.br/app/editais/1/2026/3');
});
t('número de controle PNCP', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.parseControle_('PNCP-93235968000188-1-000246/2026'))), { cnpj: '93235968000188', seq: 246, ano: 2026 });
});
t('deduplicação, atualização e preservação de dados manuais', () => {
  const store = { rows: [], index: {}, dirty: false };
  const raw = { numeroControlePNCP: '11111111000111-1-000010/2026', anoCompra: 2026, sequencialCompra: 10, orgaoEntidade: { cnpj: '11111111000111', razaoSocial: 'MUNICIPIO X' },
    unidadeOrgao: { ufSigla: 'SC', municipioNome: 'X', codigoIbge: '4200000' }, objetoCompra: 'Aquisição de camas hospitalares', valorTotalEstimado: 1000,
    situacaoCompraId: 1, situacaoCompraNome: 'Divulgada no PNCP', dataPublicacaoPncp: '2026-11-20T10:00:00', dataAtualizacaoGlobal: '2026-11-20T10:00:00', dataEncerramentoProposta: '2026-12-10T09:00:00', modalidadeNome: 'Pregão - Eletrônico' };
  const now = new Date(2026, 10, 25, 7);
  const run = (r, when) => { const rec = ctx.normalizeData(r); const pre = ctx.preClassify(m, rec.objeto, rec.orgao); const st = ctx.interpretStatus(rec, when);
    return ctx.upsertOpportunity_(store, rec, ctx.classifyOpportunity(pre, null, st, rec.publicado, when), null, st, when); };
  assert.strictEqual(run(raw, now), 'novo');
  store.rows[0][ctx.C['Observações manuais']] = 'liguei para a prefeitura';
  assert.strictEqual(run(raw, now), 'igual');
  assert.strictEqual(store.rows.length, 1);
  const later = new Date(2026, 10, 26, 7);
  assert.strictEqual(run(Object.assign({}, raw, { situacaoCompraId: 2, situacaoCompraNome: 'Revogada', dataAtualizacaoGlobal: '2026-11-25T15:00:00' }), later), 'atualizado');
  assert.strictEqual(store.rows.length, 1);
  const row = store.rows[0];
  assert.strictEqual(row[ctx.C['Situação interpretada']], 'Revogada');
  assert.strictEqual(row[ctx.C['Observações manuais']], 'liguei para a prefeitura');
  assert.strictEqual(row[ctx.C['Data de identificação']].getTime(), now.getTime());
  // processo distinto da mesma prefeitura NÃO é duplicado
  assert.strictEqual(run(Object.assign({}, raw, { numeroControlePNCP: '11111111000111-1-000011/2026', sequencialCompra: 11 }), later), 'novo');
  assert.strictEqual(store.rows.length, 2);
});
t('prazo vencido rebaixa "aberta" para "em julgamento" sem chamada externa', () => {
  const C = ctx.C; const row = new Array(ctx.COLS.length).fill('');
  row[C['Situação interpretada']] = 'Licitação aberta'; row[C['Prioridade']] = 'Alta'; row[C['Tipo de oportunidade']] = 'C — Licitação aberta';
  row[C['Prazo para propostas']] = new Date(2026, 10, 1);
  const store = { rows: [row], index: {}, dirty: false };
  assert.strictEqual(ctx.recomputeTimeStatus_(store, new Date(2026, 10, 25)), 1);
  assert.strictEqual(row[C['Situação interpretada']], 'Licitação em julgamento');
  assert.strictEqual(row[C['Prioridade']], 'Média');
});
console.log(`\n${ok} testes passaram.`);
