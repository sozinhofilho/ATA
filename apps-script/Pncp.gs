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
