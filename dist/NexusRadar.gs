// NEXUS RADAR — Oportunidades Públicas Hospitalares
// Arquivo único gerado por build.sh em 2026-11-28. Cole TODO o conteúdo no arquivo Código.gs do Apps Script.

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

// 'Palavras-chave' guarda os nomes RENEM das variações (contam como nível 1).
var CAT_COLS = ['ID', 'Categoria', 'Produto', 'Código RENEM', 'Código CATMAT', 'Marca', 'Modelo',
  'Sinônimos', 'Palavras-chave', 'Produto ativo', 'Fonte', 'Ata vigente', 'Observações', 'Exige contexto de saúde'];

var LOG_COLS = ['Data/hora', 'Execução', 'Fonte', 'Etapa', 'Registros', 'Resultado', 'Detalhes'];

/** Parâmetros editáveis na aba CONFIGURACOES: [chave, valor padrão, descrição]. */
var CFG_DEFAULTS = [
  ['E-mail destinatário', 'sozinho.filho@gmail.com', 'Quem recebe o relatório. Separe vários por vírgula.'],
  ['Envio de e-mail diário', 'SIM', 'SIM ou NÃO.'],
  ['Exportação em Excel', 'SIM', 'SIM ou NÃO. Anexa o .xlsx ao e-mail.'],
  ['Hora do relatório', 7, 'Hora aproximada (0-23) do e-mail. A coleta começa 1 hora antes. Rode installTriggers() após mudar.'],
  ['Estados (UF)', '', 'Vazio = Brasil inteiro. Ou siglas separadas por vírgula, ex.: SC,PR,RS'],
  ['Modalidades PNCP', '4,5,6,7,8', '4 Concorrência eletrônica, 5 Concorrência presencial, 6 Pregão eletrônico, 7 Pregão presencial, 8 Dispensa, 9 Inexigibilidade, 12 Credenciamento'],
  ['Período da pesquisa inicial (dias)', 7, 'Primeira coleta: todas as licitações com propostas abertas no país + publicações destes últimos dias (máx. 30; valores altos podem levar mais de um dia).'],
  ['Janela de segurança (dias)', 3, 'Nas coletas diárias, reconsulta as publicações destes últimos dias (e automaticamente qualquer intervalo desde a última coleta completa).'],
  ['Monitorar oportunidades abertas', 'SIM', 'Reconsulta diariamente a situação das oportunidades em aberto.'],
  ['Dias de acompanhamento após prazo', 60, 'Por quantos dias após o prazo de propostas a situação continua sendo verificada.'],
  ['Buscar itens das contratações', 'SIM', 'Consulta os itens para identificar produtos e quantidades.'],
  ['Requisições simultâneas', 6, 'Paralelismo das chamadas ao PNCP (1 a 8). Reduza se aparecer erro 429.'],
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
    initialDays: num('Período da pesquisa inicial (dias)', 1, 30),
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

// ======================= CatalogData.gs =======================
/**
 * CatalogData.gs: catálogo RENEM (Relação Nacional de Equipamentos e Materiais Permanentes financiáveis
 * para o SUS) conforme equipamentosrenem.com.br/catalogo, coletado em 2026-11-28
 * (840 itens, tabela FNS de 03/03/2026), agrupado em 779 produtos de busca.
 * Gerado por tools/build_catalog.py. Não edite à mão: edite a aba CATALOGO da planilha.
 *
 * [ID, Categoria, Produto, Códigos RENEM, Sinônimos, Nomes RENEM das variações, Exige contexto de saúde]
 */
var RENEM_CATALOG = [
  ["RENEM-001", "Apoio", "Agogô", "11922", "", "", "SIM"],
  ["RENEM-002", "Apoio", "Alicate de Ordenha para Bolsa de Sangue", "2270", "", "", "NÃO"],
  ["RENEM-003", "Apoio", "Analisador Termogravimétrico", "11952", "", "", "NÃO"],
  ["RENEM-004", "Apoio", "Andador", "909", "", "", "NÃO"],
  ["RENEM-005", "Apoio", "Andador Posterior com 04 Rodas", "11890", "", "", "NÃO"],
  ["RENEM-006", "Apoio", "Aquecedor de Máscaras Termoplásticas para Radioterapia", "11751", "", "", "NÃO"],
  ["RENEM-007", "Apoio", "Armário com Aspiração de Segurança", "11203", "", "", "NÃO"],
  ["RENEM-008", "Apoio", "Armário Eletrônico Dispensador de Medicamentos e Materiais Hospitalares com Sistema Automatizado", "11925", "", "", "NÃO"],
  ["RENEM-009", "Apoio", "Articulador Odontológico", "713", "", "", "NÃO"],
  ["RENEM-010", "Apoio", "Aspirador de Vapores", "10376", "", "", "NÃO"],
  ["RENEM-011", "Apoio", "Autoclave", "10551; 10893; 10892; 10552; 2271", "", "Autoclave Horizontal de Mesa; Autoclave Hospitalar Horizontal; Autoclave Vertical", "NÃO"],
  ["RENEM-012", "Apoio", "Balança Dinâmica", "11796", "", "", "NÃO"],
  ["RENEM-013", "Apoio", "Banco Regulável Ajustável Supino - 0 a 90°", "11935", "", "", "NÃO"],
  ["RENEM-014", "Apoio", "Banco Supino Reto", "11933", "", "", "NÃO"],
  ["RENEM-015", "Apoio", "Banho Ultrassônico", "11338", "", "", "NÃO"],
  ["RENEM-016", "Apoio", "Barra de Flexão em T", "11897", "", "", "NÃO"],
  ["RENEM-017", "Apoio", "Berço Hospitalar com Grades", "20", "berco hospitalar; bercinho hospitalar; berco infantil hospitalar", "", "NÃO"],
  ["RENEM-018", "Apoio", "Berço para Recém Nascido", "2011", "berco acrilico; berco de acrilico; bercario", "", "NÃO"],
  ["RENEM-019", "Apoio", "Biombo", "1737", "biombo hospitalar; biombo triplo; biombo duplo", "", "NÃO"],
  ["RENEM-020", "Apoio", "Biombo Plumbífero", "2745", "", "", "NÃO"],
  ["RENEM-021", "Apoio", "Braçadeira para Injeção", "10541", "", "", "NÃO"],
  ["RENEM-022", "Apoio", "Cabine Audiométrica", "1047", "", "", "NÃO"],
  ["RENEM-023", "Apoio", "Cabine de Exaustão de Pós", "11773", "", "", "NÃO"],
  ["RENEM-024", "Apoio", "Cabine de Pesagem", "1462", "", "", "NÃO"],
  ["RENEM-025", "Apoio", "Cabine de Proteção Biológica", "778", "", "", "NÃO"],
  ["RENEM-026", "Apoio", "Cadeira Adutora e Abdutora", "11934", "", "", "NÃO"],
  ["RENEM-027", "Apoio", "Cadeira de Banho/Higiênica", "1736", "cadeira higienica; cadeira para banho; cadeira de banho", "", "NÃO"],
  ["RENEM-028", "Apoio", "Cadeira de Rodas", "3052; 11246; 11245", "cadeira de rodas para obeso; cadeira de rodas obeso; cadeira de rodas infantil", "Cadeira de Rodas Adulto; Cadeira de Rodas para Obeso; Cadeira de Rodas Pediátrica", "NÃO"],
  ["RENEM-029", "Apoio", "Cadeira Oftalmológica", "1364", "", "", "NÃO"],
  ["RENEM-030", "Apoio", "Cadeira Otorrinológica", "1754", "", "", "NÃO"],
  ["RENEM-031", "Apoio", "Cadeira para Coleta de Sangue", "10994", "poltrona de coleta; poltrona para coleta; cadeira de coleta", "", "NÃO"],
  ["RENEM-032", "Apoio", "Cadeira para Massagem", "10502", "", "", "NÃO"],
  ["RENEM-033", "Apoio", "Caixa para Desinfecção de Limas Endodônticas", "11086", "", "", "NÃO"],
  ["RENEM-034", "Apoio", "Calandra Hospitalar", "11800", "", "", "NÃO"],
  ["RENEM-035", "Apoio", "Calibrador de Pressão", "11147", "", "", "NÃO"],
  ["RENEM-036", "Apoio", "Calorímetro Diferencial de Varredura", "11162", "", "", "NÃO"],
  ["RENEM-037", "Apoio", "Cama Comum", "1236", "", "", "SIM"],
  ["RENEM-038", "Apoio", "Câmara de Conservação para Transporte de Bolsas de Sangue", "1384", "", "", "NÃO"],
  ["RENEM-039", "Apoio", "Câmara Escura Odontológica", "10491", "", "", "NÃO"],
  ["RENEM-040", "Apoio", "Câmara Mortuária", "2940", "", "", "NÃO"],
  ["RENEM-041", "Apoio", "Câmara para Conservação de Hemoderivados/Imuno/Termolábeis", "2460", "", "", "NÃO"],
  ["RENEM-042", "Apoio", "Câmara para Conservação de Imunobiológicos", "3050", "camara de conservacao de vacinas; camara para conservacao de vacinas; camara fria para vacinas; refrigerador para vacinas; camara de vacinas", "", "NÃO"],
  ["RENEM-043", "Apoio", "Câmara para Conservação de Imunobiológicos a Energia Solar", "11608", "", "", "NÃO"],
  ["RENEM-044", "Apoio", "Capela de Exaustão de Gases", "1845", "", "", "NÃO"],
  ["RENEM-045", "Apoio", "Capela de Fluxo Laminar", "1863", "", "", "NÃO"],
  ["RENEM-046", "Apoio", "Carro de Curativos", "1855", "carrinho de curativo; carro de curativo; carro para curativo; carrinho para curativo", "", "NÃO"],
  ["RENEM-047", "Apoio", "Carro de Emergência", "10798", "carrinho de emergencia; carro de parada; carro para emergencia; carro de urgencia; carro de urgencia e emergencia", "", "NÃO"],
  ["RENEM-048", "Apoio", "Carro Maca", "10805; 11045; 1488", "maca hospitalar; maca de transporte; maca retratil; maca com grades; maca hidraulica; maca para transporte; maca de emergencia; maca para remocao; maca articulada; maca fixa", "Carro Maca Avançado; Carro Maca para Ressonância Magnética; Carro Maca Simples", "NÃO"],
  ["RENEM-049", "Apoio", "Carro para Transporte de Cadáveres", "2223", "", "", "NÃO"],
  ["RENEM-050", "Apoio", "Carro Térmico", "2089", "", "", "NÃO"],
  ["RENEM-051", "Apoio", "Cavalete de Pintura", "11916", "", "", "SIM"],
  ["RENEM-052", "Apoio", "Cavaquinho", "11904", "", "", "SIM"],
  ["RENEM-053", "Apoio", "Centrífuga de Roupas", "11802", "", "", "NÃO"],
  ["RENEM-054", "Apoio", "Centrifugador para Prótese Dentária", "10929", "", "", "NÃO"],
  ["RENEM-055", "Apoio", "Chapa Aquecedora", "11782", "", "", "SIM"],
  ["RENEM-056", "Apoio", "Chocalho", "11910", "", "", "SIM"],
  ["RENEM-057", "Apoio", "Chuveiro Lava-Olhos", "2656", "", "", "NÃO"],
  ["RENEM-058", "Apoio", "Cilindro de CO2", "11252", "", "", "SIM"],
  ["RENEM-059", "Apoio", "Cilindro de Gases Medicinais", "782", "", "", "NÃO"],
  ["RENEM-060", "Apoio", "Coletor de Dados Hospitalar", "11946", "", "Coletor de Dados Hospitalar Móvel", "NÃO"],
  ["RENEM-061", "Apoio", "Comadre", "1006", "", "", "SIM"],
  ["RENEM-062", "Apoio", "Compressor Odontológico", "3119", "", "", "NÃO"],
  ["RENEM-063", "Apoio", "Compressora", "2149", "", "", "NÃO"],
  ["RENEM-064", "Apoio", "Condutivímetro", "2160", "", "", "NÃO"],
  ["RENEM-065", "Apoio", "Conjunto de Bancos Coloridos", "11912", "", "", "SIM"],
  ["RENEM-066", "Apoio", "Conjunto de Controle de Qualidade e Dosimetria para Radioterapia", "11749", "", "", "NÃO"],
  ["RENEM-067", "Apoio", "Conjunto de Fixação de Pacientes em Radioterapia", "11750", "", "", "NÃO"],
  ["RENEM-068", "Apoio", "Contador de Cápsula", "11780", "", "", "NÃO"],
  ["RENEM-069", "Apoio", "Deionizador", "2351", "", "", "NÃO"],
  ["RENEM-070", "Apoio", "Desintegrador de Agulhas", "337", "", "", "NÃO"],
  ["RENEM-071", "Apoio", "Dessecador", "636", "", "", "NÃO"],
  ["RENEM-072", "Apoio", "Destilador de Água", "2339", "", "", "NÃO"],
  ["RENEM-073", "Apoio", "Desumidificador", "2303", "", "", "SIM"],
  ["RENEM-074", "Apoio", "Diapasão", "910", "", "", "SIM"],
  ["RENEM-075", "Apoio", "Disco Flexor", "11894", "", "", "SIM"],
  ["RENEM-076", "Apoio", "Dispensador de Parafina", "10522", "", "", "NÃO"],
  ["RENEM-077", "Apoio", "Dispositivo Auxiliar de Marcha", "11837", "", "", "NÃO"],
  ["RENEM-078", "Apoio", "Elevador para Transposição de Leito", "10554", "", "", "NÃO"],
  ["RENEM-079", "Apoio", "Encapsuladora", "2875", "", "", "NÃO"],
  ["RENEM-080", "Apoio", "Equipamento de Moldagem por Compressão à Vácuo", "11955", "", "", "NÃO"],
  ["RENEM-081", "Apoio", "Equipamento para Conexão Estéril", "2301", "", "", "NÃO"],
  ["RENEM-082", "Apoio", "Equipamento para Impregnação e Laminação de Card", "11938", "", "", "NÃO"],
  ["RENEM-083", "Apoio", "Equipamento para Montagem e Embalagem de Cassetes", "11937", "", "", "NÃO"],
  ["RENEM-084", "Apoio", "Equipamento para Teste de Integridade de Filtros", "1592", "", "", "NÃO"],
  ["RENEM-085", "Apoio", "Escada Suspensa", "11893", "", "", "NÃO"],
  ["RENEM-086", "Apoio", "Estadiômetro", "10267", "", "", "NÃO"],
  ["RENEM-087", "Apoio", "Esteira Elétrica para Usuário de Cadeira de Rodas", "11932", "", "", "NÃO"],
  ["RENEM-088", "Apoio", "Esterilizador por Métodos Físicos-Químicos", "10888", "", "", "NÃO"],
  ["RENEM-089", "Apoio", "Estesiômetro", "11919", "", "", "NÃO"],
  ["RENEM-090", "Apoio", "Estufa de CO2", "2841", "", "", "NÃO"],
  ["RENEM-091", "Apoio", "Estufa de Cultura", "410", "", "", "NÃO"],
  ["RENEM-092", "Apoio", "Estufa de Secagem e Esterilização", "2825", "", "", "NÃO"],
  ["RENEM-093", "Apoio", "Expansor de Áudio", "11984", "", "", "SIM"],
  ["RENEM-094", "Apoio", "Expansor de Pele", "10851", "", "", "NÃO"],
  ["RENEM-095", "Apoio", "Extrator Manual de Plasma", "1074", "", "", "NÃO"],
  ["RENEM-096", "Apoio", "Extrusora de Co-Rotação com Duplo Parafuso Aquecido", "11943", "", "", "NÃO"],
  ["RENEM-097", "Apoio", "Flauta", "11905", "", "", "SIM"],
  ["RENEM-098", "Apoio", "Fluorômetro", "11884", "", "", "NÃO"],
  ["RENEM-099", "Apoio", "Fone de Ouvido Monoauricular", "11987", "", "", "SIM"],
  ["RENEM-100", "Apoio", "Forno de Despirogenização", "1618", "", "", "NÃO"],
  ["RENEM-101", "Apoio", "Forno de Sinterização de Zircônia", "11829", "", "", "NÃO"],
  ["RENEM-102", "Apoio", "Forno Fotopolimerizador", "11819", "", "", "NÃO"],
  ["RENEM-103", "Apoio", "Forno Mufla", "2358", "", "", "NÃO"],
  ["RENEM-104", "Apoio", "Forno Ortopédico de Infravermelho", "11214", "", "", "NÃO"],
  ["RENEM-105", "Apoio", "Fotodocumentador Multimodal", "11973", "", "", "NÃO"],
  ["RENEM-106", "Apoio", "Fotopolimerizador de Resinas", "419", "", "", "NÃO"],
  ["RENEM-107", "Apoio", "Freezer Laboratorial", "11743", "", "", "NÃO"],
  ["RENEM-108", "Apoio", "Freezer para Armazenamento de Hemocomponentes", "10930", "", "", "NÃO"],
  ["RENEM-109", "Apoio", "Freezer para Banco de Leite", "10906", "", "", "NÃO"],
  ["RENEM-110", "Apoio", "Freezer para Congelamento Rápido", "11269; 2312", "", "", "NÃO"],
  ["RENEM-111", "Apoio", "Freezer para Soroteca", "1988", "", "", "NÃO"],
  ["RENEM-112", "Apoio", "Fresadora Ortopédica", "2103", "", "", "NÃO"],
  ["RENEM-113", "Apoio", "Gabinete UV para Visualização de Cromatografia", "2355", "", "", "NÃO"],
  ["RENEM-114", "Apoio", "Geladeira de Porta Dupla para Hematologia", "10935", "", "", "NÃO"],
  ["RENEM-115", "Apoio", "Gerador de Umidade", "11853", "", "", "NÃO"],
  ["RENEM-116", "Apoio", "Goniômetro", "3027", "", "", "NÃO"],
  ["RENEM-117", "Apoio", "Gotejador", "78", "", "Gotejador Elétrico", "NÃO"],
  ["RENEM-118", "Apoio", "Gravador de Áudio", "11980", "", "Gravador de Áudio Digital", "NÃO"],
  ["RENEM-119", "Apoio", "Imersor de Cera", "11818", "", "", "NÃO"],
  ["RENEM-120", "Apoio", "Impressora 3D Odontológica", "11831", "", "", "NÃO"],
  ["RENEM-121", "Apoio", "Impressora de Cassetes", "11920", "", "", "NÃO"],
  ["RENEM-122", "Apoio", "Impressora de Lâminas", "11918", "", "", "NÃO"],
  ["RENEM-123", "Apoio", "Impressora Dry de Filmes Radiológicos", "288", "", "", "NÃO"],
  ["RENEM-124", "Apoio", "Lanterna Clínica", "2705", "", "", "NÃO"],
  ["RENEM-125", "Apoio", "Lavadora de Endoscópio", "398", "", "", "NÃO"],
  ["RENEM-126", "Apoio", "Lavadora de Microplacas", "10507", "", "", "NÃO"],
  ["RENEM-127", "Apoio", "Lavadora de Pipetas", "2163", "", "", "NÃO"],
  ["RENEM-128", "Apoio", "Lavadora de Roupas Hospitalar", "10920; 10562", "lavadora hospitalar; lavadora de barreira; lavadora hospitalar de roupas", "", "NÃO"],
  ["RENEM-129", "Apoio", "Lavadora Extratora de Roupas Hospitalar", "11414", "", "", "NÃO"],
  ["RENEM-130", "Apoio", "Lavadora Termodesinfectora", "10548", "", "", "NÃO"],
  ["RENEM-131", "Apoio", "Lavadora Ultrassônica acima de 15 litros", "10984", "", "", "NÃO"],
  ["RENEM-132", "Apoio", "Lavadora Ultrassônica até 15 litros", "10983", "", "", "NÃO"],
  ["RENEM-133", "Apoio", "Leito Fluidizado", "11557", "", "", "NÃO"],
  ["RENEM-134", "Apoio", "Luminária Flexível de Mesa com Lupa", "2327", "", "", "SIM"],
  ["RENEM-135", "Apoio", "Maca de Transferência", "2945", "", "", "NÃO"],
  ["RENEM-136", "Apoio", "Manequim Adulto Simulador para Treino de habilidades clínicas em Suporte Básico de Vida", "11957", "", "", "NÃO"],
  ["RENEM-137", "Apoio", "Manequim Lactente Simulador para Treino de habilidades clínicas em Suporte Básico de Vida", "11960", "", "", "NÃO"],
  ["RENEM-138", "Apoio", "Manequim Pediátrico Simulador para Treino de habilidades clínicas em Suporte Básico de Vida", "11959", "", "", "NÃO"],
  ["RENEM-139", "Apoio", "Manequim Simulador para Treino de habilidades clínicas em Suporte Avançado de Vida", "11956", "", "", "NÃO"],
  ["RENEM-140", "Apoio", "Manta Aquecedora", "11783", "", "", "NÃO"],
  ["RENEM-141", "Apoio", "Máquina de Solda Odontológica", "255", "", "", "NÃO"],
  ["RENEM-142", "Apoio", "Máquina de Sucção para Laminação", "10568", "", "", "NÃO"],
  ["RENEM-143", "Apoio", "Máquina de Sucção para Termomoldagem em Ortopedia Técnica", "11453", "", "", "NÃO"],
  ["RENEM-144", "Apoio", "Máquina Unitarizadora de Medicamentos", "11267", "", "", "NÃO"],
  ["RENEM-145", "Apoio", "Martelo de Reflexo", "3079", "", "", "NÃO"],
  ["RENEM-146", "Apoio", "Medidor de Atividade de Água", "11784", "", "", "NÃO"],
  ["RENEM-147", "Apoio", "Medidor de Cuff", "10414", "", "", "NÃO"],
  ["RENEM-148", "Apoio", "Medidor de Densidade Aparente/Compactada", "512", "", "", "NÃO"],
  ["RENEM-149", "Apoio", "Medidor de Nível de Oxigênio", "836", "", "", "NÃO"],
  ["RENEM-150", "Apoio", "Medidor Geiger de Radiação", "478", "", "", "NÃO"],
  ["RENEM-151", "Apoio", "Mesa Antropométrica", "10128", "", "", "NÃO"],
  ["RENEM-152", "Apoio", "Mesa de Mayo", "3026", "", "", "NÃO"],
  ["RENEM-153", "Apoio", "Mesa Refrigerada", "11930", "", "", "NÃO"],
  ["RENEM-154", "Apoio", "Micromotor Elétrico de Bancada", "11821", "", "", "NÃO"],
  ["RENEM-155", "Apoio", "Microscópio Eletrônico de Varredura", "11616", "", "", "NÃO"],
  ["RENEM-156", "Apoio", "Microscópio Óptico com Câmera", "11526", "", "", "NÃO"],
  ["RENEM-157", "Apoio", "Mini-Extrusora com GMP", "11953", "", "", "NÃO"],
  ["RENEM-158", "Apoio", "Mochila de Resgate", "11839", "", "", "NÃO"],
  ["RENEM-159", "Apoio", "Moinho para Trituração de Comprimidos", "11854", "", "", "NÃO"],
  ["RENEM-160", "Apoio", "Monitor de Vídeo", "11949", "", "", "SIM"],
  ["RENEM-161", "Apoio", "Motor de Suspensão", "698", "", "", "NÃO"],
  ["RENEM-162", "Apoio", "Nanoindentador Completo", "11954", "", "", "NÃO"],
  ["RENEM-163", "Apoio", "Negatoscópio", "541", "", "", "NÃO"],
  ["RENEM-164", "Apoio", "Nível Pélvico", "11223", "", "", "NÃO"],
  ["RENEM-165", "Apoio", "No-break de 20KVA", "11965", "", "", "SIM"],
  ["RENEM-166", "Apoio", "Osmose Reversa", "10353", "", "", "NÃO"],
  ["RENEM-167", "Apoio", "Pandeiro", "11911", "", "", "SIM"],
  ["RENEM-168", "Apoio", "Panela Elétrica para Confecção de Órteses", "11213", "", "", "NÃO"],
  ["RENEM-169", "Apoio", "Panela Elétrica Polimerizadora", "11822", "", "Panela Elétrica Polimerizadora Digital", "NÃO"],
  ["RENEM-170", "Apoio", "Panela Eliminadora de Bolhas", "11823", "", "", "NÃO"],
  ["RENEM-171", "Apoio", "Papagaio", "496", "", "", "SIM"],
  ["RENEM-172", "Apoio", "Passa Chassi Radiográfico", "569", "", "", "NÃO"],
  ["RENEM-173", "Apoio", "Pedômetro", "11962", "", "Pedômetro Digital", "NÃO"],
  ["RENEM-174", "Apoio", "Picnômetro com Tampa", "11786", "", "", "NÃO"],
  ["RENEM-175", "Apoio", "Piscina de bolinhas", "11915", "", "", "SIM"],
  ["RENEM-176", "Apoio", "Plastificadora para uso Odontológico", "730", "", "", "NÃO"],
  ["RENEM-177", "Apoio", "Plataforma Automática de Pipetagem de Alto Desempenho", "11811", "", "", "NÃO"],
  ["RENEM-178", "Apoio", "Plataforma Inclinada", "11895", "", "", "NÃO"],
  ["RENEM-179", "Apoio", "Plataforma Suspensa", "11892", "", "", "NÃO"],
  ["RENEM-180", "Apoio", "Poltrona para Doação de Sangue", "1672", "", "", "NÃO"],
  ["RENEM-181", "Apoio", "Prancha Longa de Imobilização de Coluna", "10794", "", "", "NÃO"],
  ["RENEM-182", "Apoio", "Prensa Hidráulica", "11787", "", "", "SIM"],
  ["RENEM-183", "Apoio", "Processador de Áudio", "11983", "", "", "SIM"],
  ["RENEM-184", "Apoio", "Processadora de Filmes Radiográficos", "545", "", "", "NÃO"],
  ["RENEM-185", "Apoio", "Rack para Servidores Genomicos", "11966", "", "", "SIM"],
  ["RENEM-186", "Apoio", "Rádio Comunicador Marítimo", "11856", "", "", "SIM"],
  ["RENEM-187", "Apoio", "Radiômetro para Fototerapia", "806", "", "", "NÃO"],
  ["RENEM-188", "Apoio", "Rampa de Equilíbrio", "11896", "", "", "NÃO"],
  ["RENEM-189", "Apoio", "Receptor Quádruplo sem Fio", "11979", "", "Receptor Quádruplo sem Fio Digital", "NÃO"],
  ["RENEM-190", "Apoio", "Reco-reco", "11913", "", "", "SIM"],
  ["RENEM-191", "Apoio", "Recortador de Gesso", "11824", "", "", "NÃO"],
  ["RENEM-192", "Apoio", "Refrigerador Laboratorial", "10546", "", "", "NÃO"],
  ["RENEM-193", "Apoio", "Registrador de Ponto Eletrônico", "11950", "", "", "SIM"],
  ["RENEM-194", "Apoio", "Resfriador Rápido para Lactário", "10258", "", "", "NÃO"],
  ["RENEM-195", "Apoio", "Revestidora para Comprimidos e Pellets", "11705", "", "", "NÃO"],
  ["RENEM-196", "Apoio", "Rolo Suspenso com Apoio dos Pés", "11898", "", "", "NÃO"],
  ["RENEM-197", "Apoio", "Rotaevaporador", "11674", "", "", "NÃO"],
  ["RENEM-198", "Apoio", "Scanner de Bancada", "11830", "", "", "NÃO"],
  ["RENEM-199", "Apoio", "Scanner de Lâminas", "11923", "", "", "NÃO"],
  ["RENEM-200", "Apoio", "Scanner Intraoral Odontológico", "11825", "", "", "NÃO"],
  ["RENEM-201", "Apoio", "Secadora de Roupas Hospitalar", "11801", "secadora hospitalar; secadora rotativa hospitalar", "", "NÃO"],
  ["RENEM-202", "Apoio", "Secadora de Traquéias", "10442", "", "", "NÃO"],
  ["RENEM-203", "Apoio", "Seladora", "1503", "", "", "SIM"],
  ["RENEM-204", "Apoio", "Seladora Dielétrica para Bolsa de Sangue", "2290", "", "", "NÃO"],
  ["RENEM-205", "Apoio", "Sensor Inercial", "11963", "", "", "SIM"],
  ["RENEM-206", "Apoio", "Serra para Gesso", "3054", "", "", "NÃO"],
  ["RENEM-207", "Apoio", "Servidor de Ancoragem de Sistemas Web", "11967", "", "", "NÃO"],
  ["RENEM-208", "Apoio", "Servidor de Armazenamento Central de Dados Genômicos", "11968", "", "", "NÃO"],
  ["RENEM-209", "Apoio", "Servidor de Armazenamento em Redundância", "11964", "", "", "NÃO"],
  ["RENEM-210", "Apoio", "Servidor de Armazenamento para Sequenciador Genético de Alto Desempenho-NGS", "11969", "", "", "NÃO"],
  ["RENEM-211", "Apoio", "Servidor de Gerenciamento de Logs", "11970", "", "", "NÃO"],
  ["RENEM-212", "Apoio", "Servidor para Processamento de Análises Genômicas", "11971", "", "", "NÃO"],
  ["RENEM-213", "Apoio", "Simulador de Cabeça para Intubação", "2260", "", "", "NÃO"],
  ["RENEM-214", "Apoio", "Simulador de Escada", "11929", "", "", "NÃO"],
  ["RENEM-215", "Apoio", "Simulador de Maternidade", "1977", "", "", "NÃO"],
  ["RENEM-216", "Apoio", "Simulador de Parto", "1857", "", "", "NÃO"],
  ["RENEM-217", "Apoio", "Simulador de Remo", "11931", "", "", "NÃO"],
  ["RENEM-218", "Apoio", "Sistema de Água Ultrapura", "11732", "", "", "NÃO"],
  ["RENEM-219", "Apoio", "Sistema de Digitalização de Imagens Odontológicas", "11826", "", "", "NÃO"],
  ["RENEM-220", "Apoio", "Sistema de Embalagem Primária e Secundária para Sólidos", "11200", "", "", "NÃO"],
  ["RENEM-221", "Apoio", "Sistema de Envase Asséptico", "11991", "", "", "NÃO"],
  ["RENEM-222", "Apoio", "Sistema de Fermentadores", "11944", "", "", "NÃO"],
  ["RENEM-223", "Apoio", "Sistema de Fluxo de Trabalho de Biologia Molecular", "11878", "", "", "NÃO"],
  ["RENEM-224", "Apoio", "Sistema de Higienização de Pacientes", "11667", "", "", "NÃO"],
  ["RENEM-225", "Apoio", "Sistema de Inspeção das Linhas de Embalagem", "11882", "", "", "NÃO"],
  ["RENEM-226", "Apoio", "Sistema de Luzes de Treinamento Reativo", "11961", "", "", "NÃO"],
  ["RENEM-227", "Apoio", "Sistema de Monitoramento de Temperatura", "10934", "", "", "NÃO"],
  ["RENEM-228", "Apoio", "Sistema de Produção de Biomedicamentos", "11879", "", "", "NÃO"],
  ["RENEM-229", "Apoio", "Sistema de Retorno de Aúdio sem Fio", "11978", "", "", "SIM"],
  ["RENEM-230", "Apoio", "Sistema Manual de Células de Difusão Vertical", "11939", "", "", "NÃO"],
  ["RENEM-231", "Apoio", "Suporte de Hamper", "2692", "", "", "NÃO"],
  ["RENEM-232", "Apoio", "Suporte de Soro", "2369; 11239", "suporte para soro; haste de soro; suporte de soro com rodizios", "Suporte de Soro para Ressonância Magnética", "NÃO"],
  ["RENEM-233", "Apoio", "Switch de 100GB", "11972", "", "", "SIM"],
  ["RENEM-234", "Apoio", "Tanque Inox de Processamento", "11945", "", "", "NÃO"],
  ["RENEM-235", "Apoio", "Termohigrobarômetro", "11855", "", "", "NÃO"],
  ["RENEM-236", "Apoio", "Termohigrômetro", "1339", "", "", "NÃO"],
  ["RENEM-237", "Apoio", "Torno Odontológico", "789", "", "", "NÃO"],
  ["RENEM-238", "Apoio", "Trapézio", "11917", "", "", "SIM"],
  ["RENEM-239", "Apoio", "Triângulo", "11903", "", "", "SIM"],
  ["RENEM-240", "Apoio", "Turbidímetro", "11883", "", "", "NÃO"],
  ["RENEM-241", "Apoio", "Ultracongelador de Nitrogênio Líquido", "11254", "", "", "NÃO"],
  ["RENEM-242", "Apoio", "Unidade Automática para Reprocessamento de Filtros", "10754", "", "", "NÃO"],
  ["RENEM-243", "Apoio", "Vibrador de Gesso", "11827", "", "", "NÃO"],
  ["RENEM-244", "Apoio", "Videogame", "11921", "", "", "SIM"],
  ["RENEM-245", "Apoio", "Violão", "11906", "", "", "SIM"],
  ["RENEM-246", "Apoio", "Violino", "11902", "", "", "SIM"],
  ["RENEM-247", "Apoio Laboratorial", "Lavadora GMP", "11304", "", "", "NÃO"],
  ["RENEM-248", "Gerais", "Amplificador Multicanais", "11986", "", "", "SIM"],
  ["RENEM-249", "Gerais", "Aparelho de DVD", "10", "", "", "SIM"],
  ["RENEM-250", "Gerais", "Aparelho de Som", "1748", "", "", "SIM"],
  ["RENEM-251", "Gerais", "Aquecedor Portátil de Ambiente", "2356", "", "", "SIM"],
  ["RENEM-252", "Gerais", "Armário", "2138", "", "", "SIM"],
  ["RENEM-253", "Gerais", "Armário em Aço Inox para CME", "11718", "", "", "NÃO"],
  ["RENEM-254", "Gerais", "Armário Vitrine", "2131", "armario vitrine hospitalar", "", "NÃO"],
  ["RENEM-255", "Gerais", "Arquivo", "1730", "", "", "SIM"],
  ["RENEM-256", "Gerais", "Balcão de Atendimento", "2709", "", "", "SIM"],
  ["RENEM-257", "Gerais", "Balde a Chute", "2224", "", "", "SIM"],
  ["RENEM-258", "Gerais", "Balde a Pedal", "2099", "", "", "NÃO"],
  ["RENEM-259", "Gerais", "Balde/Lixeira", "1717", "", "", "SIM"],
  ["RENEM-260", "Gerais", "Bancada", "53", "", "", "SIM"],
  ["RENEM-261", "Gerais", "Bancada para Oficina Ortopédica", "11205", "", "", "SIM"],
  ["RENEM-262", "Gerais", "Banqueta", "2711", "", "", "SIM"],
  ["RENEM-263", "Gerais", "Banqueta Dobrável", "11084", "", "", "SIM"],
  ["RENEM-264", "Gerais", "Bebedouro/Purificador Refrigerado", "1820", "", "", "SIM"],
  ["RENEM-265", "Gerais", "Bomba Dosadora para Fluoretação", "11887", "", "", "SIM"],
  ["RENEM-266", "Gerais", "Botijão de Gás", "2848", "", "", "SIM"],
  ["RENEM-267", "Gerais", "Cabideiro", "10806", "", "", "SIM"],
  ["RENEM-268", "Gerais", "Cadeira", "759; 11087", "", "Cadeira para Obeso", "SIM"],
  ["RENEM-269", "Gerais", "Cadeira Universitária", "2272", "", "", "SIM"],
  ["RENEM-270", "Gerais", "Caixa de Som Amplificada", "11625", "", "", "SIM"],
  ["RENEM-271", "Gerais", "Caixa Sanfonada", "11840", "", "", "SIM"],
  ["RENEM-272", "Gerais", "Caixa Térmica", "2172", "", "", "SIM"],
  ["RENEM-273", "Gerais", "Câmera de Segurança", "11834", "", "", "SIM"],
  ["RENEM-274", "Gerais", "Câmera de Videoconferência", "11858", "", "", "SIM"],
  ["RENEM-275", "Gerais", "Carrinho de Mão", "1703", "", "", "SIM"],
  ["RENEM-276", "Gerais", "Carro para Ferramentas", "11842", "", "", "SIM"],
  ["RENEM-277", "Gerais", "Carro para Material de Limpeza", "2306", "", "", "SIM"],
  ["RENEM-278", "Gerais", "Carro para Mecânico", "11843", "", "", "SIM"],
  ["RENEM-279", "Gerais", "Carro para Transporte de Materiais", "2630", "", "", "SIM"],
  ["RENEM-280", "Gerais", "Carro para Transporte de Resíduos", "10350", "", "", "SIM"],
  ["RENEM-281", "Gerais", "Compressor de Ar", "11198", "", "", "SIM"],
  ["RENEM-282", "Gerais", "Computador", "10894; 2274; 10557; 11871", "", "Computador Portátil", "SIM"],
  ["RENEM-283", "Gerais", "Computador Servidor", "10991; 10558", "", "", "SIM"],
  ["RENEM-284", "Gerais", "Controladora para rede wifi", "11812", "", "", "SIM"],
  ["RENEM-285", "Gerais", "Cronômetro", "2144", "", "", "SIM"],
  ["RENEM-286", "Gerais", "Decoder de videowall", "11813", "", "", "SIM"],
  ["RENEM-287", "Gerais", "Desempoeirador de Comprimido", "11874", "", "", "SIM"],
  ["RENEM-288", "Gerais", "Divã", "1678", "diva clinico; diva para exame; diva para exames; diva de exame", "", "NÃO"],
  ["RENEM-289", "Gerais", "Dobradeira de Tubos", "11455", "", "", "SIM"],
  ["RENEM-290", "Gerais", "Empilhadeira", "2844", "", "", "SIM"],
  ["RENEM-291", "Gerais", "Equipamento de Envase e Rotulagem de Soluções", "11936", "", "", "SIM"],
  ["RENEM-292", "Gerais", "Escada com 2 degraus", "1829", "escada 2 degraus; escada com dois degraus; escadinha 2 degraus; escadinha hospitalar; escada de dois degraus", "", "NÃO"],
  ["RENEM-293", "Gerais", "Escada com 3 degraus", "10902", "", "", "SIM"],
  ["RENEM-294", "Gerais", "Escada de 7 degraus", "2374", "", "", "SIM"],
  ["RENEM-295", "Gerais", "Esmerilhadeira", "10080", "", "", "SIM"],
  ["RENEM-296", "Gerais", "Estabilizador de Tensão/Módulo Isolador", "11430", "", "", "SIM"],
  ["RENEM-297", "Gerais", "Estante", "1921", "", "", "SIM"],
  ["RENEM-298", "Gerais", "Ferro Elétrico Industrial", "1980", "", "", "SIM"],
  ["RENEM-299", "Gerais", "Fogão", "2894", "", "", "SIM"],
  ["RENEM-300", "Gerais", "Fogão Industrial", "2416", "", "", "SIM"],
  ["RENEM-301", "Gerais", "Forno de Microondas", "1994", "", "", "SIM"],
  ["RENEM-302", "Gerais", "Forno Industrial", "1851", "", "", "SIM"],
  ["RENEM-303", "Gerais", "Freezer Comum", "1414", "", "", "SIM"],
  ["RENEM-304", "Gerais", "Furadeira Elétrica de Bancada", "2347", "", "", "SIM"],
  ["RENEM-305", "Gerais", "Furadeira Manual Industrial 1/2\"", "11206", "", "", "SIM"],
  ["RENEM-306", "Gerais", "Geladeira Comercial de 4 Portas", "10942", "", "", "SIM"],
  ["RENEM-307", "Gerais", "Geladeira/Refrigerador", "2022", "", "", "SIM"],
  ["RENEM-308", "Gerais", "GPS", "11610", "", "GPS Portátil", "SIM"],
  ["RENEM-309", "Gerais", "Graminho Traçador", "11208", "", "", "SIM"],
  ["RENEM-310", "Gerais", "Impressora de Código de Barras", "1731", "", "", "SIM"],
  ["RENEM-311", "Gerais", "Impressora Laser", "10896", "", "", "SIM"],
  ["RENEM-312", "Gerais", "Impressora Laser Multifuncional", "1373", "", "", "SIM"],
  ["RENEM-313", "Gerais", "Lavadora de Roupas", "1938", "", "", "SIM"],
  ["RENEM-314", "Gerais", "Leitor de Código de Barras", "1234", "", "", "SIM"],
  ["RENEM-315", "Gerais", "Leitor/Quantificador de Material Genético em Placas", "11833", "", "", "SIM"],
  ["RENEM-316", "Gerais", "Liquidificador", "1941", "", "", "SIM"],
  ["RENEM-317", "Gerais", "Liquidificador Industrial", "1387", "", "", "SIM"],
  ["RENEM-318", "Gerais", "Lixadeira Dupla", "11220", "", "", "SIM"],
  ["RENEM-319", "Gerais", "Longarina", "494", "", "", "SIM"],
  ["RENEM-320", "Gerais", "Lousa Interativa", "10565", "", "", "SIM"],
  ["RENEM-321", "Gerais", "Máquina Chanfradeira", "11091", "", "", "SIM"],
  ["RENEM-322", "Gerais", "Máquina de Costura de Coluna", "11452", "", "", "SIM"],
  ["RENEM-323", "Gerais", "Máquina de Costura em Zig Zag", "11216", "", "", "SIM"],
  ["RENEM-324", "Gerais", "Máquina de Costura Industrial", "2456", "", "", "SIM"],
  ["RENEM-325", "Gerais", "Máquina de Solda MIG MAG", "11209", "", "", "SIM"],
  ["RENEM-326", "Gerais", "Máquina Fotográfica", "11844", "", "", "SIM"],
  ["RENEM-327", "Gerais", "Máquina para Produzir Gelo", "2943", "", "", "SIM"],
  ["RENEM-328", "Gerais", "Mesa Auxiliar", "2102", "mesa auxiliar hospitalar; mesa auxiliar inox; mesa auxiliar em aco inox; mesa para instrumental", "", "NÃO"],
  ["RENEM-329", "Gerais", "Mesa de Cabeceira", "2234", "mesa de cabeceira hospitalar; criado mudo hospitalar", "", "NÃO"],
  ["RENEM-330", "Gerais", "Mesa de Cabeceira com Refeição Acoplada", "11228", "mesa de refeicao para leito; mesa de refeicao hospitalar; mesa para refeicao no leito", "", "NÃO"],
  ["RENEM-331", "Gerais", "Mesa de Escritório", "1868", "", "", "SIM"],
  ["RENEM-332", "Gerais", "Mesa de Reunião", "2659", "", "", "SIM"],
  ["RENEM-333", "Gerais", "Mesa para Computador", "2098", "", "", "SIM"],
  ["RENEM-334", "Gerais", "Mesa para Consultório", "1923", "", "", "NÃO"],
  ["RENEM-335", "Gerais", "Mesa para Impressora", "2150", "", "", "SIM"],
  ["RENEM-336", "Gerais", "Mesa para Refeição", "2304", "", "", "SIM"],
  ["RENEM-337", "Gerais", "Mesa para Refeitório", "2426", "", "", "SIM"],
  ["RENEM-338", "Gerais", "Microfone", "2284", "", "", "SIM"],
  ["RENEM-339", "Gerais", "Micrômetro", "2812", "", "", "SIM"],
  ["RENEM-340", "Gerais", "Microretífica", "11841", "", "", "SIM"],
  ["RENEM-341", "Gerais", "Mixer", "2185", "", "", "SIM"],
  ["RENEM-342", "Gerais", "Mocho", "2954", "mocho giratorio; mocho clinico; mocho hospitalar", "", "NÃO"],
  ["RENEM-343", "Gerais", "Morsa de Bancada", "11219", "", "", "SIM"],
  ["RENEM-344", "Gerais", "Morsa para Furadeira de Bancada", "2295", "", "", "SIM"],
  ["RENEM-345", "Gerais", "Moto Esmeril", "10566", "", "", "SIM"],
  ["RENEM-346", "Gerais", "Motocultivador", "11774", "", "", "SIM"],
  ["RENEM-347", "Gerais", "Multímetro", "2408", "", "", "SIM"],
  ["RENEM-348", "Gerais", "Nebulizador Costal", "11792", "", "", "SIM"],
  ["RENEM-349", "Gerais", "Nebulizador Pesado Veicular", "11791", "", "", "SIM"],
  ["RENEM-350", "Gerais", "No-Break", "1978; 11849; 10990", "", "", "SIM"],
  ["RENEM-351", "Gerais", "Palete", "10850", "", "", "SIM"],
  ["RENEM-352", "Gerais", "Paquímetro", "1175", "", "", "SIM"],
  ["RENEM-353", "Gerais", "Parafusadeira Pneumática Manual", "11092", "", "", "SIM"],
  ["RENEM-354", "Gerais", "Perfurador De Solo À Gasolina", "11775", "", "", "SIM"],
  ["RENEM-355", "Gerais", "Plataforma de Elevação", "11204", "", "", "SIM"],
  ["RENEM-356", "Gerais", "Politriz", "10111", "", "", "SIM"],
  ["RENEM-357", "Gerais", "Poltrona Hospitalar", "2345", "poltrona de acompanhante; poltrona para acompanhante; poltrona reclinavel hospitalar; poltrona hospitalar reclinavel; poltrona de hemodialise; poltrona para hemodialise; poltrona para quimioterapia", "", "NÃO"],
  ["RENEM-358", "Gerais", "Ponto de acesso sem fio", "11814", "", "", "SIM"],
  ["RENEM-359", "Gerais", "Projetor Multimídia", "510", "", "", "SIM"],
  ["RENEM-360", "Gerais", "Pulverizador de Compressão Prévia", "11605", "", "", "SIM"],
  ["RENEM-361", "Gerais", "Purificador de Ar", "10582", "", "", "SIM"],
  ["RENEM-362", "Gerais", "Rack de Servidor", "10905", "", "", "SIM"],
  ["RENEM-363", "Gerais", "Rádio VHF", "11848", "", "", "SIM"],
  ["RENEM-364", "Gerais", "Relógio Comparador", "1320", "", "", "SIM"],
  ["RENEM-365", "Gerais", "Relógio de Parede", "2482", "", "", "SIM"],
  ["RENEM-366", "Gerais", "Roçadeira Multifuncional à Gasolina", "11778", "", "", "SIM"],
  ["RENEM-367", "Gerais", "Roteador", "2594", "", "", "SIM"],
  ["RENEM-368", "Gerais", "Scanner", "2487", "", "", "SIM"],
  ["RENEM-369", "Gerais", "Scanner 3D", "11815", "", "", "SIM"],
  ["RENEM-370", "Gerais", "Serra de Fita", "11064", "", "", "SIM"],
  ["RENEM-371", "Gerais", "Serra Tico-Tico", "11065", "", "", "SIM"],
  ["RENEM-372", "Gerais", "Servidor de Videomonitoramento", "11835", "", "", "SIM"],
  ["RENEM-373", "Gerais", "Silo", "10567", "", "", "SIM"],
  ["RENEM-374", "Gerais", "Sistema de Centrifugação", "11875", "", "", "SIM"],
  ["RENEM-375", "Gerais", "Sistema de Filtração em Fluxo Tangencial", "11876", "", "", "SIM"],
  ["RENEM-376", "Gerais", "Sistema Integrado de Granulação, Secagem e Mistura", "11873", "", "", "SIM"],
  ["RENEM-377", "Gerais", "Sofá-cama Hospitalar", "1990", "sofa cama para acompanhante", "", "NÃO"],
  ["RENEM-378", "Gerais", "Sonofletor de Comunicação", "11836", "", "", "SIM"],
  ["RENEM-379", "Gerais", "Soprador Térmico", "2527", "", "", "SIM"],
  ["RENEM-380", "Gerais", "Suporte para Perfurocortante", "11838", "", "", "NÃO"],
  ["RENEM-381", "Gerais", "Switch", "1327", "", "", "SIM"],
  ["RENEM-382", "Gerais", "Switch de distribuição", "11816", "", "", "SIM"],
  ["RENEM-383", "Gerais", "Switcher de vídeo", "11817", "", "", "SIM"],
  ["RENEM-384", "Gerais", "Tablet", "11744", "", "", "SIM"],
  ["RENEM-385", "Gerais", "Tábua De Passar Roupa", "11776", "", "", "SIM"],
  ["RENEM-386", "Gerais", "Tambor", "11901", "", "", "SIM"],
  ["RENEM-387", "Gerais", "Teclado Eletrônico", "11914", "", "", "SIM"],
  ["RENEM-388", "Gerais", "Tela de Projeção", "2625", "", "", "SIM"],
  ["RENEM-389", "Gerais", "Telefone", "1382", "", "", "SIM"],
  ["RENEM-390", "Gerais", "Telefone Celular Rural de Mesa", "11596", "", "", "SIM"],
  ["RENEM-391", "Gerais", "Telefone Satelital", "11847", "", "", "SIM"],
  ["RENEM-392", "Gerais", "Televisor", "2259", "", "", "SIM"],
  ["RENEM-393", "Gerais", "Termonebulizador tipo FOG", "11604", "", "", "SIM"],
  ["RENEM-394", "Gerais", "Torno Universal", "11088", "", "", "SIM"],
  ["RENEM-395", "Gerais", "Torquímetro", "10776", "", "", "SIM"],
  ["RENEM-396", "Gerais", "Transportadora de Paletes", "259", "", "", "SIM"],
  ["RENEM-397", "Gerais", "Triturador Forrageiro", "11374", "", "", "SIM"],
  ["RENEM-398", "Gerais", "Trocador de Fraldas de Parede", "11651", "", "", "NÃO"],
  ["RENEM-399", "Gerais", "Varal de Chão", "11777", "", "", "SIM"],
  ["RENEM-400", "Gerais", "Ventilador de Teto/Parede", "2624", "", "", "SIM"],
  ["RENEM-401", "Infraestrutura", "Ar Condicionado", "2569", "", "", "SIM"],
  ["RENEM-402", "Infraestrutura", "Bomba à Vácuo", "434", "", "", "SIM"],
  ["RENEM-403", "Infraestrutura", "Bomba à Vácuo Odontológica", "11803", "", "", "SIM"],
  ["RENEM-404", "Infraestrutura", "Bomba D'Agua", "2318", "", "Bomba D'Agua Elétrica", "SIM"],
  ["RENEM-405", "Infraestrutura", "Cortina de Ar", "11362", "", "", "SIM"],
  ["RENEM-406", "Infraestrutura", "Estativa de Teto para Equipamentos", "10856", "", "", "SIM"],
  ["RENEM-407", "Infraestrutura", "Exaustor de Ar Industrial", "2452", "", "", "SIM"],
  ["RENEM-408", "Infraestrutura", "Exaustor para Câmara Escura", "359", "", "", "SIM"],
  ["RENEM-409", "Infraestrutura", "Grupo Gerador", "11243; 10901; 10602; 2570", "", "Grupo Gerador Portátil", "SIM"],
  ["RENEM-410", "Infraestrutura", "Mesas de Trabalho ou Bancada", "1950", "", "", "SIM"],
  ["RENEM-411", "Infraestrutura", "Régua de Gases", "2966", "", "", "SIM"],
  ["RENEM-412", "Infraestrutura", "Sistema Integrado de Monitoramento de Radiação de Àrea", "11951", "", "", "SIM"],
  ["RENEM-413", "Infraestrutura", "Vacuômetro para Rede de Gases", "11771", "", "", "SIM"],
  ["RENEM-414", "Infraestrutura", "Válvula Reguladora de Pressão para Rede de Gases", "11770", "", "", "SIM"],
  ["RENEM-415", "Item Industrial Hosp/Farmacêutico e/ou Pesquisa", "Analisador de Tamanho de Partículas", "11324", "", "", "NÃO"],
  ["RENEM-416", "Item Industrial Hosp/Farmacêutico e/ou Pesquisa", "Sistema Completo de Mistura de Sólidos por BINS", "878", "", "", "NÃO"],
  ["RENEM-417", "Item Industrial Não Hospitalar", "Moinho Rotativo Cônico", "11272", "", "", "SIM"],
  ["RENEM-418", "Médico Assistencial", "Acelerador Linear", "11806; 11807", "", "", "NÃO"],
  ["RENEM-419", "Médico Assistencial", "Adipômetro", "10272", "", "", "NÃO"],
  ["RENEM-420", "Médico Assistencial", "Agitador com Incubadora", "10848", "", "", "NÃO"],
  ["RENEM-421", "Médico Assistencial", "Agitador de Kline", "2832", "", "", "NÃO"],
  ["RENEM-422", "Médico Assistencial", "Agitador de Plaquetas", "1732", "", "", "NÃO"],
  ["RENEM-423", "Médico Assistencial", "Agitador de Tubos", "41", "", "", "NÃO"],
  ["RENEM-424", "Médico Assistencial", "Agitador Magnético", "1738", "", "", "NÃO"],
  ["RENEM-425", "Médico Assistencial", "Aglutinoscópio", "2827", "", "", "NÃO"],
  ["RENEM-426", "Médico Assistencial", "Amalgamador Odontológico", "174", "", "", "NÃO"],
  ["RENEM-427", "Médico Assistencial", "Amnioscópio", "95", "", "", "NÃO"],
  ["RENEM-428", "Médico Assistencial", "Analisador Automático para Hematologia", "2828", "", "", "NÃO"],
  ["RENEM-429", "Médico Assistencial", "Analisador Bioquímico", "180", "", "", "NÃO"],
  ["RENEM-430", "Médico Assistencial", "Analisador de Composição Corporal", "11416", "", "", "NÃO"],
  ["RENEM-431", "Médico Assistencial", "Analisador de G6PD", "11808", "", "", "NÃO"],
  ["RENEM-432", "Médico Assistencial", "Analisador de Gases Respiratórios/Hemogasômetro", "718", "", "", "NÃO"],
  ["RENEM-433", "Médico Assistencial", "Analisador de Íons/Eletrólitos", "2877", "", "", "NÃO"],
  ["RENEM-434", "Médico Assistencial", "Analisador de Meridianos", "10518", "", "", "NÃO"],
  ["RENEM-435", "Médico Assistencial", "Analisador de Partículas por Difração à Laser", "1461", "", "", "NÃO"],
  ["RENEM-436", "Médico Assistencial", "Analisador de Urina", "10493", "", "", "NÃO"],
  ["RENEM-437", "Médico Assistencial", "Analisador Imunológico", "2789", "", "", "NÃO"],
  ["RENEM-438", "Médico Assistencial", "Aparelho de Anestesia", "162; 10927; 11234", "", "Aparelho de Anestesia com Monitor Multiparâmetros; Aparelho de Anestesia para Ressonância Magnética", "NÃO"],
  ["RENEM-439", "Médico Assistencial", "Aparelho de Bioimpedância", "10270", "", "Aparelho de Bioimpedância Elétrica", "NÃO"],
  ["RENEM-440", "Médico Assistencial", "Aparelho de Corrente Interferencial", "3034", "", "", "NÃO"],
  ["RENEM-441", "Médico Assistencial", "Aparelho de Fototerapia para Psoríase", "11354", "", "", "NÃO"],
  ["RENEM-442", "Médico Assistencial", "Aparelho de Luz Infravermelho", "2775", "", "", "NÃO"],
  ["RENEM-443", "Médico Assistencial", "Aparelho de Raios X", "10912; 10883; 361", "", "Aparelho de Raios X - Fixo Analógico; Aparelho de Raios X - Fixo Digital; Aparelho de Raios X - Móvel", "NÃO"],
  ["RENEM-444", "Médico Assistencial", "Aparelho de Raios X - Odontológico", "316", "", "", "NÃO"],
  ["RENEM-445", "Médico Assistencial", "Aparelho de Raios X - Panorâmico", "329", "", "", "NÃO"],
  ["RENEM-446", "Médico Assistencial", "Aparelho de Raios X Telecomandado com Fluoroscopia", "10913", "", "", "NÃO"],
  ["RENEM-447", "Médico Assistencial", "Aparelho Gerador de Ozônio para Odontologia", "11820", "", "", "NÃO"],
  ["RENEM-448", "Médico Assistencial", "Aparelho Medidor de Ponto de Fusão", "61", "", "", "NÃO"],
  ["RENEM-449", "Médico Assistencial", "Aparelho para Densitometria Óssea por Raios - X", "418", "", "", "NÃO"],
  ["RENEM-450", "Médico Assistencial", "Aparelho para Determinação da Desintegração", "2524", "", "", "NÃO"],
  ["RENEM-451", "Médico Assistencial", "Aparelho para Determinação de Dureza", "2902", "", "", "NÃO"],
  ["RENEM-452", "Médico Assistencial", "Aparelho para Fisioterapia por Microondas", "360", "", "", "NÃO"],
  ["RENEM-453", "Médico Assistencial", "Aparelho para Fisioterapia por Ondas Curtas", "453", "", "", "NÃO"],
  ["RENEM-454", "Médico Assistencial", "Aparelho para Fototerapia", "321", "fototerapia; aparelho de fototerapia", "", "NÃO"],
  ["RENEM-455", "Médico Assistencial", "Aparelho para Hemodiálise", "483", "", "", "NÃO"],
  ["RENEM-456", "Médico Assistencial", "Aparelho para Hemossedimentação", "10492", "", "", "NÃO"],
  ["RENEM-457", "Médico Assistencial", "Aparelho para Tração Ortopédica", "882", "", "", "NÃO"],
  ["RENEM-458", "Médico Assistencial", "Aparelho Radiográfico Odontológico para Exame Extraoral", "10375", "", "", "NÃO"],
  ["RENEM-459", "Médico Assistencial", "Aquecedor de Fluídos/Sangue", "531", "", "", "NÃO"],
  ["RENEM-460", "Médico Assistencial", "Aquecedor Endodôntico para Gutta Percha", "992", "", "", "NÃO"],
  ["RENEM-461", "Médico Assistencial", "Arco Cirúrgico", "253", "", "", "NÃO"],
  ["RENEM-462", "Médico Assistencial", "Aspirador de Secreções", "71", "aspirador de secrecao; aspirador cirurgico; aspirador de secrecao portatil", "Aspirador de Secreções Elétrico Móvel", "NÃO"],
  ["RENEM-463", "Médico Assistencial", "Aspirador Ultrassônico/Bisturi Ultrassônico", "10584", "", "", "NÃO"],
  ["RENEM-464", "Médico Assistencial", "Assistente de Tosse", "11889", "", "", "NÃO"],
  ["RENEM-465", "Médico Assistencial", "Audiômetro", "956", "", "", "NÃO"],
  ["RENEM-466", "Médico Assistencial", "Automação para Imuno-Histoquímica", "11672", "", "", "NÃO"],
  ["RENEM-467", "Médico Assistencial", "Autorefrator", "10563", "", "", "NÃO"],
  ["RENEM-468", "Médico Assistencial", "Balança Analítica de Precisão", "2141", "", "", "NÃO"],
  ["RENEM-469", "Médico Assistencial", "Balança Antropométrica", "2980; 2981; 11247", "balanca pediatrica; balanca antropometrica digital; balanca digital pediatrica; balanca com regua antropometrica", "Balança Antropométrica Adulto; Balança Antropométrica Infantil; Balança Antropométrica para Obesos", "NÃO"],
  ["RENEM-470", "Médico Assistencial", "Balança Digital", "11076", "", "Balança Digital Portátil", "NÃO"],
  ["RENEM-471", "Médico Assistencial", "Balança Digital para Pessoa em Cadeira de Rodas", "11886", "", "", "NÃO"],
  ["RENEM-472", "Médico Assistencial", "Balança para Determinação de Umidade", "11280", "", "", "NÃO"],
  ["RENEM-473", "Médico Assistencial", "Balança para Laboratório", "10265", "", "", "NÃO"],
  ["RENEM-474", "Médico Assistencial", "Balança Semi-Analítica", "11339", "", "", "NÃO"],
  ["RENEM-475", "Médico Assistencial", "Balança Tipo Plataforma", "2305", "", "", "NÃO"],
  ["RENEM-476", "Médico Assistencial", "Balancim Proprioceptivo", "2965", "", "", "NÃO"],
  ["RENEM-477", "Médico Assistencial", "Banco de Wells", "10495", "", "", "NÃO"],
  ["RENEM-478", "Médico Assistencial", "Banho a Seco", "2840", "", "", "NÃO"],
  ["RENEM-479", "Médico Assistencial", "Banho de Parafina", "377", "", "", "NÃO"],
  ["RENEM-480", "Gerais", "Banho-Maria", "220; 1828", "", "", "SIM"],
  ["RENEM-481", "Médico Assistencial", "Banho-Maria para Lactário", "10257", "", "", "NÃO"],
  ["RENEM-482", "Médico Assistencial", "Banqueta para Parto Vertical", "11074", "", "", "NÃO"],
  ["RENEM-483", "Médico Assistencial", "Baropodômetro", "10298", "", "", "NÃO"],
  ["RENEM-484", "Médico Assistencial", "Barras Paralelas para Fisioterapia", "911", "", "", "NÃO"],
  ["RENEM-485", "Médico Assistencial", "BERA Sistema de Potencial Evocado", "146", "", "", "NÃO"],
  ["RENEM-486", "Médico Assistencial", "BERA Triagem", "11595", "", "", "NÃO"],
  ["RENEM-487", "Médico Assistencial", "Berço Aquecido", "553", "", "", "NÃO"],
  ["RENEM-488", "Médico Assistencial", "Berço para Recém Nascido com Fototerapia Reversa", "10864", "", "", "NÃO"],
  ["RENEM-489", "Médico Assistencial", "Bicicleta Ergométrica Vertical", "6", "", "", "NÃO"],
  ["RENEM-490", "Médico Assistencial", "Bilirrubinômetro", "632", "", "", "NÃO"],
  ["RENEM-491", "Médico Assistencial", "Biofeedback Eletromiográfico", "11891", "", "", "NÃO"],
  ["RENEM-492", "Médico Assistencial", "Biômetro de Coerência Óptica", "3130", "", "", "NÃO"],
  ["RENEM-493", "Médico Assistencial", "Biômetro Ultrassônico/Ecobiômetro", "10987", "", "", "NÃO"],
  ["RENEM-494", "Médico Assistencial", "Biorreator/Fermentador", "1510", "", "", "NÃO"],
  ["RENEM-495", "Médico Assistencial", "BIPAP", "10463; 11241", "", "BIPAP com Monitor Gráfico", "NÃO"],
  ["RENEM-496", "Médico Assistencial", "Bisturi Elétrico", "10989; 10995", "eletrocauterio; unidade eletrocirurgica", "", "NÃO"],
  ["RENEM-497", "Médico Assistencial", "Bomba de Infusão", "407", "bomba infusora; bomba de infusao volumetrica; bomba de infusao peristaltica", "", "NÃO"],
  ["RENEM-498", "Médico Assistencial", "Bomba de Infusão de Seringa", "10452", "bomba de seringa", "", "NÃO"],
  ["RENEM-499", "Médico Assistencial", "Bomba Elétrica para Sucção de Leite", "246", "", "", "NÃO"],
  ["RENEM-500", "Médico Assistencial", "Bomba Injetora de Contraste", "10543", "", "", "NÃO"],
  ["RENEM-501", "Médico Assistencial", "Bomba Peristáltica para uso Farmacêutico/Laboratorial", "291", "", "", "NÃO"],
  ["RENEM-502", "Médico Assistencial", "Botijão Criogênico", "10404", "", "", "NÃO"],
  ["RENEM-503", "Médico Assistencial", "Braquiterapia com Sistema de Controle Remoto", "10547", "", "", "NÃO"],
  ["RENEM-504", "Médico Assistencial", "Bureta Automática", "1935", "", "", "NÃO"],
  ["RENEM-505", "Médico Assistencial", "Cadeira Flexora e Extensora", "11926", "", "", "NÃO"],
  ["RENEM-506", "Médico Assistencial", "Cadeira Odontológica Completa", "519", "cadeira odontologica; consultorio odontologico completo", "", "NÃO"],
  ["RENEM-507", "Médico Assistencial", "Cadeira para Turbilhão", "3043", "", "", "NÃO"],
  ["RENEM-508", "Médico Assistencial", "Cama Elástica Proprioceptiva", "11441", "", "", "NÃO"],
  ["RENEM-509", "Médico Assistencial", "Cama Hospitalar", "765; 1002; 1981", "cama fowler; cama hospitalar fowler; leito hospitalar; cama hospitalar eletrica; cama hospitalar manual; cama de uti; cama para uti; cama hospitalar infantil; cama hospitalar bariatrica", "Cama Hospitalar Adulto; Cama Hospitalar Tipo Fawler Elétrica; Cama Hospitalar Tipo Fawler Mecânica", "NÃO"],
  ["RENEM-510", "Médico Assistencial", "Cama PPP", "10844", "cama de parto; cama para parto; cama pre parto parto e pos parto", "", "NÃO"],
  ["RENEM-511", "Médico Assistencial", "Câmara Cintilográfica", "595", "", "", "NÃO"],
  ["RENEM-512", "Médico Assistencial", "Câmara Climática", "1998", "", "", "NÃO"],
  ["RENEM-513", "Médico Assistencial", "Câmara Ultra-Violeta/Transiluminador", "2039", "", "", "NÃO"],
  ["RENEM-514", "Médico Assistencial", "Campímetro", "10165", "", "", "NÃO"],
  ["RENEM-515", "Médico Assistencial", "Capnógrafo", "149", "", "", "NÃO"],
  ["RENEM-516", "Médico Assistencial", "Cardiotocógrafo", "108", "", "", "NÃO"],
  ["RENEM-517", "Médico Assistencial", "Cardioversor", "936; 11598", "", "Cardioversor Para Unidade Móvel de Urgência", "NÃO"],
  ["RENEM-518", "Médico Assistencial", "Central de Inclusão de Parafina", "10397", "", "", "NÃO"],
  ["RENEM-519", "Médico Assistencial", "Central de Monitoração", "10277", "", "Central de Monitoração para UTI", "NÃO"],
  ["RENEM-520", "Médico Assistencial", "Central de Nebulização", "2964", "", "", "NÃO"],
  ["RENEM-521", "Médico Assistencial", "Centrífuga Laboratorial", "2059", "", "", "NÃO"],
  ["RENEM-522", "Médico Assistencial", "Centrífuga Lavadora de Células", "11264", "", "", "NÃO"],
  ["RENEM-523", "Médico Assistencial", "Centrífuga Refrigerada", "1673", "", "", "NÃO"],
  ["RENEM-524", "Médico Assistencial", "Cicloergômetro", "3068", "", "", "NÃO"],
  ["RENEM-525", "Médico Assistencial", "Cicloergômetro para Membros Superiores", "11927", "", "", "NÃO"],
  ["RENEM-526", "Médico Assistencial", "Citocentrífuga", "10482", "", "", "NÃO"],
  ["RENEM-527", "Médico Assistencial", "Citômetro de Fluxo", "11411; 11410", "", "", "NÃO"],
  ["RENEM-528", "Médico Assistencial", "Coagulador de Argônio", "10908", "", "", "NÃO"],
  ["RENEM-529", "Médico Assistencial", "Coagulômetro", "2443", "", "", "NÃO"],
  ["RENEM-530", "Médico Assistencial", "Colorador Automático de Lâminas", "10059", "", "", "NÃO"],
  ["RENEM-531", "Médico Assistencial", "Colposcópio", "378", "", "", "NÃO"],
  ["RENEM-532", "Médico Assistencial", "Coluna Oftalmológica", "2952", "", "", "NÃO"],
  ["RENEM-533", "Médico Assistencial", "Compressor Torácico Externo Automático", "11907", "", "", "NÃO"],
  ["RENEM-534", "Médico Assistencial", "Concentrador de Oxigênio", "11593", "concentrador de o2", "", "NÃO"],
  ["RENEM-535", "Médico Assistencial", "Consultório Odontológico", "10898", "", "Consultório Odontológico Portátil", "NÃO"],
  ["RENEM-536", "Médico Assistencial", "Contador de Colônias", "2190", "", "", "NÃO"],
  ["RENEM-537", "Médico Assistencial", "Contador Manual de Células", "1260", "", "", "NÃO"],
  ["RENEM-538", "Médico Assistencial", "CPAP", "626", "", "", "NÃO"],
  ["RENEM-539", "Médico Assistencial", "CR - Digitalizador de Imagens Radiográficas", "10449; 10921", "", "", "NÃO"],
  ["RENEM-540", "Médico Assistencial", "Criocautério", "3132", "", "", "NÃO"],
  ["RENEM-541", "Médico Assistencial", "Criostato", "1422", "", "", "NÃO"],
  ["RENEM-542", "Médico Assistencial", "Cromatógrafo", "906", "", "", "NÃO"],
  ["RENEM-543", "Médico Assistencial", "DEA - Desfibrilador Externo Automático", "11199", "desfibrilador externo automatico; dea", "", "NÃO"],
  ["RENEM-544", "Médico Assistencial", "Decibelímetro", "11485", "", "", "NÃO"],
  ["RENEM-545", "Médico Assistencial", "Dermátomo", "1116", "", "", "NÃO"],
  ["RENEM-546", "Médico Assistencial", "Dermatoscópio", "1394; 11861", "", "Dermatoscópio para Telessaúde", "NÃO"],
  ["RENEM-547", "Médico Assistencial", "Desfibrilador", "11233", "desfibrilador cardioversor; desfibrilador bifasico", "Desfibrilador Convencional", "NÃO"],
  ["RENEM-548", "Médico Assistencial", "Destilador de Óleo Essencial", "11781", "", "", "NÃO"],
  ["RENEM-549", "Médico Assistencial", "Detector Fetal", "421", "sonar doppler; doppler fetal; sonar fetal", "", "NÃO"],
  ["RENEM-550", "Médico Assistencial", "Dinamômetro", "3039", "", "", "NÃO"],
  ["RENEM-551", "Médico Assistencial", "Disruptor de Células e Tecidos", "11924", "", "", "NÃO"],
  ["RENEM-552", "Médico Assistencial", "Dissolutor - Aparelho para Teste de Dissolução", "161", "", "", "NÃO"],
  ["RENEM-553", "Médico Assistencial", "Doppler Vascular", "10225", "", "", "NÃO"],
  ["RENEM-554", "Médico Assistencial", "Eletrocardiógrafo", "451; 11860", "aparelho de eletrocardiograma; ecg de 12 canais", "Eletrocardiógrafo para Telessaúde", "NÃO"],
  ["RENEM-555", "Médico Assistencial", "Eletroencefalógrafo", "484", "", "", "NÃO"],
  ["RENEM-556", "Médico Assistencial", "Eletroestimulador com Corrente Galvânica-Farádica", "3016", "", "", "NÃO"],
  ["RENEM-557", "Médico Assistencial", "Eletromiógrafo", "529", "", "", "NÃO"],
  ["RENEM-558", "Médico Assistencial", "Eletroneuromiógrafo", "11242", "", "", "NÃO"],
  ["RENEM-559", "Médico Assistencial", "Eletronistagmógrafo", "1199", "", "", "NÃO"],
  ["RENEM-560", "Médico Assistencial", "Eletroretinógrafo", "10163", "", "", "NÃO"],
  ["RENEM-561", "Médico Assistencial", "Emissões Otoacústicas", "25", "", "", "NÃO"],
  ["RENEM-562", "Médico Assistencial", "Emissões Otoacústicas Triagem", "11594", "", "", "NÃO"],
  ["RENEM-563", "Médico Assistencial", "Endoscópio Flexível", "10138", "", "", "NÃO"],
  ["RENEM-564", "Médico Assistencial", "Endoscópio Rígido", "547", "", "", "NÃO"],
  ["RENEM-565", "Médico Assistencial", "Equipamento de Análise Clínica Tipo Point Of Care", "11908", "", "", "NÃO"],
  ["RENEM-566", "Médico Assistencial", "Equipamento para Crosslinking Corneano", "11648", "", "", "NÃO"],
  ["RENEM-567", "Médico Assistencial", "Equipamento para Drenagem Linfática", "10418", "", "", "NÃO"],
  ["RENEM-568", "Médico Assistencial", "Equipo Cart Odontológico", "10055", "", "", "NÃO"],
  ["RENEM-569", "Médico Assistencial", "Eretor Plataforma", "10356", "", "", "NÃO"],
  ["RENEM-570", "Médico Assistencial", "Escada Digital em Madeira para Reabilitação", "10887", "", "", "NÃO"],
  ["RENEM-571", "Médico Assistencial", "Escada em L com Rampa", "11444", "", "", "NÃO"],
  ["RENEM-572", "Médico Assistencial", "Escada Linear para Marcha", "10211", "", "", "NÃO"],
  ["RENEM-573", "Médico Assistencial", "Esfigmomanômetro", "10785; 10786; 11244", "aparelho de pressao arterial; aparelho de pressao; tensiometro", "Esfigmomanômetro Adulto; Esfigmomanômetro Infantil; Esfigmomanômetro Obeso", "NÃO"],
  ["RENEM-574", "Médico Assistencial", "Esfigmomanômetro de Pedestal", "89", "", "", "NÃO"],
  ["RENEM-575", "Médico Assistencial", "Espaldar em Madeira", "2934", "", "", "NÃO"],
  ["RENEM-576", "Médico Assistencial", "Espectrofotômetro", "2453", "", "", "NÃO"],
  ["RENEM-577", "Médico Assistencial", "Espectrofotômetro UV-VIS", "11133", "", "", "NÃO"],
  ["RENEM-578", "Médico Assistencial", "Espectrômetro", "2462", "", "", "NÃO"],
  ["RENEM-579", "Médico Assistencial", "Espirômetro", "597; 11868", "", "Espirômetro para Telessaúde", "NÃO"],
  ["RENEM-580", "Médico Assistencial", "Esteira Ergométrica", "3", "", "", "NÃO"],
  ["RENEM-581", "Médico Assistencial", "Estetoscópio", "85; 11863; 110", "", "Estetoscópio Adulto; Estetoscópio Digital para Telessaúde; Estetoscópio Infantil", "NÃO"],
  ["RENEM-582", "Médico Assistencial", "Estetoscópio de Pinard", "79", "", "", "NÃO"],
  ["RENEM-583", "Médico Assistencial", "Estimulador Neuro-Muscular", "843", "", "", "NÃO"],
  ["RENEM-584", "Médico Assistencial", "Exercitador de Mãos e Dedos", "11443", "", "", "NÃO"],
  ["RENEM-585", "Médico Assistencial", "Exercitador de Pés e Tornozelo", "11446", "", "", "NÃO"],
  ["RENEM-586", "Médico Assistencial", "Extrator/Purificador de Material Genético", "460", "", "", "NÃO"],
  ["RENEM-587", "Médico Assistencial", "Facoemulsificador", "1554", "", "", "NÃO"],
  ["RENEM-588", "Médico Assistencial", "FES", "2982", "", "", "NÃO"],
  ["RENEM-589", "Médico Assistencial", "Foco Cirúrgico de Solo", "10795", "", "Foco Cirúrgico de Solo Móvel", "NÃO"],
  ["RENEM-590", "Médico Assistencial", "Foco Cirúrgico de Teto", "3020", "", "", "NÃO"],
  ["RENEM-591", "Médico Assistencial", "Foco Cirúrgico de Teto com Câmera de Vídeo", "11417", "", "", "NÃO"],
  ["RENEM-592", "Médico Assistencial", "Foco Refletor Ambulatorial", "971", "foco clinico; foco de luz auxiliar; luminaria de exame; foco auxiliar", "", "NÃO"],
  ["RENEM-593", "Médico Assistencial", "Fotocoagulador a Laser", "10372", "", "", "NÃO"],
  ["RENEM-594", "Médico Assistencial", "Fotóforo - Foco de Luz de Cabeça", "3069", "", "", "NÃO"],
  ["RENEM-595", "Médico Assistencial", "Fotômetro", "1129", "", "", "NÃO"],
  ["RENEM-596", "Médico Assistencial", "Fresadora Odontológica", "11828", "", "", "NÃO"],
  ["RENEM-597", "Médico Assistencial", "Friabilômetro", "516", "", "", "NÃO"],
  ["RENEM-598", "Médico Assistencial", "Gaiola Power Hack", "11928", "", "", "NÃO"],
  ["RENEM-599", "Médico Assistencial", "Gama Probe", "11251", "", "", "NÃO"],
  ["RENEM-600", "Médico Assistencial", "Gangorra de Equilíbrio", "10904", "", "", "NÃO"],
  ["RENEM-601", "Médico Assistencial", "Ganho de Inserção", "2398", "", "", "NÃO"],
  ["RENEM-602", "Médico Assistencial", "Garrote Pneumático Eletrônico", "10928", "", "", "NÃO"],
  ["RENEM-603", "Médico Assistencial", "Glicosímetro", "428", "", "", "NÃO"],
  ["RENEM-604", "Médico Assistencial", "Granulador", "2572", "", "", "NÃO"],
  ["RENEM-605", "Médico Assistencial", "Hemoglobinômetro", "2158", "", "", "NÃO"],
  ["RENEM-606", "Médico Assistencial", "Homogeneizador", "1858", "", "", "NÃO"],
  ["RENEM-607", "Médico Assistencial", "Homogeneizador de Bolsa de Sangue", "10458", "", "", "NÃO"],
  ["RENEM-608", "Médico Assistencial", "Imitanciômetro", "1966", "", "", "NÃO"],
  ["RENEM-609", "Médico Assistencial", "Incubadora de Demanda Bioquímica de Oxigênio", "1697", "", "", "NÃO"],
  ["RENEM-610", "Médico Assistencial", "Incubadora de Plaquetas", "10319", "", "", "NÃO"],
  ["RENEM-611", "Médico Assistencial", "Incubadora de Transporte Neonatal", "852", "", "", "NÃO"],
  ["RENEM-612", "Médico Assistencial", "Incubadora Neonatal", "537", "incubadora para recem nascido; incubadora para rn; incubadora infantil", "", "NÃO"],
  ["RENEM-613", "Médico Assistencial", "Jogo de Peneiras com Aparelho Vibratório", "2642", "", "", "NÃO"],
  ["RENEM-614", "Médico Assistencial", "Jogo de Polias", "10201", "", "", "NÃO"],
  ["RENEM-615", "Médico Assistencial", "Lâmpada de Fenda", "1289", "", "", "NÃO"],
  ["RENEM-616", "Médico Assistencial", "Laringoscópio", "11248; 11249", "", "Laringoscópio Adulto; Laringoscópio Infantil", "NÃO"],
  ["RENEM-617", "Médico Assistencial", "Laser para Fisioterapia", "3001", "", "", "NÃO"],
  ["RENEM-618", "Médico Assistencial", "Laser para Oftalmologia", "10321", "", "", "NÃO"],
  ["RENEM-619", "Médico Assistencial", "Laser para Tratamento Odontológico", "184", "", "", "NÃO"],
  ["RENEM-620", "Médico Assistencial", "Leitor Automatizado de Placas Elispot", "11992", "", "", "NÃO"],
  ["RENEM-621", "Médico Assistencial", "Leitora de Microplacas de Elisa", "11099", "", "", "NÃO"],
  ["RENEM-622", "Médico Assistencial", "Lensômetro", "2927", "", "", "NÃO"],
  ["RENEM-623", "Médico Assistencial", "Liofilizador", "2682", "", "", "NÃO"],
  ["RENEM-624", "Médico Assistencial", "Litotriptor Extracorpóreo", "1044", "", "", "NÃO"],
  ["RENEM-625", "Médico Assistencial", "Litotriptor Intracorpóreo", "10194", "", "", "NÃO"],
  ["RENEM-626", "Médico Assistencial", "Localizador de Ápice", "192", "", "", "NÃO"],
  ["RENEM-627", "Médico Assistencial", "Mamógrafo", "10925", "", "", "NÃO"],
  ["RENEM-628", "Médico Assistencial", "Manovacuômetro", "10422", "", "", "NÃO"],
  ["RENEM-629", "Médico Assistencial", "Manta Térmica", "1656", "", "Manta Térmica Elétrica", "NÃO"],
  ["RENEM-630", "Médico Assistencial", "MAPA - Monitor Ambulatorial de Pressão Arterial", "10274", "", "", "NÃO"],
  ["RENEM-631", "Médico Assistencial", "Máquina de Circulação Extracorpórea", "10468", "", "", "NÃO"],
  ["RENEM-632", "Médico Assistencial", "Marcapasso Cardíaco Externo", "10252", "", "", "NÃO"],
  ["RENEM-633", "Médico Assistencial", "Martelete Pneumático", "11211", "", "", "NÃO"],
  ["RENEM-634", "Médico Assistencial", "Medidor de Fluxo Expiratório", "11909", "", "", "NÃO"],
  ["RENEM-635", "Médico Assistencial", "Mesa Cirúrgica", "2174; 363", "mesa operatoria", "Mesa Cirúrgica Elétrica; Mesa Cirúrgica Mecânica", "NÃO"],
  ["RENEM-636", "Médico Assistencial", "Mesa de Exames", "1222", "mesa de exame; mesa de exame clinico; mesa clinica; mesa para exame clinico; maca para exame; maca para exames; maca clinica", "", "NÃO"],
  ["RENEM-637", "Médico Assistencial", "Mesa de Kanavel", "3099", "", "", "NÃO"],
  ["RENEM-638", "Médico Assistencial", "Mesa Ginecológica", "10398; 662", "mesa para exame ginecologico; maca ginecologica; mesa de parto", "Mesa Ginecológica Elétrica", "NÃO"],
  ["RENEM-639", "Médico Assistencial", "Mesa Ortostática", "3007", "", "", "NÃO"],
  ["RENEM-640", "Médico Assistencial", "Micro Jato para Prótese Dentária", "738", "", "", "NÃO"],
  ["RENEM-641", "Médico Assistencial", "Microcerátomo", "10316", "", "", "NÃO"],
  ["RENEM-642", "Médico Assistencial", "Micromotor Elétrico com Localizador de Ápice", "11738", "", "", "NÃO"],
  ["RENEM-643", "Médico Assistencial", "Micropipeta Monocanal", "24", "", "", "NÃO"],
  ["RENEM-644", "Médico Assistencial", "Micropipeta Multicanal", "2510", "", "", "NÃO"],
  ["RENEM-645", "Médico Assistencial", "Microscópio Cirúrgico", "390", "", "", "NÃO"],
  ["RENEM-646", "Médico Assistencial", "Microscópio Cirúrgico Oftalmológico", "11748", "", "", "NÃO"],
  ["RENEM-647", "Médico Assistencial", "Microscópio Especular de Córnea", "10432", "", "", "NÃO"],
  ["RENEM-648", "Médico Assistencial", "Microscópio Estereoscópio", "11785", "", "", "NÃO"],
  ["RENEM-649", "Médico Assistencial", "Microscópio Laboratorial", "725; 11197", "", "Microscópio Laboratorial Básico", "NÃO"],
  ["RENEM-650", "Médico Assistencial", "Micrótomo", "433", "", "", "NÃO"],
  ["RENEM-651", "Médico Assistencial", "Misturador Laboratorial", "466", "", "", "NÃO"],
  ["RENEM-652", "Médico Assistencial", "Moinho de Facas e Martelos", "11628", "", "", "NÃO"],
  ["RENEM-653", "Médico Assistencial", "Monitor de Pressão Intracraniana", "1159", "", "", "NÃO"],
  ["RENEM-654", "Médico Assistencial", "Monitor de Sinais Vitais", "11864", "", "Monitor de Sinais Vitais para Telessaúde", "NÃO"],
  ["RENEM-655", "Médico Assistencial", "Monitor Hemodinâmico", "11799", "", "", "NÃO"],
  ["RENEM-656", "Médico Assistencial", "Monitor Multiparâmetros", "673; 11673; 11237; 10985", "monitor multiparametrico; monitor multiparametro; monitor multiparamentro; monitor cardiaco", "Monitor Multiparâmetros para Centro Cirúrgico; Monitor Multiparâmetros para Ressonância Magnética; Monitor Multiparâmetros para UTI", "NÃO"],
  ["RENEM-657", "Médico Assistencial", "Monitor para Imagens Radiológicas", "10765", "", "", "NÃO"],
  ["RENEM-658", "Médico Assistencial", "Motor Elétrico Cirúrgico Odontológico", "205", "", "", "NÃO"],
  ["RENEM-659", "Médico Assistencial", "Nebulizador", "586", "nebulizador ultrassonico", "Nebulizador Portátil", "SIM"],
  ["RENEM-660", "Médico Assistencial", "Oftalmoscópio", "1506; 11867", "", "Oftalmoscópio para Telessaúde", "NÃO"],
  ["RENEM-661", "Médico Assistencial", "Oftalmoscópio Binocular Indireto", "11429", "", "", "NÃO"],
  ["RENEM-662", "Médico Assistencial", "Osmômetro", "2229", "", "", "NÃO"],
  ["RENEM-663", "Médico Assistencial", "Otoscópio", "11866; 1073", "", "Otoscópio para Telessaúde; Otoscópio Simples", "NÃO"],
  ["RENEM-664", "Médico Assistencial", "Otoscópio de Sistema Aberto", "11649", "", "", "NÃO"],
  ["RENEM-665", "Médico Assistencial", "Oxímetro", "11870", "", "Oxímetro para Telessaúde", "NÃO"],
  ["RENEM-666", "Médico Assistencial", "Oxímetro de Pulso", "699; 11235", "oximetro portatil; oximetro de dedo", "Oxímetro de Pulso para Ressonância Magnética", "NÃO"],
  ["RENEM-667", "Médico Assistencial", "PCR em Tempo Real", "11412", "", "", "NÃO"],
  ["RENEM-668", "Médico Assistencial", "Pedígrafo", "1521", "", "", "NÃO"],
  ["RENEM-669", "Médico Assistencial", "Percolador", "10779", "", "", "NÃO"],
  ["RENEM-670", "Médico Assistencial", "PET CT", "301", "", "", "NÃO"],
  ["RENEM-671", "Médico Assistencial", "pHmetro - Medidor", "304", "", "", "NÃO"],
  ["RENEM-672", "Médico Assistencial", "Pipetador Automático", "1706", "", "", "NÃO"],
  ["RENEM-673", "Médico Assistencial", "Pistola para Biópsia Mamária", "10963", "", "", "NÃO"],
  ["RENEM-674", "Médico Assistencial", "Placa Aquecedora", "2429", "", "", "NÃO"],
  ["RENEM-675", "Médico Assistencial", "Placa Refrigerada", "10523", "", "", "NÃO"],
  ["RENEM-676", "Médico Assistencial", "Podoscópio", "10213", "", "", "NÃO"],
  ["RENEM-677", "Médico Assistencial", "Polarímetro", "610", "", "", "NÃO"],
  ["RENEM-678", "Médico Assistencial", "Polígrafo", "154", "", "", "NÃO"],
  ["RENEM-679", "Médico Assistencial", "Polissonógrafo", "10325", "", "", "NÃO"],
  ["RENEM-680", "Médico Assistencial", "Processadora de Tecidos", "616; 11240", "", "", "NÃO"],
  ["RENEM-681", "Médico Assistencial", "Projetor Oftalmológico", "452", "", "", "NÃO"],
  ["RENEM-682", "Médico Assistencial", "Prono-supinador", "10438", "", "", "NÃO"],
  ["RENEM-683", "Médico Assistencial", "Pupilômetro", "1519", "", "", "NÃO"],
  ["RENEM-684", "Médico Assistencial", "Rampa com Degraus", "2930", "", "", "NÃO"],
  ["RENEM-685", "Médico Assistencial", "Rampa para Alongamento", "3091", "", "", "NÃO"],
  ["RENEM-686", "Médico Assistencial", "Reanimador Pulmonar em T", "779", "", "", "NÃO"],
  ["RENEM-687", "Médico Assistencial", "Reanimador Pulmonar Manual", "3006; 3010", "ambu; reanimador manual", "Reanimador Pulmonar Manual Adulto; Reanimador Pulmonar Manual Pediátrico", "NÃO"],
  ["RENEM-688", "Médico Assistencial", "Refletor Odontológico", "744", "", "", "NÃO"],
  ["RENEM-689", "Médico Assistencial", "Refratômetro", "688", "", "", "NÃO"],
  ["RENEM-690", "Médico Assistencial", "Refratômetro de Bancada", "11294", "", "", "NÃO"],
  ["RENEM-691", "Médico Assistencial", "Refrator de Greens", "66", "", "", "NÃO"],
  ["RENEM-692", "Médico Assistencial", "Ressonância Nuclear Magnética 1,5 T", "10889", "", "", "NÃO"],
  ["RENEM-693", "Médico Assistencial", "Ressonância Nuclear Magnética 3,0 T", "10890", "", "", "NÃO"],
  ["RENEM-694", "Médico Assistencial", "Ressonância Nuclear Magnética até 0,5 T", "10891", "", "", "NÃO"],
  ["RENEM-695", "Médico Assistencial", "Retinógrafo", "98; 11862", "", "Retinógrafo para Telessaúde", "NÃO"],
  ["RENEM-696", "Médico Assistencial", "Retinoscópio", "1534", "", "", "NÃO"],
  ["RENEM-697", "Médico Assistencial", "Sequenciador de DNA", "2857", "", "", "NÃO"],
  ["RENEM-698", "Médico Assistencial", "Serra de Autópsia", "10071", "", "", "NÃO"],
  ["RENEM-699", "Médico Assistencial", "Serra/Perfuradora Óssea", "11629", "", "", "NÃO"],
  ["RENEM-700", "Médico Assistencial", "Simetrógrafo", "10297", "", "", "NÃO"],
  ["RENEM-701", "Médico Assistencial", "Simulador/Tomógrafo para Radioterapia", "719", "", "", "NÃO"],
  ["RENEM-702", "Médico Assistencial", "Sistema Automatizado Elisa", "11859", "", "", "NÃO"],
  ["RENEM-703", "Médico Assistencial", "Sistema Computadorizado para Teste Ergométrico", "10446", "", "", "NÃO"],
  ["RENEM-704", "Médico Assistencial", "Sistema de Aférese", "2095", "", "", "NÃO"],
  ["RENEM-705", "Médico Assistencial", "Sistema de Análise de Proteína", "11798", "", "", "NÃO"],
  ["RENEM-706", "Médico Assistencial", "Sistema de Bomba Intraórtica/Balão Intraórtico", "10278", "", "", "NÃO"],
  ["RENEM-707", "Médico Assistencial", "Sistema de Campo Livre", "2275", "", "", "NÃO"],
  ["RENEM-708", "Médico Assistencial", "Sistema de Cirurgia Guiada por Imagem", "1543", "", "", "NÃO"],
  ["RENEM-709", "Médico Assistencial", "Sistema de Eletroforese", "994", "", "", "NÃO"],
  ["RENEM-710", "Médico Assistencial", "Sistema de Hemodinâmica", "282", "", "", "NÃO"],
  ["RENEM-711", "Médico Assistencial", "Sistema de Hipo/Hipertermia", "3012", "", "", "NÃO"],
  ["RENEM-712", "Médico Assistencial", "Sistema de Identificação e de Antibiograma", "2734", "", "", "NÃO"],
  ["RENEM-713", "Médico Assistencial", "Sistema de Microscopia Cirúrgica com Vídeo Angiografia", "10947", "", "", "NÃO"],
  ["RENEM-714", "Médico Assistencial", "Sistema de Monitorização Neurofisiológica Intraoperatória", "11948", "", "", "NÃO"],
  ["RENEM-715", "Médico Assistencial", "Sistema de Vídeo Endoscopia Flexível", "11268", "", "", "NÃO"],
  ["RENEM-716", "Médico Assistencial", "Sistema de Vídeo Endoscopia Rígida", "10254", "", "", "NÃO"],
  ["RENEM-717", "Médico Assistencial", "Sistema Holter - Analisador e Gravador", "1123", "", "", "NÃO"],
  ["RENEM-718", "Médico Assistencial", "Sistema para Urodinâmica", "264", "", "", "NÃO"],
  ["RENEM-719", "Médico Assistencial", "Suporte de Westergreen", "1590", "", "", "NÃO"],
  ["RENEM-720", "Médico Assistencial", "Tablado para Fisioterapia", "2951", "", "", "NÃO"],
  ["RENEM-721", "Médico Assistencial", "Tábua de Propriocepção", "10903", "", "", "NÃO"],
  ["RENEM-722", "Médico Assistencial", "Tábua de Quadríceps", "3094", "", "", "NÃO"],
  ["RENEM-723", "Médico Assistencial", "Tábua de Tríceps", "3103", "", "", "NÃO"],
  ["RENEM-724", "Médico Assistencial", "TENS e FES", "3093", "", "", "NÃO"],
  ["RENEM-725", "Médico Assistencial", "TENS - Estimulador Transcutâneo", "2958", "", "", "NÃO"],
  ["RENEM-726", "Médico Assistencial", "Termociclador para PCR", "10560", "", "", "NÃO"],
  ["RENEM-727", "Médico Assistencial", "Termômetro Clínico", "11415", "", "", "NÃO"],
  ["RENEM-728", "Médico Assistencial", "Titulador Automático", "2797", "", "", "NÃO"],
  ["RENEM-729", "Médico Assistencial", "Tomógrafo Computadorizado", "11805; 11804", "", "", "NÃO"],
  ["RENEM-730", "Médico Assistencial", "Tomógrafo de Coerência Óptica", "10323", "", "", "NÃO"],
  ["RENEM-731", "Médico Assistencial", "Tonômetro", "1551", "", "", "NÃO"],
  ["RENEM-732", "Médico Assistencial", "Topógrafo de Córnea", "3123", "", "", "NÃO"],
  ["RENEM-733", "Médico Assistencial", "Transiluminador Cutâneo", "1229", "", "", "NÃO"],
  ["RENEM-734", "Médico Assistencial", "Tromboelastógrafo/Tromboelastômetro", "10909", "", "", "NÃO"],
  ["RENEM-735", "Médico Assistencial", "Turbilhão", "928", "", "", "NÃO"],
  ["RENEM-736", "Médico Assistencial", "UltraSonicador", "11266", "", "", "NÃO"],
  ["RENEM-737", "Médico Assistencial", "Ultrassom Diagnóstico", "11869", "", "Ultrassom Diagnóstico Portátil paraTelessaúde", "NÃO"],
  ["RENEM-738", "Médico Assistencial", "Ultrassom Diagnóstico com Aplicação Transesofágica", "11423", "", "", "NÃO"],
  ["RENEM-739", "Médico Assistencial", "Ultrassom Diagnóstico sem Aplicação Transesofágica", "11422", "", "", "NÃO"],
  ["RENEM-740", "Médico Assistencial", "Ultrassom Diagnóstico Transcraniano", "11655", "", "", "NÃO"],
  ["RENEM-741", "Médico Assistencial", "Ultrassom Odontológico", "2729", "", "", "NÃO"],
  ["RENEM-742", "Médico Assistencial", "Ultrassom Oftalmológico", "194", "", "", "NÃO"],
  ["RENEM-743", "Médico Assistencial", "Ultrassom para Fisioterapia", "204", "", "", "NÃO"],
  ["RENEM-744", "Médico Assistencial", "Unidade Auxiliar com Sugador", "97", "", "", "NÃO"],
  ["RENEM-745", "Médico Assistencial", "Ventilador Pulmonar", "11236", "ventilador mecanico; respirador pulmonar; ventilador de transporte; ventilador pulmonar de transporte", "Ventilador Pulmonar para Ressonância Magnética", "NÃO"],
  ["RENEM-746", "Médico Assistencial", "Ventilador Pulmonar Pressométrico e Volumétrico", "11425", "", "", "NÃO"],
  ["RENEM-747", "Médico Assistencial", "Ventilômetro/Respirômetro", "10294", "", "", "NÃO"],
  ["RENEM-748", "Médico Assistencial", "Vídeo Laringoscópio", "10907", "", "", "NÃO"],
  ["RENEM-749", "Médico Assistencial", "Viscosímetro", "973", "", "", "NÃO"],
  ["RENEM-750", "Médico Assistencial", "Vitreófago", "10155", "", "", "NÃO"],
  ["RENEM-751", "Veículo", "Ambulância Padrão Samu 192 Furgão Sem Equipamentos", "11994", "", "Ambulância Padrão Samu 192 Furgão Sem Equipamentos Aquisição por Pregão 90105/2025", "NÃO"],
  ["RENEM-752", "Veículo", "Ambulância Padrão Samu 192 Furgão Tipo B", "11995", "", "Ambulância Padrão Samu 192 Furgão Tipo B Aquisição por Pregão 90105/2025", "NÃO"],
  ["RENEM-753", "Veículo", "Ambulância Padrão Samu 192 Furgão Tipo D", "11996", "", "Ambulância Padrão Samu 192 Furgão Tipo D Aquisição por Pregão 90105/2025", "NÃO"],
  ["RENEM-754", "Veículo", "Ambulância Tipo A - Simples Remoção Furgão", "11998", "", "Ambulância Tipo A - Simples Remoção Furgão Aquisição por Pregão 90130/2025", "NÃO"],
  ["RENEM-755", "Veículo", "Ambulância Tipo A - Simples Remoção Tipo Furgão", "11656; 11974", "", "", "NÃO"],
  ["RENEM-756", "Veículo", "Ambulância Tipo A - Simples Remoção Tipo Furgoneta", "11677", "", "", "NÃO"],
  ["RENEM-757", "Veículo", "Ambulância Tipo A - Simples Remoção Tipo pick-up 4x4", "11678", "", "", "NÃO"],
  ["RENEM-758", "Veículo", "Bicicleta", "11603; 11899", "", "Bicicleta Elétrica", "SIM"],
  ["RENEM-759", "Veículo", "Embarcação para Transporte com Motor Popa", "11083", "", "", "SIM"],
  ["RENEM-760", "Veículo", "Micro-ônibus com Acessibilidade", "12001", "", "Micro-ônibus com Acessibilidade Aquisição por Pregão 90414/2025", "SIM"],
  ["RENEM-761", "Veículo", "Micro-ônibus Rural de Transporte Sanitário", "11654", "", "", "NÃO"],
  ["RENEM-762", "Veículo", "Micro-ônibus Urbano de Transporte Sanitário", "11652", "", "", "NÃO"],
  ["RENEM-763", "Veículo", "Motocicleta", "11900", "", "Motocicleta Elétrica", "SIM"],
  ["RENEM-764", "Veículo", "Quadriciclo 4x4", "11880", "", "", "SIM"],
  ["RENEM-765", "Veículo", "Quadriciclo UTV", "11881", "", "", "SIM"],
  ["RENEM-766", "Veículo", "Unidade Móvel da Saúde - SAMU 192", "11993", "", "", "NÃO"],
  ["RENEM-767", "Veículo", "Unidade Móvel da Saúde - SAMU 192 Sem Equipamentos", "11997", "", "", "NÃO"],
  ["RENEM-768", "Veículo", "Unidade Móvel de Coleta", "32", "", "", "NÃO"],
  ["RENEM-769", "Veículo", "Unidade Móvel de Saúde - SAMU", "11587", "", "", "NÃO"],
  ["RENEM-770", "Veículo", "Unidade Móvel de Saúde - SAMU 192", "11845; 11846", "", "", "NÃO"],
  ["RENEM-771", "Veículo", "Unidade Odontológica Móvel - UOM", "11885", "", "", "NÃO"],
  ["RENEM-772", "Veículo", "Veículo de Passeio - Transporte de Equipe", "36", "", "", "SIM"],
  ["RENEM-773", "Veículo", "Veículo de Transporte Adaptado", "11585; 11795", "", "", "NÃO"],
  ["RENEM-774", "Veículo", "Veículo de Transporte Sanitário", "11653", "", "", "NÃO"],
  ["RENEM-775", "Veículo", "Veículo Pick-up Cabine Dupla 4x4", "10923", "", "", "SIM"],
  ["RENEM-776", "Veículo", "Veículo Tipo Motocicleta", "11611", "", "", "SIM"],
  ["RENEM-777", "Veículo", "Veículo Tipo Van com Acessibilidade", "11975; 11999", "", "Veículo Tipo Van com Acessibilidade Aquisição por Pregão 90447/2025", "SIM"],
  ["RENEM-778", "Veículo", "Veículo tipo Van - Diesel", "11103", "", "", "SIM"],
  ["CTX-001", "Genérico hospitalar", "Mobiliário/equipamento hospitalar (genérico)", "", "mobiliario hospitalar; moveis hospitalares; equipamento hospitalar; equipamentos hospitalares; equipamento medico hospitalar; equipamentos medico hospitalares; equipamento medico assistencial; equipamentos medicos; material permanente hospitalar; mobiliario clinico; equipamentos para ubs; equipamentos para upa; ambulancia; ambulancias", "", "NÃO"]
];

// ======================= Catalog.gs =======================
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
var PARTS_RE_ = /(pecas|insumos|acessorios|reposicao|material de consumo|baterias|refis)/;
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
  if (HARD_EXCLUDE_RE_.test(o)) return { hits: [], contextual: false, excluded: true, service: false, health: false };
  var health = HEALTH_RE_.test(o) || HEALTH_RE_.test(org);
  var hits = matchProducts(matcher, objeto, '', health);
  var service = SERVICE_RE_.test(o) && !ACQUIRE_RE_.test(o);
  var parts = PARTS_RE_.test(o) && !NEW_EQUIP_RE_.test(o);
  var excluded = EXCLUDE_RE_.test(o);
  var contextual = !hits.length && health && (EQUIP_RE_.test(o) || (STRUCT_RE_.test(o) && ACQUIRE_RE_.test(o)));
  // Processo misto (ex.: medicamentos + equipamentos): mantém se houver equipamento no objeto.
  if (excluded && EQUIP_RE_.test(o)) excluded = false;
  return { hits: hits, contextual: contextual && !excluded, excluded: excluded && !hits.length, service: service, parts: parts, health: health };
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
  } else if (specific.length && !specific.some(function (h) { return !h.needsHealth; })) {
    prio = open ? 'Média' : 'Baixa';
    motivo = 'Somente itens gerais da RENEM (' + specific.map(function (h) { return h.row.produto; }).slice(0, 3).join(', ') +
      ') em contratação da saúde; sem equipamento médico-hospitalar específico';
  } else if (specific.length && open && ageDays <= 60) {
    prio = 'Alta';
    motivo = 'Produto identificado (' + specific.filter(function (h) { return !h.needsHealth; }).map(function (h) { return h.row.produto; }).slice(0, 3).join(', ') +
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
function analyzeItems_(matcher, items, healthCtx) {
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
      var p = perProduct[key] || (perProduct[key] = { qtd: 0, un: '', valor: 0, n: 0, needsHealth: h.needsHealth });
      p.qtd += Number(it.quantidade) || 0;
      p.un = p.un || it.unidadeMedida || '';
      p.valor += Number(it.valorTotal) || 0;
      p.n++;
      if (code) catmat[code] = true;
    });
  });
  // Produtos que exigem contexto de saúde só valem em contratação da saúde ou junto de equipamento de saúde.
  if (!healthCtx && !hits.some(function (h) { return !h.needsHealth && !h.generic; })) {
    hits = hits.filter(function (h) { return !h.needsHealth; });
    Object.keys(perProduct).forEach(function (k) { if (perProduct[k].needsHealth) delete perProduct[k]; });
  }
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
      out[r.id] = analyzeItems_(matcher, Array.isArray(x.data) ? x.data : [], !!r._health);
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
    rec._health = pre.health;
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
