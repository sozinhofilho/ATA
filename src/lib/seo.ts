import { absoluteUrl, marca } from './site';
import { type Product, productUrl, productImages, getCategory } from './catalog';

export interface Crumb { label: string; href?: string }

export function breadcrumbLd(items: Crumb[]) {
  const list = [{ label: 'Início', href: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: absoluteUrl(c.href) } : {}) })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') } })),
  };
}

/** Product sem offers, preços, avaliações ou disponibilidade (nada fictício nos dados estruturados). */
export function productLd(p: Product) {
  const imgs = productImages(p).filter((i) => !i.src.endsWith('.svg')).map((i) => absoluteUrl(i.src));
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nome,
    description: p.descricao_resumida || undefined,
    url: absoluteUrl(productUrl(p)),
    sku: p.id,
    category: getCategory(p.categoria)?.nome,
    ...(imgs.length ? { image: imgs } : {}),
    ...(p.marca ? { brand: { '@type': 'Brand', name: p.marca } } : {}),
    ...(p.modelo ? { model: p.modelo } : {}),
    ...(p.fabricante ? { manufacturer: { '@type': 'Organization', name: p.fabricante } } : {}),
    additionalProperty: [
      ...(p.renem ? [{ '@type': 'PropertyValue', name: 'Código RENEM', value: p.renem }] : []),
      ...(p.catmat ? [{ '@type': 'PropertyValue', name: 'Código CATMAT', value: p.catmat }] : []),
    ],
  };
}

export function itemListLd(name: string, products: Product[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(productUrl(p)), name: p.nome })),
  };
}

export function truncate(s: string, n = 155) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

export const defaultDescription = `Mobiliário e equipamentos hospitalares para órgãos públicos: catálogo por nome, categoria e RENEM, consulta de Atas de Registro de Preços e atendimento.`;
