# Nexus Radar — Manual de instalação e uso

Sistema privado que, todos os dias, consulta o PNCP (Portal Nacional de Contratações Públicas), identifica
compras públicas de mobiliário e equipamentos hospitalares em todo o Brasil, grava tudo numa planilha
Google privada e envia um e-mail com resumo + arquivo Excel. Roda 100% no Google Apps Script (gratuito),
com o computador desligado.

---

## 1. Instalação (uma única vez, ~10 minutos, no computador)

> Faça no navegador do computador (Chrome), logado na conta Google **sozinho.filho@gmail.com**.
> O editor do Apps Script não funciona bem pelo celular.

1. Abra a planilha **Nexus Radar — Oportunidades Hospitalares** no seu Google Drive
   (ou crie uma planilha nova em https://sheets.new).
2. No menu da planilha, clique em **Extensões > Apps Script**. Abre uma nova aba com o editor.
3. No editor, clique no arquivo **Código.gs**, apague tudo o que estiver escrito e cole **todo** o conteúdo
   do arquivo `dist/NexusRadar.gs` (também disponível no Google Drive como documento
   "Nexus Radar — código (NexusRadar.gs)"). Clique no ícone de disquete (**Salvar**).
4. Fuso horário: clique na engrenagem **Configurações do projeto** (barra lateral esquerda) e, em
   **Fuso horário**, escolha **(GMT-03:00) Horário de Brasília — São Paulo**.
   - (Opcional) Na mesma tela, marque "Mostrar arquivo de manifesto appsscript.json" e substitua o conteúdo
     pelo arquivo `dist/appsscript.json`. Isso fixa o fuso e as permissões.
5. Volte ao editor (ícone `< >`). Na barra superior, no seletor de função, escolha **setupSystem** e clique
   em **Executar**.
6. O Google pedirá autorização:
   - Clique em **Revisar permissões** → escolha sua conta.
   - Aparece "O Google não verificou este app" (é normal: o app é seu e privado). Clique em **Avançado** →
     **Acessar Nexus Radar (não seguro)**.
   - Clique em **Permitir**. As permissões pedidas e por quê:
     - *Ver, editar, criar e excluir planilhas*: gravar as oportunidades.
     - *Ver, editar, criar e excluir arquivos do Google Drive*: gerar o Excel temporário e apagá-lo depois.
     - *Conectar a um serviço externo*: consultar a API pública do PNCP.
     - *Enviar e-mail como você*: enviar o relatório **somente para você** (não lê sua caixa de entrada).
     - *Permitir que este aplicativo seja executado quando você não estiver presente*: o agendamento diário.
7. Volte à planilha e recarregue a página (F5). Aparece o menu **Nexus Radar** e as 6 abas.
8. Menu **Nexus Radar > Atualizar agora (sem e-mail)**. A primeira carga (Brasil inteiro, últimos 30 dias +
   todas as licitações com propostas abertas) leva de 20 a 40 minutos: o sistema trabalha em blocos de
   ~4,5 minutos e continua sozinho. Pode fechar a planilha. Acompanhe pela aba **LOGS**.
9. Menu **Nexus Radar > Enviar e-mail de teste**. Confira o e-mail e o Excel anexo.
10. Menu **Nexus Radar > Ativar automação diária**. Pronto.

A partir daí, todo dia: a coleta começa entre 6h e 7h e o e-mail chega ao final dela (normalmente antes das
7h30). Se algo atrasar, às 9h uma "rede de segurança" envia o relatório com aviso de cobertura parcial.

---

## 2. Uso diário

- **E-mail**: assunto `[NEXUS RADAR] XX novas oportunidades hospitalares — DD/MM/AAAA`, com contadores,
  as 10 oportunidades mais relevantes (legível no celular), link da planilha e Excel anexo.
- **Planilha** (6 abas):
  | Aba | Conteúdo |
  |---|---|
  | NOVAS OPORTUNIDADES | O que foi encontrado desde o último e-mail. |
  | OPORTUNIDADES ABERTAS | Licitações com propostas abertas e itens "a validar" em acompanhamento. |
  | HISTORICO | Base completa (inclui encerradas, canceladas e revogadas). |
  | CATALOGO | Produtos e sinônimos usados na busca. |
  | CONFIGURACOES | Parâmetros editáveis. |
  | LOGS | Cada execução: fonte, páginas, erros, resultado. |
- **Observações manuais**: escreva na coluna "Observações manuais" (em qualquer aba de oportunidades). O
  sistema copia para o HISTORICO e preserva nas atualizações.
- **Prioridade**: Alta (produto identificado + propostas abertas + publicação recente), Média (produto
  identificado mas fora do prazo/situação a validar, ou termo genérico em licitação aberta), Baixa
  (contextual, serviço/manutenção ou encerrada). O motivo fica na coluna "Motivo da classificação".

## 3. Alterar configurações (aba CONFIGURACOES, coluna "Valor")

| O que | Como |
|---|---|
| E-mail destinatário | Linha "E-mail destinatário". Vários: separe por vírgula. |
| Estados | Linha "Estados (UF)". Vazio = Brasil todo. Ex.: `SC,PR,RS`. |
| Modalidades | Linha "Modalidades PNCP" (padrão 4,5,6,7,8). |
| Horário | Linha "Hora do relatório" e depois menu **Ativar automação diária** de novo. |
| Excel / e-mail | "Exportação em Excel" e "Envio de e-mail diário": SIM ou NÃO. |
| Velocidade | "Requisições simultâneas" (padrão 6). Se aparecer erro 429 nos LOGS, reduza para 2 ou 3. |

## 4. Produtos

Edite a aba **CATALOGO**: cada linha é um produto; a coluna "Sinônimos" aceita vários termos separados por
`;` (sem acento ou com acento, singular ou plural: o sistema normaliza). Para desativar, escreva `NÃO` em
"Produto ativo". Para incluir um produto, adicione uma linha nova com ID, Categoria, Produto e Sinônimos.
Se souber o código CATMAT, coloque em "Código CATMAT": itens com esse código passam a ser nível 1.

## 5. Executar manualmente / ligar e desligar

- **Atualizar agora (sem e-mail)**: coleta e atualiza a planilha.
- **Varredura completa + e-mail**: coleta e envia o relatório (no máximo 1 por dia pelo agendamento).
- **Ativar / Desativar automação diária**: liga/desliga os acionadores (sem duplicar).
- **Refazer carga inicial**: repete a busca dos últimos 30 dias + propostas abertas (não apaga dados).
- **Testar fontes**: verifica se o PNCP está respondendo.

## 6. Chaves de API (futuro)

O Portal da Transparência foi deixado de fora por decisão do proprietário. Se for ativado no futuro, a chave
deve ficar em **Configurações do projeto > Propriedades do script** (nunca na planilha ou no código).

## 7. Limites e custos

- Custo: **R$ 0**. Usa apenas recursos gratuitos de uma conta Google pessoal.
- Cotas gratuitas do Apps Script (conta pessoal): 6 min por execução, 90 min/dia de acionadores,
  20.000 chamadas externas/dia, 100 destinatários de e-mail/dia, anexos até 25 MB.
- Consumo medido do Nexus Radar: veja `docs/RESULTADOS_TESTES.md`.
