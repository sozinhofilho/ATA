# Nexus Hospitalar — website institucional e catálogo B2G

Website institucional com catálogo digital de mobiliário e equipamentos médico-hospitalares para órgãos públicos, com experiência de navegação de e-commerce B2B **sem venda online**: o visitante pesquisa, filtra, consulta o produto e inicia a conversa comercial pelo WhatsApp.

> **Situação: versão de homologação.** Nome, logotipo, WhatsApp, e-mail, domínio e dados empresariais são **provisórios**, e os 37 produtos publicados são **demonstrativos** (marcas "Exemplo", sem especificações inventadas). O build de produção é bloqueado automaticamente até que esses dados sejam substituídos. Veja [docs/pendencias-lancamento.md](docs/pendencias-lancamento.md).

## Visualizar

```bash
npm install          # Node.js 20 ou superior
npm run dev          # http://localhost:4321 (com recarga automática)
# ou, para ver exatamente o que será publicado:
npm run build && npm run preview
```

## O que está pronto

| Área | Conteúdo |
|---|---|
| Páginas | Início (12 seções), Produtos (catálogo), página individual de cada produto, Categorias e cada categoria, Soluções (9 tipos de unidade), Atas disponíveis, Como comprar, Sobre nós, Contato, Política de Privacidade, Termos de Uso, 404 |
| Catálogo | Busca com sugestões (nome, categoria, RENEM, CATMAT, marca, modelo, sinônimos, acentos, plural, erros de digitação), filtros (categoria, subcategoria, marca, fabricante, tipo, ambiente, RENEM, CATMAT, ata quando houver), ordenação, paginação, chips de filtros, estado vazio, estado na URL |
| Conversão | WhatsApp com mensagens por origem (produto com nome/RENEM/URL, categoria, atas, solução), botão flutuante, formulário que monta a mensagem para WhatsApp ou e-mail sem armazenar dados |
| Gestão | Planilha (Google Planilhas/Excel) → CSV → `npm run build`. Validação, normalização, slugs, status (rascunho/pendente/publicado/inativo), descarte de colunas privadas |
| SEO | URLs amigáveis, títulos e descriptions únicos, canonical, Open Graph, sitemap.xml, robots.txt, JSON-LD (Organization, Product sem ofertas fictícias, BreadcrumbList, ItemList, FAQPage), 404 |
| Qualidade | 35 testes unitários, 42 testes no navegador, 11 de integração, Lighthouse 94–100 (mobile) e 100 (desktop), axe-core WCAG 2.2 AA sem violações |

## Comandos

| Comando | Faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run catalog` | Importa e valida `data/catalog/produtos.csv` |
| `npm run build` | Catálogo + verificação de pendências + build estático em `dist/` + verificação pós-build (links, SEO, vazamento de dados) |
| `npm run build:production` | Igual, mas **falha** se houver dado provisório ou produto demonstrativo |
| `npm run preview` | Serve `dist/` localmente |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes no navegador (requer Playwright) e capturas em `docs/capturas/` |
| `npm run test:integracao` | Simula atualização da planilha e rebuild |

## Estrutura

```
data/catalog/produtos.csv     ← planilha do catálogo (exportada do Google Planilhas)
src/config/site.json          ← nome, contatos, WhatsApp, CNPJ, aviso legal (dados centrais)
src/data/categories.json      ← categorias e subcategorias
src/data/solutions.json       ← páginas de soluções (UBS, UPA…)
src/data/atas.json            ← atas conferidas e autorizadas (vazio = página de consulta)
src/data/institucional.json   ← história, missão, parceiros, certificações (vazio = não exibe)
src/data/faq.ts               ← perguntas frequentes
src/components/               ← cabeçalho, rodapé, cards, busca, galeria, formulário, FAQ…
src/pages/                    ← rotas do site
src/lib/                      ← busca, catálogo, SEO, WhatsApp
src/scripts/                  ← JavaScript do navegador (catálogo, busca, mensuração)
src/styles/global.css         ← tokens de cor, tipografia, espaçamento, botões
scripts/                      ← importador do catálogo e verificações de publicação
public/                       ← imagens, ícones, documentos públicos, _headers
tests/                        ← unitários, navegador (e2e), integração, Lighthouse
docs/                         ← guias, relatórios, capturas, planilha-modelo
```

## Documentação

- [Arquitetura e escolha tecnológica](docs/arquitetura.md)
- [Pesquisa de referências](docs/pesquisa-referencias.md)
- [Identidade visual e como alterar nome/marca](docs/identidade-visual.md)
- [Guia de instalação](docs/guia-instalacao.md) · [Guia de publicação](docs/guia-publicacao.md) · [Guia de manutenção](docs/guia-manutencao.md)
- [Catálogo: adicionar e atualizar produtos](docs/guia-catalogo.md) · [Cadastrar atas](docs/guia-atas.md)
- [Alterar WhatsApp, contatos e dados da empresa](docs/guia-contatos-e-marca.md)
- [Google Analytics, Tag Manager e Search Console](docs/guia-analytics.md)
- [SEO e palavras-chave](docs/seo-palavras-chave.md)
- [Custos](docs/custos.md) · [Pendências para lançamento](docs/pendencias-lancamento.md)
- Relatórios: [testes](docs/relatorios/relatorio-testes.md), [navegador](docs/relatorios/relatorio-testes-e2e.md), [integração](docs/relatorios/relatorio-integracao-catalogo.md), [desempenho](docs/relatorios/relatorio-performance.md)

## Aviso

A Nexus Hospitalar é uma empresa privada de atuação comercial e não integra a administração pública. O site não realiza licitações, não vende online e não substitui a orientação jurídica dos órgãos públicos.
