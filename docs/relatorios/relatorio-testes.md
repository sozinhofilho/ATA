# Relatório consolidado de testes

Executado em 25/11/2026 no ambiente de desenvolvimento (Linux, Node.js 22, Chromium via Playwright), sobre o build de homologação com 37 produtos demonstrativos.

## Resumo

| Bateria | Ferramenta | Resultado | Detalhe |
|---|---|---|---|
| Unitários | `node --test` | **35/35** | CSV, regras do catálogo, busca, WhatsApp |
| Navegador (ponta a ponta) | Playwright + Chromium | **42/42** | [relatorio-testes-e2e.md](relatorio-testes-e2e.md) |
| Integração do catálogo | build completo em cópia temporária | **11/11** | [relatorio-integracao-catalogo.md](relatorio-integracao-catalogo.md) |
| Verificação pós-build | `scripts/postbuild-check.mjs` | **aprovado** | 65 páginas, 5.140 links/recursos internos, 64 URLs no sitemap |
| Acessibilidade | axe-core 4.14 (WCAG 2.0/2.1/2.2 A e AA) | **0 violações** | 14 páginas em desktop + 3 em mobile |
| Desempenho | Lighthouse 12 | mobile 94–98, desktop 100 | [relatorio-performance.md](relatorio-performance.md) |
| Trava de produção | `SITE_MODE=production npm run build` | **bloqueia** (esperado) | 37 produtos demonstrativos + dados provisórios |

Os testes encontraram e permitiram corrigir, durante o desenvolvimento: nome acessível do link do logotipo diferente do texto visível, contraste insuficiente na página 404, meta descriptions acima de 170 caracteres em 7 páginas, deslocamento de layout (CLS 0,096) no catálogo mobile, ícones duplicados no botão de menu mobile e falso positivo do importador ao classificar a coluna "palavras_chave" como privada.

## Cobertura dos 32 testes obrigatórios (item 38 do prompt)

| # | Teste | Como foi verificado | Resultado |
|---|---|---|---|
| 1 | Navegação | E2E: todos os itens do menu abrem com H1 único e sem erro de JavaScript | ✅ |
| 2 | Links internos | E2E (rastreamento completo a partir da home) + pós-build (todos os `href`/`src`) | ✅ |
| 3 | Links externos | E2E: todos com `target=_blank` e `rel=noopener`; destinos são fontes oficiais (Planalto, gov.br, PNCP, TCU, FNS). Disponibilidade dos sites externos não foi verificada automaticamente (rede do ambiente de testes restrita) | ✅ parcial |
| 4 | Menu mobile | E2E: abre, foco, Esc fecha, aria-expanded, navega | ✅ |
| 5 | Pesquisa por produto | E2E: sugestões ao digitar, teclado até o produto | ✅ |
| 6 | Pesquisa por categoria | E2E: sugestão de categoria ("macas") e filtro de categoria | ✅ |
| 7 | Código RENEM | Unitário e E2E ("1981" → Cama Fowler; filtro RENEM 10798) | ✅ |
| 8 | Acentuação | Unitário e E2E ("berco", "BERÇOS") | ✅ |
| 9 | Sinônimos | Unitário e E2E ("aparelho de pressão", "DEA", "aed", "carro de parada") | ✅ |
| 10 | Filtros | E2E: categoria, subcategoria, marca, ambiente, RENEM, chips, limpar | ✅ |
| 11 | Ordenação | E2E: A–Z, Z–A, recentes | ✅ |
| 12 | Paginação | E2E: 12 por página, contador, URL | ✅ |
| 13 | Página de produto | E2E: breadcrumb, códigos, 3 CTAs, só especificações confirmadas, evento view_item | ✅ |
| 14 | Galeria | E2E: troca por miniatura, ampliação em diálogo, Esc fecha | ✅ |
| 15 | Relacionados | E2E: entre 4 e 8 | ✅ |
| 16 | Botões de WhatsApp | E2E: todos os links `wa.me` de 12 páginas usam o número central e texto codificado | ✅ |
| 17 | Mensagens personalizadas | E2E: produto (nome, RENEM, URL), categoria, atas, solução, home; estado vazio com termo buscado | ✅ |
| 18 | Formulário | E2E: validação acessível, e-mail inválido, mensagem gerada para WhatsApp e e-mail, nenhuma requisição enviada, evento sem dados pessoais | ✅ |
| 19 | Importação de produtos | Unitário + integração (CSV com `;`, produto novo, slug automático) | ✅ |
| 20 | Alteração de produtos | Integração: nome alterado reflete em página e índice | ✅ |
| 21 | Produtos inativos | Unitário, E2E (404) e integração (inativado sai do site) | ✅ |
| 22 | Rascunhos | Unitário e E2E (sem página, fora da busca) | ✅ |
| 23 | URLs inválidas | E2E: status 404 | ✅ |
| 24 | Página 404 | E2E: conteúdo, busca, noindex | ✅ |
| 25 | Sitemap | E2E: XML válido, inclui todos os publicados, exclui pendentes | ✅ |
| 26 | Metadados SEO | E2E + pós-build: título único, description 50–170, canonical, OG, JSON-LD sem ofertas fictícias, hierarquia de cabeçalhos | ✅ |
| 27 | Responsividade | E2E: 360, 390, 768, 1024 e 1440 px sem rolagem horizontal em 15 páginas; área de toque ≥ 44 px | ✅ |
| 28 | Acessibilidade | axe-core sem violações; teclado e foco visível | ✅ |
| 29 | Performance | Lighthouse mobile e desktop em 6 páginas | ✅ |
| 30 | Segurança | Sem requisições a terceiros sem consentimento; arquivos internos não publicados; conteúdo sanitizado; URLs inseguras rejeitadas; `_headers` com CSP/HSTS | ✅ |
| 31 | Dados confidenciais | Pós-build (CPF, chaves, campos comerciais, contrato 147/2026) e integração (coluna `preco_interno` descartada) | ✅ |
| 32 | Atualização do catálogo | Integração: rebuild após alteração; erro de planilha bloqueia; atas vigentes/vencidas | ✅ |

## Limitações

- Testes executados em Chromium. Safari/iOS e Firefox não foram testados em dispositivos reais; o layout usa apenas CSS e APIs amplamente suportadas (`<dialog>`, `details`, CSS Grid), com fallback para `window.open` na galeria.
- As capturas mobile usam a emulação "iPhone 13" do Playwright, não um aparelho físico.
- Os números do Lighthouse foram medidos em servidor local sem CDN; em produção (com compressão e cache) tendem a ser iguais ou melhores, mas devem ser reconferidos no endereço publicado (PageSpeed Insights).
- Os links `wa.me` usam número provisório; abrir uma conversa real só será possível com o número definitivo.
