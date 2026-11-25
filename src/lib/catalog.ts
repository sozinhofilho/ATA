// Acesso aos dados do catálogo já validados pelo importador (scripts/import-catalog.mjs).
import productsRaw from '../data/generated/products.json';
import categoriesRaw from '../data/categories.json';
import solutionsRaw from '../data/solutions.json';
import atasRaw from '../data/atas.json';
import { AMBIENTES } from '../../scripts/lib/catalog-core.mjs';

export interface Spec { label: string; value: string }
export interface Product {
  id: string; slug: string; nome: string;
  categoria: string; subcategoria: string; categorias_secundarias: string[];
  tipo_equipamento: string; marca: string; fabricante: string; modelo: string;
  renem: string; catmat: string;
  descricao_resumida: string; descricao_completa: string[];
  especificacoes: Spec[];
  dimensoes: string; peso: string; capacidade_carga: string; material: string; alimentacao_eletrica: string;
  funcionalidades: string[]; acessorios: string[]; ambientes: string[]; aplicacoes: string[];
  imagem_principal: string; imagens_adicionais: string[]; imagem_ilustrativa: boolean;
  ficha_tecnica: string; manual: string; certificacoes: string[]; anvisa: string;
  garantia: string; prazo_entrega: string; disponibilidade_comercial: string;
  disponibilidade_ata: string; referencia_ata: string; ata_confirmada: boolean;
  palavras_chave: string[]; sinonimos: string[];
  destaque: boolean; ordem_destaque: string; relacionados: string[];
  titulo_seo: string; meta_description: string;
  status: string; data_atualizacao: string; demonstrativo: boolean;
}
export interface Subcategory { slug: string; nome: string }
export interface Category { slug: string; nome: string; nomeCurto: string; ilustracao: string; descricao: string; subcategorias: Subcategory[] }
export interface Solution {
  slug: string; ambiente: string; nome: string; nomeCurto: string; tipoUnidadeMensagem: string; ilustracao: string;
  titulo: string; resumo: string; introducao: string; contexto: { titulo: string; texto: string }[]; categorias: string[];
}
export interface Ata {
  id: string; numero: string; orgaoGerenciador: string; uf?: string; fornecedorBeneficiario: string; objeto: string;
  categorias: string[]; vigenciaInicio: string; vigenciaFim: string; situacaoAdesao: string;
  linkOficial: string; dataConferencia: string; observacoes?: string; publicar: boolean;
}

export const products = productsRaw as unknown as Product[];
export const allCategories = categoriesRaw as Category[];
export const solutions = solutionsRaw as Solution[];
export const ambientesLabel = AMBIENTES as Record<string, string>;

const today = process.env.CATALOG_TODAY || new Date().toISOString().slice(0, 10);
export const atas = ((atasRaw as { atas: Ata[] }).atas || [])
  .filter((a) => a.publicar && a.vigenciaFim && a.vigenciaFim >= today)
  .sort((a, b) => a.vigenciaFim.localeCompare(b.vigenciaFim));

export function inCategory(p: Product, slug: string) {
  return p.categoria === slug || p.categorias_secundarias.includes(slug);
}

/** Somente categorias com produtos publicados aparecem no site. */
export const categories = allCategories
  .map((c) => ({ ...c, count: products.filter((p) => inCategory(p, c.slug)).length }))
  .filter((c) => c.count > 0);

export function getCategory(slug: string) {
  return allCategories.find((c) => c.slug === slug);
}
export function getSubcategory(catSlug: string, subSlug: string) {
  return getCategory(catSlug)?.subcategorias.find((s) => s.slug === subSlug);
}
export function subcategoriesWithProducts(cat: Category) {
  return cat.subcategorias
    .map((s) => ({ ...s, count: products.filter((p) => p.categoria === cat.slug && p.subcategoria === s.slug).length }))
    .filter((s) => s.count > 0);
}

export function productUrl(p: Product) { return `/produtos/${p.slug}/`; }
export function categoryUrl(slug: string) { return `/categorias/${slug}/`; }

export function imageOf(src: string) {
  const m = src.match(/^ilustracao:([a-z0-9-]+)$/);
  return m ? { src: `/images/ilustracoes/${m[1]}.svg`, ilustracao: true } : { src, ilustracao: false };
}

export function productImages(p: Product) {
  return [p.imagem_principal, ...p.imagens_adicionais].map((s, i) => {
    const img = imageOf(s);
    const ilustr = img.ilustracao || p.imagem_ilustrativa;
    return { ...img, ilustracao: ilustr, alt: i === 0 ? `${p.nome}${ilustr ? ' (imagem ilustrativa)' : ''}` : `${p.nome}, imagem ${i + 1}${ilustr ? ' (ilustrativa)' : ''}` };
  });
}

export const featured = products
  .filter((p) => p.destaque)
  .sort((a, b) => (Number(a.ordem_destaque) || 999) - (Number(b.ordem_destaque) || 999))
  .slice(0, 12);

/** Produtos relacionados: primeiro os indicados na planilha, depois mesma subcategoria e categoria. */
export function relatedProducts(p: Product, min = 4, max = 8): Product[] {
  const out: Product[] = [];
  const add = (x?: Product) => { if (x && x.id !== p.id && !out.includes(x)) out.push(x); };
  p.relacionados.forEach((id) => add(products.find((x) => x.id === id)));
  products.filter((x) => x.categoria === p.categoria && x.subcategoria === p.subcategoria).forEach(add);
  products.filter((x) => inCategory(x, p.categoria)).forEach(add);
  if (out.length < min) products.filter((x) => x.ambientes.some((a) => p.ambientes.includes(a))).forEach(add);
  return out.slice(0, max);
}

export function productsForSolution(s: Solution) {
  return products
    .filter((p) => p.ambientes.includes(s.ambiente))
    .sort((a, b) => s.categorias.indexOf(a.categoria) - s.categorias.indexOf(b.categoria) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Índice público de busca (somente campos publicáveis). */
export function searchIndex() {
  return products.map((p) => {
    const cat = getCategory(p.categoria);
    const sub = getSubcategory(p.categoria, p.subcategoria);
    return {
      id: p.id, slug: p.slug, url: productUrl(p), nome: p.nome,
      categoriaSlug: p.categoria, categoria: cat?.nome ?? '', subcategoriaSlug: p.subcategoria, subcategoria: sub?.nome ?? '',
      catsSecundarias: p.categorias_secundarias,
      tipo: p.tipo_equipamento, marca: p.marca, fabricante: p.fabricante, modelo: p.modelo,
      renem: p.renem, catmat: p.catmat, resumo: p.descricao_resumida,
      sinonimos: p.sinonimos, palavras: p.palavras_chave, ambientes: p.ambientes,
      imagem: imageOf(p.imagem_principal).src, destaque: p.destaque, ordemDestaque: Number(p.ordem_destaque) || 999,
      atualizado: p.data_atualizacao, ata: p.ata_confirmada, demo: p.demonstrativo,
    };
  });
}
export type SearchItem = ReturnType<typeof searchIndex>[number];
