# Resultados dos testes (24 e 25/11/2026)

Todos os testes de coleta usaram **dados reais** da API pública do PNCP. A execução rodou num simulador local do Google Apps Script (`test/gas-sim.js`), que reproduz as funções de planilha, propriedades, acionadores e e-mail. As chamadas HTTP foram reais.

## Testes unitários (`node test/unit.js`): 11 de 11 aprovados

Os testes cobrem:
- sinônimos e plural;
- nível 1 por nome ou código CATMAT;
- falsos positivos (maçã, monitor de vídeo, incubadora de CO2, veterinária);
- serviço, manutenção e peças;
- casos contextuais;
- prioridade;
- situação aberta, em julgamento, concluída, cancelada, revogada e suspensa;
- sanitização contra injeção de fórmulas;
- número de controle PNCP;
- deduplicação, atualização e preservação de observações manuais;
- prazo vencido.

## Testes com dados reais

| Teste | Resultado |
|---|---|
| SC, 2 dias | 496 contratações analisadas, 23 candidatas, 2 mantidas. Os 2 falsos positivos encontrados (incubadora de CO2 e uso veterinário) foram corrigidos. |
| SC, PR e RS (abertas + 4 dias) | 2.120 contratações analisadas e 23 oportunidades. E-mail e Excel gerados. |
| Repetição sobre a mesma base | 0 novas, 23 linhas e 23 IDs únicos (**sem duplicidade**). O e-mail do dia não foi reenviado. |
| **Brasil (carga inicial)** | 57.764 contratações analisadas, 1.674 candidatas com itens verificados e **646 oportunidades**: 350 de prioridade alta, 69 média e 227 baixa. Das 646, 517 estão com licitação aberta. Foram 3.815 requisições, 0 páginas com falha e 2 falhas de itens. Levou 15 blocos de execução (cerca de 56 minutos). |

## Medições de desempenho do PNCP

- **Primeiras páginas:** cerca de 1 s.
- **Páginas além da 100ª:** cerca de 10 s cada. Por isso as consultas são divididas por UF.
- **Paralelismo:**
  - 1 requisição por vez: 30 requisições em 289 s.
  - 3 simultâneas: 110 s.
  - 6 simultâneas: 51 s, sem nenhum erro 429. O padrão adotado é 6.
- **Erro 429:** aparece de forma esporádica em rajadas. O sistema espera e tenta de novo.

## Estimativa de cota diária (conta Google gratuita)

| Rotina | Requisições | Tempo estimado de execução |
|---|---|---|
| Carga inicial (uma vez) | cerca de 3.800 | cerca de 60 min (dentro do limite de 90 min/dia; se passar, continua no dia seguinte) |
| Coleta diária (janela de 3 dias) | cerca de 1.000 a 1.500 | cerca de 10 a 20 min |
| Limite gratuito | 20.000 requisições/dia | 90 min/dia em acionadores |

## Amostra conferida na fonte oficial

Oportunidades conferidas nos links do PNCP:
- Floresta/PR: camas, macas, monitores, 21 poltronas e biombos.
- Ajuricaba/RS: mobiliário para UBS.
- Primeiro de Maio/PR: 2 carros de emergência.
- Palmital/PR: 16 tipos de equipamentos para a Secretaria de Saúde.
- Novo Hamburgo/RS: registro de preços de equipamentos para as unidades de saúde.

Os links de cada uma estão no Excel de exemplo (`docs/exemplo/`).

## Não testado aqui (depende do Google)

Estas etapas só podem ser feitas na conta do proprietário, depois da autorização:
- execução real no Apps Script;
- envio real do e-mail;
- exportação .xlsx pela API do Drive;
- acionadores reais.
