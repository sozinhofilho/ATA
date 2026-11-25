# SEO e palavras-chave

## Técnico (implementado)

URLs amigáveis com barra final; títulos e descriptions únicos por página (verificados no build); hierarquia H1–H3 sem saltos (testado); canonical absoluto; Open Graph/Twitter; `sitemap.xml` e `robots.txt` gerados; JSON-LD `Organization`, `Product` (sem preço, oferta, avaliação ou disponibilidade fictícios), `BreadcrumbList`, `ItemList` e `FAQPage`; imagens com `alt`; 404 personalizada com `noindex`; páginas de filtro do catálogo usam query string e canonical para `/produtos/` (sem páginas duplicadas); índice de busca bloqueado no robots de produção. Lighthouse SEO: 100 (com robots de produção).

## Mapa de intenção × página

Volumes de busca, CPC e dificuldade **não foram estimados**: não houve acesso a ferramentas com dados reais (Google Keyword Planner, Search Console). Após o lançamento, valide com o Planejador de Palavras-chave do Google Ads e os dados do Search Console.

| Tema de busca | Página de destino |
|---|---|
| ata de registro de preços hospitalar; adesão ata equipamentos hospitalares | `/atas/`, `/como-comprar/` |
| ata de móveis/mobiliário hospitalar; mobiliário hospitalar para licitações | `/categorias/mobiliario-hospitalar/`, `/atas/` |
| equipamentos hospitalares para prefeituras; para secretaria municipal de saúde | `/`, `/solucoes/` |
| mobiliário para UBS; equipamentos para UBS | `/solucoes/ubs/` |
| equipamentos para hospital municipal | `/solucoes/hospitais/` |
| equipamentos médico-hospitalares | `/categorias/equipamentos-medicos/`, `/produtos/` |
| cama hospitalar ata de registro de preços | `/produtos/<cama>/`, `/categorias/mobiliario-hospitalar/` |
| maca hospitalar para prefeitura | `/categorias/macas-e-transporte/` |
| equipamentos tabela RENEM | `/produtos/` (busca por RENEM), páginas de produto com código |
| fornecedor hospitalar para órgãos públicos | `/sobre/`, `/` |

## Próximos passos de conteúdo (após o lançamento)

1. Substituir produtos demonstrativos por produtos reais com descrições originais e completas (principal fator de SEO do catálogo).
2. Fotografias reais otimizadas (WebP) com `alt` descritivo — habilitam imagem no JSON-LD do produto.
3. Conteúdo educativo adicional (ex.: "Como montar a lista de equipamentos de uma UBS"), sempre com fontes oficiais.
4. Cadastrar a empresa no Google Perfil da Empresa, se houver endereço de atendimento.
