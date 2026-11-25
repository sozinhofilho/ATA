// Regras do catálogo: colunas, normalização, validação e geração da base publicável.
// Usado pelo importador (scripts/import-catalog.mjs) e pelos testes unitários.

export const STATUS = ['rascunho', 'pendente', 'publicado', 'inativo'];
export const STATUS_ALIASES = {
  'rascunho': 'rascunho',
  'pendente': 'pendente',
  'pendente de validacao': 'pendente',
  'pendente de validacao comercial': 'pendente',
  'publicado': 'publicado',
  'inativo': 'inativo',
};

export const ILUSTRACOES = [
  'cama', 'maca', 'monitor', 'carro-emergencia', 'mesa-exame', 'berco', 'suporte-soro', 'lavadora',
  'generico', 'poltrona', 'cadeira-rodas', 'desfibrilador', 'balanca', 'bomba-infusao',
  'mesa-cabeceira', 'biombo', 'escada', 'mesa-ginecologica', 'aspirador', 'carro-curativo',
];

export const AMBIENTES = {
  ubs: 'UBS',
  upa: 'UPA',
  hospital: 'Hospitais',
  consultorio: 'Consultórios',
  maternidade: 'Maternidade',
  especialidades: 'Centros de especialidades',
  emergencia: 'Salas de emergência',
  enfermaria: 'Enfermarias',
  lavanderia: 'Lavanderia',
};

// Colunas aceitas na planilha. Qualquer outra coluna é descartada (nunca chega ao site).
// tipo: text | longtext | list | bool | date | specs | url | code | enum
export const COLUMNS = [
  ['id', 'code', 'ID único e permanente do produto (ex.: NX-0001).'],
  ['slug', 'text', 'Endereço da página. Se vazio, é gerado a partir do nome.'],
  ['nome', 'text', 'Nome comercial.'],
  ['categoria', 'text', 'Slug ou nome da categoria principal (ver aba Categorias).'],
  ['subcategoria', 'text', 'Slug ou nome da subcategoria.'],
  ['categorias_secundarias', 'list', 'Outras categorias (slugs), separadas por |.'],
  ['tipo_equipamento', 'text', 'Ex.: Cama Fowler, Monitor, Maca.'],
  ['marca', 'text', 'Somente quando confirmada.'],
  ['fabricante', 'text', 'Somente quando confirmado.'],
  ['modelo', 'text', 'Somente quando confirmado.'],
  ['renem', 'code', 'Código RENEM (apenas números).'],
  ['catmat', 'code', 'Código CATMAT (apenas números).'],
  ['descricao_resumida', 'text', 'Até ~200 caracteres; aparece no card.'],
  ['descricao_completa', 'longtext', 'Descrição comercial e técnica. Parágrafos separados por linha em branco.'],
  ['especificacoes', 'specs', 'Pares "Campo: valor" separados por |.'],
  ['dimensoes', 'text', ''],
  ['peso', 'text', ''],
  ['capacidade_carga', 'text', ''],
  ['material', 'text', ''],
  ['alimentacao_eletrica', 'text', ''],
  ['funcionalidades', 'list', 'Separadas por |.'],
  ['acessorios', 'list', 'Separados por |.'],
  ['ambientes', 'list', 'Códigos: ubs | upa | hospital | consultorio | maternidade | especialidades | emergencia | enfermaria | lavanderia.'],
  ['aplicacoes', 'list', 'Separadas por |.'],
  ['imagem_principal', 'url', 'Caminho /images/produtos/arquivo.webp ou ilustracao:nome.'],
  ['imagens_adicionais', 'list', 'Caminhos separados por |.'],
  ['imagem_ilustrativa', 'bool', 'sim quando a imagem não for fotografia do modelo comercializado.'],
  ['ficha_tecnica', 'url', 'Somente documentos autorizados (/documents/...).'],
  ['manual', 'url', ''],
  ['certificacoes', 'list', 'Somente comprovadas.'],
  ['anvisa', 'text', 'Registro ou notificação Anvisa, quando aplicável e confirmado.'],
  ['garantia', 'text', 'Somente quando confirmada pelo fornecedor.'],
  ['prazo_entrega', 'text', 'Somente quando confirmado.'],
  ['disponibilidade_comercial', 'text', 'Ex.: Sob consulta.'],
  ['disponibilidade_ata', 'text', '"confirmada" somente com ata vigente cadastrada em atas.json.'],
  ['referencia_ata', 'text', 'ID da ata em src/data/atas.json.'],
  ['palavras_chave', 'list', 'Separadas por |.'],
  ['sinonimos', 'list', 'Separados por | (ex.: leito | cama de internação).'],
  ['destaque', 'bool', 'sim para aparecer na página inicial.'],
  ['ordem_destaque', 'code', 'Número para ordenar os destaques.'],
  ['relacionados', 'list', 'IDs de produtos relacionados, separados por |.'],
  ['titulo_seo', 'text', 'Até ~60 caracteres. Se vazio, é gerado.'],
  ['meta_description', 'text', 'Até ~155 caracteres. Se vazio, usa a descrição resumida.'],
  ['status', 'enum', 'rascunho | pendente | publicado | inativo.'],
  ['data_atualizacao', 'date', 'AAAA-MM-DD ou DD/MM/AAAA.'],
  ['fonte', 'text', 'Origem das informações (uso interno; não exibido).'],
  ['autorizacao_publicacao', 'bool', 'sim quando o fornecedor autorizou a divulgação.'],
  ['demonstrativo', 'bool', 'sim para produtos fictícios de desenvolvimento. Bloqueia o build de produção.'],
];
export const COLUMN_NAMES = COLUMNS.map((c) => c[0]);
const COLUMN_TYPES = Object.fromEntries(COLUMNS.map((c) => [c[0], c[1]]));

