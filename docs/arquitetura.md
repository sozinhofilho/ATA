# Arquitetura e escolha tecnológica

## Decisão

**Astro 7 (geração estática) + CSS próprio com tokens + TypeScript leve + catálogo em CSV → JSON.** Sem banco de dados, sem servidor próprio e sem plataforma paga.

| Critério | Como a arquitetura atende |
|---|---|
| SEO | Cada produto, categoria e solução vira um arquivo HTML completo no build, com título, description, canonical, Open Graph e JSON-LD. O conteúdo está no HTML (não depende de JavaScript para ser indexado). |
| Velocidade | Astro envia zero JavaScript por padrão; só a busca, o catálogo, o menu e o formulário carregam scripts pequenos. Fonte Inter auto-hospedada, ilustrações em SVG. Lighthouse mobile 94–100. |
| Manutenção | Produtos em planilha; textos institucionais em arquivos JSON; dados da empresa em um único arquivo (`src/config/site.json`). |
| Páginas individuais | Geradas automaticamente por `getStaticPaths` para cada produto publicado. |
| Hospedagem econômica | Saída 100% estática (`dist/`), compatível com hospedagens gratuitas (Cloudflare Pages, Netlify). |
| Segurança | Sem banco, sem login, sem formulário com backend; nada de credenciais no código. Cabeçalhos de segurança em `public/_headers`. |
| Escalabilidade | Busca local suficiente para centenas de produtos (índice ~1 KB por produto). Acima de ~2.000 itens, considerar índice dividido ou Pagefind (gratuito). A estrutura permite adicionar CMS ou API no futuro sem refazer o layout. |
| Independência | Código aberto (Astro: MIT; Inter: OFL). Nenhum serviço pago necessário. |

### Alternativas avaliadas

- **HTML/CSS/JS puro:** mais simples, mas sem geração automática de páginas por produto; exigiria um gerador próprio.
- **Next.js (export estático):** viável, mas envia o runtime do React para todas as páginas, mais peso sem benefício para um catálogo de conteúdo.
- **WordPress/Shopify:** descartados conforme o escopo (custos, manutenção de plugins, superfície de ataque, checkout desnecessário).
- **Tailwind CSS:** dispensado; o sistema de design é pequeno e foi organizado em tokens CSS, sem etapa extra de build.
- **Fuse.js (busca):** avaliado (licença Apache-2.0). Optou-se por um mecanismo próprio de ~200 linhas (`src/lib/search-core.mjs`) porque o projeto exige regras específicas — sinônimos do setor (DEA, ECG, ambu), plural em português, códigos RENEM/CATMAT por prefixo e pesos por campo — e assim se evita uma dependência. Se o catálogo crescer muito, o Pagefind é a alternativa gratuita recomendada.

## Fluxo de dados

```
Google Planilhas (privada)
   │  Arquivo › Fazer download › CSV
   ▼
data/catalog/produtos.csv ──► scripts/import-catalog.mjs ──► src/data/generated/products.json
                                  │ valida colunas, status, códigos, URLs, categorias
                                  │ descarta colunas privadas (preço, margem, comissão…)
                                  │ gera slugs, resolve relacionados, vincula atas vigentes
                                  ▼
                              astro build ──► dist/ (HTML estático + indice-busca.json + sitemap.xml)
                                  ▼
                       scripts/postbuild-check.mjs (links, SEO, dados confidenciais, modo produção)
```

- Somente linhas com `status = publicado` **e** `autorizacao_publicacao = sim` são publicadas.
- `demonstrativo = sim` marca produtos fictícios; `SITE_MODE=production` bloqueia o build se existirem.
- A coluna `fonte` e a autorização ficam só no controle interno; não vão para o site.
- Atas: `src/data/atas.json`. O selo "Disponível para consulta em ata" só aparece se o produto tiver `disponibilidade_ata = confirmada` **e** a ata referenciada estiver `publicar: true` e vigente.

## Componentes reutilizáveis

`SiteHeader`, `SiteFooter`, `Logo`, `SearchBox`, `ProductCard`, `CategoryCard`, `Gallery`, `Breadcrumb`, `Faq`, `CtaBand`, `FloatingWhatsApp`, `LeadForm`, `ConsentBanner`, `Pending`, `Field`, `Icon`. A tabela de especificações e os produtos relacionados ficam na página de produto (`src/pages/produtos/[slug].astro`).

## Homologação × produção

| | Homologação (padrão) | Produção (`SITE_MODE=production`) |
|---|---|---|
| Faixa "Versão de homologação" | exibida | removida |
| Indexação | `noindex` + `robots.txt` bloqueando | liberada, com sitemap |
| Produtos demonstrativos | permitidos | bloqueiam o build |
| Dados provisórios (WhatsApp 5500…, domínio .example, CNPJ vazio) | listados como pendências | bloqueiam o build |
| Espaços reservados (história, visão, parceiros) | exibidos em amarelo | ocultos |

## Formulário de contato

Não há serviço gratuito de envio de formulários que dispense cadastro de terceiros e não exponha dados ou credenciais. Por isso o formulário **monta a mensagem no navegador** e abre o WhatsApp ou o aplicativo de e-mail do visitante, que revisa e envia. O site não recebe nem armazena dados. Se no futuro for desejável receber formulários diretamente, as opções gratuitas são Netlify Forms (se hospedado na Netlify) ou Cloudflare Pages Functions + serviço de e-mail, ambas exigindo configuração e revisão da Política de Privacidade.
