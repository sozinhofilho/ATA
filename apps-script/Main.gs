/**
 * Main.gs: instalação, motor de coleta com checkpoints, acionadores e menu.
 *
 * Fluxo diário (acionador ~1h antes da hora do relatório):
 *   1. collect  — publicações PNCP da janela de segurança (e, na 1ª vez, todas as propostas abertas)
 *   2. refresh  — reconsulta a situação das oportunidades em aberto
 *   3. finish   — atualiza abas, exporta Excel e envia o e-mail
 * Se o tempo de execução acabar (limite de 6 min do Google), salva o ponto de parada e agenda
 * a continuação automática em 1 minuto.
 */

var HANDLERS_ = ['startDailyScan', 'continueScan', 'safetyNet'];
var STATE_KEY_ = 'RUN_STATE';
var EXEC_START_ = Date.now();

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Nexus Radar')
    .addItem('Atualizar agora (sem e-mail)', 'updateNow')
    .addItem('Varredura completa + e-mail', 'runDailyScan')
    .addItem('Enviar e-mail de teste', 'sendTestEmail')
    .addItem('Testar fontes', 'testSources')
    .addSeparator()
    .addItem('Ativar automação diária', 'installTriggers')
    .addItem('Desativar automação diária', 'removeTriggers')
    .addSeparator()
    .addItem('Refazer carga inicial', 'resetCollection')
    .addToUi();
}

// ===================== Instalação =====================

function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || getSS_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone(NR.TZ);
  try { ss.setSpreadsheetLocale('pt_BR'); } catch (e) { /* opcional */ }
  if (ss.getName() !== NR.SPREADSHEET_NAME && /^(Planilha sem título|Untitled spreadsheet)/i.test(ss.getName())) ss.rename(NR.SPREADSHEET_NAME);

  var order = [NR.SHEETS.NOVAS, NR.SHEETS.ABERTAS, NR.SHEETS.HIST, NR.SHEETS.CAT, NR.SHEETS.CFG, NR.SHEETS.LOGS];
  order.forEach(function (name, i) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name, i);
    if (name === NR.SHEETS.CAT) setupHeader_(sh, CAT_COLS);
    else if (name === NR.SHEETS.CFG) setupHeader_(sh, ['Parâmetro', 'Valor', 'Descrição']);
    else if (name === NR.SHEETS.LOGS) setupHeader_(sh, LOG_COLS);
    else setupOpportunitySheet_(sh);
  });
  // Remove a aba padrão vazia criada pelo Google.
  ss.getSheets().forEach(function (sh) {
    if (order.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0 && ss.getSheets().length > 6) ss.deleteSheet(sh);
  });

  var cat = ss.getSheetByName(NR.SHEETS.CAT);
  if (cat.getLastRow() < 2) {
    var rows = defaultCatalogRows_();
    cat.getRange(2, 1, rows.length, CAT_COLS.length).setValues(rows);
    cat.setColumnWidth(3, 260); cat.setColumnWidth(8, 600);
  }
  var cfg = ss.getSheetByName(NR.SHEETS.CFG);
  var existing = cfg.getLastRow() > 1 ? cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  var add = CFG_DEFAULTS.filter(function (d) { return existing.indexOf(d[0]) < 0; });
  if (add.length) cfg.getRange(cfg.getLastRow() + 1, 1, add.length, 3).setValues(add);
  cfg.setColumnWidth(1, 260); cfg.setColumnWidth(2, 220); cfg.setColumnWidth(3, 620);
  ss.setActiveSheet(ss.getSheetByName(NR.SHEETS.NOVAS));
  var tz = Session.getScriptTimeZone();
  if (tz !== NR.TZ) {
    log_('', 'Sistema', 'setupSystem', '', 'ATENÇÃO', 'Fuso do projeto é ' + tz + '. Ajuste em Configurações do projeto para America/Sao_Paulo.');
    toast_('ATENÇÃO: ajuste o fuso horário do projeto Apps Script para (GMT-03:00) São Paulo.');
  }
  log_('', 'Sistema', 'setupSystem', '', 'OK', 'Planilha configurada (versão ' + NR.VERSION + ', fuso ' + tz + ')');
  toast_('Planilha configurada. Próximo passo: menu Nexus Radar > Atualizar agora.');
}

