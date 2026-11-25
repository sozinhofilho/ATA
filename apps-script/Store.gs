/**
 * Store.gs: base de dados na aba HISTORICO (todas as oportunidades), deduplicação,
 * atualização preservando dados manuais, e reconstrução das abas NOVAS/ABERTAS.
 */

var OPEN_STATUSES = ['Licitação aberta', 'Situação a validar', 'Planejamento identificado', 'Pesquisa de preços', 'Recurso identificado'];
var PRIO_ORDER = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
var LINK_COLS = ['Link da oportunidade', 'Link dos documentos'];

/** Remove caracteres de controle e impede fórmulas vindas das fontes (injeção de fórmulas). */
function sanitize_(v) {
  if (v == null) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  if (s.length > 5000) s = s.slice(0, 4990) + ' […]';
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function safeUrl_(u) {
  u = String(u || '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}

function loadStore_() {
  var sh = getSheet_(NR.SHEETS.HIST);
  var rows = [];
  if (sh.getLastRow() > 1) {
    rows = sh.getRange(2, 1, sh.getLastRow() - 1, COLS.length).getValues();
  }
  var index = {};
  rows.forEach(function (r, i) { if (r[C['ID único']]) index[r[C['ID único']]] = i; });
  return { rows: rows, index: index, dirty: false };
}

/**
 * Insere ou atualiza (deduplicação pelo ID oficial: número de controle PNCP).
 * @return {'novo'|'atualizado'|'igual'}
 */
function upsertOpportunity_(store, rec, cls, itemHits, status, now) {
  var i = store.index[rec.id];
  var prev = i != null ? store.rows[i] : null;
  var row = buildRow_(rec, cls, itemHits, status, now, prev);
  if (!prev) {
    store.index[rec.id] = store.rows.length;
    store.rows.push(row);
    store.dirty = true;
    return 'novo';
  }
  var changed = ['Situação oficial', 'Situação interpretada', 'Prazo para propostas', 'Valor estimado da aquisição',
    'Valor aprovado', 'Produtos identificados', 'Prioridade', 'Última atualização'].some(function (k) {
    return !sameVal_(prev[C[k]], row[C[k]]);
  });
  store.rows[i] = row;
  store.dirty = true;
  return changed ? 'atualizado' : 'igual';
}

function sameVal_(a, b) {
  if (a instanceof Date || b instanceof Date) {
    var ta = a instanceof Date ? a.getTime() : (a ? new Date(a).getTime() : 0);
    var tb = b instanceof Date ? b.getTime() : (b ? new Date(b).getTime() : 0);
    return ta === tb;
  }
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function buildRow_(rec, cls, itemHits, status, now, prev) {
  var r = new Array(COLS.length).fill('');
  var hits = cls.hits || [];
  var uniq = function (arr) { return arr.filter(function (x, i) { return x && arr.indexOf(x) === i; }); };
  var pend = (cls.pendencias || []).slice();
  if (!(rec.valorEstimado > 0)) pend.push('Valor estimado sigiloso ou não informado');

  r[C['ID único']] = rec.id;
  r[C['Data de identificação']] = prev ? prev[C['Data de identificação']] : now;
  r[C['Data de publicação']] = rec.publicado || '';
  r[C['Última atualização']] = rec.atualizado || '';
  r[C['Estado']] = rec.uf;
  r[C['Município']] = rec.municipio;
  r[C['Código IBGE']] = rec.ibge ? String(rec.ibge) : '';
  r[C['Órgão responsável']] = rec.orgao + (rec.unidade && normalizeText(rec.unidade) !== normalizeText(rec.orgao) ? ' — ' + rec.unidade : '');
  r[C['CNPJ do órgão']] = rec.cnpj;
  r[C['Tipo de oportunidade']] = opportunityType_(status, rec.modalidade);
  r[C['Objeto']] = rec.objeto;
  r[C['Produtos identificados']] = uniq(hits.map(function (h) { return h.row.produto; })).join(', ');
  r[C['Categoria']] = uniq(hits.map(function (h) { return h.row.categoria; })).join(', ');
  r[C['Código RENEM']] = uniq(hits.map(function (h) { return h.row.renem; })).join('; ');
  r[C['Código CATMAT']] = (itemHits && itemHits._catmat) || uniq(hits.map(function (h) { return h.row.catmat; })).join('; ');
  r[C['Quantidade']] = (itemHits && itemHits._resumo) || (prev ? prev[C['Quantidade']] : '');
  r[C['Valor estimado da aquisição']] = rec.valorEstimado > 0 ? rec.valorEstimado : '';
  r[C['Valor aprovado']] = rec.valorHomologado > 0 ? rec.valorHomologado : '';
  r[C['Valor transferido']] = '';
  r[C['Situação oficial']] = rec.situacaoNome;
  r[C['Situação interpretada']] = status;
  r[C['Prioridade']] = cls.prioridade;
  r[C['Motivo da classificação']] = cls.motivo + (itemHits && itemHits._valorItens > 0
    ? '. Valor estimado dos itens compatíveis: R$ ' + formatBRL_(itemHits._valorItens) : '');
  r[C['Prazo para propostas']] = rec.prazo || '';
  r[C['Número do processo ou proposta']] = rec.processo;
  r[C['Número de controle PNCP']] = rec.controle;
  r[C['Fonte oficial']] = 'PNCP — API de Consulta';
  r[C['Link da oportunidade']] = safeUrl_(rec.link);
  r[C['Link dos documentos']] = safeUrl_(rec.linkDocs);
  r[C['Telefone institucional']] = prev ? prev[C['Telefone institucional']] : '';
  r[C['E-mail institucional']] = prev ? prev[C['E-mail institucional']] : '';
  r[C['Pendências de validação']] = pend.join('; ');
  r[C['Observações manuais']] = prev ? prev[C['Observações manuais']] : '';
  r[C['Nível de correspondência']] = cls.nivel;
  r[C['Modalidade']] = rec.modalidade + (rec.srp ? ' · Registro de preços (SRP)' : '');
  r[C['Última verificação']] = now;
  return r.map(sanitize_);
}

/** Atualiza situação de uma linha existente a partir do detalhe oficial. Retorna true se mudou. */
function applyDetailToRow_(row, rec, now) {
  var status = interpretStatus(rec, now);
  var before = [row[C['Situação oficial']], row[C['Situação interpretada']], String(row[C['Prazo para propostas']]), row[C['Valor aprovado']]].join('|');
  row[C['Situação oficial']] = sanitize_(rec.situacaoNome);
  row[C['Situação interpretada']] = status;
  row[C['Tipo de oportunidade']] = opportunityType_(status, rec.modalidade);
  if (rec.prazo) row[C['Prazo para propostas']] = rec.prazo;
  if (rec.valorHomologado > 0) row[C['Valor aprovado']] = rec.valorHomologado;
  if (rec.atualizado) row[C['Última atualização']] = rec.atualizado;
  if (['Contratação concluída', 'Cancelada', 'Revogada'].indexOf(status) >= 0 && row[C['Prioridade']] !== 'Baixa') {
    row[C['Prioridade']] = 'Baixa';
    row[C['Motivo da classificação']] = 'Processo encerrado (' + status.toLowerCase() + '). Classificação anterior: ' + row[C['Motivo da classificação']];
  }
  row[C['Última verificação']] = now;
  var after = [row[C['Situação oficial']], row[C['Situação interpretada']], String(row[C['Prazo para propostas']]), row[C['Valor aprovado']]].join('|');
  return before !== after;
}

/** Recalcula a situação de linhas cujo prazo venceu desde a última verificação (sem chamada externa). */
function recomputeTimeStatus_(store, now) {
  var n = 0;
  store.rows.forEach(function (row) {
    if (row[C['Situação interpretada']] === 'Licitação aberta') {
      var p = row[C['Prazo para propostas']];
      if (p instanceof Date && p.getTime() <= now.getTime()) {
        row[C['Situação interpretada']] = 'Licitação em julgamento';
        row[C['Tipo de oportunidade']] = String(row[C['Tipo de oportunidade']]).replace('Licitação aberta', 'Licitação em julgamento');
        if (row[C['Prioridade']] === 'Alta') {
          row[C['Prioridade']] = 'Média';
          row[C['Motivo da classificação']] = 'Prazo de propostas encerrado. ' + row[C['Motivo da classificação']];
        }
        store.dirty = true; n++;
      }
    }
  });
  return n;
}

function formatBRL_(n) {
  var s = (Math.round(Number(n) * 100) / 100).toFixed(2).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
}

/** Grava a base inteira na aba HISTORICO. */
function flushStore_(store) {
  if (!store.dirty) return;
  var sh = getSheet_(NR.SHEETS.HIST);
  writeOpportunityRows_(sh, store.rows);
  store.dirty = false;
}

/** Escreve linhas numa aba de oportunidades (limpa dados antigos, mantém cabeçalho e formatos). */
function writeOpportunityRows_(sh, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, COLS.length).clearContent();
  if (!rows.length) return;
  sh.getRange(2, 1, rows.length, COLS.length).setValues(rows);
  // Links clicáveis (RichText evita fórmulas e funciona em qualquer idioma da planilha).
  LINK_COLS.forEach(function (name) {
    var col = C[name];
    var rich = rows.map(function (r) {
      var u = safeUrl_(r[col]);
      var b = SpreadsheetApp.newRichTextValue().setText(u || '');
      if (u) b.setLinkUrl(u);
      return [b.build()];
    });
    sh.getRange(2, col + 1, rows.length, 1).setRichTextValues(rich);
  });
}

/** Copia observações manuais feitas nas abas NOVAS/ABERTAS para o HISTORICO. */
function syncManualNotes_(store) {
  [NR.SHEETS.NOVAS, NR.SHEETS.ABERTAS].forEach(function (name) {
    var sh = getSheet_(name);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, COLS.length).getValues();
    vals.forEach(function (v) {
      var i = store.index[v[C['ID único']]];
      if (i == null) return;
      ['Observações manuais', 'Telefone institucional', 'E-mail institucional'].forEach(function (k) {
        var nv = v[C[k]];
        if (nv !== '' && nv != null && String(nv) !== String(store.rows[i][C[k]])) {
          store.rows[i][C[k]] = sanitize_(nv);
          store.dirty = true;
        }
      });
    });
  });
}

function sortOpportunities_(rows) {
  return rows.sort(function (a, b) {
    var sa = a[C['Situação interpretada']] === 'Licitação aberta' ? 0 : 1;
    var sb = b[C['Situação interpretada']] === 'Licitação aberta' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    var pa = PRIO_ORDER[a[C['Prioridade']]] != null ? PRIO_ORDER[a[C['Prioridade']]] : 3;
    var pb = PRIO_ORDER[b[C['Prioridade']]] != null ? PRIO_ORDER[b[C['Prioridade']]] : 3;
    if (pa !== pb) return pa - pb;
    var ta = a[C['Prazo para propostas']] instanceof Date ? a[C['Prazo para propostas']].getTime() : 9e15;
    var tb = b[C['Prazo para propostas']] instanceof Date ? b[C['Prazo para propostas']].getTime() : 9e15;
    return ta - tb;
  });
}

function selectNew_(store, since) {
  var t = since ? since.getTime() : 0;
  return sortOpportunities_(store.rows.filter(function (r) {
    var d = r[C['Data de identificação']];
    return d instanceof Date && d.getTime() > t;
  }));
}

function selectOpen_(store) {
  return sortOpportunities_(store.rows.filter(function (r) {
    return OPEN_STATUSES.indexOf(r[C['Situação interpretada']]) >= 0;
  }));
}

/** Reconstrói as abas NOVAS e ABERTAS a partir do HISTORICO. */
function updateSpreadsheet(store, since) {
  var novas = selectNew_(store, since);
  var abertas = selectOpen_(store);
  writeOpportunityRows_(getSheet_(NR.SHEETS.NOVAS), novas);
  writeOpportunityRows_(getSheet_(NR.SHEETS.ABERTAS), abertas);
  return { novas: novas, abertas: abertas };
}

/** Função exigida pelo escopo: deduplicação é feita pelo índice do ID oficial no upsert. */
function deduplicateRecords(records) {
  var seen = {};
  return records.filter(function (r) { if (seen[r.id]) return false; seen[r.id] = true; return true; });
}

// ---------- Logs ----------
function log_(runId, fonte, etapa, registros, resultado, detalhes) {
  try {
    var sh = getSheet_(NR.SHEETS.LOGS);
    sh.appendRow([new Date(), runId || '', fonte, etapa, registros, resultado, sanitize_(String(detalhes || '').slice(0, 1000))]);
    if (sh.getLastRow() > 3000) sh.deleteRows(2, 500);
  } catch (e) { console.error('Falha ao registrar log: ' + e); }
}
