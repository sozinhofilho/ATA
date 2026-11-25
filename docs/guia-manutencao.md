# Guia de manutenção

## Rotina

| Tarefa | Onde | Depois |
|---|---|---|
| Incluir/alterar/remover produtos | Planilha → `data/catalog/produtos.csv` | `npm run build` ou enviar ao repositório |
| Fotos e fichas técnicas | `public/images/produtos/`, `public/documents/` | referenciar na planilha |
| Atas | `src/data/atas.json` | build; revisar mensalmente vigências |
| WhatsApp, e-mail, CNPJ, endereço | `src/config/site.json` | build |
| Textos "Sobre", parceiros, certificações | `src/data/institucional.json` | build |
| Perguntas frequentes | `src/data/faq.ts` | build |
| Categorias / subcategorias | `src/data/categories.json` | build (categorias sem produtos não aparecem) |
| Páginas de soluções | `src/data/solutions.json` | build |
| Textos legais | `src/pages/politica-de-privacidade.astro`, `termos-de-uso.astro` | revisão jurídica |

## Verificações automáticas a cada build

1. **Importador do catálogo**: interrompe com mensagem clara se houver ID duplicado, categoria desconhecida, RENEM/CATMAT com letras, data inválida, URL insegura ou produto publicado sem autorização.
2. **Pendências de produção**: em homologação lista; em produção bloqueia.
3. **Pós-build**: links internos, um H1 por página, título, description, canonical, `alt` nas imagens, ausência de CPF, chaves de API, campos comerciais internos e referência ao contrato confidencial.

## Revisões periódicas sugeridas

- **Mensal:** vigência das atas publicadas; produtos com informações desatualizadas (`data_atualizacao`).
- **Trimestral:** `npm outdated` e `npm audit`; atualizar dependências (`npm update`) e rodar todos os testes (`npm run test:all`).
- **Anual:** renovação do domínio; revisão da Política de Privacidade e do conteúdo "Como comprar" frente a mudanças legais.

## Em caso de erro no build

Leia a mensagem iniciada por `✖`: ela indica a linha da planilha e o campo. Corrija e rode novamente. O site publicado anteriormente continua no ar até um build bem-sucedido.