function setupHeader_(sh, cols) {
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1f3b57').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(1);
}

function setupOpportunitySheet_(sh) {
  setupHeader_(sh, COLS);
  var maxRows = sh.getMaxRows();
  var col = function (name) { return C[name] + 1; };
  ['Data de identificação', 'Data de publicação', 'Última atualização', 'Última verificação'].forEach(function (n) {
    sh.getRange(2, col(n), maxRows - 1, 1).setNumberFormat('dd/MM/yyyy');
  });
  sh.getRange(2, col('Prazo para propostas'), maxRows - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  ['Valor estimado da aquisição', 'Valor aprovado', 'Valor transferido'].forEach(function (n) {
    sh.getRange(2, col(n), maxRows - 1, 1).setNumberFormat('"R$" #,##0.00');
  });
  ['Código IBGE', 'CNPJ do órgão', 'Número de controle PNCP'].forEach(function (n) {
    sh.getRange(2, col(n), maxRows - 1, 1).setNumberFormat('@');
  });
  sh.setFrozenColumns(1);
  sh.setColumnWidth(col('Objeto'), 420);
  sh.setColumnWidth(col('Motivo da classificação'), 320);
  sh.setColumnWidth(col('Órgão responsável'), 260);
  sh.setColumnWidth(col('Produtos identificados'), 220);
  // Formatação condicional simples por prioridade.
  var pr = sh.getRange(2, col('Prioridade'), maxRows - 1, 1);
  var rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Alta').setBackground('#f4c7c3').setBold(true).setRanges([pr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Média').setBackground('#fce8b2').setRanges([pr]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Baixa').setBackground('#eeeeee').setRanges([pr]).build()
  ];
  var st = sh.getRange(2, col('Situação interpretada'), maxRows - 1, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Licitação aberta').setBackground('#b7e1cd').setRanges([st]).build());
  sh.setConditionalFormatRules(rules);
  if (!sh.getFilter()) sh.getRange(1, 1, Math.max(2, sh.getMaxRows()), COLS.length).createFilter();
}

// ===================== Execução =====================

/** Menu: atualização manual sem e-mail. */
function updateNow() { startRun_({ email: false, trigger: 'manual' }); }

/** Varredura completa (manual) com envio do e-mail ao final (1 por dia, salvo se forçado). */
function runDailyScan() { startRun_({ email: true, trigger: 'manual' }); }

/** Acionador diário. */
function startDailyScan() {
  var st = getState_();
  var age = st ? Date.now() - st.startedAt : 0;
  // Execução em andamento: continua (a carga inicial pode atravessar a cota diária e seguir no dia seguinte).
  if (st && st.phase !== 'done' && (age < 3 * 3600 * 1000 || (st.mode === 'inicial' && age < 4 * 86400000))) {
    st.email = getConfig().emailOn; st.trigger = 'agendado'; saveState_(st);
    return continueScan();
  }
  startRun_({ email: getConfig().emailOn, trigger: 'agendado' });
}

/** Refaz a carga inicial (últimos N dias + todas as propostas abertas). Não apaga dados. */
function resetCollection() {
  PropertiesService.getScriptProperties().deleteProperty('LAST_COLLECT_TO');
  PropertiesService.getScriptProperties().deleteProperty(STATE_KEY_);
  toast_('A próxima atualização fará a carga inicial completa.');
}

function startRun_(opts) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { toast_('Já existe uma execução em andamento.'); return; }
  try {
    var cfg = getConfig();
    var props = PropertiesService.getScriptProperties();
    var today = new Date();
    var lastTo = props.getProperty('LAST_COLLECT_TO');
    var initial = !lastTo;
    var from = addDays_(today, -(initial ? cfg.initialDays : cfg.windowDays));
    if (!initial) {
      // Cobre lacunas (dias sem coleta completa), limitado a 30 dias.
      var gapFrom = addDays_(parseYmd_(lastTo), -1);
      var floor = addDays_(today, -30);
      if (gapFrom.getTime() < from.getTime()) from = gapFrom.getTime() < floor.getTime() ? floor : gapFrom;
    }
    var st = {
      id: Utilities.formatDate(today, NR.TZ, 'yyyyMMdd-HHmmss'),
      startedAt: Date.now(),
      trigger: opts.trigger,
      email: !!opts.email,
      mode: initial ? 'inicial' : 'diária',
      plan: { from: ymd_(from), to: ymd_(today), propTo: ymd_(addDays_(today, 365)), mods: cfg.modalidades, ufs: cfg.ufs, includeProposta: initial },
      unitIdx: 0, page: 1, totalPages: null,
      phase: 'collect',
      stats: { paginas: 0, paginasFalha: 0, registros: 0, candidatos: 0, novos: 0, atualizados: 0, itens: 0, itensFalha: 0, verificados: 0, verificacaoFalha: 0 },
      errors: []
    };
    saveState_(st);
    log_(st.id, 'Sistema', 'início', '', 'OK', 'Coleta ' + st.mode + ' (' + opts.trigger + ') de ' + st.plan.from + ' a ' + st.plan.to +
      ', UFs: ' + (cfg.ufs.join(',') || 'Brasil') + ', modalidades: ' + cfg.modalidades.join(','));
  } finally { lock.releaseLock(); }
  continueScan();
}

