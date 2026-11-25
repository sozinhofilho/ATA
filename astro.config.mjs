import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./src/config/site.json', import.meta.url), 'utf8'));
const site = (process.env.SITE_URL || cfg.site.urlPadrao).replace(/\/$/, '');

// Site 100% estático: cada produto, categoria e solução gera um HTML próprio.
export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
});
