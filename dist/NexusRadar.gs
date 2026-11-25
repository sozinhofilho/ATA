// NEXUS RADAR — Oportunidades Públicas Hospitalares
// Arquivo único gerado por build.sh em 2026-11-25. Cole TODO o conteúdo no arquivo Código.gs do Apps Script.

// ======================= Config.gs =======================
/**
 * NEXUS RADAR — Oportunidades Públicas Hospitalares
 * Config.gs: constantes, nomes de abas, colunas e leitura da aba CONFIGURACOES.
 */

var NR = {
  VERSION: '1.0.0',
  SPREADSHEET_NAME: 'Nexus Radar — Oportunidades Hospitalares',
  TZ: 'America/Sao_Paulo',
  SHEETS: {
    NOVAS: 'NOVAS OPORTUNIDADES',
    ABERTAS: 'OPORTUNIDADES ABERTAS',
    HIST: 'HISTORICO',
    CAT: 'CATALOGO',
    CFG: 'CONFIGURACOES',
    LOGS: 'LOGS'
  },
  PNCP_CONSULTA: 'https://pncp.gov.br/api/consulta',
  PNCP_API: 'https://pncp.gov.br/api/pncp',
  PNCP_APP: 'https://pncp.gov.br/app/editais',
  // Tempo máximo de trabalho por execução (o limite do Google é 6 min).
  MAX_RUN_MS: 4.5 * 60 * 1000,
  CONTINUE_AFTER_MS: 60 * 1000
};

/** Colunas das abas de oportunidades (33 do escopo + 3 técnicas). */
var COLS = [
  'ID único', 'Data de identificação', 'Data de publicação', 'Última atualização',
  'Estado', 'Município', 'Código IBGE', 'Órgão responsável', 'CNPJ do órgão',
  'Tipo de oportunidade', 'Objeto', 'Produtos identificados', 'Categoria',
  'Código RENEM', 'Código CATMAT', 'Quantidade', 'Valor estimado da aquisição',
  'Valor aprovado', 'Valor transferido', 'Situação oficial', 'Situação interpretada',
  'Prioridade', 'Motivo da classificação', 'Prazo para propostas',
  'Número do processo ou proposta', 'Número de controle PNCP', 'Fonte oficial',
  'Link da oportunidade', 'Link dos documentos', 'Telefone institucional',
  'E-mail institucional', 'Pendências de validação', 'Observações manuais',
  // técnicas
  'Nível de correspondência', 'Modalidade', 'Última verificação'
];
var C = {};
COLS.forEach(function (n, i) { C[n] = i; });

var CAT_COLS = ['ID', 'Categoria', 'Produto', 'Código RENEM', 'Código CATMAT', 'Marca', 'Modelo',
  'Sinônimos', 'Palavras-chave', 'Produto ativo', 'Fonte', 'Ata vigente', 'Observações'];

var LOG_COLS = ['Data/hora', 'Execução', 'Fonte', 'Etapa', 'Registros', 'Resultado', 'Detalhes'];

/** Parâmetros editáveis na aba CONFIGURACOES: [chave, valor padrão, descrição]. */
var CFG_DEFAULTS = [
  ['E-mail destinatário', 'sozinho.filho@gmail.com', 'Quem recebe o relatório. Separe vários por vírgula.'],
  ['Envio de e-mail diário', 'SIM', 'SIM ou NÃO.'],
  ['Exportação em Excel', 'SIM', 'SIM ou NÃO. Anexa o .xlsx ao e-mail.'],
  ['Hora do relatório', 7, 'Hora aproximada (0-23) do e-mail. A coleta começa 1 hora antes. Rode installTriggers() após mudar.'],
  ['Estados (UF)', '', 'Vazio = Brasil inteiro. Ou siglas separadas por vírgula, ex.: SC,PR,RS'],
  ['Modalidades PNCP', '4,5,6,7,8', '4 Concorrência eletrônica, 5 Concorrência presencial, 6 Pregão eletrônico, 7 Pregão presencial, 8 Dispensa, 9 Inexigibilidade, 12 Credenciamento'],
  ['Período da pesquisa inicial (dias)', 30, 'Usado apenas na primeira coleta.'],
  ['Janela de segurança (dias)', 7, 'Nas coletas diárias, reconsulta as publicações destes últimos dias.'],
  ['Monitorar oportunidades abertas', 'SIM', 'Reconsulta diariamente a situação das oportunidades em aberto.'],
  ['Dias de acompanhamento após prazo', 60, 'Por quantos dias após o prazo de propostas a situação continua sendo verificada.'],
  ['Buscar itens das contratações', 'SIM', 'Consulta os itens para identificar produtos e quantidades.'],
  ['Requisições simultâneas', 4, 'Paralelismo das chamadas ao PNCP (1 a 8). Reduza se aparecer erro 429.'],
  ['Máximo de oportunidades no e-mail', 10, 'Quantas oportunidades detalhar no corpo do e-mail.']
];

