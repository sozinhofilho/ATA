// Catálogo: busca, filtros, ordenação, paginação e estado na URL.
// Os cards já vêm renderizados no HTML (funcionam sem JavaScript); aqui apenas filtramos e reordenamos.
import { search } from '../lib/search-core.mjs';
import { loadIndex } from './search-ui';
import { track } from './analytics';

const PAGE_SIZE = 12;
type State = {
  q: string; categoria: string[]; subcategoria: string[]; marca: string; fabricante: string; tipo: string;
  ambiente: string[]; renem: string; catmat: string; ata: boolean; ordem: string; pagina: number;
};
const LIST_KEYS = ['categoria', 'subcategoria', 'ambiente'] as const;
const TEXT_KEYS = ['marca', 'fabricante', 'tipo', 'renem', 'catmat'] as const;
const LABELS: Record<string, string> = { categoria: 'Categoria', subcategoria: 'Subcategoria', marca: 'Marca', fabricante: 'Fabricante', tipo: 'Tipo', ambiente: 'Ambiente', renem: 'RENEM', catmat: 'CATMAT', ata: 'Ata', q: 'Busca' };

function readState(): State {
  const u = new URLSearchParams(location.search);
  return {
    q: (u.get('q') || '').slice(0, 100),
    categoria: u.getAll('categoria'), subcategoria: u.getAll('subcategoria'), ambiente: u.getAll('ambiente'),
    marca: u.get('marca') || '', fabricante: u.get('fabricante') || '', tipo: u.get('tipo') || '',
    renem: (u.get('renem') || '').replace(/\D/g, ''), catmat: (u.get('catmat') || '').replace(/\D/g, ''),
    ata: u.get('ata') === '1', ordem: u.get('ordem') || 'relevancia', pagina: Math.max(1, Number(u.get('pagina')) || 1),
  };
}

function writeState(s: State) {
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q);
  for (const k of LIST_KEYS) s[k].forEach((v) => u.append(k, v));
  for (const k of TEXT_KEYS) if (s[k]) u.set(k, s[k]);
  if (s.ata) u.set('ata', '1');
  if (s.ordem !== 'relevancia') u.set('ordem', s.ordem);
  if (s.pagina > 1) u.set('pagina', String(s.pagina));
  const qs = u.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

