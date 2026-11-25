# Pendências para o lançamento definitivo

O comando `npm run build:production` bloqueia a publicação enquanto os itens marcados com 🔒 não forem resolvidos.

## Dependem de informações reais do proprietário

- 🔒 **WhatsApp comercial** (`contato.whatsapp` em `src/config/site.json`).
- 🔒 **E-mail** com domínio próprio.
- 🔒 **Razão social e CNPJ**; endereço e cidade/UF (foro nos Termos de Uso).
- 🔒 **Domínio definitivo** (`SITE_URL`).
- 🔒 **Produtos reais**: remover os 37 demonstrativos (`NX-DEMO-…`) e cadastrar itens validados, com autorização de publicação.
- 🔒 Confirmar dados e alterar `provisorio.*` para `false` em `site.json`.
- E-mail do encarregado de dados (LGPD) para a Política de Privacidade.
- História, visão e estrutura de atendimento (`src/data/institucional.json`) — opcionais; espaços ficam ocultos em produção se vazios.
- Conferir os códigos RENEM de cada produto na RENEM/SIGEM vigente (os do guia visual são apenas exemplos).
- Contrato nº 147/2026: disponibilizar para extração dos 58 itens como `pendente`.

## Dependem de autorização

- Autorização formal da **Minas Indústria** e da **Líder Móveis Hospitalares** para citar nomes, marcas, fotos e fichas técnicas (listar em `institucional.json` somente após confirmação).
- Fotografias e documentos técnicos oficiais com autorização de uso.
- Atas a divulgar (com conferência no PNCP e autorização do fornecedor).
- Criação de contas: hospedagem, domínio, Google Analytics/Search Console.
- Publicação externa do site (nenhuma foi realizada).
- Nome e marca definitivos (verificar INPI) — "Nexus Hospitalar" é provisório.

## Revisões recomendadas

- Revisão jurídica da Política de Privacidade, dos Termos de Uso e da página "Como comprar".
- Revisão das descrições dos produtos reais pelo fornecedor.
- Após publicar: Search Console, sitemap, teste dos links de WhatsApp com o número real.