/** Lê a aba CONFIGURACOES e devolve um objeto normalizado. Nunca lê dados coletados. */
function getConfig() {
  var sh = getSheet_(NR.SHEETS.CFG);
  var map = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0]) map[String(r[0]).trim()] = r[1];
    });
  }
  function v(key) {
    if (map.hasOwnProperty(key) && map[key] !== '') return map[key];
    for (var i = 0; i < CFG_DEFAULTS.length; i++) if (CFG_DEFAULTS[i][0] === key) return CFG_DEFAULTS[i][1];
    return '';
  }
  function yes(key) { return /^(s|sim|y|yes|true|1|ativo)$/i.test(String(v(key)).trim()); }
  function list(key) {
    return String(v(key)).split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(String);
  }
  function num(key, min, max) {
    var n = Number(v(key));
    if (isNaN(n)) n = Number(CFG_DEFAULTS.filter(function (d) { return d[0] === key; })[0][1]);
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  return {
    recipients: list('E-mail destinatário').filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }).join(','),
    emailOn: yes('Envio de e-mail diário'),
    excelOn: yes('Exportação em Excel'),
    hour: num('Hora do relatório', 0, 23),
    ufs: list('Estados (UF)').map(function (u) { return u.toUpperCase(); }).filter(function (u) { return /^[A-Z]{2}$/.test(u); }),
    modalidades: list('Modalidades PNCP').map(Number).filter(function (n) { return n > 0 && n < 20; }),
    initialDays: num('Período da pesquisa inicial (dias)', 1, 90),
    windowDays: num('Janela de segurança (dias)', 1, 30),
    monitorOpen: yes('Monitorar oportunidades abertas'),
    followDays: num('Dias de acompanhamento após prazo', 0, 365),
    fetchItems: yes('Buscar itens das contratações'),
    concurrency: num('Requisições simultâneas', 1, 8),
    topN: num('Máximo de oportunidades no e-mail', 1, 50)
  };
}

function getSS_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* cai para a planilha ativa */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Planilha não encontrada. Rode setupSystem() a partir da planilha (Extensões > Apps Script).');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(name) { return getSS_().getSheetByName(name); }

// ======================= Http.gs =======================
/**
 * Http.gs: chamadas HTTP com paralelismo controlado, retentativas e espera progressiva.
 * Somente GET em APIs públicas. Nenhuma escrita em sistemas governamentais.
 */

/**
 * Executa várias URLs (GET) em lotes de `concurrency`. Retenta 429/5xx/erros de rede.
 * @return {Array<{url:string, ok:boolean, code:number, data:*, error:string}>}
 */
function httpGetJsonAll_(urls, concurrency, maxAttempts) {
  concurrency = concurrency || 4;
  maxAttempts = maxAttempts || 4;
  var results = new Array(urls.length);
  var pending = urls.map(function (u, i) { return i; });
  var attempt = 0;
  while (pending.length && attempt < maxAttempts) {
    attempt++;
    var retry = [];
    var saw429 = false;
    for (var s = 0; s < pending.length; s += concurrency) {
      var chunk = pending.slice(s, s + concurrency);
      var reqs = chunk.map(function (i) {
        return { url: urls[i], method: 'get', muteHttpExceptions: true, headers: { Accept: 'application/json' } };
      });
      var resps;
      try {
        resps = UrlFetchApp.fetchAll(reqs);
      } catch (e) {
        // Falha de rede do lote inteiro: marca todos para nova tentativa.
        chunk.forEach(function (i) { results[i] = { url: urls[i], ok: false, code: 0, data: null, error: String(e) }; retry.push(i); });
        continue;
      }
      for (var k = 0; k < chunk.length; k++) {
        var i = chunk[k];
        var r = parseResponse_(urls[i], resps[k]);
        results[i] = r;
        if (!r.ok && (r.code === 429 || r.code >= 500 || r.code === 0)) {
          retry.push(i);
          if (r.code === 429) saw429 = true;
        }
      }
      if (saw429) { Utilities.sleep(2000); saw429 = false; }
    }
    pending = retry;
    if (pending.length) Utilities.sleep(Math.min(20000, 1500 * Math.pow(2, attempt - 1)));
  }
  return results;
}

