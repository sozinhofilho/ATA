# Google Analytics 4, Tag Manager e Search Console

Nada de mensuração está ativo. Os identificadores **não foram criados nem inventados**; ative somente com autorização do proprietário.

## Ativar GA4 (ou GTM)

1. Crie a propriedade GA4 em https://analytics.google.com e copie o ID (`G-XXXXXXX`). Se preferir Tag Manager, crie o contêiner e copie `GTM-XXXXXXX`.
2. Na hospedagem (ou no `.env` local), defina **uma** das variáveis:
   - `PUBLIC_GA4_ID=G-XXXXXXX`
   - `PUBLIC_GTM_ID=GTM-XXXXXXX`
3. Publique novamente. O site passa a exibir um aviso de cookies; os scripts do Google **só carregam após "Aceitar"** (LGPD). A Política de Privacidade muda o texto automaticamente.
4. Verifique em GA4 › Relatórios › Tempo real.

## Eventos já implementados

| Evento | Quando | Parâmetros |
|---|---|---|
| `view_item` | abrir página de produto | `item_id`, `item_name`, `item_category` |
| `view_item_list` | abrir catálogo ou categoria | `item_list_name`, `results` |
| `search` | pesquisar (cabeçalho, home, catálogo) | `search_term`, `location` |
| `select_item` | clicar em produto (card/sugestão) | `item_id`, `item_name`, `item_list_name` |
| `whatsapp_click` | qualquer botão de WhatsApp | `location`, `item_id`, `item_name` |
| `quote_request_click` | "Solicitar proposta" | `item_id`, `item_name`, `location` |
| `ata_request_click` | "Consultar atas"/"Consultar disponibilidade em ata" | `location`, `ata_id` |
| `technical_document_request` | "Solicitar documentação técnica" | `item_id`, `item_name` |
| `technical_document_download` | baixar ficha técnica/manual publicados | `item_id`, `document_type` |
| `generate_lead` | envio do formulário ou CTA final | `method` (whatsapp/email), `location` |
| `share` | compartilhar produto | `item_name`, `method` |

Os parâmetros passam por uma lista de permissão e um filtro que remove e-mails, telefones e CPFs (`src/scripts/analytics.ts`). Nenhum dado digitado no formulário é enviado.

**Atenção:** clique no WhatsApp não é venda nem lead qualificado; trate como "intenção de contato". Para Google Ads, marque `whatsapp_click`, `quote_request_click` e `generate_lead` como conversões secundárias até haver forma de qualificar os contatos.

## Search Console

1. Em https://search.google.com/search-console, adicione a propriedade do domínio definitivo.
2. Verificação por DNS (recomendado) ou por meta tag: defina `PUBLIC_GSC_VERIFICATION=<código>` e publique.
3. Envie o sitemap: `https://www.seudominio.com.br/sitemap.xml`.
4. Só faça isso após publicar em modo produção (a homologação é `noindex`).

## Google Ads (preparação)

Páginas de destino prontas e com CTA: `/atas/`, `/categorias/mobiliario-hospitalar/`, `/categorias/equipamentos-medicos/`, `/solucoes/ubs/`, `/solucoes/hospitais/` e cada `/produtos/<produto>/`. Nenhuma campanha foi criada.
