# Como cadastrar atas

As atas ficam em `src/data/atas.json`. Com a lista vazia, a página `/atas/` mostra apenas a consulta comercial (sem dados inventados).

## Antes de cadastrar

- Confira a ata no **PNCP** (https://www.gov.br/pncp/pt-br) ou na fonte oficial do órgão gerenciador.
- Obtenha autorização do fornecedor beneficiário para divulgar.
- Não informe saldo, preço ou elegibilidade sem confirmação atualizada.

## Exemplo

```json
{
  "atas": [
    {
      "id": "ARP-0012-2026-ORGAO",
      "numero": "12/2026",
      "orgaoGerenciador": "Nome oficial do órgão gerenciador",
      "uf": "MG",
      "fornecedorBeneficiario": "Razão social do fornecedor",
      "objeto": "Registro de preços para aquisição de mobiliário hospitalar",
      "categorias": ["mobiliario-hospitalar"],
      "vigenciaInicio": "2026-03-01",
      "vigenciaFim": "2027-02-28",
      "situacaoAdesao": "Prevê adesão de não participantes; saldo a confirmar na consulta",
      "linkOficial": "https://pncp.gov.br/...",
      "dataConferencia": "2026-11-20",
      "observacoes": "",
      "publicar": true
    }
  ]
}
```

- A ata só aparece se `publicar` for `true` **e** `vigenciaFim` não tiver passado (verificado a cada build).
- Para vincular produtos: na planilha, `disponibilidade_ata = confirmada` e `referencia_ata = ARP-0012-2026-ORGAO`. O card passa a exibir **"Disponível para consulta em ata"** e a página do produto mostra número, órgão e vigência. Se a ata vencer, o selo volta automaticamente para "Consulte disponibilidade" no próximo build.
- Atualize `dataConferencia` sempre que reconferir a ata.
- Após editar, rode `npm run build` (um erro de sintaxe no JSON interrompe o build).
