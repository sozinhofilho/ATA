// Caixa de pesquisa com sugestões (padrão ARIA combobox).
// O índice é carregado sob demanda no primeiro foco, para não pesar o carregamento inicial.
import { prepareDoc, search, normalize } from '../lib/search-core.mjs';
import { track } from './analytics';

type Item = { id: string; url: string; nome: string; categoria: string; categoriaSlug: string; renem: string; imagem: string; [k: string]: unknown };
type Index = { produtos: Item[]; categorias: { slug: string; nome: string; count: number }[] };

let indexPromise: Promise<{ docs: ReturnType<typeof prepareDoc>[]; index: Index }> | null = null;
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/indice-busca.json')
      .then((r) => { if (!r.ok) throw new Error('índice indisponível'); return r.json(); })
      .then((index: Index) => ({ index, docs: index.produtos.map(prepareDoc) }))
      .catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function setup(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const list = form.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const status = form.querySelector<HTMLElement>('[data-search-status]');
  const location = form.dataset.location || 'busca';
  let active = -1;
  let timer: number | undefined;
  let options: HTMLLIElement[] = [];

  const close = () => {
    list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1;
  };
  const highlight = (i: number) => {
    options.forEach((o, j) => o.setAttribute('aria-selected', String(i === j)));
    active = i;
    if (i >= 0 && options[i]) { input.setAttribute('aria-activedescendant', options[i].id); options[i].scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };

  async function update() {
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    let data;
    try { data = await loadIndex(); } catch { close(); return; }
    if (input.value.trim() !== q) return;
    const results = search(data.docs, q, { limit: 6 });
    const nq = normalize(q);
    const cats = data.index.categorias.filter((c) => normalize(c.nome).includes(nq)).slice(0, 2);
    const html: string[] = [];
    let n = 0;
    for (const c of cats) {
      html.push(`<li role="option" id="${list.id}-${n++}" class="sug sug--cat" data-href="/categorias/${c.slug}/" data-kind="categoria" data-name="${escapeHtml(c.nome)}"><span class="sug__icon" aria-hidden="true">▦</span><span><strong>${escapeHtml(c.nome)}</strong><small>Categoria · ${c.count} produto(s)</small></span></li>`);
    }
    for (const { item } of results) {
      html.push(`<li role="option" id="${list.id}-${n++}" class="sug" data-href="${item.url}" data-kind="produto" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.nome)}"><img src="${item.imagem}" alt="" width="48" height="32" loading="lazy"><span><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.categoria)}${item.renem ? ` · RENEM ${escapeHtml(item.renem)}` : ''}</small></span></li>`);
    }
    html.push(`<li role="option" id="${list.id}-${n++}" class="sug sug--all" data-href="/produtos/?q=${encodeURIComponent(q)}" data-kind="todos"><span class="sug__icon" aria-hidden="true">→</span><span><strong>Ver todos os resultados para “${escapeHtml(q)}”</strong></span></li>`);
    list.innerHTML = html.join('');
    options = Array.from(list.querySelectorAll('li'));
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
    if (status) status.textContent = results.length ? `${results.length} sugestão(ões) disponível(is). Use as setas para navegar.` : 'Nenhum produto encontrado. Pressione Enter para ver o catálogo.';
  }

  const go = (li: HTMLLIElement) => {
    if (li.dataset.kind === 'produto') track('select_item', { item_id: li.dataset.id, item_name: li.dataset.name, location });
    window.location.href = li.dataset.href!;
  };

  input.addEventListener('focus', () => { loadIndex().catch(() => {}); });
  input.addEventListener('input', () => { window.clearTimeout(timer); timer = window.setTimeout(update, 120); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && e.key !== 'ArrowDown') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) { update(); return; } highlight(Math.min(active + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, -1)); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(options[active]); }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = (e.target as Element).closest<HTMLLIElement>('li[role="option"]');
    if (li) go(li);
  });
  input.addEventListener('blur', () => window.setTimeout(close, 100));
  form.addEventListener('submit', (e) => {
    const q = input.value.trim();
    if (!q) { e.preventDefault(); input.focus(); return; }
    track('search', { search_term: q, location });
    // No catálogo, a própria página trata a busca sem recarregar.
    if (form.dataset.inline === 'true') { e.preventDefault(); close(); form.dispatchEvent(new CustomEvent('nexus:search', { detail: q, bubbles: true })); }
  });
}

export function initSearchBoxes() {
  document.querySelectorAll<HTMLFormElement>('form[data-search]').forEach((f) => {
    if (f.dataset.ready) return;
    f.dataset.ready = '1';
    setup(f);
  });
}
