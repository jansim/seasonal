import { MONTHS, MONTHS_LONG, loadCountries, loadCountry, arrange, describe } from './data.js';
import { renderTimeline, timelineMonthAt } from './timeline.js';
import { renderArch, archHit } from './arch.js';
import { esc } from './util.js';

const PAPER = {
  a4: { name: 'A4', w: 297, h: 210 },
  a3: { name: 'A3', w: 420, h: 297 },
  letter: { name: 'Letter', w: 279.4, h: 215.9 },
};
const VIEWS = { timeline: 'Timeline', arch: 'Half-year arch' };
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Figtree:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap';

const $ = (sel) => document.querySelector(sel);
const today = new Date();
const todayMonth = today.getMonth() + 1;
const daysInMonth = new Date(today.getFullYear(), todayMonth, 0).getDate();
const todayFraction = (todayMonth - 1 + (today.getDate() - 1) / daysInMonth) / 12;

const state = {
  country: null,
  view: 'timeline',
  category: 'all',
  query: '',
  sort: 'season',
  showStored: true,
  month: todayMonth,
  print: false,
  paper: 'a4',
  orientation: 'landscape',
  printHighlight: false,
  printToday: false,
};
let countries = [];
let country = null;
let pinned = null;

const el = {
  country: $('#country'), category: $('#category'), query: $('#query'), sort: $('#sort'),
  stored: $('#stored'), view: $('#view'), chips: $('#chips'), nowMonth: $('#now-month'),
  tip: $('#tip'), sheet: $('#sheet'), stage: $('#stage'),
};

/* ---------- URL state ---------- */

function readURL() {
  const p = new URLSearchParams(location.search);
  if (p.has('country')) state.country = p.get('country');
  if (VIEWS[p.get('view')]) state.view = p.get('view');
  if (p.has('cat')) state.category = p.get('cat');
  if (p.has('q')) state.query = p.get('q');
  if (p.get('sort') === 'name') state.sort = 'name';
  if (p.get('stored') === '0') state.showStored = false;
  const m = Number(p.get('month'));
  if (m >= 1 && m <= 12) state.month = m;
  if (p.has('print')) state.print = true;
  if (PAPER[p.get('paper')]) state.paper = p.get('paper');
  if (p.get('orient') === 'portrait') state.orientation = 'portrait';
}

function writeURL() {
  const p = new URLSearchParams();
  p.set('country', state.country);
  p.set('view', state.view);
  if (state.category !== 'all') p.set('cat', state.category);
  if (state.query) p.set('q', state.query);
  if (state.sort !== 'season') p.set('sort', state.sort);
  if (!state.showStored) p.set('stored', '0');
  if (state.month !== todayMonth) p.set('month', state.month);
  if (state.print) {
    p.set('print', '');
    p.set('paper', state.paper);
    if (state.orientation === 'portrait') p.set('orient', 'portrait');
  }
  history.replaceState(null, '', `${location.pathname}?${p.toString().replace(/print=(&|$)/, 'print$1')}`);
}

function guessCountry() {
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang.split('-')[1]?.toLowerCase();
    const match = countries.find((c) => c.code === region || (region === 'uk' && c.code === 'gb'));
    if (match) return match.code;
  }
  return countries[0].code;
}

/* ---------- Rendering ---------- */

function groups() {
  return arrange(country, state);
}

function render() {
  if (!country) return;
  writeURL();
  const g = groups();
  const highlight = state.print ? state.printHighlight : true;
  const showToday = state.print ? state.printToday : true;
  const visible = g.flatMap((x) => x.items);
  const fresh = visible.filter((i) => i.fresh.includes(state.month));
  const ctx = {
    country,
    month: state.month,
    showStored: state.showStored,
    todayFraction: showToday ? todayFraction : null,
    highlight,
    inSeason: fresh.length,
  };

  document.body.dataset.view = state.view;
  $('#title-country').textContent = country.name;
  $('#sheet-title').innerHTML = `What’s in season in <em>${esc(country.name)}</em>`;
  $('#sheet-eyebrow').textContent = `${VIEWS[state.view].toUpperCase()} · ${visible.length} ITEMS`;
  $('#note').textContent = country.note;
  $('#legend-stored').hidden = !state.showStored;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === state.view));
  el.category.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === state.category));

  if (!visible.length) {
    el.view.innerHTML = `<p class="empty">Nothing matches “${esc(state.query)}”.</p>`;
  } else if (state.view === 'arch') {
    renderArch(el.view, g, ctx);
  } else {
    renderTimeline(el.view, g, ctx);
  }
  renderNow(visible, fresh);
  applyFocus();
  scrollToMonth();
  if (state.print) fitSheet();
}

