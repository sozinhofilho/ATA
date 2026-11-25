// Mecanismo de busca local do catálogo (sem dependências e sem serviços pagos).
// Reconhece: maiúsculas/minúsculas, acentos, plural/singular, pequenas variações de escrita,
// sinônimos, códigos RENEM/CATMAT, marca, modelo, categoria e descrição.

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'para', 'com', 'em', 'um', 'uma', 'no', 'na', 'por', 'tipo']);

// Termos genéricos: ajudam a ordenar, mas não são obrigatórios na correspondência.
const SOFT = new Set(['hospitalar', 'equipamento', 'medico', 'clinico', 'aparelho', 'produto', 'adulto', 'unidade', 'saude', 'ata', 'renem', 'catmat', 'codigo']);

// Sinônimos globais (além dos sinônimos cadastrados em cada produto).
// Cada grupo é tratado como equivalente durante a busca.
export const SYNONYM_GROUPS = [
  ['cama', 'leito'],
  ['maca', 'padiola', 'carro maca'],
  ['dea', 'aed', 'desfibrilador externo automatico'],
  ['desfibrilador', 'cardioversor', 'cardiodesfibrilador'],
  ['monitor', 'monitor multiparametrico', 'multiparametro', 'monitor multiparametro'],
  ['ecg', 'eletrocardiografo', 'eletro'],
  ['pressao', 'esfigmomanometro', 'tensiometro'],
  ['oximetro', 'saturimetro'],
  ['carro emergencia', 'carro parada', 'carrinho emergencia'],
  ['cadeira roda', 'cadeira rodas'],
  ['balanca', 'pesagem'],
  ['sonar', 'detector fetal', 'doppler fetal'],
  ['ambu', 'reanimador'],
  ['berco', 'bercario'],
  ['mocho', 'banqueta'],
  ['diva', 'mesa exame'],
  ['soro', 'suporte soro'],
  ['lavanderia', 'lavadora', 'secadora', 'centrifuga', 'calandra'],
];

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Redução simples de plural para singular em português. */
export function stem(w) {
  if (w.length <= 3 || /^\d+$/.test(w)) return w;
  if (w.endsWith('oes') || w.endsWith('aes')) return w.slice(0, -3) + 'ao';
  if (w.endsWith('ais')) return w.slice(0, -3) + 'al';
  if (w.endsWith('eis') && w.length > 5) return w.slice(0, -3) + 'el';
  if (w.endsWith('res') || w.endsWith('zes') || w.endsWith('ses')) return w.slice(0, -2);
  if (w.endsWith('ns')) return w.slice(0, -2) + 'm';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(s) {
  return normalize(s)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}

const SYN_INDEX = (() => {
  const map = new Map();
  for (const group of SYNONYM_GROUPS) {
    const g = group.map((x) => tokenize(x).join(' '));
    for (const term of g) map.set(term, g);
  }
  return map;
})();

function levenshtein1(a, b) {
  // true quando a distância de edição entre a e b é <= 1
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

const FIELD_WEIGHTS = {
  nome: 10,
  codigos: 12,
  sinonimos: 7,
  tipo: 6,
  marca: 6,
  categoria: 4,
  palavras: 4,
  descricao: 2,
};

/** Prepara um documento de busca a partir de um item do índice. */
export function prepareDoc(item) {
  const fields = {
    nome: item.nome,
    codigos: [item.renem, item.catmat, item.id].filter(Boolean).join(' '),
    sinonimos: (item.sinonimos || []).join(' '),
    tipo: [item.tipo, item.subcategoria].filter(Boolean).join(' '),
    marca: [item.marca, item.fabricante, item.modelo].filter(Boolean).join(' '),
    categoria: [item.categoria, item.subcategoria].filter(Boolean).join(' '),
    palavras: [(item.palavras || []).join(' '), (item.ambientes || []).join(' ')].join(' '),
    descricao: item.resumo || '',
  };
  const tokens = {};
  const phrases = {};
  for (const [f, v] of Object.entries(fields)) {
    tokens[f] = tokenize(v);
    phrases[f] = ' ' + tokens[f].join(' ') + ' ';
  }
  return { item, tokens, phrases };
}

function termScore(doc, term) {
  // term pode ser um token único ou uma expressão de várias palavras (sinônimo composto)
  let best = 0;
  const isPhrase = term.includes(' ');
  const isNumber = /^\d+$/.test(term);
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    if (isPhrase) {
      if (doc.phrases[field].includes(' ' + term + ' ')) best = Math.max(best, weight);
      continue;
    }
    for (const t of doc.tokens[field]) {
      let s = 0;
      if (t === term) s = 1;
      else if (isNumber) s = field === 'codigos' && t.startsWith(term) ? 0.6 : 0;
      else if (term.length >= 2 && t.startsWith(term)) s = 0.75;
      else if (term.length >= 5 && levenshtein1(t, term)) s = 0.45;
      if (s) best = Math.max(best, weight * s);
    }
  }
  return best;
}

function expandToken(tok, nextTok) {
  // Expande o termo com grupos de sinônimos (inclusive expressões de duas palavras).
  const alts = new Set([tok]);
  const pair = nextTok ? `${tok} ${nextTok}` : null;
  for (const key of [tok, pair]) {
    if (key && SYN_INDEX.has(key)) for (const a of SYN_INDEX.get(key)) alts.add(a);
  }
  return [...alts];
}

/**
 * Executa a busca. Retorna [{ item, score }] em ordem de relevância.
 * Todos os termos relevantes da consulta precisam corresponder (diretamente ou por sinônimo).
 */
export function search(docs, query, { limit = Infinity } = {}) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const required = [];
  const optional = [];
  qTokens.forEach((tok, i) => {
    const alts = expandToken(tok, qTokens[i + 1]);
    (SOFT.has(tok) ? optional : required).push(alts);
  });
  const groups = required.length ? required : optional;
  const qPhrase = ' ' + qTokens.join(' ') + ' ';

  const results = [];
  for (const doc of docs) {
    let total = 0;
    let ok = true;
    for (const alts of groups) {
      let best = 0;
      for (const a of alts) best = Math.max(best, termScore(doc, a) * (a.includes(' ') || a === alts[0] ? 1 : 0.9));
      if (!best) { ok = false; break; }
      total += best;
    }
    if (!ok) continue;
    if (required.length) for (const alts of optional) total += termScore(doc, alts[0]) * 0.3;
    if (doc.phrases.nome.includes(qPhrase)) total += 6; // expressão exata no nome
    if (doc.item.destaque) total += 0.5;
    results.push({ item: doc.item, score: total });
  }
  results.sort((a, b) => b.score - a.score || String(a.item.nome).localeCompare(String(b.item.nome), 'pt-BR'));
  return results.slice(0, limit);
}
