# Catálogo: como adicionar e atualizar produtos

## Fluxo recomendado (Alternativa A — sem integração automática)

1. Importe `docs/planilha-modelo/modelo-catalogo-produtos.xlsx` no **Google Planilhas** (Arquivo › Importar) ou use o Excel. A planilha tem listas de validação (status, sim/não, categoria) e as abas **Instruções** e **Categorias**.
2. Mantenha a planilha **privada** (compartilhada apenas com quem atualiza o catálogo). Não use "Publicar na Web".
3. Preencha uma linha por produto. Deixe em branco tudo que não estiver confirmado pelo fornecedor.
4. Exporte: *Arquivo › Fazer download › Valores separados por vírgula (.csv)*. CSV com ponto e vírgula (Excel em português) também é aceito.
5. Substitua `data/catalog/produtos.csv` pelo arquivo exportado (mesmo nome).
6. Rode `npm run catalog` para validar. Corrija eventuais erros apontados (linha e campo).
7. Rode `npm run build` (ou envie ao repositório para a hospedagem publicar automaticamente). Páginas de produto, categorias, busca e sitemap são atualizadas sozinhas.

> **Alternativa B** (sincronização automática com a planilha): possível no futuro com a API do Google Sheets e uma credencial de serviço armazenada como segredo na hospedagem. Não foi implementada nesta versão por exigir credenciais, contas e manutenção adicionais, e por aumentar o risco de publicar dados internos.

## Colunas principais

| Coluna | Obrigatória | Observação |
|---|---|---|
| `id` | sim | Permanente e único (ex.: `NX-0001`). Não reutilize. |
| `nome` | sim | Nome comercial. |
| `categoria` | sim | Slug ou nome (aba Categorias). |
| `subcategoria` | não | Deve pertencer à categoria. |
| `slug` | não | Gerado do nome se vazio. Mudar o slug muda o endereço da página. |
| `renem`, `catmat` | não | Apenas números. Confira na RENEM/SIGEM (FNS) e no CATMAT. |
| `descricao_resumida` | recomendada | Aparece no card e nas buscas (~200 caracteres). |
| `descricao_completa` | não | Parágrafos separados por linha em branco. |
| `especificacoes` | não | `Campo: valor | Campo: valor`. |
| `imagem_principal` | recomendada | `/images/produtos/arquivo.webp` ou `ilustracao:cama` (ilustração genérica). |
| `status` | sim | `rascunho`, `pendente`, `publicado`, `inativo`. |
| `autorizacao_publicacao` | sim p/ publicar | `sim` somente com autorização do fornecedor. |
| `demonstrativo` | — | `sim` apenas para dados fictícios. Bloqueia produção. |
| `disponibilidade_ata` + `referencia_ata` | não | `confirmada` + ID da ata em `atas.json` (ver [guia-atas.md](guia-atas.md)). |
| `sinonimos`, `palavras_chave` | não | Melhoram a busca (ex.: `leito | cama de internação`). |
| `destaque`, `ordem_destaque` | não | Até 12 aparecem na página inicial. |
| `relacionados` | não | IDs separados por `|`; completados automaticamente pela categoria. |

Listas usam a barra vertical `|` como separador. A lista completa está na aba **Instruções** da planilha e em `scripts/lib/catalog-core.mjs`.

## Status e publicação

| Status | No site |
|---|---|
| `rascunho` | não aparece |
| `pendente` | não aparece (use para "Pendente de validação comercial", por exemplo itens extraídos do contrato 147/2026) |
| `publicado` + `autorizacao_publicacao = sim` | aparece |
| `inativo` | não aparece (página removida no próximo build) |

## Dados que nunca devem ir para a planilha pública/CSV do site

Preços internos, margens, comissões, dados bancários, dados pessoais, assinaturas, números de contrato privados. Colunas com esses dados são **descartadas automaticamente** pelo importador, mas o ideal é mantê-las em outra aba/planilha, fora do arquivo exportado.

## Contrato nº 147/2026 (quando disponibilizado)

Os 58 itens podem ser cadastrados com `status = pendente`, `fonte = Contrato 147/2026` (campo interno, não publicado) e sem preços. Distinga na coluna `fabricante` os itens da Minas Indústria dos demais fabricantes. Publique somente após validação comercial e autorização. O contrato não comprova disponibilidade atual.

## Imagens

- Use fotografias oficiais autorizadas; padrão WebP, 1200×800 px (3:2), fundo branco, até ~150 KB.
- Coloque em `public/images/produtos/` e informe `/images/produtos/arquivo.webp`.
- Se não for foto do modelo comercializado, marque `imagem_ilustrativa = sim` (o site exibirá "Imagem ilustrativa").
- Nunca use fotos de concorrentes nem imagens geradas por IA apresentadas como o produto real.

## Remover os produtos demonstrativos

Apague as linhas com `demonstrativo = sim` (IDs `NX-DEMO-…`) da planilha antes do lançamento.