// Campos internos que nunca podem ser publicados, mesmo que apareçam na planilha.
export const PRIVATE_COLUMN_PATTERN = /(pre[cç]o|valor|margem|comiss|custo|desconto|banc|ag[eê]ncia|conta_|cpf|senha|token|api_?key|chave_?(api|acesso|pix)|contrato_?privado|observa[cç][aã]o_interna|interno)/i;

export function stripAccents(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(s) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function cleanText(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, '') // remove marcação HTML: o conteúdo é sempre exibido como texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function parseBool(v) {
  const s = stripAccents(String(v ?? '')).trim().toLowerCase();
  return ['sim', 's', 'yes', 'y', 'true', '1', 'x', 'verdadeiro'].includes(s);
}

export function parseList(v) {
  return String(v ?? '')
    .split('|')
    .map((x) => cleanText(x))
    .filter(Boolean);
}

export function parseSpecs(v) {
  return parseList(v)
    .map((pair) => {
      const i = pair.indexOf(':');
      if (i <= 0) return null;
      const label = cleanText(pair.slice(0, i));
      const value = cleanText(pair.slice(i + 1));
      return label && value ? { label, value } : null;
    })
    .filter(Boolean);
}

export function parseDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function isSafeUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return true;
  if (/^ilustracao:[a-z0-9-]+$/.test(s)) return true;
  if (/^\/(?!\/)[A-Za-z0-9._~\-/%]+$/.test(s)) return !s.includes('..');
  return /^https:\/\/[^\s"'<>]+$/.test(s);
}

export function resolveImage(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/^ilustracao:([a-z0-9-]+)$/);
  if (m) return { src: `/images/ilustracoes/${m[1]}.svg`, ilustracao: true, nome: m[1] };
  return s ? { src: s, ilustracao: false } : null;
}

function findCategory(categories, value) {
  const key = slugify(value);
  return categories.find((c) => c.slug === key || slugify(c.nome) === key || slugify(c.nomeCurto) === key);
}
function findSub(category, value) {
  if (!category || !value) return undefined;
  const key = slugify(value);
  return category.subcategorias.find((s) => s.slug === key || slugify(s.nome) === key);
}

/**
 * Converte uma linha da planilha em produto normalizado.
 * Retorna { product, errors[], warnings[], dropped[] }.
 */
