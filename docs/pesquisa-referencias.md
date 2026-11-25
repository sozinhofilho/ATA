# Pesquisa de referências (Fase 1)

Pesquisa realizada em 25/11/2026 a partir das referências do Prompt Mestre e do Guia Visual. Os sites foram estudados quanto a padrões de navegação e jornada; **nenhum texto, imagem, logotipo, código ou identidade visual foi copiado**.

## Limitações honestas

- Não foi possível obter informações públicas indexadas sobre a **Minas Indústria** nem atas em nome da **Líder Móveis Hospitalares** nas buscas realizadas. Por isso o site **não cita** essas empresas: o prompt proíbe afirmar parcerias ou representações não confirmadas formalmente. Ao confirmar a autorização, liste-as em `src/data/institucional.json`.
- O **contrato nº 147/2026** não foi disponibilizado nesta etapa; o catálogo usa produtos demonstrativos. Os códigos RENEM exibidos (1981, 673, 1488, 2345, 10798, 10398) vêm do Guia Visual e **devem ser conferidos** na RENEM/SIGEM do Fundo Nacional de Saúde antes da publicação.
- Volume de buscas, CPC e dificuldade de palavras-chave **não foram estimados**, por falta de acesso a ferramentas com dados reais (ver [seo-palavras-chave.md](seo-palavras-chave.md)).

## Padrões observados e aplicados

| Referência | Padrão relevante | Aplicação no projeto |
|---|---|---|
| Líder Móveis Hospitalares (BR) | CTA específico para solicitar ata | Botão "Consultar atas" fixo no cabeçalho e em cada produto |
| Portal de Adesões (BR) | Catálogo por categoria de mobiliário hospitalar | Categorias com contagem de produtos e subcategorias |
| LFC Governo (BR) | Organização de atas e filtros por categoria | Página de atas estruturada por número, órgão, vigência e fonte; filtros no catálogo |
| Eixo Licitações (BR) | Páginas por tipo de equipamento | Páginas individuais de categoria e de produto, com URL própria |
| Hospimetal (BR) | Apresentação de linhas hospitalares | Agrupamento por ambiente (soluções por unidade de saúde) |
| Sourcewell (EUA) | Página de contrato com fornecedor, categoria, número, data de vencimento ("maturity date"), lista de produtos e documentos; contratos competitivamente licitados e entregues via representante local | Estrutura da ata: número, órgão gerenciador, fornecedor, objeto, vigência, link oficial e data de conferência |
| OMNIA Partners (EUA) | Página por fornecedor, sem taxa para o órgão, documentos do contrato acessíveis | Transparência: link para fonte oficial (PNCP) e aviso de que adesão depende de requisitos |
| McKesson / Medline Government (EUA) | Área dedicada a governos estaduais e locais, contratos cooperativos (Sourcewell, MMCAP, OMNIA) | Linguagem dirigida a secretarias e fundos de saúde; seção "Como comprar" educativa |
| Ministério da Saúde — Novo PAC Saúde | Guias passo a passo para adesão de estados e municípios a atas do MS | Seção sobre adesões vinculadas a programas federais (art. 86, § 6º) |

## Boas práticas aplicadas ao mercado brasileiro

1. **Pesquisa por código RENEM em destaque**: gestores de fundos de saúde trabalham com a RENEM (Portaria GM/MS nº 3.134/2013) para propostas de financiamento.
2. **Separar "informação" de "promessa"**: nenhum selo de disponibilidade em ata sem ata vigente cadastrada; nenhum preço, estoque ou prazo não confirmado.
3. **Conteúdo educativo com base legal citada** (Lei 14.133/2021, Decreto 11.462/2023), distinguindo norma federal de regulamentos locais e indicando temas controversos (adesão a atas municipais).
4. **WhatsApp como canal principal**, com mensagem já contextualizada (produto, RENEM, URL), reduzindo atrito para o comprador público.
5. **Sem cadastro obrigatório** e sem pop-ups; catálogo navegável e indexável.
6. **Mobile first**: busca e filtros acessíveis no celular, botões com área de toque ≥ 44 px.

## Fontes consultadas

- Decreto nº 11.462/2023 — https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm e https://legis.senado.leg.br/norma/36936810/publicacao/36939164
- Lei nº 14.133/2021, art. 86 — https://www.legjur.com/legislacao/art/lei_00141332021-86
- TCU — Sistema de Registro de Preços — https://licitacoesecontratos.tcu.gov.br/5-9-4-sistema-de-registro-de-precos-2/
- Parecer referencial CONJUR/MS (vigência da ata, art. 84) — https://www.gov.br/saude/pt-br/composicao/conjur/demandas-judiciais/banco-de-pareceres-referenciais/pareceres-referenciais/2025/parecer-referencial-no-00011-2025-conjur-ms-cgu-agu.pdf
- Ministério da Saúde — Guia para adesão à ARP nº 238/2025 — https://www.gov.br/saude/pt-br/assuntos/novo-pac-saude/publicacoes/guia-para-adesao-a-ata-de-registro-de-precos-no-238-2025
- FNS — Financiamento federal de equipamentos (RENEM/SIGEM) — https://www.gov.br/transferegov/pt-br/noticias/eventos/fntu/x-fntu/apresentacoes/evento-159-financiamento-federal-de-equipamentos-e-materiais-permanentes-para-o-sus.pdf
- Sourcewell — https://www.sourcewell-mn.gov/cooperative-purchasing/022422-MDL e https://www.sourcewell-mn.gov/cooperative-purchasing/022422-MML
- OMNIA Partners / Medline — https://www.omniapartners.com/suppliers/medline-industries-inc/public-sector/contract-documents
- Cloudflare Pages (limites) — https://developers.cloudflare.com/pages/platform/limits
- Netlify (planos por créditos) — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Vercel (Hobby: uso não comercial) — https://vercel.com/docs/plans/hobby