/** Continua a execução do ponto salvo (chamado pelo acionador de continuação). */
function continueScan() {
  deleteTriggers_(['continueScan']);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var st = getState_();
    if (!st || st.phase === 'done') return;
    var cfg = getConfig();
    var store = loadStore_();
    var now = new Date();
    if (st.phase === 'collect') runCollect_(st, cfg, store, now);
    if (st.phase === 'refresh') runRefresh_(st, cfg, store, now);
    if (st.phase === 'finish' && timeLeft_() > 45000) runFinish_(st, cfg, store, now);
    flushStore_(store);
    saveState_(st);
    if (st.phase !== 'done') {
      scheduleContinue_();
      log_(st.id, 'Sistema', 'checkpoint', '', 'PAUSA', 'Tempo de execução atingido na etapa "' + st.phase + '" (unidade ' +
        st.unitIdx + ', página ' + st.page + '). Continuação agendada para 1 minuto.');
    }
  } catch (e) {
    log_('', 'Sistema', 'erro', '', 'ERRO', e && e.stack ? e.stack : String(e));
    scheduleContinue_();
    throw e;
  } finally { lock.releaseLock(); }
}

function timeLeft_() { return NR.MAX_RUN_MS - (Date.now() - EXEC_START_); }

function runCollect_(st, cfg, store, now) {
  var matcher = loadProductCatalog();
  var units = pncpUnits_(st.plan);
  var batch = cfg.concurrency * 3;
  // st.extra: páginas adicionais pendentes, compactadas como [indiceUnidade, dePagina, atePagina].
  st.extra = st.extra || [];
  while (timeLeft_() > 60000) {
    // Monta um lote: primeiro páginas adicionais pendentes, depois a página 1 das próximas unidades.
    var reqs = [];
    while (reqs.length < batch && st.extra.length) {
      var e = st.extra[0];
      reqs.push({ u: e[0], p: e[1] });
      if (e[1] >= e[2]) st.extra.shift(); else e[1]++;
    }
    while (reqs.length < batch && st.unitIdx < units.length) reqs.push({ u: st.unitIdx++, p: 1 });
    if (!reqs.length) { st.phase = 'refresh'; break; }
    var res = httpGetJsonAll_(reqs.map(function (q) { return pncpUnitUrl_(units[q.u], q.p); }), cfg.concurrency);
    var recs = [];
    res.forEach(function (r, i) {
      var q = reqs[i];
      if (r.ok) {
        st.stats.paginas++;
        if (r.data && Array.isArray(r.data.data)) {
          recs = recs.concat(r.data.data);
          var total = r.data.totalPaginas || 1;
          if (q.p === 1 && total > 1) st.extra.push([q.u, 2, total]);
        }
      } else {
        st.stats.paginasFalha++;
        pushErr_(st, 'PNCP ' + unitLabel_(units[q.u]) + ' pág. ' + q.p + ': ' + r.error);
      }
    });
    processRecords_(st, cfg, store, matcher, recs, now);
    st.page = st.extra.length;  // apenas informativo (páginas pendentes)
    saveState_(st);
  }
}

