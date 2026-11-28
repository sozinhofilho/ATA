/**
 * Simulador local do Google Apps Script para testar o Nexus Radar com dados REAIS do PNCP.
 * Simula SpreadsheetApp (em memória), PropertiesService, LockService, ScriptApp, MailApp.
 * UrlFetchApp usa curl de verdade (chamadas reais às APIs públicas).
 * Uso: TZ=America/Sao_Paulo node test/gas-sim.js <workdir> [--ufs SC,PR] [--days N] [--window N] [--runs N]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync, execSync } = require('child_process');

const args = process.argv.slice(2);
const workdir = path.resolve(args[0] || './sim-out');
fs.mkdirSync(workdir, { recursive: true });
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

// ---------- Planilha em memória (persistida em JSON entre execuções) ----------
const dbFile = path.join(workdir, 'spreadsheet.json');
const db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8'), reviveDates) : { sheets: {}, order: [], props: {} };
function reviveDates(k, v) { return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) ? new Date(v) : v; }
function save() { fs.writeFileSync(dbFile, JSON.stringify(db)); }

const noop = new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => '' : noop, apply: () => noop });

function makeSheet(name) {
  if (!db.sheets[name]) { db.sheets[name] = []; db.order.push(name); }
  const data = () => db.sheets[name];
  const sheet = {
    getName: () => name,
    setName: (n) => { db.sheets[n] = db.sheets[name]; delete db.sheets[name]; db.order[db.order.indexOf(name)] = n; name = n; return sheet; },
    getLastRow: () => { const d = data(); let n = d.length; while (n > 0 && d[n - 1].every(v => v === '' || v == null)) n--; return n; },
    getMaxRows: () => 1000,
    getRange: (r, c, nr, nc) => {
      if (typeof r === 'string') return noop;
      nr = nr || 1; nc = nc || 1;
      let px;
      const rng = {
        getValues: () => { const d = data(); const out = []; for (let i = 0; i < nr; i++) { const row = d[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(o); } return out; },
        setValues: (vals) => { const d = data(); for (let i = 0; i < vals.length; i++) { d[r - 1 + i] = d[r - 1 + i] || []; for (let j = 0; j < vals[i].length; j++) d[r - 1 + i][c - 1 + j] = vals[i][j]; } return px; },
        setRichTextValues: (vals) => { rng.setValues(vals.map(row => row.map(x => x.text))); return px; },
        clearContent: () => { const d = data(); for (let i = 0; i < nr; i++) if (d[r - 1 + i]) for (let j = 0; j < nc; j++) d[r - 1 + i][c - 1 + j] = ''; return px; },
      };
      px = new Proxy(rng, { get: (t, p) => t[p] || (() => px) });
      return px;
    },
    appendRow: (row) => { data().splice(sheet.getLastRow(), 0, row); return sheet; },
    deleteRows: (start, n) => { data().splice(start - 1, n); },
    getFilter: () => null,
  };
  return new Proxy(sheet, { get: (t, p) => t[p] || (() => sheet) });
}

const ss = {
  getId: () => 'SIMULATED',
  getName: () => 'Nexus Radar — Oportunidades Hospitalares',
  getUrl: () => 'https://docs.google.com/spreadsheets/d/SIMULATED/edit',
  getSheetByName: (n) => db.sheets[n] ? makeSheet(n) : null,
  insertSheet: (n) => makeSheet(n || ('Sheet' + db.order.length)),
  getSheets: () => db.order.map(makeSheet),
  toast: (m) => console.log('[toast]', m),
};
const ssProxy = new Proxy(ss, { get: (t, p) => t[p] || (() => ssProxy) });

// ---------- UrlFetchApp com curl real ----------
let httpCount = 0;
function curlMany(urls) {
  const tmp = fs.mkdtempSync(path.join(workdir, 'h-'));
  const script = urls.map((u, i) => `curl -s --max-time 60 -o ${tmp}/b${i} -w "%{http_code}" ${JSON.stringify(u)} > ${tmp}/c${i} &`).join('\n') + '\nwait\n';
  spawnSync('bash', ['-c', script], { stdio: 'ignore' });
  const out = urls.map((u, i) => {
    const code = Number(fs.readFileSync(`${tmp}/c${i}`, 'utf8') || 0);
    const body = fs.existsSync(`${tmp}/b${i}`) ? fs.readFileSync(`${tmp}/b${i}`) : Buffer.alloc(0);
    return mkResp(code, body);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  httpCount += urls.length;
  return out;
}
function mkResp(code, body) {
  return { getResponseCode: () => code, getContentText: () => body.toString('utf8'), getBlob: () => ({ setName() { return this; }, getBytes: () => body }) };
}
const UrlFetchApp = {
  fetchAll: (reqs) => curlMany(reqs.map(r => r.url)),
  fetch: (url) => /docs\.google\.com/.test(url) ? mkResp(200, Buffer.from('SIMULATED-XLSX')) : curlMany([url])[0],
};

const Utilities = {
  sleep: (ms) => execSync(`sleep ${ms / 1000}`),
  formatDate: (d, tz, fmt) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(d).map(x => [x.type, x.value]));
    return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour === '24' ? '00' : p.hour).replace('mm', p.minute).replace('ss', p.second);
  },
};
const props = {
  getProperty: (k) => db.props[k] == null ? null : db.props[k],
  setProperty: (k, v) => { db.props[k] = String(v); },
  deleteProperty: (k) => { delete db.props[k]; },
};
const triggers = [];
const mails = [];
const ctx = {
  console, Date, JSON, Math, RegExp, Object, Array, String, Number, Boolean, Error, Intl,
  UrlFetchApp, Utilities,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ssProxy, openById: () => ssProxy, flush: () => {},
    create: () => new Proxy({ getSheets: () => [noop], insertSheet: () => noop, getId: () => 'TMP' }, { get: (t, p) => t[p] || noop }), getUi: () => { throw new Error('sem UI'); },
    newRichTextValue: () => { const b = { text: '', setText(t) { b.text = t; return b; }, setLinkUrl() { return b; }, build() { return { text: b.text }; } }; return b; },
    newConditionalFormatRule: () => noop,
  },
  PropertiesService: { getScriptProperties: () => props },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ScriptApp: {
    getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t })),
    deleteTrigger: () => {},
    newTrigger: (h) => { const b = new Proxy({}, { get: (t, p) => p === 'create' ? () => triggers.push(h) : () => b }); return b; },
    getOAuthToken: () => 'x',
  },
  MailApp: { sendEmail: (m) => { mails.push(m); }, getRemainingDailyQuota: () => 100 },
  Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
  DriveApp: { getFileById: () => ({ setTrashed: () => {} }) },
};
vm.createContext(ctx);
const dir = path.join(__dirname, '..', 'apps-script');
for (const f of ['Config.gs', 'Http.gs', 'CatalogData.gs', 'Catalog.gs', 'Classify.gs', 'Pncp.gs', 'Store.gs', 'Report.gs', 'Main.gs']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
if (args.includes('--debug')) {
  const orig = ctx.classifyOpportunity;
  const dbgFile = path.join(workdir, 'debug_classify.tsv'); const dbg = { write: (x) => fs.appendFileSync(dbgFile, x) };
  ctx.classifyOpportunity = function (pre, ih, status, pub, now) {
    const r = orig(pre, ih, status, pub, now);
    dbg.write([r.keep ? 'KEEP' : 'DROP', r.nivel, r.prioridade, status, (pre.hits || []).map(h => h.row.produto).join(','),
      pre.contextual, ih ? ih._itemCount : '', ih ? (ih._resumo || '') : '', String(pre._objeto || '').slice(0, 200)].join('\t') + '\n');
    return r;
  };
  const origPre = ctx.preClassify;
  ctx.preClassify = function (m, o, org) { const r = origPre(m, o, org); r._objeto = o; return r; };
}
module.exports = { ctx, db, save, mails, workdir, opt, httpCount: () => httpCount };

if (require.main === module) {
  const t0 = Date.now();
  if (!db.sheets['CONFIGURACOES']) ctx.setupSystem();
  // Ajustes de configuração vindos da linha de comando (como se editados na aba CONFIGURACOES).
  const cfgSheet = db.sheets['CONFIGURACOES'];
  const setCfg = (k, v) => { const row = cfgSheet.find(r => r[0] === k); if (row) row[1] = v; };
  if (opt('ufs') != null) setCfg('Estados (UF)', opt('ufs'));
  if (opt('days')) setCfg('Período da pesquisa inicial (dias)', Number(opt('days')));
  if (opt('window')) setCfg('Janela de segurança (dias)', Number(opt('window')));
  if (opt('mods')) setCfg('Modalidades PNCP', opt('mods'));
  if (opt('conc')) setCfg('Requisições simultâneas', Number(opt('conc')));
  const email = args.includes('--email');
  ctx.startRun_({ email, trigger: email ? 'agendado' : 'manual' });
  let n = 1;
  while (true) {
    save();
    const st = JSON.parse(db.props.RUN_STATE);
    console.log(`[exec ${n}] fase=${st.phase} unidade=${st.unitIdx} pág=${st.page}/${st.totalPages} stats=${JSON.stringify(st.stats)} http=${httpCount} t=${Math.round((Date.now() - t0) / 1000)}s`);
    if (st.phase === 'done') break;
    vm.runInContext('EXEC_START_ = Date.now();', ctx);   // nova execução (como o acionador de continuação)
    ctx.continueScan();
    n++;
  }
  save();
  mails.forEach((m, i) => {
    fs.writeFileSync(path.join(workdir, `email_${i}.html`), m.htmlBody);
    console.log('E-MAIL:', m.to, '|', m.subject, '| anexos:', (m.attachments || []).length);
  });
  console.log('triggers criados:', triggers);
  console.log(`Concluído em ${Math.round((Date.now() - t0) / 1000)}s, ${httpCount} requisições HTTP, ${n} execuções.`);
}