export async function initCatalog() {
  const root = document.querySelector<HTMLElement>('[data-catalog]');
  if (!root) return;
  const form = root.querySelector<HTMLFormElement>('[data-filters]')!;
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const countEl = root.querySelector<HTMLElement>('[data-count]')!;
  const emptyEl = root.querySelector<HTMLElement>('[data-empty]')!;
  const chipsEl = root.querySelector<HTMLElement>('[data-chips]')!;
  const pagEl = root.querySelector<HTMLElement>('[data-pagination]')!;
  const sortEl = root.querySelector<HTMLSelectElement>('[data-sort]')!;
  const subFs = root.querySelector<HTMLElement>('[data-subcats]')!;
  const panel = root.querySelector<HTMLElement>('[data-filters-panel]')!;
  const backdrop = root.querySelector<HTMLElement>('[data-filters-backdrop]')!;
  const openBtn = root.querySelector<HTMLButtonElement>('[data-filters-open]')!;
  const filterN = root.querySelector<HTMLElement>('[data-filter-n]')!;
  const searchForm = document.querySelector<HTMLFormElement>('form[data-search][data-inline="true"]');
  const searchInput = searchForm?.querySelector<HTMLInputElement>('input[type="search"]');
  const emptyWa = root.querySelector<HTMLAnchorElement>('[data-empty-wa]');
  const cards = new Map<string, HTMLElement>();
  grid.querySelectorAll<HTMLElement>('[data-product-id]').forEach((c) => cards.set(c.dataset.productId!, c));

  let state = readState();
  let data: Awaited<ReturnType<typeof loadIndex>>;
  try { data = await loadIndex(); } catch { return; } // sem índice: o catálogo continua exibindo todos os produtos
  const items = data.index.produtos as any[];

  // ---- formulário <-> estado
  function syncForm() {
    form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      if (cb.name === 'ata') cb.checked = state.ata;
      else cb.checked = (state as any)[cb.name]?.includes(cb.value) ?? false;
    });
    for (const k of TEXT_KEYS) { const el = form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null; if (el) el.value = state[k]; }
    sortEl.value = state.ordem;
    if (searchInput) searchInput.value = state.q;
    // Subcategorias: visíveis apenas para as categorias selecionadas
    let anySub = false;
    subFs.querySelectorAll<HTMLElement>('[data-cat]').forEach((l) => {
      const show = state.categoria.includes(l.dataset.cat!);
      l.hidden = !show;
      if (show) anySub = true;
    });
    subFs.hidden = !anySub;
  }
  function readForm() {
    const fd = new FormData(form);
    for (const k of LIST_KEYS) state[k] = fd.getAll(k).map(String);
    for (const k of TEXT_KEYS) state[k] = String(fd.get(k) ?? '').trim();
    state.renem = state.renem.replace(/\D/g, '');
    state.catmat = state.catmat.replace(/\D/g, '');
    // remove subcategorias de categorias desmarcadas
    state.subcategoria = state.subcategoria.filter((s) => {
      const lbl = subFs.querySelector<HTMLElement>(`input[value="${CSS.escape(s)}"]`)?.closest<HTMLElement>('[data-cat]');
      return lbl ? state.categoria.includes(lbl.dataset.cat!) : false;
    });
    state.ata = fd.get('ata') === '1';
  }

  // ---- filtragem
  function compute() {
    let scored: { item: any; score: number }[];
    if (state.q) scored = search(data.docs, state.q) as any;
    else scored = items.map((item) => ({ item, score: 0 }));
    const f = scored.filter(({ item }) =>
      (!state.categoria.length || state.categoria.some((c) => item.categoriaSlug === c || item.catsSecundarias.includes(c))) &&
      (!state.subcategoria.length || state.subcategoria.includes(item.subcategoriaSlug)) &&
      (!state.marca || item.marca === state.marca) &&
      (!state.fabricante || item.fabricante === state.fabricante) &&
      (!state.tipo || item.tipo === state.tipo) &&
      (!state.ambiente.length || state.ambiente.some((a) => item.ambientes.includes(a))) &&
      (!state.renem || String(item.renem).startsWith(state.renem)) &&
      (!state.catmat || String(item.catmat).startsWith(state.catmat)) &&
      (!state.ata || item.ata),
    );
    const byName = (a: any, b: any) => a.item.nome.localeCompare(b.item.nome, 'pt-BR');
    const featured = (a: any, b: any) => Number(b.item.destaque) - Number(a.item.destaque) || a.item.ordemDestaque - b.item.ordemDestaque || byName(a, b);
    switch (state.ordem) {
      case 'az': f.sort(byName); break;
      case 'za': f.sort((a, b) => byName(b, a)); break;
      case 'recentes': f.sort((a, b) => String(b.item.atualizado).localeCompare(String(a.item.atualizado)) || byName(a, b)); break;
      case 'destaque': f.sort(featured); break;
      default: f.sort(state.q ? (a, b) => b.score - a.score || byName(a, b) : featured);
    }
    return f.map((x) => x.item);
  }

  function activeFilters() {
    const out: { key: string; value: string; label: string }[] = [];
    const optLabel = (name: string, value: string) =>
      form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value)}"]`)?.closest('label')?.querySelector('span')?.textContent || value;
    if (state.q) out.push({ key: 'q', value: state.q, label: `“${state.q}”` });
    for (const k of LIST_KEYS) state[k].forEach((v) => out.push({ key: k, value: v, label: optLabel(k, v) }));
    for (const k of TEXT_KEYS) if (state[k]) out.push({ key: k, value: state[k], label: state[k] });
    if (state.ata) out.push({ key: 'ata', value: '1', label: 'Disponível em ata' });
    return out;
  }

  function renderChips() {
    const act = activeFilters();
    chipsEl.hidden = !act.length;
    chipsEl.replaceChildren();
    for (const a of act) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-label', `Remover filtro ${LABELS[a.key]}: ${a.label}`);
      b.innerHTML = `<span></span><span class="chip__x" aria-hidden="true">×</span>`;
      b.firstElementChild!.textContent = `${LABELS[a.key]}: ${a.label}`;
      b.addEventListener('click', () => {
        if (a.key === 'q') state.q = '';
        else if (a.key === 'ata') state.ata = false;
        else if ((LIST_KEYS as readonly string[]).includes(a.key)) (state as any)[a.key] = (state as any)[a.key].filter((v: string) => v !== a.value);
        else (state as any)[a.key] = '';
        if (a.key === 'categoria') state.subcategoria = [];
        state.pagina = 1; syncForm(); render();
      });
      chipsEl.appendChild(b);
    }
    if (act.length > 1) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'chip chip--clear'; c.textContent = 'Limpar todos';
      c.addEventListener('click', clearAll);
      chipsEl.appendChild(c);
    }
    const nFilters = act.filter((a) => a.key !== 'q').length;
    filterN.hidden = !nFilters; filterN.textContent = String(nFilters);
  }

  function renderPagination(total: number) {
    const pages = Math.ceil(total / PAGE_SIZE);
    pagEl.replaceChildren();
    pagEl.hidden = pages <= 1;
    if (pages <= 1) return;
    const mk = (label: string, page: number, opts: { current?: boolean; disabled?: boolean; aria?: string } = {}) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      if (opts.current) b.setAttribute('aria-current', 'page');
      if (opts.disabled) b.disabled = true;
      b.setAttribute('aria-label', opts.aria || `Página ${page}`);
      b.addEventListener('click', () => { state.pagina = page; render(); grid.closest('section')!.scrollIntoView({ block: 'start' }); });
      pagEl.appendChild(b);
    };
    mk('‹', state.pagina - 1, { disabled: state.pagina === 1, aria: 'Página anterior' });
    for (let i = 1; i <= pages; i++) mk(String(i), i, { current: i === state.pagina });
    mk('›', state.pagina + 1, { disabled: state.pagina === pages, aria: 'Próxima página' });
  }

  function render() {
    const list = compute();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.pagina > pages) state.pagina = pages;
    const start = (state.pagina - 1) * PAGE_SIZE;
    const visible = new Set(list.slice(start, start + PAGE_SIZE).map((i) => i.id));
    // reordena os cards conforme a ordenação e oculta os que não estão na página
    const frag = document.createDocumentFragment();
    for (const it of list) { const c = cards.get(it.id); if (c) frag.appendChild(c); }
    for (const [id, c] of cards) { c.hidden = !visible.has(id); if (!list.some((x) => x.id === id)) frag.appendChild(c); }
    grid.appendChild(frag);
    emptyEl.hidden = list.length > 0;
    grid.hidden = list.length === 0;
    if (emptyWa) {
      const base = emptyWa.href.split('?text=')[0];
      const msg = state.q
        ? `Olá! Não encontrei no catálogo o equipamento "${state.q}". Gostaria de consultar se há possibilidade de fornecimento.`
        : 'Olá! Gostaria de consultar equipamentos que não encontrei no catálogo.';
      emptyWa.href = `${base}?text=${encodeURIComponent(msg)}`;
    }
    const shown = list.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} de ` : '';
    countEl.textContent = list.length === 1 ? '1 produto encontrado' : `${shown}${list.length} produtos encontrados`;
    renderChips();
    renderPagination(list.length);
    writeState(state);
  }

  function clearAll() {
    state = { ...readState(), q: '', categoria: [], subcategoria: [], ambiente: [], marca: '', fabricante: '', tipo: '', renem: '', catmat: '', ata: false, pagina: 1, ordem: state.ordem };
    syncForm(); render();
  }

  // ---- painel de filtros no celular
  const setPanel = (open: boolean) => {
    panel.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.querySelector<HTMLElement>('[data-filters-close]')?.focus(); }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  };
  openBtn.addEventListener('click', () => setPanel(true));
  root.querySelectorAll('[data-filters-close]').forEach((b) => b.addEventListener('click', () => { setPanel(false); openBtn.focus(); }));
  backdrop.addEventListener('click', () => setPanel(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('is-open')) { setPanel(false); openBtn.focus(); } });

  // ---- eventos
  let tmr: number | undefined;
  form.addEventListener('change', () => { readForm(); state.pagina = 1; syncForm(); render(); });
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type !== 'text' && t.inputMode !== 'numeric') return;
    window.clearTimeout(tmr);
    tmr = window.setTimeout(() => { readForm(); state.pagina = 1; render(); }, 250);
  });
  sortEl.addEventListener('change', () => { state.ordem = sortEl.value; state.pagina = 1; render(); });
  root.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', clearAll));
  searchForm?.addEventListener('nexus:search', (e) => { state.q = String((e as CustomEvent).detail).slice(0, 100); state.pagina = 1; render(); });
  searchInput?.addEventListener('search', () => { if (!searchInput.value) { state.q = ''; state.pagina = 1; render(); } });

  syncForm();
  render();
  root.dataset.ready = '1';
  track('view_item_list', { item_list_name: 'catalogo', results: compute().length });
  if (state.q) track('search', { search_term: state.q, location: 'catalogo-url' });
}