function httpGetJson_(url) { return httpGetJsonAll_([url], 1, 4)[0]; }

function parseResponse_(url, resp) {
  var code = resp.getResponseCode();
  if (code === 204) return { url: url, ok: true, code: code, data: null, error: '' };
  var text = resp.getContentText('UTF-8');
  if (code >= 200 && code < 300) {
    if (!text) return { url: url, ok: true, code: code, data: null, error: '' };
    try {
      return { url: url, ok: true, code: code, data: JSON.parse(text), error: '' };
    } catch (e) {
      return { url: url, ok: false, code: code, data: null, error: 'Resposta não é JSON' };
    }
  }
  var msg = 'HTTP ' + code;
  if (code === 429) msg += ' (limite de requisições excedido)';
  else if (code === 401 || code === 403) msg += ' (acesso negado/credencial)';
  else if (code >= 500) msg += ' (indisponibilidade da fonte)';
  try { var j = JSON.parse(text); if (j && j.message) msg += ': ' + String(j.message).slice(0, 200); } catch (e) { /* html */ }
  return { url: url, ok: false, code: code, data: null, error: msg };
}

function qs_(params) {
  return Object.keys(params).filter(function (k) { return params[k] !== '' && params[k] != null; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
}

// ======================= Catalog.gs =======================
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
  ['Diagnóstico', 'Equipamentos de diagnóstico', 'esfigmomanometro; aparelho de pressao arterial; estetoscopio; otoscopio; oftalmoscopio; laringoscopio; detector fetal; sonar doppler; doppler fetal; nebulizador; cardiotocografo; colposcopio; ultrassonografo; aparelho de ultrassom; reanimador manual; ambu'],
  ['Emergência e neonatal', 'Incubadora neonatal', 'incubadora de transporte; incubadora para recem nascido; incubadora para rn; incubadora infantil; fototerapia; aparelho de fototerapia; berco aquecido'],
  ['Equipamentos para UBS', 'Câmara de conservação de vacinas', 'camara de conservacao de vacinas; camara para conservacao de vacinas; camara fria para vacinas; refrigerador para vacinas; camara de vacinas; caixa termica para vacinas'],
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

// ======================= Classify.gs =======================
/**
 * Classify.gs: pré-filtro, níveis de correspondência, situação interpretada e prioridade.
 * Regras simples e explicáveis (sem pontuação complexa), conforme o escopo.
 */

// Objetos que, sem produto explícito, não são oportunidades de equipamento/mobiliário.
var EXCLUDE_RE_ = new RegExp([
  'medicament', 'farmac', 'generos alimenticios', 'alimentacao escolar', 'merenda', 'hortifrut',
  'material de limpeza', 'produtos de limpeza', 'saneantes', 'combustive', 'pneu', 'pecas automotivas',
  'servicos medicos', 'plantao', 'plantoes', 'contratacao de profissionais', 'credenciamento de (?:medicos|profissionais|clinicas|laboratorios|prestadores)',
  'exames laboratoriais', 'exames de imagem', 'consultas medicas', 'transporte escolar', 'coleta de lixo',
  'residuos', 'pavimentacao', 'recapeamento', 'iluminacao publica', 'material de expediente',
  'material escolar', 'uniformes', 'software', 'licenca de uso', 'oxigenio medicinal', 'gases medicinais',
  'veterinari', 'ambulatorio animal', 'animais', 'castracao', 'zoonoses', 'laboratorio de analises',
  'material de consumo', 'insumos', 'material medico hospitalar de consumo', 'luvas', 'seringas', 'curativos'
].join('|'));

// Indica serviço sobre o bem (não aquisição): reduz prioridade.
var SERVICE_RE_ = /(manuten|locacao|aluguel|conserto|reparo|calibra|assistencia tecnica|comodato|prestacao de servico|servicos tecnicos|contratacao de empresa para (?:prestacao|execucao))/;
var ACQUIRE_RE_ = /(aquisicao|aquisicoes|compra de|fornecimento de (?:equipamento|mobiliario|moveis|bens))/;
// Peças, insumos e reposição (não é equipamento novo).
var PARTS_RE_ = /(pecas|insumos|acessorios|reposicao|material de consumo)/;
var NEW_EQUIP_RE_ = /(aquisicao|aquisicoes|compra|fornecimento)(?: (?:parcelada|futura|futuras|eventual|eventuais|e|de|do|da|dos|das|para|novos|novas))* (?:equipamento|mobiliario|moveis|materiais permanentes|material permanente|bens permanentes)/;
// Fora do escopo mesmo que algum item coincida (uso veterinário, brinquedos/escolar).
var HARD_EXCLUDE_RE_ = /(veterinari|uso animal|ambulatorio animal|clinica veterinaria|brinquedo|jogos pedagogicos|ludic)/;

// Contexto de saúde (objeto ou nome do órgão/unidade).
var HEALTH_RE_ = /(?:^|\s)(saude|hospital\w*|ubs|upa|unidades? basicas? de saude|posto de saude|pronto atendimento|pronto socorro|policlinica|caps|samu|maternidade|clinicas?|ambulatori\w*|fms|centro de especialidades|esf)(?=\s|$)/;
// Contexto de equipamento permanente.
var EQUIP_RE_ = /(equipamento|mobiliario|moveis|material permanente|materiais permanentes|bens permanentes|aparelho|mobilia)/;
var STRUCT_RE_ = /(estruturacao|implantacao|ampliacao|aparelhamento|equipar|equipagem)/;

/**
 * Pré-classificação só com o objeto e nomes do órgão (sem itens).
 * @return {{hits:Array, contextual:boolean, excluded:boolean, service:boolean}}
 */
function preClassify(matcher, objeto, orgaoTexto) {
  var o = normalizeText(objeto);
  var org = normalizeText(orgaoTexto);
  var hits = matchProducts(matcher, objeto);
  if (HARD_EXCLUDE_RE_.test(o)) return { hits: [], contextual: false, excluded: true, service: false };
  var service = SERVICE_RE_.test(o) && !ACQUIRE_RE_.test(o);
  var parts = PARTS_RE_.test(o) && !NEW_EQUIP_RE_.test(o);
  var excluded = EXCLUDE_RE_.test(o);
  var health = HEALTH_RE_.test(o) || HEALTH_RE_.test(org);
  var contextual = !hits.length && health && (EQUIP_RE_.test(o) || (STRUCT_RE_.test(o) && ACQUIRE_RE_.test(o)));
  // Processo misto (ex.: medicamentos + equipamentos): mantém se houver equipamento no objeto.
  if (excluded && EQUIP_RE_.test(o)) excluded = false;
  return { hits: hits, contextual: contextual && !excluded, excluded: excluded && !hits.length, service: service, parts: parts };
}

/** Situação interpretada a partir dos dados oficiais do PNCP. */
function interpretStatus(rec, now) {
  now = now || new Date();
  var sid = Number(rec.situacaoId);
  if (sid === 2) return 'Revogada';
  if (sid === 3) return 'Cancelada';
  if (sid === 4) return 'Situação a validar';            // suspensa
  if (rec.valorHomologado && Number(rec.valorHomologado) > 0) return 'Contratação concluída';
  var enc = rec.prazo instanceof Date ? rec.prazo : null;
  if (!enc) return 'Situação a validar';
  if (enc.getTime() > now.getTime()) return 'Licitação aberta';
  return 'Licitação em julgamento';
}

function opportunityType_(status, modalidade) {
  var m = modalidade ? ' (' + modalidade + ')' : '';
  if (status === 'Licitação aberta') return 'C — Licitação aberta' + m;
  if (status === 'Licitação em julgamento') return 'C — Licitação em julgamento' + m;
  if (status === 'Contratação concluída' || status === 'Cancelada' || status === 'Revogada') return 'D — Contratação encerrada' + m;
  if (status === 'Planejamento identificado' || status === 'Pesquisa de preços') return 'B — Compra em planejamento';
  if (status === 'Recurso identificado') return 'A — Recurso identificado';
  return 'C — Processo a validar' + m;
}

/**
 * Classificação final de uma oportunidade.
 * @param pre resultado de preClassify
 * @param itemHits produtos encontrados nos itens (pode ser null se itens não consultados)
 * @return {{keep:boolean, nivel:number, prioridade:string, motivo:string, pendencias:string[], hits:Array}}
 */
function classifyOpportunity(pre, itemHits, status, publishedAt, now) {
  now = now || new Date();
  var hits = mergeHits_(pre.hits, itemHits || []);
  var specific = hits.filter(function (h) { return !h.generic; });
  var nivel = 0;
  if (specific.length) nivel = Math.min.apply(null, specific.map(function (h) { return h.level; }));
  else if (hits.length) nivel = 2;
  else if (pre.contextual) nivel = 3;

  var pend = [];
  // Contextual sem produto nos itens (itens consultados e com conteúdo) => descartar.
  if (nivel === 3 && itemHits && itemHits._itemsChecked && itemHits._itemCount > 0) {
    return { keep: false, nivel: 0, prioridade: '', motivo: 'Itens consultados sem produto compatível', pendencias: [], hits: [] };
  }
  if (!nivel) return { keep: false, nivel: 0, prioridade: '', motivo: '', pendencias: [], hits: [] };

  var closed = ['Contratação concluída', 'Cancelada', 'Revogada'].indexOf(status) >= 0;
  var open = status === 'Licitação aberta';
  var ageDays = publishedAt instanceof Date ? (now - publishedAt) / 86400000 : 999;
  var prio, motivo;

  if (pre.service) {
    prio = 'Baixa';
    motivo = 'Objeto indica serviço (manutenção/locação), não aquisição';
  } else if (pre.parts) {
    prio = 'Baixa';
    motivo = 'Objeto indica peças/insumos/reposição, não equipamento novo';
  } else if (closed) {
    prio = 'Baixa';
    motivo = 'Processo encerrado (' + status.toLowerCase() + ')';
  } else if (specific.length && open && ageDays <= 60) {
    prio = 'Alta';
    motivo = 'Produto identificado (' + specific.map(function (h) { return h.row.produto; }).slice(0, 3).join(', ') +
      ') em processo com propostas abertas, publicado há ' + Math.max(0, Math.round(ageDays)) + ' dia(s)';
  } else if (specific.length) {
    prio = 'Média';
    motivo = 'Produto identificado, mas situação "' + status + '"';
  } else if (nivel === 2) {
    prio = open ? 'Média' : 'Baixa';
    motivo = 'Termo genérico de equipamento/mobiliário hospitalar, sem produto especificado';
    pend.push('Confirmar quais equipamentos fazem parte do processo');
  } else {
    prio = 'Baixa';
    motivo = 'Oportunidade contextual: equipamentos/material permanente para saúde sem item específico identificado';
    pend.push('Validação humana: verificar itens e edital');
  }
  if (status === 'Situação a validar') pend.push('Confirmar situação na fonte oficial');
  if (itemHits && itemHits._itemsError) pend.push('Itens não puderam ser consultados');
  if (itemHits && itemHits._truncated) pend.push('Processo com muitos itens: lista parcial');
  return { keep: true, nivel: nivel, prioridade: prio, motivo: motivo, pendencias: pend, hits: hits };
}

function mergeHits_(a, b) {
  var m = {};
  a.concat(b).forEach(function (h) {
    var k = h.row.id;
    if (!m[k] || h.level < m[k].level) m[k] = h;
  });
  var out = Object.keys(m).map(function (k) { return m[k]; });
  if (out.some(function (h) { return !h.generic; })) out = out.filter(function (h) { return !h.generic; });
  return out;
}

// ======================= Pncp.gs =======================
/**
 * Pncp.gs: integração com o Portal Nacional de Contratações Públicas (API de consulta, pública,
 * sem autenticação). Endpoints validados com chamadas reais em 24/11/2026:
 *
 *  GET /api/consulta/v1/contratacoes/publicacao  (dataInicial, dataFinal yyyyMMdd, codigoModalidadeContratacao*, uf, pagina*, tamanhoPagina<=50)
 *  GET /api/consulta/v1/contratacoes/proposta    (dataFinal*, codigoModalidadeContratacao, uf, pagina*, tamanhoPagina<=50)
 *  GET /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}   (detalhe/situação)
 *  GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens (pagina, tamanhoPagina<=500)
 *
 * Respostas: 200 JSON {data:[], totalRegistros, totalPaginas, paginasRestantes}; 204 = sem dados;
 * 429 = limite de requisições (tratado com espera e nova tentativa).
 */

var PNCP_PAGE_SIZE = 50;
// Consultas divididas por UF: páginas profundas do PNCP são lentas (~10 s cada após a página 100),
// enquanto as primeiras páginas respondem em ~1 s.
var ALL_UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE',
  'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

function ymd_(d) { return Utilities.formatDate(d, NR.TZ, 'yyyyMMdd'); }

function addDays_(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }

/** URL de uma página de uma "unidade" de coleta. */
function pncpUnitUrl_(unit, page) {
  if (unit.type === 'prop') {
    return NR.PNCP_CONSULTA + '/v1/contratacoes/proposta?' + qs_({
      dataFinal: unit.dataFinal, codigoModalidadeContratacao: unit.mod || '', uf: unit.uf || '',
      pagina: page, tamanhoPagina: PNCP_PAGE_SIZE
    });
  }
  return NR.PNCP_CONSULTA + '/v1/contratacoes/publicacao?' + qs_({
    dataInicial: unit.date, dataFinal: unit.date, codigoModalidadeContratacao: unit.mod,
    uf: unit.uf || '', pagina: page, tamanhoPagina: PNCP_PAGE_SIZE
  });
}

/**
 * Lista determinística de unidades de coleta (não precisa ser guardada inteira no checkpoint).
 * Ordem: propostas abertas (só na carga inicial) e depois publicações dia a dia, por modalidade e UF.
 */
function pncpUnits_(plan) {
  var units = [];
  var ufs = plan.ufs.length ? plan.ufs : ALL_UFS;
  if (plan.includeProposta) {
    // dataFinal = limite do prazo de encerramento; 12 meses à frente cobre todas as propostas abertas.
    ufs.forEach(function (uf) { units.push({ type: 'prop', dataFinal: plan.propTo || plan.to, uf: uf }); });
  }
  var d = parseYmd_(plan.from), end = parseYmd_(plan.to);
  while (d.getTime() <= end.getTime()) {
    var day = ymd_(d);
    plan.mods.forEach(function (m) {
      ufs.forEach(function (uf) { units.push({ type: 'pub', date: day, mod: m, uf: uf }); });
    });
    d = addDays_(d, 1);
  }
  return units;
}

function parseYmd_(s) { return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)), 12); }

