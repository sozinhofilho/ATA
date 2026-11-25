# Alterar WhatsApp, contatos e dados da empresa

Tudo fica em **`src/config/site.json`**. Não é preciso editar páginas.

```json
"contato": {
  "whatsapp": "5531999999999",        ← DDI 55 + DDD + número, só dígitos
  "whatsappExibicao": "(31) 99999-9999",
  "email": "contato@seudominio.com.br",
  "telefone": "",                      ← opcional; vazio = não exibido
  "telefoneExibicao": "",
  "horarioAtendimento": "Segunda a sexta-feira, das 8h às 18h",
  "encarregadoDadosEmail": "privacidade@seudominio.com.br"
},
"empresa": {
  "razaoSocial": "…", "cnpj": "00.000.000/0001-00", "endereco": "…", "cidadeUf": "Belo Horizonte/MG"
}
```

- O número do WhatsApp é usado em todos os botões (`https://wa.me/<número>?text=<mensagem>`), sempre com mensagem codificada.
- Os textos das mensagens por origem (home, produto, categoria, atas, soluções) ficam em `src/lib/whatsapp.ts`.
- O site nunca envia mensagens automaticamente: o texto é apenas preenchido e o visitante decide enviar.
- Depois de confirmar cada dado real, altere o respectivo item de `provisorio` para `false`.
- Nome e identidade visual: veja [identidade-visual.md](identidade-visual.md).
- Domínio: variável `SITE_URL` na hospedagem (ou `site.urlPadrao` no mesmo arquivo).