function unitLabel_(u) {
  return (u.type === 'prop' ? 'propostas abertas' : 'publicações ' + u.date + ' mod. ' + u.mod) + (u.uf ? ' ' + u.uf : '');
}

function processRecords_(st, cfg, store, matcher, list, now) {
  st.stats.registros += list.length;
  var candidates = [];
  var seen = {};
  list.forEach(function (c) {
    if (!c || !c.numeroControlePNCP) return;
    var rec = normalizeData(c);
    if (seen[rec.id]) return; seen[rec.id] = true;
    var idx = store.index[rec.id];
    if (idx != null) {
      var row = store.rows[idx];
      var same = sameVal_(row[C['Última atualização']], rec.atualizado);
      if (same) {   // sem alteração oficial: só recalcula situação
        if (applyDetailToRow_(row, rec, now)) st.stats.atualizados++;
        store.dirty = true;
        return;
      }
    }
    var pre = preClassify(matcher, rec.objeto, rec.orgao + ' ' + rec.unidade);
    if (!pre.hits.length && !pre.contextual) {
      if (idx != null) { if (applyDetailToRow_(store.rows[idx], rec, now)) st.stats.atualizados++; store.dirty = true; }
      return;
    }
    candidates.push({ rec: rec, pre: pre });
  });
  if (!candidates.length) return;
  st.stats.candidatos += candidates.length;
  var items = {};
  if (cfg.fetchItems) {
    items = fetchItemsFor_(matcher, candidates.map(function (x) { return x.rec; }), cfg.concurrency);
    Object.keys(items).forEach(function (k) { if (items[k]._itemsError) st.stats.itensFalha++; else st.stats.itens++; });
  }
  candidates.forEach(function (x) {
    var ih = items[x.rec.id] || null;
    var status = interpretStatus(x.rec, now);
    var cls = classifyOpportunity(x.pre, ih, status, x.rec.publicado, now);
    if (!cls.keep) return;
    var r = upsertOpportunity_(store, x.rec, cls, ih, status, now);
    if (r === 'novo') st.stats.novos++;
    else if (r === 'atualizado') st.stats.atualizados++;
  });
}

function runRefresh_(st, cfg, store, now) {
  st.stats.prazosVencidos = (st.stats.prazosVencidos || 0) + recomputeTimeStatus_(store, now);
  if (!cfg.monitorOpen) { st.phase = 'finish'; return; }
  var limitMs = cfg.followDays * 86400000;
  var todo = store.rows.filter(function (r) {
    var s = r[C['Situação interpretada']];
    if (['Licitação aberta', 'Licitação em julgamento', 'Situação a validar'].indexOf(s) < 0) return false;
    var v = r[C['Última verificação']];
    if (v instanceof Date && v.getTime() >= st.startedAt) return false;
    var p = r[C['Prazo para propostas']];
    return !(p instanceof Date) || now.getTime() - p.getTime() <= limitMs;
  }).map(function (r) { return r[C['ID único']]; });
  var batch = cfg.concurrency * 5;
  while (todo.length && timeLeft_() > 60000) {
    var ids = todo.splice(0, batch);
    var res = fetchPNCPDetails_(ids, cfg.concurrency);
    res.forEach(function (x) {
      var row = store.rows[store.index[x.id]];
      if (!row) return;
      if (x.ok) {
        st.stats.verificados++;
        if (applyDetailToRow_(row, normalizeData(x.data), now)) st.stats.atualizados++;
      } else {
        st.stats.verificacaoFalha++;
        row[C['Última verificação']] = now;  // evita repetir na mesma execução; tenta de novo amanhã
      }
      store.dirty = true;
    });
    // ids inválidos (sem número de controle reconhecível) não voltam para a fila
  }
  if (st.stats.verificacaoFalha) pushErr_(st, 'PNCP: ' + st.stats.verificacaoFalha + ' verificação(ões) de situação falharam');
  if (!todo.length) st.phase = 'finish';
}