function parseDate_(s) {
  if (!s) return null;
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
}

/** Converte um registro de contratação do PNCP no formato interno. */
function normalizeData(c) {
  var org = c.orgaoEntidade || {}, un = c.unidadeOrgao || {};
  var cnpj = String(org.cnpj || '');
  var ano = c.anoCompra, seq = c.sequencialCompra;
  return {
    id: 'PNCP-' + c.numeroControlePNCP,
    controle: c.numeroControlePNCP || '',
    cnpj: cnpj, ano: ano, seq: seq,
    publicado: parseDate_(c.dataPublicacaoPncp),
    atualizado: parseDate_(c.dataAtualizacaoGlobal || c.dataAtualizacao),
    uf: un.ufSigla || '', municipio: un.municipioNome || '', ibge: un.codigoIbge || '',
    orgao: org.razaoSocial || '', unidade: un.nomeUnidade || '',
    objeto: c.objetoCompra || '',
    valorEstimado: typeof c.valorTotalEstimado === 'number' ? c.valorTotalEstimado : null,
    valorHomologado: typeof c.valorTotalHomologado === 'number' ? c.valorTotalHomologado : null,
    situacaoId: c.situacaoCompraId, situacaoNome: c.situacaoCompraNome || '',
    prazo: parseDate_(c.dataEncerramentoProposta),
    processo: [c.processo ? 'Processo ' + c.processo : '', c.numeroCompra ? 'Compra ' + c.numeroCompra + '/' + ano : ''].filter(String).join(' · '),
    modalidade: c.modalidadeNome || '',
    srp: !!c.srp,
    link: 'https://pncp.gov.br/app/editais/' + cnpj + '/' + ano + '/' + seq,
    linkDocs: c.linkSistemaOrigem || (NR.PNCP_API + '/v1/orgaos/' + cnpj + '/compras/' + ano + '/' + seq + '/arquivos')
  };
}