function renderNow(visible, fresh) {
  el.nowMonth.textContent = MONTHS_LONG[state.month - 1];
  $('#print-month-label').textContent = MONTHS_LONG[state.month - 1];
  $('#today-btn').hidden = state.month === todayMonth;
  const stored = state.showStored ? visible.filter((i) => !i.fresh.includes(state.month) && i.stored.includes(state.month)) : [];
  const chip = (i, kind) => `<button type="button" class="chip ${kind}${pinned === i.id ? ' is-pinned' : ''}" data-id="${esc(i.id)}"
    aria-pressed="${pinned === i.id}"><span class="dot" style="--c:${i.color}"></span>${esc(i.name)}</button>`;
  el.chips.innerHTML = (fresh.length
    ? `<div class="chip-row"><span class="chip-label">Fresh</span><div class="chip-list">${fresh.map((i) => chip(i, 'fresh')).join('')}</div></div>`
    : '<p class="chip-empty">Nothing fresh this month with the current filters.</p>')
    + (stored.length ? `<div class="chip-row"><span class="chip-label">From storage</span><div class="chip-list">${stored.map((i) => chip(i, 'stored')).join('')}</div></div>` : '');
}

/** On narrow screens the timeline scrolls sideways; keep the selected month visible. */
function scrollToMonth() {
  if (state.print || el.view.scrollWidth <= el.view.clientWidth) return;
  const btn = el.view.querySelector(`.tl-month[data-month="${state.month}"]`);
  if (!btn) return;
  const v = el.view.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const label = el.view.querySelector('.tl-label')?.offsetWidth ?? 0;
  if (b.left < v.left + label || b.right > v.right) {
    el.view.scrollLeft += b.left - v.left - label - (v.width - label) / 2 + b.width / 2;
  }
}

/* ---------- Hover / focus ---------- */

let hoverId = null;

function applyFocus() {
  const id = hoverId ?? pinned;
  el.view.classList.toggle('has-focus', !!id);
  el.view.querySelectorAll('[data-id]').forEach((n) => n.classList.toggle('is-focus', n.dataset.id === id));
  el.chips.querySelectorAll('.chip').forEach((n) => n.classList.toggle('is-focus', n.dataset.id === id));
}

function setHover(id, event) {
  if (id !== hoverId) {
    hoverId = id;
    applyFocus();
  }
  const item = id && country.items.find((i) => i.id === id);
  if (!item || !event) {
    el.tip.hidden = true;
    return;
  }
  el.tip.innerHTML = `<strong><span class="dot" style="--c:${item.color}"></span>${esc(item.name)}</strong>
    ${item.fresh.length ? `<span><em>Fresh</em> ${describe(item.fresh)}</span>` : ''}
    ${item.stored.length && state.showStored ? `<span><em>From storage</em> ${describe(item.stored)}</span>` : ''}`;
  el.tip.hidden = false;
  const pad = 14;
  const { innerWidth: vw, innerHeight: vh } = window;
  const r = el.tip.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + r.width > vw - 8) x = event.clientX - r.width - pad;
  if (y + r.height > vh - 8) y = event.clientY - r.height - pad;
  el.tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}

function hitAt(event) {
  if (state.view === 'arch') return archHit(el.view, event);
  const row = event.target.closest('.tl-item');
  return { id: row?.dataset.id, month: timelineMonthAt(el.view, event) };
}

el.view.addEventListener('pointermove', (e) => {
  if (state.print) return;
  setHover(hitAt(e).id ?? null, e);
});
el.view.addEventListener('pointerleave', () => setHover(null));
el.view.addEventListener('click', (e) => {
  if (state.print) return;
  const btn = e.target.closest('[data-month]');
  const month = btn ? Number(btn.dataset.month) : hitAt(e).month;
  if (month) setMonth(month);
});

el.chips.addEventListener('pointerover', (e) => setHover(e.target.closest('.chip')?.dataset.id ?? null));
el.chips.addEventListener('pointerleave', () => setHover(null));
el.chips.addEventListener('focusin', (e) => setHover(e.target.closest('.chip')?.dataset.id ?? null));
el.chips.addEventListener('focusout', () => setHover(null));
el.chips.addEventListener('click', (e) => {
  const id = e.target.closest('.chip')?.dataset.id;
  if (!id) return;
  pinned = pinned === id ? null : id;
  render();
});

/* ---------- Controls ---------- */

function setMonth(m) {
  state.month = ((m - 1 + 12) % 12) + 1;
  render();
}

async function setCountry(code) {
  const entry = countries.find((c) => c.code === code) ?? countries[0];
  state.country = entry.code;
  el.country.value = entry.code;
  el.view.setAttribute('aria-busy', 'true');
  try {
    country = await loadCountry(entry);
  } catch (err) {
    el.view.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  } finally {
    el.view.removeAttribute('aria-busy');
  }
  pinned = null;
  const cats = [{ id: 'all', name: 'All' }, ...country.categories];
  if (!cats.some((c) => c.id === state.category)) state.category = 'all';
  el.category.innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  render();
}

