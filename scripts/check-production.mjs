#!/usr/bin/env node
// Trava de publicação: em SITE_MODE=production, impede o build se houver dados provisórios.
// Em homologação apenas lista as pendências.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.SITE_MODE === 'production';
const cfg = JSON.parse(readFileSync(resolve(root, 'src/config/site.json'), 'utf8'));
const products = JSON.parse(readFileSync(resolve(root, 'src/data/generated/products.json'), 'utf8'));
const siteUrl = process.env.SITE_URL || cfg.site.urlPadrao;

const issues = [];
for (const [k, v] of Object.entries(cfg.provisorio || {})) if (v) issues.push(`site.json: "provisorio.${k}" ainda está true (confirme o dado real e altere para false)`);
if (/^55?0+$/.test(cfg.contato.whatsapp.replace(/\D/g, '')) || /^5500/.test(cfg.contato.whatsapp)) issues.push('WhatsApp provisório (5500000000000)');
if (/\.example$|example\./.test(cfg.contato.email)) issues.push(`e-mail provisório (${cfg.contato.email})`);
if (/\.example|\.invalid|localhost/.test(siteUrl)) issues.push(`domínio provisório (${siteUrl}); defina SITE_URL`);
if (!cfg.empresa.razaoSocial) issues.push('razão social não informada (empresa.razaoSocial)');
if (!cfg.empresa.cnpj) issues.push('CNPJ não informado (empresa.cnpj)');
const demos = products.filter((p) => p.demonstrativo);
if (demos.length) issues.push(`${demos.length} produto(s) demonstrativo(s) publicados`);
if (!products.length) issues.push('nenhum produto publicado no catálogo');

if (!issues.length) { console.log('✔ Pendências de produção: nenhuma.'); process.exit(0); }
const head = production ? '✖ Build de PRODUÇÃO bloqueado. Resolva:' : `ℹ Homologação: ${issues.length} pendência(s) para o lançamento definitivo:`;
(production ? console.error : console.log)(head);
for (const i of issues) (production ? console.error : console.log)(`   - ${i}`);
process.exit(production ? 1 : 0);
