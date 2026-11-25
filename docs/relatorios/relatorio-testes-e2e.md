# Relatório de testes ponta a ponta

Executado em 24/11/2026, 22:21:36 (America/Sao_Paulo), Chromium 158.0.8127.36 via Playwright, sobre o build estático de `dist/`.

**Resultado: 42 de 42 testes aprovados.**

| Grupo | Teste | Resultado | Tempo |
|---|---|---|---|
| Navegação | menu principal leva às páginas com H1 e sem erros de JavaScript | ✅ aprovado | 546 ms |
| Navegação | todas as páginas e recursos internos rastreados a partir da home respondem 200 | ✅ aprovado | 141 ms |
| Navegação | links externos abrem em nova aba com rel="noopener" | ✅ aprovado | 327 ms |
| Mobile | menu abre, recebe foco, fecha com Esc e mantém aria-expanded | ✅ aprovado | 348 ms |
| Pesquisa | sugestões durante a digitação e navegação por teclado até o produto | ✅ aprovado | 458 ms |
| Pesquisa | sugere categorias pelo nome ("macas") | ✅ aprovado | 374 ms |
| Pesquisa | catálogo encontra por código RENEM: "1981" | ✅ aprovado | 214 ms |
| Pesquisa | catálogo encontra por sem acento: "berco" | ✅ aprovado | 215 ms |
| Pesquisa | catálogo encontra por plural e maiúsculas: "BERÇOS" | ✅ aprovado | 193 ms |
| Pesquisa | catálogo encontra por sinônimo: "aparelho de pressão" | ✅ aprovado | 181 ms |
| Pesquisa | catálogo encontra por sigla: "DEA" | ✅ aprovado | 180 ms |
| Pesquisa | catálogo encontra por expressão: "cama hospitalar" | ✅ aprovado | 180 ms |
| Pesquisa | catálogo encontra por termo simples: "monitor" | ✅ aprovado | 163 ms |
| Pesquisa | catálogo encontra por maca: "maca" | ✅ aprovado | 190 ms |
| Pesquisa | termo inexistente mostra estado vazio com CTA personalizado | ✅ aprovado | 225 ms |
| Pesquisa | busca dentro do catálogo atualiza resultados sem recarregar e registra evento "search" | ✅ aprovado | 187 ms |
| Catálogo | filtro por categoria, subcategoria, marca e chips removíveis | ✅ aprovado | 355 ms |
| Catálogo | filtros por ambiente e RENEM; estado restaurado pela URL | ✅ aprovado | 310 ms |
| Catálogo | ordenação A–Z, Z–A e recentes | ✅ aprovado | 240 ms |
| Catálogo | paginação de 12 em 12 com contador | ✅ aprovado | 231 ms |
| Catálogo | painel de filtros no celular abre como diálogo e fecha | ✅ aprovado | 535 ms |
| Produto | página individual com breadcrumb, códigos, CTAs e especificações confirmadas | ✅ aprovado | 176 ms |
| Produto | galeria troca imagem pela miniatura e amplia em diálogo | ✅ aprovado | 213 ms |
| Produto | exibe de 4 a 8 produtos relacionados | ✅ aprovado | 133 ms |
| WhatsApp | mensagem do produto inclui nome, RENEM e URL; clique registra eventos | ✅ aprovado | 159 ms |
| WhatsApp | mensagens específicas por origem (home, categoria, atas, solução) | ✅ aprovado | 361 ms |
| WhatsApp | todos os links wa.me do site usam o número central e texto codificado | ✅ aprovado | 940 ms |
| Formulário | validação acessível e geração da mensagem (WhatsApp e e-mail) sem enviar dados ao site | ✅ aprovado | 702 ms |
| Formulário | consulta de ata gera mensagem de consulta com produtos e município | ✅ aprovado | 163 ms |
| Publicação | produtos pendentes, rascunhos e inativos não geram página nem aparecem na busca | ✅ aprovado | 5 ms |
| Publicação | categorias sem produtos publicados não são exibidas | ✅ aprovado | 2 ms |
| 404 | URL inválida exibe página 404 personalizada com busca e noindex | ✅ aprovado | 109 ms |
| SEO | sitemap.xml válido com páginas, categorias, soluções e produtos publicados | ✅ aprovado | 4 ms |
| SEO | títulos únicos, description, canonical, Open Graph e dados estruturados válidos | ✅ aprovado | 1301 ms |
| Responsividade | sem rolagem horizontal em 360, 390, 768, 1024, 1440 px nas páginas principais | ✅ aprovado | 3738 ms |
| Responsividade | áreas de toque dos botões principais com pelo menos 44 px no celular | ✅ aprovado | 130 ms |
| Acessibilidade | axe-core (WCAG 2.0/2.1/2.2 A e AA) sem violações sérias ou críticas | ✅ aprovado | 7211 ms |
| Acessibilidade | navegação por teclado: link "pular para o conteúdo" e foco visível | ✅ aprovado | 183 ms |
| Segurança | sem mensuração ativa sem identificadores/consentimento e sem requisições a terceiros | ✅ aprovado | 1820 ms |
| Segurança | arquivos internos (planilha, relatórios, .env) não são publicados | ✅ aprovado | 8 ms |
| Segurança | conteúdo do catálogo é exibido como texto (sem HTML injetado) | ✅ aprovado | 1 ms |
| Capturas | gera capturas desktop (1440) e mobile (iPhone 13 / 390) | ✅ aprovado | 13563 ms |

## Achados do axe-core (todas as severidades)

Nenhuma violação encontrada nas páginas auditadas.