function itemsUrl_(rec) {
  return NR.PNCP_API + '/v1/orgaos/' + rec.cnpj + '/compras/' + rec.ano + '/' + rec.seq + '/itens?pagina=1&tamanhoPagina=500';
}

function detailUrl_(cnpj, ano, seq) {
  return NR.PNCP_CONSULTA + '/v1/orgaos/' + cnpj + '/compras/' + ano + '/' + seq;
}

/** Analisa os itens de uma contratação e devolve os produtos encontrados + resumo. */
function analyzeItems_(matcher, items) {
  var hits = [];
  var perProduct = {};
  var catmat = {};
  (items || []).forEach(function (it) {
    if (it.materialOuServico && it.materialOuServico !== 'M') return; // só materiais
    var code = it.catalogoCodigoItem ? String(it.catalogoCodigoItem) : '';
    var hs = matchProducts(matcher, [it.descricao, it.informacaoComplementar].join(' '), code);
    hs.forEach(function (h) {
      hits.push(h);
      var key = h.row.produto;
      var p = perProduct[key] || (perProduct[key] = { qtd: 0, un: '', valor: 0, n: 0 });
      p.qtd += Number(it.quantidade) || 0;
      p.un = p.un || it.unidadeMedida || '';
      p.valor += Number(it.valorTotal) || 0;
      p.n++;
      if (code) catmat[code] = true;
    });
  });
  var resumo = Object.keys(perProduct).map(function (k) {
    var p = perProduct[k];
    var q = p.qtd ? (Math.round(p.qtd * 100) / 100) + ' ' + (p.un || 'un').toLowerCase() : 'qtd n/d';
    return k + ': ' + q + (p.n > 1 ? ' (' + p.n + ' itens)' : '');
  }).join('; ');
  var valor = Object.keys(perProduct).reduce(function (s, k) { return s + perProduct[k].valor; }, 0);
  hits._itemsChecked = true;
  hits._itemCount = (items || []).length;
  hits._truncated = (items || []).length >= 500;
  hits._resumo = resumo;
  hits._valorItens = valor;
  hits._catmat = Object.keys(catmat).join('; ');
  return hits;
}