export function normalizeRow(raw, { categories }) {
  const errors = [];
  const warnings = [];
  const dropped = [];
  const linha = raw.__linha ?? '?';
  const r = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === '__linha') continue;
    const k = slugify(key).replace(/-/g, '_');
    if (!COLUMN_NAMES.includes(k)) {
      if (String(value).trim() !== '') dropped.push(key);
      continue;
    }
    r[k] = value;
  }

  const p = {};
  for (const name of COLUMN_NAMES) {
    const type = COLUMN_TYPES[name];
    const v = r[name] ?? '';
    switch (type) {
      case 'list': p[name] = parseList(v); break;
      case 'bool': p[name] = parseBool(v); break;
      case 'specs': p[name] = parseSpecs(v); break;
      case 'date': {
        const d = parseDate(v);
        if (d === null) { errors.push(`linha ${linha}: data inválida em ${name} ("${v}")`); p[name] = ''; }
        else p[name] = d;
        break;
      }
      case 'code': p[name] = cleanText(v).replace(/\s+/g, ''); break;
      case 'longtext':
        p[name] = String(v ?? '')
          .split(/\r?\n\s*\r?\n/)
          .map(cleanText)
          .filter(Boolean);
        break;
      default: p[name] = cleanText(v);
    }
  }

  // status
  const st = STATUS_ALIASES[stripAccents(p.status).toLowerCase()];
  if (!st) {
    if (p.status) errors.push(`linha ${linha}: status inválido "${p.status}" (use ${STATUS.join(', ')})`);
    p.status = 'rascunho';
  } else p.status = st;

  if (!p.id) errors.push(`linha ${linha}: coluna "id" é obrigatória`);
  if (!p.nome) errors.push(`linha ${linha}: coluna "nome" é obrigatória`);

  p.slug = slugify(p.slug || p.nome);
  if (!p.slug) errors.push(`linha ${linha}: não foi possível gerar o slug`);

  for (const code of ['renem', 'catmat', 'ordem_destaque']) {
    if (p[code] && !/^\d+$/.test(p[code])) errors.push(`linha ${linha}: ${code} deve conter apenas números ("${p[code]}")`);
  }

  const cat = findCategory(categories, p.categoria);
  if (!cat) {
    errors.push(`linha ${linha}: categoria desconhecida "${p.categoria}"`);
  } else {
    p.categoria = cat.slug;
    if (p.subcategoria) {
      const sub = findSub(cat, p.subcategoria);
      if (!sub) { warnings.push(`linha ${linha}: subcategoria "${p.subcategoria}" não pertence a ${cat.slug}; ignorada`); p.subcategoria = ''; }
      else p.subcategoria = sub.slug;
    }
  }
  p.categorias_secundarias = p.categorias_secundarias
    .map((c) => findCategory(categories, c)?.slug)
    .filter((s) => s && s !== p.categoria);

  const ambientesValidos = [];
  for (const a of p.ambientes) {
    const k = slugify(a);
    if (AMBIENTES[k]) ambientesValidos.push(k);
    else warnings.push(`linha ${linha}: ambiente desconhecido "${a}" ignorado`);
  }
  p.ambientes = ambientesValidos;

  for (const f of ['imagem_principal', 'ficha_tecnica', 'manual']) {
    if (!isSafeUrl(p[f])) { errors.push(`linha ${linha}: endereço inseguro ou inválido em ${f}`); p[f] = ''; }
  }
  p.imagens_adicionais = p.imagens_adicionais.filter((u) => {
    if (isSafeUrl(u)) return true;
    errors.push(`linha ${linha}: endereço inválido em imagens_adicionais`);
    return false;
  });

  const ilustr = p.imagem_principal.match(/^ilustracao:([a-z0-9-]+)$/);
  if (ilustr && !ILUSTRACOES.includes(ilustr[1])) {
    warnings.push(`linha ${linha}: ilustração "${ilustr[1]}" inexistente; usando "generico"`);
    p.imagem_principal = 'ilustracao:generico';
  }
  if (!p.imagem_principal) {
    const fallback = cat?.ilustracao ?? 'generico';
    if (p.status === 'publicado') warnings.push(`linha ${linha}: sem imagem principal; usando ilustração "${fallback}"`);
    p.imagem_principal = `ilustracao:${fallback}`;
  }

  const ata = stripAccents(p.disponibilidade_ata).toLowerCase();
  p.disponibilidade_ata = ata === 'confirmada' ? 'confirmada' : '';

  if (p.status === 'publicado') {
    if (!p.autorizacao_publicacao) errors.push(`linha ${linha}: produto "${p.id}" está como publicado sem autorizacao_publicacao = sim`);
    if (!p.descricao_resumida) warnings.push(`linha ${linha}: produto "${p.id}" sem descrição resumida`);
  }

  if (dropped.length) warnings.push(`linha ${linha}: colunas ignoradas (não publicáveis ou desconhecidas): ${dropped.join(', ')}`);

  return { product: p, errors, warnings, dropped };
}

