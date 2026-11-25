/**
 * Catalog.gs: catálogo inicial (categorias do escopo + sinônimos), normalização de texto
 * e montagem do identificador de produtos.
 *
 * O catálogo inicial NÃO é o catálogo da Minas Indústria: são categorias genéricas de
 * mobiliário e equipamentos médico-hospitalares. Códigos RENEM/CATMAT ficam vazios até
 * serem confirmados pelo proprietário (não inventamos códigos).
 */

// [Categoria, Produto, Sinônimos separados por ';', Genérico?]
var DEFAULT_CATALOG = [
  ['Camas e leitos', 'Cama hospitalar', 'cama fowler; cama hospitalar fowler; leito hospitalar; cama hospitalar eletrica; cama hospitalar manual; cama hospitalar mecanica; cama de parto; cama ppp; cama para uti; cama hospitalar infantil; cama hospitalar pediatrica; cama hospitalar bariatrica'],
  ['Berços hospitalares', 'Berço hospitalar', 'berco aquecido; berco acrilico; berco hospitalar infantil; berco de acrilico; bercinho hospitalar'],
  ['Macas', 'Maca hospitalar', 'maca de transporte; carro maca; maca retratil; maca para exame; maca para exames; maca fixa; maca ginecologica; maca de emergencia; maca para remocao; maca com grades; maca hidraulica; maca clinica; maca de resgate; maca articulada; maca para transporte'],
  ['Carros hospitalares', 'Carro de emergência', 'carrinho de emergencia; carro de parada; carro para emergencia; carro de urgencia'],
  ['Carros hospitalares', 'Carro de curativos', 'carrinho de curativo; carro de curativo; carro para curativo; carrinho para curativo'],
  ['Carros hospitalares', 'Carro de medicação', 'carro de medicacao; carro para medicacao; carro de medicamentos; carro para medicamentos; carrinho de medicacao; carro de anestesia; carro para anestesia; carro de prontuario; carro hamper; hamper hospitalar; suporte de hamper; carro para instrumental; carro de transporte de materiais hospitalares; carro para roupa suja'],
  ['Mobiliário clínico', 'Mesa de cabeceira hospitalar', 'mesa de cabeceira; mesa de refeicao hospitalar; mesa de refeicao para leito; mesa para refeicao no leito; mesa de cabeceira com mesa de refeicao'],
  ['Mobiliário clínico', 'Mesa ginecológica', 'mesa ginecologica; mesa para exame ginecologico; mesa de parto'],
  ['Mobiliário clínico', 'Mesa de exames', 'mesa de exame; mesa de exame clinico; mesa clinica; mesa para exame clinico; mesa auxiliar hospitalar; mesa auxiliar inox; mesa auxiliar em aco inox; mesa de mayo; mesa para instrumental; mesa de instrumental'],
  ['Mobiliário clínico', 'Divã clínico', 'diva clinico; diva para exame; diva para exames; diva de exame'],
  ['Mobiliário clínico', 'Biombo', 'biombo hospitalar; biombo triplo; biombo duplo'],
  ['Mobiliário clínico', 'Escada de dois degraus', 'escada 2 degraus; escada com 2 degraus; escada com dois degraus; escadinha 2 degraus; escadinha hospitalar'],
  ['Mobiliário clínico', 'Suporte de soro', 'suporte para soro; haste de soro; suporte de soro com rodizios'],
  ['Mobiliário clínico', 'Mocho', 'mocho giratorio; mocho clinico; mocho hospitalar; banqueta giratoria'],
  ['Mobiliário clínico', 'Armário vitrine', 'armario vitrine; armario vitrine hospitalar'],
  ['Mobiliário clínico', 'Negatoscópio', 'negatoscopio'],
  ['Mobiliário clínico', 'Foco auxiliar', 'foco clinico; foco de luz auxiliar; luminaria de exame; foco cirurgico'],
  ['Poltronas hospitalares', 'Poltrona hospitalar', 'poltrona de acompanhante; poltrona para acompanhante; poltrona reclinavel hospitalar; poltrona hospitalar reclinavel; poltrona para coleta; cadeira de coleta; poltrona de coleta; poltrona de hemodialise; poltrona para hemodialise; poltrona para quimioterapia; poltrona reclinavel'],
  ['Cadeiras de rodas e de banho', 'Cadeira de rodas', 'cadeira de rodas para obeso; cadeira de rodas adulto; cadeira de rodas infantil; cadeira de rodas obeso'],
  ['Cadeiras de rodas e de banho', 'Cadeira de banho', 'cadeira higienica; cadeira para banho; cadeira de banho e higienica'],
  ['Balanças antropométricas', 'Balança antropométrica', 'balanca pediatrica; balanca antropometrica digital; balanca digital pediatrica; balanca antropometrica adulto; balanca de bioimpedancia; balanca com regua antropometrica; antropometro; estadiometro; infantometro'],
  ['Monitorização', 'Monitor multiparâmetro', 'monitor multiparametrico; monitor multiparametros; monitor multiparamentro; monitor de sinais vitais; monitor cardiaco; oximetro de pulso; oximetro portatil'],
  ['Infusão', 'Bomba de infusão', 'bomba infusora; bomba de seringa; bomba de infusao volumetrica; bomba de infusao peristaltica'],
  ['Ventilação', 'Ventilador pulmonar', 'ventilador mecanico; respirador pulmonar; ventilador de transporte; ventilador pulmonar de transporte; aparelho de anestesia; cpap; bipap'],
  ['Cardiologia e emergência', 'Desfibrilador', 'cardioversor; desfibrilador externo automatico; dea; desfibrilador cardioversor'],
  ['Cardiologia e emergência', 'Eletrocardiógrafo', 'aparelho de eletrocardiograma; eletrocardiografo digital; ecg de 12 canais'],
  ['Aspiração', 'Aspirador de secreções', 'aspirador de secrecao; aspirador de secrecoes; aspirador cirurgico; aspirador de secrecao portatil'],
  ['Diagnóstico', 'Equipamentos de diagnóstico', 'esfigmomanometro; estetoscopio; otoscopio; oftalmoscopio; laringoscopio; detector fetal; sonar doppler; doppler fetal; nebulizador; cardiotocografo; colposcopio; ultrassonografo; aparelho de ultrassom; reanimador manual; ambu'],
  ['Emergência e neonatal', 'Incubadora neonatal', 'incubadora de transporte; incubadora para recem nascido; incubadora para rn; incubadora infantil; fototerapia; aparelho de fototerapia; berco aquecido'],
  ['Centro cirúrgico e esterilização', 'Autoclave', 'autoclave hospitalar; mesa cirurgica; bisturi eletrico; eletrocauterio'],
  ['Lavanderia hospitalar', 'Lavadora hospitalar', 'lavadora extratora; lavadora de barreira; lavadora hospitalar de roupas; secadora hospitalar; secadora rotativa; centrifuga de roupas; calandra'],
  ['Genérico hospitalar', 'Mobiliário/equipamento hospitalar (genérico)', 'mobiliario hospitalar; moveis hospitalares; equipamento hospitalar; equipamentos hospitalares; equipamento medico hospitalar; equipamentos medico hospitalares; equipamento medico assistencial; equipamentos medicos; material permanente hospitalar; mobiliario clinico; equipamentos para ubs; equipamentos para upa']
];

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

