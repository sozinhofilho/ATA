/**
 * Report.gs: exportação em Excel (.xlsx real via exportação oficial do Google Drive)
 * e relatório diário por e-mail (MailApp, somente para o proprietário).
 */

var XLSX_MAX_BYTES_ = 20 * 1024 * 1024;

/** Gera o .xlsx com as abas "Novas" e "Abertas". Retorna {blob, error}. */
function exportExcel(views) {
  var tmp = null;
  try {
    var name = 'Nexus_Radar_' + Utilities.formatDate(new Date(), NR.TZ, 'yyyy-MM-dd');
    tmp = SpreadsheetApp.create(name + '_temp');
    var first = tmp.getSheets()[0];
    var add = function (sheet, title, rows) {
      sheet.setName(title);
      var data = [COLS].concat(rows.map(function (r) { return r.slice(); }));
      sheet.getRange(1, 1, data.length, COLS.length).setValues(data);
      sheet.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#1f3b57').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      if (rows.length) {
        ['Data de identificação', 'Data de publicação', 'Última atualização', 'Última verificação'].forEach(function (n) {
          sheet.getRange(2, C[n] + 1, rows.length, 1).setNumberFormat('dd/MM/yyyy');
        });
        sheet.getRange(2, C['Prazo para propostas'] + 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
        ['Valor estimado da aquisição', 'Valor aprovado', 'Valor transferido'].forEach(function (n) {
          sheet.getRange(2, C[n] + 1, rows.length, 1).setNumberFormat('"R$" #,##0.00');
        });
      }
    };
    add(first, 'Novas oportunidades', views.novas);
    add(tmp.insertSheet(), 'Oportunidades abertas', views.abertas);
    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return { blob: null, error: 'Exportação falhou: HTTP ' + resp.getResponseCode() };
    var blob = resp.getBlob().setName(name + '.xlsx');
    if (blob.getBytes().length > XLSX_MAX_BYTES_) return { blob: null, error: 'Excel maior que o limite de anexo; use o link da planilha.' };
    return { blob: blob, error: '' };
  } catch (e) {
    return { blob: null, error: 'Exportação falhou: ' + e };
  } finally {
    if (tmp) { try { DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (e) { /* ignora */ } }
  }
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/^'/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate_(d, withTime) {
  return d instanceof Date ? Utilities.formatDate(d, NR.TZ, withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy') : '';
}

function opportunityCardHtml_(r, n) {
  var val = r[C['Valor estimado da aquisição']];
  var link = safeUrl_(r[C['Link da oportunidade']]);
  var prio = r[C['Prioridade']];
  var color = prio === 'Alta' ? '#c0392b' : prio === 'Média' ? '#b7791f' : '#666';
  var line = function (k, v) { return v ? '<div><b>' + k + ':</b> ' + esc_(v) + '</div>' : ''; };
  var obj = String(r[C['Objeto']] || '');
  if (obj.length > 280) obj = obj.slice(0, 277) + '…';
  return '<div style="border:1px solid #ddd;border-left:4px solid ' + color + ';border-radius:6px;padding:10px 12px;margin:10px 0;font-size:14px;line-height:1.45">' +
    '<div style="font-weight:bold;margin-bottom:4px">OPORTUNIDADE ' + ('0' + n).slice(-2) + ' — <span style="color:' + color + '">Prioridade ' + esc_(prio) + '</span></div>' +
    line('Município', r[C['Município']] + '/' + r[C['Estado']]) +
    line('Órgão', r[C['Órgão responsável']]) +
    line('Tipo', r[C['Tipo de oportunidade']]) +
    line('Objeto', obj) +
    line('Produtos identificados', r[C['Produtos identificados']]) +
    line('Quantidades', r[C['Quantidade']]) +
    line('Valor divulgado', val ? 'R$ ' + formatBRL_(val) : 'não divulgado') +
    line('Situação', r[C['Situação interpretada']] + (r[C['Prazo para propostas']] ? ' — propostas até ' + fmtDate_(r[C['Prazo para propostas']], true) : '')) +
    line('Motivo', r[C['Motivo da classificação']]) +
    (link ? '<div><b>Fonte oficial:</b> <a href="' + esc_(link) + '">' + esc_(link) + '</a></div>' : '') +
    '</div>';
}

/** Envia o relatório diário ao proprietário. */
function sendDailyEmail(st, views, store, partial) {
  var cfg = getConfig();
  if (!cfg.recipients) { log_(st.id, 'E-mail', 'envio', '', 'ERRO', 'Nenhum destinatário válido na aba CONFIGURACOES.'); return; }
  var now = new Date();
  var ss = getSS_();
  var novas = views.novas, abertas = views.abertas;
  var count = function (rows, fn) { return rows.filter(fn).length; };
  var nAlta = count(novas, function (r) { return r[C['Prioridade']] === 'Alta'; });
  var nAbertasConf = count(abertas, function (r) { return r[C['Situação interpretada']] === 'Licitação aberta'; });
  var nPlan = count(abertas, function (r) { return /^B/.test(r[C['Tipo de oportunidade']]); });
  var nRec = count(abertas, function (r) { return /^A/.test(r[C['Tipo de oportunidade']]); });
  var s = st.stats || {};
  var errors = (st.errors || []).slice();
  var coverageOk = !partial && !errors.length && (s.paginasFalha || 0) === 0;

  var excel = cfg.excelOn ? exportExcel(views) : { blob: null, error: 'Exportação em Excel desativada' };
  if (excel.error && cfg.excelOn) errors.push(excel.error);

  var top = novas.slice(0, cfg.topN);
  var topTitle = 'As ' + top.length + ' novas oportunidades mais relevantes';
  if (!top.length) {
    top = abertas.filter(function (r) { return r[C['Situação interpretada']] === 'Licitação aberta'; }).slice(0, Math.min(5, cfg.topN));
    topTitle = 'Nenhuma nova oportunidade. Em acompanhamento (licitações abertas):';
  }
  var subject = '[NEXUS RADAR] ' + novas.length + ' novas oportunidades hospitalares — ' + fmtDate_(now);
  var stat = function (k, v) { return '<tr><td style="padding:3px 8px 3px 0">' + k + '</td><td style="padding:3px 0;font-weight:bold;text-align:right">' + v + '</td></tr>'; };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#222">' +
    '<h2 style="color:#1f3b57;margin:0 0 4px">Nexus Radar — Oportunidades Hospitalares</h2>' +
    '<div style="color:#666;font-size:13px;margin-bottom:10px">Pesquisa de ' + fmtDate_(now, true) +
    (st.plan ? ' · período ' + st.plan.from.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') + ' a ' + st.plan.to.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '') +
    ' · abrangência: ' + (cfg.ufs.join(', ') || 'Brasil') + '</div>' +
    (coverageOk ? '' : '<div style="background:#fff3cd;border:1px solid #f0d58c;padding:8px;border-radius:6px;font-size:13px;margin-bottom:10px"><b>Cobertura parcial.</b> Algumas consultas falharam ou não terminaram; as oportunidades ausentes podem aparecer no próximo relatório.</div>') +
    '<table style="font-size:14px;border-collapse:collapse;margin-bottom:8px">' +
    stat('Novas oportunidades', novas.length) +
    stat('Oportunidades atualizadas', s.atualizados || 0) +
    stat('Novas com prioridade alta', nAlta) +
    stat('Licitações confirmadamente abertas (em acompanhamento)', nAbertasConf) +
    stat('Oportunidades em planejamento', nPlan) +
    stat('Oportunidades ligadas a recursos públicos', nRec) +
    '</table>' +
    '<div style="margin:12px 0"><a href="' + ss.getUrl() + '" style="background:#1f3b57;color:#fff;padding:9px 14px;border-radius:5px;text-decoration:none;display:inline-block">Abrir planilha privada</a></div>' +
    '<h3 style="color:#1f3b57;margin:16px 0 4px;font-size:16px">' + esc_(topTitle) + '</h3>' +
    (top.length ? top.map(function (r, i) { return opportunityCardHtml_(r, i + 1); }).join('') :
      '<p style="font-size:14px">Nenhuma nova oportunidade foi encontrada nas fontes monitoradas' + (coverageOk ? '.' : ' (cobertura parcial).') + '</p>') +
    '<h3 style="color:#1f3b57;font-size:15px;margin:16px 0 4px">Fontes consultadas</h3>' +
    '<div style="font-size:13px">PNCP — API de Consulta (contratações publicadas, propostas abertas, itens e situação): ' +
    (s.paginas || 0) + ' páginas, ' + (s.registros || 0) + ' contratações analisadas, ' + (s.itens || 0) + ' processos com itens verificados, ' +
    (s.verificados || 0) + ' situações reconferidas.</div>' +
    '<div style="font-size:13px;color:#666">Não integradas nesta versão: PCA do PNCP (instável), Compras.gov.br, Transferegov, Portal da Transparência, FNS/InvestSUS.</div>' +
    (errors.length ? '<h3 style="color:#a94442;font-size:15px;margin:16px 0 4px">Erros e indisponibilidades</h3><ul style="font-size:12px">' +
      errors.map(function (e) { return '<li>' + esc_(e) + '</li>'; }).join('') + '</ul>' : '') +
    '<p style="font-size:11px;color:#888;margin-top:18px">Relatório automático privado. Dados de fontes oficiais; confirme sempre no link oficial antes de agir. ' +
    'Licitação aberta não significa elegibilidade para adesão a ata.</p></div>';

  var text = subject + '\n\nNovas: ' + novas.length + ' | Atualizadas: ' + (s.atualizados || 0) + ' | Alta: ' + nAlta +
    ' | Licitações abertas: ' + nAbertasConf + '\nPlanilha: ' + ss.getUrl();
  var msg = { to: cfg.recipients, subject: subject, htmlBody: html, body: text, name: 'Nexus Radar' };
  if (excel.blob) msg.attachments = [excel.blob];
  MailApp.sendEmail(msg);
  var props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_EMAIL_DAY', Utilities.formatDate(now, NR.TZ, 'yyyy-MM-dd'));
  props.setProperty('LAST_REPORT_AT', String(now.getTime()));
  log_(st.id, 'E-mail', 'envio', novas.length, coverageOk ? 'OK' : 'PARCIAL', 'Enviado para ' + cfg.recipients + (excel.blob ? ' com Excel' : ' sem Excel'));
}

/** E-mail de teste (não altera controle de envio diário). */
function sendTestEmail() {
  var cfg = getConfig();
  if (!cfg.recipients) throw new Error('Informe o e-mail destinatário na aba CONFIGURACOES.');
  var store = loadStore_();
  var views = { novas: selectNew_(store, null).slice(0, 200), abertas: selectOpen_(store) };
  var excel = cfg.excelOn ? exportExcel(views) : { blob: null };
  var msg = {
    to: cfg.recipients,
    subject: '[NEXUS RADAR] [TESTE] e-mail de teste — ' + fmtDate_(new Date()),
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px"><p>E-mail de teste do Nexus Radar.</p>' +
      '<p>Registros na base: <b>' + store.rows.length + '</b> · em acompanhamento: <b>' + views.abertas.length + '</b></p>' +
      '<p><a href="' + getSS_().getUrl() + '">Abrir planilha privada</a></p>' +
      (excel.blob ? '<p>O arquivo Excel de exemplo está anexado.</p>' : '<p>Excel: ' + esc_(excel.error || 'desativado') + '</p>') + '</div>',
    name: 'Nexus Radar'
  };
  if (excel.blob) msg.attachments = [excel.blob];
  MailApp.sendEmail(msg);
  log_('', 'E-mail', 'teste', '', 'OK', 'E-mail de teste enviado para ' + cfg.recipients);
  toast_('E-mail de teste enviado para ' + cfg.recipients);
}

/** Alias exigido pelo escopo: reconsulta situação das oportunidades em aberto agora. */
function refreshOpenOpportunities() { updateNow(); }