/** Indica se uma ata do cadastro está publicável e vigente na data informada. */
export function isAtaVigente(ata, today) {
  if (!ata || !ata.publicar) return false;
  if (!ata.vigenciaFim) return false;
  return ata.vigenciaFim >= today;
}

/**
 * Monta o catálogo publicável a partir das linhas da planilha.
 * Somente status "publicado" + autorizacao_publicacao entram no site.
 */
export function buildCatalog(records, { categories, atas = [], mode = 'homologacao', today = new Date().toISOString().slice(0, 10) }) {
  const errors = [];
  const warnings = [];
  const all = [];
  const seenIds = new Map();
  const seenSlugs = new Map();

  for (const raw of records) {
    const { product, errors: e, warnings: w } = normalizeRow(raw, { categories });
    errors.push(...e);
    warnings.push(...w);
    if (product.id) {
      if (seenIds.has(product.id)) errors.push(`ID duplicado "${product.id}" (linhas ${seenIds.get(product.id)} e ${raw.__linha})`);
      seenIds.set(product.id, raw.__linha);
    }
    all.push(product);
  }

  const published = all.filter((p) => p.status === 'publicado' && p.autorizacao_publicacao && p.id && p.nome && categories.some((c) => c.slug === p.categoria));

  for (const p of published) {
    if (seenSlugs.has(p.slug)) {
      const base = p.slug;
      let n = 2;
      while (seenSlugs.has(`${base}-${n}`)) n++;
      p.slug = `${base}-${n}`;
      warnings.push(`slug repetido "${base}" no produto ${p.id}; ajustado para "${p.slug}"`);
    }
    seenSlugs.set(p.slug, p.id);

    // Ata: o indicador só é exibido com ata publicada e vigente no cadastro.
    const ata = atas.find((a) => a.id === p.referencia_ata);
    p.ata_confirmada = p.disponibilidade_ata === 'confirmada' && isAtaVigente(ata, today);
    if (p.disponibilidade_ata === 'confirmada' && !p.ata_confirmada) {
      warnings.push(`produto ${p.id}: disponibilidade_ata = confirmada, mas a ata "${p.referencia_ata}" não está publicada/vigente; exibindo "Consulte disponibilidade"`);
    }
    if (mode === 'production' && p.demonstrativo) {
      errors.push(`produto ${p.id} é DEMONSTRATIVO e não pode ir para produção`);
    }
  }

  const ids = new Set(published.map((p) => p.id));
  for (const p of published) {
    const missing = p.relacionados.filter((id) => !ids.has(id));
    if (missing.length) warnings.push(`produto ${p.id}: relacionados não publicados ignorados (${missing.join(', ')})`);
    p.relacionados = p.relacionados.filter((id) => ids.has(id) && id !== p.id);
  }

  const counts = Object.fromEntries(STATUS.map((s) => [s, all.filter((p) => p.status === s).length]));

  // Somente campos públicos seguem para o site; "fonte" é de uso interno.
  const publicProducts = published.map((p) => {
    const { fonte, autorizacao_publicacao, ...pub } = p;
    return pub;
  });

  return { products: publicProducts, errors, warnings, counts, total: all.length };
}
