# Guia de instalação

## Requisitos

- **Node.js 20 ou superior** (recomendado 22, conforme `.nvmrc`) — https://nodejs.org
- Git (opcional, para versionar e publicar via repositório)
- Nenhum banco de dados, servidor ou conta paga.

## Passo a passo

```bash
git clone <endereço-do-repositório> nexus-hospitalar
cd nexus-hospitalar
npm install
npm run dev
```

Abra http://localhost:4321. O comando `dev` importa a planilha e recarrega a página a cada alteração de código. Após alterar a planilha (`data/catalog/produtos.csv`), rode `npm run catalog` (ou reinicie o `dev`).

Para ver a versão final otimizada:

```bash
npm run build      # gera dist/ e executa as verificações
npm run preview    # serve dist/ em http://localhost:4321
```

## Variáveis de ambiente (opcionais)

Copie `.env.example` para `.env` (nunca versione o `.env`):

| Variável | Uso |
|---|---|
| `SITE_URL` | Domínio definitivo (ex.: `https://www.seudominio.com.br`). Usado em canonical, sitemap e Open Graph. |
| `SITE_MODE` | `production` ativa a trava de publicação e libera indexação. |
| `PUBLIC_GA4_ID`, `PUBLIC_GTM_ID`, `PUBLIC_GSC_VERIFICATION` | Mensuração (ver [guia-analytics.md](guia-analytics.md)). |

## Testes

```bash
npm test                         # unitários (sem navegador)
npm i --no-save playwright && npx playwright install chromium
npm run build && npm run test:e2e   # navegador + capturas em docs/capturas/
npm run test:integracao          # atualização do catálogo e trava de produção
npm i --no-save lighthouse@12 && node tests/perf/lighthouse.mjs   # desempenho
```

O Playwright e o Lighthouse não são dependências permanentes do projeto para manter a instalação leve; o CI (`.github/workflows/ci.yml`) os instala automaticamente.
