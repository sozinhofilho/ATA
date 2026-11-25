// Índice estático de busca: gerado no build, contém somente campos públicos de produtos publicados.
import { searchIndex, categories } from '../lib/catalog';

export function GET() {
  const body = {
    geradoEm: new Date().toISOString(),
    produtos: searchIndex(),
    categorias: categories.map((c) => ({ slug: c.slug, nome: c.nome, count: c.count })),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