el.country.addEventListener('change', () => setCountry(el.country.value));
el.category.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (b) { state.category = b.dataset.cat; render(); }
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  render();
}));
el.query.addEventListener('input', () => { state.query = el.query.value; render(); });
el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });
el.stored.addEventListener('change', () => { state.showStored = el.stored.checked; render(); });
$('#prev-month').addEventListener('click', () => setMonth(state.month - 1));
$('#next-month').addEventListener('click', () => setMonth(state.month + 1));
$('#today-btn').addEventListener('click', () => setMonth(todayMonth));

/* ---------- Print / export ---------- */

const paperSize = () => {
  const p = PAPER[state.paper];
  return state.orientation === 'landscape' ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
};

function setPrint(on) {
  state.print = on;
  document.body.classList.toggle('print-mode', on);
  $('#print-bar').hidden = !on;
  setHover(null);
  if (!on) {
    el.sheet.style.cssText = '';
    el.stage.style.cssText = '';
  }
  render();
}

/** Size the sheet to the paper, fit the chart inside it, and scale the on-screen preview. */
function fitSheet() {
  const { w, h } = paperSize();
  $('#page-style').textContent = `@page { size: ${w}mm ${h}mm; margin: 0; }`;
  el.sheet.style.width = `${w}mm`;
  el.sheet.style.height = `${h - 0.5}mm`;
  el.sheet.style.transform = '';

  // Row heights don't depend on width, so scale the timeline to the page height
  // and widen it by the inverse amount to keep it filling the page width.
  const chart = el.view.firstElementChild;
  if (chart?.classList.contains('tl')) {
    chart.style.width = '';
    chart.style.transform = '';
    const box = el.view.getBoundingClientRect();
    const scale = Math.min(1.6, box.height / chart.offsetHeight);
    chart.style.width = `${box.width / scale}px`;
    chart.style.transform = `scale(${scale})`;
  }

  const sheetW = el.sheet.offsetWidth;
  const sheetH = el.sheet.offsetHeight;
  const available = el.stage.parentElement.clientWidth;
  const scale = Math.min(1, available / sheetW);
  el.sheet.style.transform = `scale(${scale})`;
  el.stage.style.height = `${sheetH * scale}px`;
  el.stage.style.width = `${sheetW * scale}px`;
}

function download(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileBase = () => `seasonal-${country.code}-${state.view}`;

function exportSVG() {
  const svg = el.view.querySelector('svg')?.cloneNode(true);
  if (!svg) return;
  svg.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
  svg.removeAttribute('class');
  const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.insertAdjacentHTML('afterbegin',
    `<style>@import url('${FONT_CSS.replace(/&/g, '&amp;')}');</style><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#F6F1E7"/>`);
  download(`${fileBase()}.svg`, 'image/svg+xml', `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`);
}

function exportCSV() {
  const cell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [['name', 'category', ...MONTHS].join(',')];
  for (const g of groups()) {
    for (const i of g.items) {
      const months = MONTHS.map((_, m) => (i.fresh.includes(m + 1) ? 'fresh' : state.showStored && i.stored.includes(m + 1) ? 'stored' : ''));
      lines.push([cell(i.name), cell(g.name), ...months].join(','));
    }
  }
  download(`seasonal-${country.code}.csv`, 'text/csv', `${lines.join('\n')}\n`);
}

$('#print-btn').addEventListener('click', () => setPrint(true));
$('#print-close').addEventListener('click', () => setPrint(false));
$('#print-go').addEventListener('click', () => window.print());
$('#export-svg').addEventListener('click', exportSVG);
$('#export-csv').addEventListener('click', exportCSV);
$('#paper').addEventListener('change', (e) => { state.paper = e.target.value; render(); });
document.querySelectorAll('[data-orient]').forEach((b) => b.addEventListener('click', () => {
  state.orientation = b.dataset.orient;
  document.querySelectorAll('[data-orient]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  render();
}));
$('#print-highlight').addEventListener('change', (e) => { state.printHighlight = e.target.checked; render(); });
$('#print-today').addEventListener('change', (e) => { state.printToday = e.target.checked; render(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.print) setPrint(false);
});
window.addEventListener('resize', () => { if (state.print) fitSheet(); });

// Printing straight from the interactive page uses the print layout too.
let tempPrint = false;
window.addEventListener('beforeprint', () => {
  if (!state.print) { tempPrint = true; setPrint(true); }
});
window.addEventListener('afterprint', () => {
  if (tempPrint) { tempPrint = false; setPrint(false); }
});

/* ---------- Boot ---------- */

async function init() {
  readURL();
  try {
    countries = await loadCountries();
  } catch (err) {
    el.view.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  }
  el.country.innerHTML = countries.map((c) => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('');
  el.query.value = state.query;
  el.sort.value = state.sort;
  el.stored.checked = state.showStored;
  $('#paper').value = state.paper;
  document.querySelectorAll('[data-orient]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.orient === state.orientation));
  await setCountry(state.country ?? guessCountry());
  if (state.print) setPrint(true);
  if (document.fonts) document.fonts.ready.then(() => { if (state.print) fitSheet(); });
}

init();
