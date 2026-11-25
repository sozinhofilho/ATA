# Identidade visual provisória

Baseada no "Guia Visual — Anexo ao Prompt Mestre 02". Nome e marca são **provisórios**: não há verificação de registro de marca ou de domínio.

## Logotipo

| Versão | Arquivo |
|---|---|
| Horizontal (fundo claro) | `public/images/marca/logo-horizontal.svg` |
| Horizontal negativa (fundo escuro) | `public/images/marca/logo-horizontal-negativo.svg` |
| Compacta | `public/images/marca/logo-compacto.svg` |
| Símbolo | `public/images/marca/simbolo.svg` |
| Favicon | `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png` |
| PNG 512/192 | `public/images/marca/logo-512.png`, `icon-192.png` |
| Imagem de compartilhamento (1200×630) | `public/og/nexus-hospitalar-og.png` |

No site, o logotipo é renderizado em HTML pelo componente `src/components/Logo.astro` (usa a fonte do site e o nome definido em `site.json`).

**Símbolo:** um "N" formado por dois nós conectados (conceito de *nexus*: conexão entre órgãos públicos e fornecedores). O guia visual usava uma cruz; ela foi substituída para evitar semelhança com emblemas protegidos de organizações de saúde (ex.: Cruz Vermelha). Não há brasões ou símbolos governamentais.

## Paleta

| Token CSS | Cor | Uso |
|---|---|---|
| `--c-navy` | `#102E43` | Autoridade, fundos escuros, títulos |
| `--c-teal` | `#087E8B` | Botões, ícones, destaques |
| `--c-teal-dark` | `#066670` | Texto/links teal sobre fundo claro (contraste AA) e hover |
| `--c-sky` | `#EAF4F7` | Áreas de apoio, fundos de imagens |
| `--c-gray-50` | `#F4F6F8` | Fundo do catálogo |
| `--c-text` | `#334155` | Texto |
| `--c-gray-500` | `#5B6B7D` | Texto secundário (5,4:1) |
| `--c-whatsapp` | `#176B46` | Ações de WhatsApp (6,6:1 com branco) |

## Tipografia

Inter Variable (licença SIL OFL), auto-hospedada via `@fontsource-variable/inter` — sem requisições ao Google Fonts. Títulos 30–48 px, texto 16 px, altura de linha 1,6.

## Espaçamento, botões, cards e ícones

- Escala de 4 px (`--sp-1` a `--sp-20`); raios de 6, 10 e 16 px.
- Botões (`.btn`): primário teal, `--outline`, `--light`, `--ghost-light`, `--whatsapp`, tamanhos `--sm` e `--block`; altura mínima 48 px (40 px no pequeno).
- Cards (`.card`): fundo branco, borda `#DBE3E9`, sombra leve; cards de produto com mídia 3:2.
- Ícones: traço simples 24×24 desenhados para o projeto (`src/components/Icon.astro`).
- Ilustrações esquemáticas de equipamentos em `public/images/ilustracoes/` — sempre identificadas como "Imagem ilustrativa". Não representam modelos comercializados e devem ser substituídas por fotografias oficiais autorizadas.

## Como alterar nome e identidade visual

1. **Nome, complemento, slogans, aviso legal:** `src/config/site.json` (bloco `marca` e `aviso`). Todo o site usa esses valores.
2. **Cores e fonte:** apenas os tokens no topo de `src/styles/global.css`. Ajuste também as cores fixas do símbolo em `src/components/Logo.astro` e nos SVGs de `public/images/marca/`.
3. **Novo logotipo:** substitua os arquivos em `public/images/marca/` mantendo os nomes, e troque o SVG do símbolo em `Logo.astro` (ou use uma `<img>` com o novo arquivo).
4. **Favicon e imagem de compartilhamento:** substitua `public/favicon.svg`, os PNGs e `public/og/nexus-hospitalar-og.png` (1200×630).
5. **Manifesto:** `public/site.webmanifest` (nome do app).
6. Ao concluir, altere `provisorio.marca` para `false` em `site.json`.