function runFinish_(st, cfg, store, now) {
  var props = PropertiesService.getScriptProperties();
  syncManualNotes_(store);
  flushStore_(store);
  var lastReport = props.getProperty('LAST_REPORT_AT');
  var views = updateSpreadsheet(store, lastReport ? new Date(Number(lastReport)) : null);
  var complete = st.stats.paginasFalha === 0;
  if (complete) props.setProperty('LAST_COLLECT_TO', st.plan.to);
  else if (!props.getProperty('LAST_COLLECT_TO') && st.stats.paginas > 0) props.setProperty('LAST_COLLECT_TO', st.plan.to);
  st.phase = 'done';
  st.finishedAt = Date.now();
  saveState_(st);
  log_(st.id, 'PNCP', 'coleta', st.stats.registros, complete ? 'OK' : 'PARCIAL',
    JSON.stringify(st.stats) + (st.errors.length ? ' | Erros: ' + st.errors.join(' || ') : ''));
  if (st.email && cfg.emailOn) {
    var today = Utilities.formatDate(now, NR.TZ, 'yyyy-MM-dd');
    if (st.trigger === 'agendado' && props.getProperty('LAST_EMAIL_DAY') === today) {
      log_(st.id, 'E-mail', 'envio', '', 'IGNORADO', 'Relatório de hoje já enviado.');
    } else {
      sendDailyEmail(st, views, store, false);
    }
  }
  toast_('Atualização concluída: ' + st.stats.novos + ' novas, ' + st.stats.atualizados + ' atualizadas.');
}

/** Rede de segurança: se o e-mail do dia não saiu (coleta lenta/falha), envia com cobertura parcial. */
function safetyNet() {
  var cfg = getConfig();
  if (!cfg.emailOn) return;
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), NR.TZ, 'yyyy-MM-dd');
  if (props.getProperty('LAST_EMAIL_DAY') === today) return;
  var st = getState_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var store = loadStore_();
    syncManualNotes_(store); flushStore_(store);
    var lastReport = props.getProperty('LAST_REPORT_AT');
    var views = updateSpreadsheet(store, lastReport ? new Date(Number(lastReport)) : null);
    var partial = st || { id: '', stats: {}, errors: [] };
    if (!st || st.phase !== 'done') pushErr_(partial, 'Coleta do dia ainda não concluída no horário do relatório (cobertura parcial).');
    sendDailyEmail(partial, views, store, true);
  } finally { lock.releaseLock(); }
}

function pushErr_(st, msg) {
  st.errors = st.errors || [];
  if (st.errors.length < 15) st.errors.push(String(msg).slice(0, 300));
}

function getState_() {
  var s = PropertiesService.getScriptProperties().getProperty(STATE_KEY_);
  return s ? JSON.parse(s) : null;
}
function saveState_(st) { PropertiesService.getScriptProperties().setProperty(STATE_KEY_, JSON.stringify(st)); }

// ===================== Acionadores =====================

function installTriggers() {
  var cfg = getConfig();
  deleteTriggers_(HANDLERS_);
  var startHour = (cfg.hour + 23) % 24;
  ScriptApp.newTrigger('startDailyScan').timeBased().everyDays(1).atHour(startHour).inTimezone(NR.TZ).create();
  ScriptApp.newTrigger('safetyNet').timeBased().everyDays(1).atHour((cfg.hour + 2) % 24).inTimezone(NR.TZ).create();
  log_('', 'Sistema', 'installTriggers', '', 'OK', 'Coleta diária entre ' + startHour + 'h e ' + (startHour + 1) +
    'h; e-mail ao concluir; rede de segurança às ' + ((cfg.hour + 2) % 24) + 'h.');
  toast_('Automação diária ativada.');
}

