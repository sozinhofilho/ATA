# Guia de publicação

O site é estático: qualquer hospedagem que sirva a pasta `dist/` funciona. **Nenhuma publicação externa foi feita** — ela depende da sua autorização e das suas contas.

## Recomendação

| Provedor | Plano | Situação para uso comercial | Observações |
|---|---|---|---|
| **Cloudflare Pages** (recomendado) | Free | Não encontramos restrição a uso comercial nos materiais consultados; confirme nos termos vigentes ao criar a conta | 500 builds/mês, 1 build simultâneo, até 20.000 arquivos por site, banda sem limite anunciado, HTTPS e domínio próprio gratuitos |
| **Netlify** (alternativa) | Free | Permite uso comercial (anúncio oficial do plano Free) | Modelo de créditos (300/mês); cada deploy e o tráfego consomem créditos — acompanhe o consumo no painel |
| Vercel | Hobby | **Não recomendado**: restrito a uso pessoal e não comercial | — |
| Firebase Hosting | Spark | Possível, mas exige projeto Google Cloud; sem vantagem para este caso | — |

Limites e condições mudam: confira as páginas oficiais antes de contratar e **não cadastre cartão** sem necessidade.

## Opção A — Cloudflare Pages com repositório Git

1. Crie uma conta em https://dash.cloudflare.com (gratuita).
2. *Workers & Pages › Create › Pages › Connect to Git* e selecione o repositório.
3. Configuração do build:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Variável de ambiente: `NODE_VERSION = 22`
4. Salve e aguarde. O site ficará em `https://<projeto>.pages.dev` (endereço de **homologação**; ele exibe a faixa de homologação e não é indexado).
5. Cada alteração enviada ao repositório gera nova publicação automaticamente.

## Opção B — Netlify

O arquivo `netlify.toml` já contém comando e pasta. Em https://app.netlify.com: *Add new site › Import from Git*, selecione o repositório e publique. Também é possível arrastar a pasta `dist/` em *Deploys* (publicação manual).

## Publicação definitiva (produção)

1. Resolva todos os itens de [pendencias-lancamento.md](pendencias-lancamento.md).
2. Registre o domínio (ex.: em https://registro.br para `.com.br`) após verificar disponibilidade e o registro da marca no INPI.
3. No provedor, adicione o domínio personalizado (*Custom domains*) e siga as instruções de DNS. O HTTPS é emitido automaticamente.
4. Defina as variáveis de ambiente no provedor:
   - `SITE_URL = https://www.seudominio.com.br`
   - `SITE_MODE = production`
5. Publique novamente. Se ainda houver dado provisório ou produto demonstrativo, o build **falhará** com a lista do que falta — isso é intencional.
6. Confira o endereço publicado (página inicial, um produto, `/sitemap.xml`, `/robots.txt`) e cadastre o site no Google Search Console ([guia-analytics.md](guia-analytics.md)).

## Cabeçalhos de segurança

`public/_headers` (lido por Cloudflare Pages e Netlify) define HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy e cache de longo prazo para arquivos versionados. Se adicionar algum serviço externo (ex.: outro script de mensuração), inclua o domínio na `Content-Security-Policy`.
