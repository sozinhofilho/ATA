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