function removeTriggers() {
  deleteTriggers_(HANDLERS_);
  log_('', 'Sistema', 'removeTriggers', '', 'OK', 'Automação diária desativada.');
  toast_('Automação diária desativada.');
}

function deleteTriggers_(handlers) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
}

function scheduleContinue_() {
  deleteTriggers_(['continueScan']);
  ScriptApp.newTrigger('continueScan').timeBased().after(NR.CONTINUE_AFTER_MS).create();
}

// ===================== Teste das fontes =====================

function testSources() {
  var out = [];
  var y = ymd_(addDays_(new Date(), -1));
  var pub = httpGetJson_(NR.PNCP_CONSULTA + '/v1/contratacoes/publicacao?' + qs_({ dataInicial: y, dataFinal: y, codigoModalidadeContratacao: 6, pagina: 1, tamanhoPagina: 10 }));
  out.push(['PNCP publicações', pub.ok ? 'OK (' + (pub.data ? pub.data.totalRegistros : 0) + ' registros ontem, pregão eletrônico)' : pub.error]);
  var prop = httpGetJson_(NR.PNCP_CONSULTA + '/v1/contratacoes/proposta?' + qs_({ dataFinal: ymd_(addDays_(new Date(), 365)), pagina: 1, tamanhoPagina: 10 }));
  out.push(['PNCP propostas abertas', prop.ok ? 'OK (' + (prop.data ? prop.data.totalRegistros : 0) + ' abertas no Brasil)' : prop.error]);
  var first = pub.ok && pub.data && pub.data.data && pub.data.data[0];
  if (first) {
    var rec = normalizeData(first);
    var it = httpGetJson_(itemsUrl_(rec));
    out.push(['PNCP itens', it.ok ? 'OK (' + (Array.isArray(it.data) ? it.data.length : 0) + ' itens em ' + rec.controle + ')' : it.error]);
    var det = httpGetJson_(detailUrl_(rec.cnpj, rec.ano, rec.seq));
    out.push(['PNCP detalhe/situação', det.ok ? 'OK (' + (det.data ? det.data.situacaoCompraNome : '') + ')' : det.error]);
  }
  out.push(['PNCP PCA (planejamento)', 'Não integrado na v1: endpoint oficial respondeu com erro 500/timeout/429 nos testes de 24/11/2026']);
  out.push(['Compras.gov.br', 'Não integrado na v1 (complementar ao PNCP; prevista para a fase 10)']);
  out.push(['Transferegov', 'Não integrado na v1 (prevista para a fase 10)']);
  out.push(['Portal da Transparência', 'Desativado por decisão do proprietário (requer chave)']);
  out.push(['FNS / InvestSUS / RENEM', 'Sem API pública documentada: apenas consulta manual no portal']);
  out.forEach(function (o) { log_('', o[0], 'testSources', '', /^OK/.test(o[1]) ? 'OK' : 'INFO', o[1]); });
  var msg = out.map(function (o) { return o[0] + ': ' + o[1]; }).join('\n');
  try { SpreadsheetApp.getUi().alert('Teste das fontes', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { console.log(msg); }
  return out;
}

// Placeholders explícitos (NÃO implementados) — mantidos para deixar claro o estado do escopo.
function fetchComprasGov() { throw new Error('Compras.gov.br: integração não implementada na versão 1.'); }
function fetchTransfereGov() { throw new Error('Transferegov: integração não implementada na versão 1.'); }
function fetchTransparencia() { throw new Error('Portal da Transparência: desativado (sem chave de API).'); }
function fetchFNS() { throw new Error('FNS: não há API pública documentada; integração não implementada.'); }

function toast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Nexus Radar', 8); } catch (e) { console.log(msg); }
}
