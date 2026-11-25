# Fontes de dados: situação e endpoints

Validação feita com chamadas reais em 24–25/11/2026.

| Fonte | Situação | Observação |
|---|---|---|
| PNCP: contratações por publicação | **Integrada e validada** | Base da coleta diária. |
| PNCP: contratações com propostas abertas | **Integrada e validada** | Usada na carga inicial (todas as abertas no país). |
| PNCP: itens da contratação | **Integrada e validada** | Identifica produtos, quantidades e código de catálogo. |
| PNCP: detalhe da contratação | **Integrada e validada** | Reconsulta diária da situação (revogada, anulada, suspensa, homologada). |
| PNCP: PCA (planos anuais) | **Integrada com limitações → não ativada** | `/v1/pca/` respondeu 500 ou timeout de 50 s; `/v1/pca/atualizacao` respondeu 204 ou 429. Fica para a próxima versão. |
| PNCP: atas / contratos | Pendente de validação | Endpoints existem (`/v1/atas`, `/v1/contratos`); não são necessários na v1, porque a situação é obtida pelo detalhe. |
| Compras.gov.br (dadosabertos.compras.gov.br) | Disponível, **não integrada** | API pública acessível (80 rotas). Cobre principalmente compras federais (SIASG); para municípios, o PNCP já é a fonte central. |
| Transferegov (api-publica.transferegov.gestao.gov.br) | Disponível, **não integrada** | Prevista para a fase 10 (recursos e convênios). |
| Portal da Transparência | Dependente de credenciais | Desativada por decisão do proprietário. |
| FNS / InvestSUS / consultafns | Sem API pública documentada | Somente consulta manual no portal. Não usamos APIs internas nem contornamos CAPTCHA. |
| RENEM | Sem API pública documentada | Consulta manual no portal. Códigos RENEM ficam em branco até serem confirmados. |

## PNCP: API de Consulta

- Órgão responsável: Ministério da Gestão e da Inovação em Serviços Públicos (MGI).
- Documentação: https://pncp.gov.br/api/consulta/swagger-ui/index.html (OpenAPI em `/api/consulta/v3/api-docs`).
- Autenticação: nenhuma, e não exige cadastro nem chave. Apenas leitura (GET).
- Datas no formato `yyyyMMdd`.
- Paginação: `pagina` (a partir de 1) e `tamanhoPagina`. A resposta traz `totalRegistros`, `totalPaginas` e `paginasRestantes`. O código 204 significa "sem dados".
- Limite de requisições: não documentado. Nos testes, o código 429 apareceu em rajadas (cerca de 1 em cada 40 requisições seguidas). O sistema espera e tenta de novo.

| Endpoint | Obrigatórios | Opcionais usados | Máx. por página |
|---|---|---|---|
| `GET /api/consulta/v1/contratacoes/publicacao` | dataInicial, dataFinal, codigoModalidadeContratacao, pagina | uf, tamanhoPagina | 50 |
| `GET /api/consulta/v1/contratacoes/proposta` | dataFinal, pagina | uf, codigoModalidadeContratacao, tamanhoPagina | 50 |
| `GET /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}` | (caminho) | – | – |
| `GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens` | (caminho) | pagina, tamanhoPagina | 500 |

Campos aproveitados:
- **Da contratação:** `numeroControlePNCP`, `processo`, `numeroCompra`, `anoCompra`, `sequencialCompra`, `orgaoEntidade.cnpj` e `razaoSocial`, `unidadeOrgao` (`ufSigla`, `municipioNome`, `codigoIbge`, `nomeUnidade`), `objetoCompra`, `valorTotalEstimado`, `valorTotalHomologado`, `modalidadeNome`, `srp`, `situacaoCompraId` e `Nome`, `dataPublicacaoPncp`, `dataAtualizacaoGlobal`, `dataEncerramentoProposta`, `linkSistemaOrigem`.
- **Dos itens:** `descricao`, `informacaoComplementar`, `quantidade`, `unidadeMedida`, `valorTotal`, `materialOuServico`, `catalogoCodigoItem`.

Situação oficial (`situacaoCompraId`): 1 = Divulgada; 2 = Revogada; 3 = Anulada; 4 = Suspensa.

Situação interpretada pelo sistema:
- Revogada.
- Cancelada (para anulada).
- Situação a validar (para suspensa ou sem prazo).
- Contratação concluída (quando há valor homologado).
- Licitação aberta (prazo de propostas no futuro).
- Licitação em julgamento (prazo encerrado, sem homologação).

Volume nacional medido:
- Cerca de 5.300 contratações publicadas por dia útil (23/11/2026), sendo 3.337 dispensas, 1.693 pregões eletrônicos, 244 concorrências eletrônicas e 38 presenciais.
- 27.138 contratações com propostas abertas.

## Modalidades (codigoModalidadeContratacao)

| Código | Modalidade |
|---|---|
| 1 | Leilão eletrônico |
| 2 | Diálogo competitivo |
| 3 | Concurso |
| 4 | Concorrência eletrônica |
| 5 | Concorrência presencial |
| 6 | Pregão eletrônico |
| 7 | Pregão presencial |
| 8 | Dispensa |
| 9 | Inexigibilidade |
| 10 | Manifestação de interesse |
| 11 | Pré-qualificação |
| 12 | Credenciamento |
| 13 | Leilão presencial |

O padrão do sistema é 4, 5, 6, 7 e 8.
