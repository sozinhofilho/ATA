# Relatório de desempenho (Lighthouse)

Executado em 24/11/2026, 22:16:22 com Lighthouse 12, Chromium headless, servidor estático local (sem CDN e sem compressão Brotli/Gzip, que a hospedagem aplica). Perfil "mobile" simula celular de gama média com rede 4G lenta; "desktop" usa o preset padrão de desktop.

A versão de homologação tem `noindex` e `robots.txt` bloqueados de propósito; para medir SEO, a auditoria usou uma cópia do build com robots e domínio canônico simulando a produção.

| Perfil | Página | Desempenho | Acessibilidade | Boas práticas | SEO | FCP | LCP | TBT | CLS | Peso total |
|---|---|---|---|---|---|---|---|---|---|---|
| mobile | Início (`/`) | 97 | 100 | 100 | 100 | 2.0 s | 2.2 s | 0 ms | 0 | Total size was 185 KiB |
| mobile | Catálogo (`/produtos/`) | 94 | 100 | 100 | 100 | 2.4 s | 2.6 s | 0 ms | 0 | Total size was 287 KiB |
| mobile | Produto (`/produtos/cama-hospitalar-tipo-fowler/`) | 97 | 100 | 100 | 100 | 2.0 s | 2.1 s | 0 ms | 0 | Total size was 153 KiB |
| mobile | Categoria (`/categorias/mobiliario-hospitalar/`) | 98 | 100 | 100 | 100 | 2.0 s | 2.0 s | 0 ms | 0 | Total size was 144 KiB |
| mobile | Atas (`/atas/`) | 98 | 100 | 100 | 100 | 1.8 s | 1.8 s | 0 ms | 0 | Total size was 118 KiB |
| mobile | Como comprar (`/como-comprar/`) | 98 | 100 | 100 | 100 | 1.9 s | 2.0 s | 0 ms | 0 | Total size was 123 KiB |
| desktop | Início (`/`) | 100 | 100 | 100 | 100 | 0.5 s | 0.5 s | 0 ms | 0 | Total size was 190 KiB |
| desktop | Catálogo (`/produtos/`) | 100 | 100 | 100 | 100 | 0.6 s | 0.6 s | 0 ms | 0 | Total size was 287 KiB |
| desktop | Produto (`/produtos/cama-hospitalar-tipo-fowler/`) | 100 | 100 | 100 | 100 | 0.5 s | 0.5 s | 0 ms | 0 | Total size was 155 KiB |
| desktop | Categoria (`/categorias/mobiliario-hospitalar/`) | 100 | 100 | 100 | 100 | 0.5 s | 0.5 s | 0 ms | 0 | Total size was 144 KiB |
| desktop | Atas (`/atas/`) | 100 | 100 | 100 | 100 | 0.4 s | 0.4 s | 0 ms | 0 | Total size was 118 KiB |
| desktop | Como comprar (`/como-comprar/`) | 100 | 100 | 100 | 100 | 0.4 s | 0.4 s | 0 ms | 0 | Total size was 123 KiB |
