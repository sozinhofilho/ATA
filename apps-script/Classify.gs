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