/** Busca os itens de vários registros (paralelo controlado). Devolve mapa id -> itemHits. */
function fetchItemsFor_(matcher, recs, concurrency) {
  var out = {};
  if (!recs.length) return out;
  var res = httpGetJsonAll_(recs.map(itemsUrl_), concurrency);
  recs.forEach(function (r, i) {
    var x = res[i];
    if (x && x.ok) {
      out[r.id] = analyzeItems_(matcher, Array.isArray(x.data) ? x.data : []);
    } else {
      var e = []; e._itemsError = true; out[r.id] = e;
    }
  });
  return out;
}

/** Coleta páginas de contratações de uma unidade. Função pública exigida pelo escopo. */
function fetchPNCP(unit, pages, concurrency) {
  var urls = pages.map(function (p) { return pncpUnitUrl_(unit, p); });
  return httpGetJsonAll_(urls, concurrency);
}

/** Consulta o detalhe atual (situação, homologação) de contratações já registradas. */
function fetchPNCPDetails_(ids, concurrency) {
  var valid = ids.filter(function (id) { return parseControle_(id); });
  var res = httpGetJsonAll_(valid.map(function (id) {
    var p = parseControle_(id); return detailUrl_(p.cnpj, p.ano, p.seq);
  }), concurrency);
  return res.map(function (r, i) { return { id: valid[i], ok: !!(r.ok && r.data), data: r.data, error: r.error }; });
}

/** "93235968000188-1-000246/2026" -> {cnpj, ano, seq} */
function parseControle_(ctrl) {
  var m = String(ctrl).replace(/^PNCP-/, '').match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  return m ? { cnpj: m[1], seq: Number(m[2]), ano: Number(m[3]) } : null;
}

// ======================= Store.gs =======================
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

// ======================= Report.gs =======================
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
    (link ? '<div style="margin-top:4px"><b>Fonte oficial:</b> <a href="' + esc_(link) + '">Abrir no PNCP</a></div>' : '') +
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

// ======================= Main.gs =======================
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
  if (st && st.phase !== 'done' && Date.now() - st.startedAt < 3 * 3600 * 1000) return continueScan();
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