/**
 * Monta o identificador a partir das linhas do catálogo (aba CATALOGO ou padrão).
 * rows: objetos {id, categoria, produto, renem, catmat, sinonimos, palavras, ativo}
 */
function buildMatcher(rows) {
  var entries = [];
  rows.forEach(function (r) {
    if (r.ativo === false) return;
    var generic = /gen[eé]rico/i.test(r.categoria);
    var add = function (term, level) {
      var re = termRegex_(term);
      if (re) entries.push({ re: re, term: term, level: level, row: r, generic: generic });
    };
    add(r.produto.replace(/\(.*?\)/g, ''), 1);
    String(r.sinonimos || '').split(/[;|\n]/).forEach(function (t) { if (t.trim()) add(t.trim(), 2); });
    String(r.palavras || '').split(/[;|\n]/).forEach(function (t) { if (t.trim()) add(t.trim(), 2); });
  });
  var catmatIndex = {};
  rows.forEach(function (r) {
    String(r.catmat || '').split(/[;,\s]+/).forEach(function (c) { if (/^\d+$/.test(c)) catmatIndex[c] = r; });
  });
  return { entries: entries, catmat: catmatIndex };
}

/**
 * Procura produtos do catálogo em um texto.
 * @return {Array<{row:Object, level:number, term:string, generic:boolean}>} um por produto.
 */
function matchProducts(matcher, text, catmatCode) {
  var t = ' ' + normalizeText(text) + ' ';
  var byProduct = {};
  if (catmatCode && matcher.catmat[String(catmatCode)]) {
    var rc = matcher.catmat[String(catmatCode)];
    byProduct[rc.id] = { row: rc, level: 1, term: 'CATMAT ' + catmatCode, generic: false };
  }
  matcher.entries.forEach(function (e) {
    if (!e.re.test(t)) return;
    var cur = byProduct[e.row.id];
    if (!cur || e.level < cur.level) byProduct[e.row.id] = { row: e.row, level: e.level, term: e.term, generic: e.generic };
  });
  var out = Object.keys(byProduct).map(function (k) { return byProduct[k]; });
  // Se houver produto específico, o genérico é redundante.
  if (out.some(function (h) { return !h.generic; })) out = out.filter(function (h) { return !h.generic; });
  return out;
}

/** Linhas padrão do catálogo no formato da aba. */
function defaultCatalogRows_() {
  return DEFAULT_CATALOG.map(function (d, i) {
    return ['CAT-' + ('00' + (i + 1)).slice(-3), d[0], d[1], '', '', '', '', d[2], '', 'SIM',
      'Categorias iniciais do escopo do projeto', '', 'Código RENEM/CATMAT a confirmar'];
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
      palavras: String(v[8] || ''), ativo: !/^(n|nao|não|no|false|0|inativo)$/i.test(String(v[9]).trim())
    };
  });
  return buildMatcher(rows);
}
