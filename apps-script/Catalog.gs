/**
 * Catalog.gs: normalização de texto, carregamento do catálogo (aba CATALOGO, ou o catálogo RENEM
 * padrão de CatalogData.gs) e identificação de produtos nos textos das contratações.
 *
 * Níveis: 1 = nome do produto RENEM (ou variação/CATMAT); 2 = sinônimo de uso comum.
 * Produtos marcados "Exige contexto de saúde" (computador, cadeira, ar-condicionado, veículos...)
 * só contam quando a contratação é da saúde (órgão/objeto) ou já tem outro equipamento de saúde.
 */

/** Normaliza texto: minúsculas, sem acento, sem pontuação, espaços únicos. */
function normalizeText(s) {
  if (s == null) return '';
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Padrão de uma palavra aceitando plural e variações simples. */
function wordPattern_(w) {
  if (/^\d+$/.test(w)) return w;
  if (w.length <= 3) return w + 's?';
  if (/ao$/.test(w)) return w.slice(0, -2) + '(?:ao|oes|aes|aos)';
  if (/[rz]$/.test(w)) return w + '(?:es)?';
  if (/il$/.test(w)) return w.slice(0, -1) + '(?:l|s)';
  if (/[aeo]l$/.test(w)) return w.slice(0, -1) + '(?:l|is)';
  if (/m$/.test(w)) return w.slice(0, -1) + '(?:m|ns)';
  if (/s$/.test(w)) return w.replace(/s$/, '') + 's?';
  return w + 's?';
}

var CONNECTOR_ = '(?:(?:de|do|da|dos|das|para|p|com|e|em|tipo)\\s+)?';

/** Constrói regex para um termo (ex.: "suporte de soro" casa "suportes para soro"). */
function termRegex_(term) {
  var words = normalizeText(term).split(' ').filter(function (w) {
    return w && ['de', 'do', 'da', 'dos', 'das', 'para', 'com', 'e', 'em'].indexOf(w) < 0;
  });
  if (!words.length) return null;
  var body = words.map(wordPattern_).join('\\s+' + CONNECTOR_);
  return new RegExp('(?:^|\\s)' + body + '(?=\\s|$)');
}

/** Chave de índice de uma palavra (4 primeiras letras; palavras curtas inteiras). */
function idxKey_(w) { return w.length >= 4 ? w.slice(0, 4) : w; }
var STOP_ = ['de', 'do', 'da', 'dos', 'das', 'para', 'com', 'e', 'em', 'a', 'o', 'tipo'];

/**
 * Monta o identificador a partir das linhas do catálogo.
 * rows: objetos {id, categoria, produto, renem, catmat, sinonimos, palavras, ativo, exigeSaude}
 */
function buildMatcher(rows) {
  var entries = [], index = {};
  rows.forEach(function (r) {
    if (r.ativo === false) return;
    var generic = /gen[eé]rico/i.test(r.categoria);
    var add = function (term, level) {
      var re = termRegex_(term);
      if (!re) return;
      var first = normalizeText(term).split(' ').filter(function (w) { return w && STOP_.indexOf(w) < 0; })[0];
      var e = { re: re, term: term, level: level, row: r, generic: generic };
      entries.push(e);
      var k = idxKey_(first);
      (index[k] = index[k] || []).push(e);
    };
    add(r.produto.replace(/\(.*?\)/g, ''), 1);
    String(r.palavras || '').split(/[;|\n]/).forEach(function (t) { if (t.trim()) add(t.replace(/\(.*?\)/g, '').trim(), 1); });
    String(r.sinonimos || '').split(/[;|\n]/).forEach(function (t) { if (t.trim()) add(t.trim(), 2); });
  });
  var catmatIndex = {};
  rows.forEach(function (r) {
    String(r.catmat || '').split(/[;,\s]+/).forEach(function (c) { if (/^\d+$/.test(c)) catmatIndex[c] = r; });
  });
  return { entries: entries, index: index, catmat: catmatIndex };
}

/**
 * Procura produtos do catálogo em um texto.
 * @param healthCtx true se a contratação é da área da saúde (libera produtos "Exige contexto de saúde").
 *        Se omitido, os produtos que exigem contexto voltam marcados com needsHealth (use filterByHealth_).
 * @return {Array<{row:Object, level:number, term:string, generic:boolean, needsHealth:boolean}>}
 */
function matchProducts(matcher, text, catmatCode, healthCtx) {
  var norm = normalizeText(text);
  var t = ' ' + norm + ' ';
  var byProduct = {};
  if (catmatCode && matcher.catmat[String(catmatCode)]) {
    var rc = matcher.catmat[String(catmatCode)];
    byProduct[rc.id] = { row: rc, level: 1, term: 'CATMAT ' + catmatCode, generic: false, needsHealth: !!rc.exigeSaude };
  }
  var seenKey = {}, cands = [];
  norm.split(' ').forEach(function (w) {
    [w, w.replace(/s$/, '')].forEach(function (x) {
      var k = idxKey_(x);
      if (x && !seenKey[k] && matcher.index[k]) { seenKey[k] = true; cands = cands.concat(matcher.index[k]); }
    });
  });
  var spans = [];
  cands.forEach(function (e) {
    var mm = e.re.exec(t);
    if (!mm) return;
    var sp = { a: mm.index, b: mm.index + mm[0].length, id: e.row.id };
    spans.push(sp);
    var cur = byProduct[e.row.id];
    if (!cur || e.level < cur.level) byProduct[e.row.id] = { row: e.row, level: e.level, term: e.term, generic: e.generic, needsHealth: !!e.row.exigeSaude, spans: [] };
    byProduct[e.row.id].spans.push(sp);
  });
  // Termo contido num termo maior de outro produto ("cadeira" em "cadeira de rodas") não conta.
  Object.keys(byProduct).forEach(function (id) {
    var own = byProduct[id].spans;
    if (!own || !own.length) return;  // CATMAT
    var allInside = own.every(function (s1) {
      return spans.some(function (s2) { return s2.id !== id && s2.a <= s1.a && s2.b >= s1.b && (s2.b - s2.a) > (s1.b - s1.a); });
    });
    if (allInside) delete byProduct[id];
  });
  var out = Object.keys(byProduct).map(function (k) { return byProduct[k]; });
  // Se houver produto específico, o genérico é redundante.
  if (out.some(function (h) { return !h.generic; })) out = out.filter(function (h) { return !h.generic; });
  if (healthCtx !== undefined) out = filterByHealth_(out, healthCtx);
  return out;
}

/** Remove produtos que exigem contexto de saúde quando a contratação não é da saúde. */
function filterByHealth_(hits, healthCtx) {
  var strong = hits.some(function (h) { return !h.needsHealth && !h.generic; });
  if (healthCtx || strong) return hits;
  return hits.filter(function (h) { return !h.needsHealth; });
}

/** Linhas padrão do catálogo (RENEM) no formato da aba CATALOGO. */
function defaultCatalogRows_() {
  return RENEM_CATALOG.map(function (d) {
    return [d[0], d[1], d[2], d[3], '', '', '', d[4], d[5], 'SIM',
      d[0].indexOf('RENEM') === 0 ? 'Catálogo RENEM (equipamentosrenem.com.br, 28/11/2026)' : 'Família genérica (oportunidade contextual)',
      '', '', d[6]];
  });
}

/** Carrega o catálogo da aba CATALOGO (ou o padrão, se a aba estiver vazia). */
function loadProductCatalog() {
  var sh = getSheet_(NR.SHEETS.CAT);
  var values = (sh && sh.getLastRow() > 1)
    ? sh.getRange(2, 1, sh.getLastRow() - 1, CAT_COLS.length).getValues()
    : defaultCatalogRows_();
  var rows = values.filter(function (v) { return v[2]; }).map(function (v) {
    return {
      id: String(v[0] || v[2]), categoria: String(v[1] || ''), produto: String(v[2]),
      renem: String(v[3] || ''), catmat: String(v[4] || ''), sinonimos: String(v[7] || ''),
      palavras: String(v[8] || ''), ativo: !/^(n|nao|não|no|false|0|inativo)$/i.test(String(v[9]).trim()),
      exigeSaude: /^(s|sim|y|yes|true|1)$/i.test(String(v[13] || '').trim())
    };
  });
  return buildMatcher(rows);
}
