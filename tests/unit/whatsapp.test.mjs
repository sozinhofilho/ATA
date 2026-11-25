import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Verifica o arquivo central de configuração e a codificação das mensagens (mesma lógica de src/lib/whatsapp.ts).
const cfg = JSON.parse(readFileSync(new URL('../../src/config/site.json', import.meta.url)));
const waLink = (m) => `https://wa.me/${cfg.contato.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(m)}`;

test('número do WhatsApp centralizado contém apenas dígitos com DDI', () => {
  assert.match(cfg.contato.whatsapp, /^55\d{10,11}$/);
});
test('mensagens com acentos, quebras de linha e URL são codificadas corretamente', () => {
  const msg = 'Olá! Tenho interesse no equipamento Cama & Fowler, código RENEM 1981.\n\nProduto: https://x.example/produtos/cama/?a=1';
  const url = waLink(msg);
  assert.ok(!/[\s&?]/.test(url.split('?text=')[1]));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), msg);
});
