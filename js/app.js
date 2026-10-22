import { MONTHS, MONTHS_LONG, OFF_SEASON, loadCountries, loadCountry, arrange, describe, modesIn, importPeak } from './data.js';
import { renderTimeline, timelineMonthAt, tide } from './timeline.js';
import { renderArch, archHit, ARCH_PAPER } from './arch.js';
import { esc, regionName, tonnes, sentence } from './util.js';

const PAPER = {
  a4: { name: 'A4', w: 297, h: 210 },
  a3: { name: 'A3', w: 420, h: 297 },
  letter: { name: 'Letter', w: 279.4, h: 215.9 },
};
const VIEWS = { timeline: 'Timeline', arch: 'Half-year arch' };
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&display=swap';
const PLATES = { cite: 'USDA Pomological Watercolor Collection', url: 'https://naldc.nal.usda.gov/usda_pomological_watercolor' };
// Region from the browser language, for languages whose region code doesn't match ours.
const LANGUAGE_DEFAULTS = { de: 'de', fr: 'fr', nl: 'be', en: 'gb' };

const $ = (sel) => document.querySelector(sel);
const today = new Date();
const todayMonth = today.getMonth() + 1;
const daysInMonth = new Date(today.getFullYear(), todayMonth, 0).getDate();
const todayFraction = (todayMonth - 1 + (today.getDate() - 1) / daysInMonth) / 12;
const touch = matchMedia('(hover: none)');

const state = {
  country: null,
  view: 'timeline',
  category: 'all',
  query: '',
  sort: 'season',
  offSeason: true,
  imports: false,
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
  offSeason: $('#offseason'), imports: $('#imports'), view: $('#view'), nowMonth: $('#now-month'),
  gallery: $('#gallery'), lists: $('#lists'), card: $('#card'), sheet: $('#sheet'), stage: $('#stage'),
  legend: $('#legend'),
};

/* ---------- URL state ---------- */

function readURL() {
  const p = new URLSearchParams(location.search);
  if (p.has('country')) state.country = p.get('country');
  if (VIEWS[p.get('view')]) state.view = p.get('view');
  if (p.has('cat')) state.category = p.get('cat');
  if (p.has('q')) state.query = p.get('q');
  if (p.get('sort') === 'name') state.sort = 'name';
  if (p.get('glass') === '0' || p.get('stored') === '0') state.offSeason = false;
  if (p.get('imports') === '1') state.imports = true;
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
  if (!state.offSeason) p.set('glass', '0');
  if (state.imports) p.set('imports', '1');
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
    const [language, region = ''] = lang.toLowerCase().split('-');
    const match = countries.find((c) => c.code === region || (region === 'uk' && c.code === 'gb') || (region === 'ca' && c.code === 'ca-on'));
    if (match) return match.code;
    if (countries.some((c) => c.code === LANGUAGE_DEFAULTS[language])) return LANGUAGE_DEFAULTS[language];
  }
  return countries[0].code;
}

/* ---------- Words ---------- */

const allSources = (c) => [...c.sources, ...(c.imports ? [c.imports] : [])];
const years = (c) => (c.imports ? `${c.imports.years[0]}–${String(c.imports.years.at(-1)).slice(2)}` : '');
const cites = (c) => allSources(c).map((s) => (s === c.imports ? `${s.cite} ${years(c)}` : s.cite));

/** 'United Kingdom' -> 'the United Kingdom', for use mid-sentence. */
const place = (c) => (/^(United|Netherlands)/.test(c.name) ? `the ${c.name}` : c.name);

function lede(c) {
  const glass = c.modes.some((m) => m === 'covered' || m === 'heated');
  const store = c.modes.includes('stored');
  const stretch = c.modes.includes('extended') ? ', with how far heated glass and cold stores stretch the season'
    : glass || store ? `, with the ${[glass && 'glasshouses', store && 'stores'].filter(Boolean).join(' and ')} that stretch the season` : '';
  const imports = c.imports ? `${stretch ? ' and' : ', and'} what the country imports meanwhile` : '';
  return `Fruit and vegetables grown in ${esc(place(c))}, ${c.resolution === 'season' ? 'season by season' : 'month by month'}`
    + `${stretch}${imports}. Compiled from ${sentence(cites(c).map(esc))}.`;
}

/** The single mode an item is listed under in a month, best first. */
const bestMode = (item, month) => modesIn(item, month).find((m) => state.offSeason || !OFF_SEASON.includes(m));

function origins(item, month, n = 3) {
  return (item.imports?.from[month - 1] ?? []).slice(0, n).map(([code, share]) => `${regionName(code)} ${share}%`);
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
  const inSeason = visible.filter((i) => i.modes.fresh.includes(state.month) || i.modes.shoulder.includes(state.month));
  const ctx = {
    country,
    month: state.month,
    offSeason: state.offSeason,
    imports: state.imports && !!country.imports,
    todayFraction: showToday ? todayFraction : null,
    highlight,
    inSeason: inSeason.length,
    columns: state.print && visible.length > 24 ? 2 : 1,
  };

  document.body.dataset.view = state.view;
  $('#title-country').textContent = place(country);
  $('#lede').innerHTML = lede(country);
  $('#sheet-title').innerHTML = `What’s in season in <em>${esc(place(country))}</em>`;
  $('#note').textContent = country.note;
  $('#sheet-sources').textContent = `Sources: ${[...cites(country), `paintings, ${PLATES.cite}`].join(' · ')}`;
  $('#imports-wrap').hidden = !country.imports;
  $('#offseason-wrap').hidden = !country.modes.some((m) => OFF_SEASON.includes(m));
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === state.view));
  el.category.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === state.category));

  renderLegend(ctx);
  if (!visible.length) {
    el.view.innerHTML = `<p class="empty">Nothing matches “${esc(state.query)}”.</p>`;
  } else if (state.view === 'arch') {
    renderArch(el.view, g, ctx);
  } else {
    renderTimeline(el.view, g, ctx);
  }
  renderMonth(visible);
  renderFrontis(visible);
  applyFocus();
  scrollToMonth();
  if (state.print) fitSheet();
}

function key(kind) {
  if (kind === 'imports') return `<i class="key k-imports">${tide([0.3, 0.6, 1, 0.8, 0.45, 0.2])}</i>`;
  const lane = ['covered', 'heated'].includes(kind) ? 'k-lane-glass' : kind === 'stored' ? 'k-lane-store' : '';
  return `<i class="key ${lane}"><span class="bar ${kind}" style="--c:#7C6A55"></span></i>`;
}

function renderLegend(ctx) {
  const kinds = country.modes.filter((m) => ctx.offSeason || !OFF_SEASON.includes(m));
  const items = kinds.map((m) => `<span>${key(m)}${esc(country.labels[m])}</span>`);
  if (ctx.imports) items.push(`<span>${key('imports')}Imports</span>`);
  if (country.resolution === 'season') items.push('<span><em>Listed by season</em></span>');
  el.legend.innerHTML = items.join('');
}

function renderMonth(visible) {
  const m = state.month;
  el.nowMonth.textContent = MONTHS_LONG[m - 1];
  $('#print-month-label').textContent = MONTHS_LONG[m - 1];
  $('#today-btn').hidden = m === todayMonth;

  const local = visible.filter((i) => !i.importOnly);
  const fresh = local.filter((i) => i.art && (i.modes.fresh.includes(m) || i.modes.shoulder.includes(m)));
  el.gallery.innerHTML = fresh.map((i) => `
    <button type="button" class="specimen${pinned === i.id ? ' is-pinned' : ''}" data-id="${esc(i.id)}" aria-pressed="${pinned === i.id}">
      ${plateHTML(i.art)}<span>${esc(i.name)}</span>
    </button>`).join('');
  el.gallery.parentElement.classList.toggle('no-gallery', !fresh.length);
  fadeGallery();

  const name = (i, extra = '') => `<button type="button" class="name${pinned === i.id ? ' is-pinned' : ''}" data-id="${esc(i.id)}"
    aria-pressed="${pinned === i.id}">${esc(i.name)}${extra}</button>`;
  const rows = [];
  for (const mode of country.modes) {
    const list = local.filter((i) => bestMode(i, m) === mode);
    if (list.length) rows.push(`<p class="list"><span class="list-label">${esc(country.labels[mode])}</span>${list.map((i) => name(i)).join(', ')}</p>`);
  }
  if (state.imports && country.imports) {
    const arriving = visible.filter((i) => i.imports && importPeak(i).includes(m) && !bestMode(i, m))
      .sort((a, b) => b.imports.t[m - 1] - a.imports.t[m - 1]);
    if (arriving.length) {
      rows.push(`<p class="list"><span class="list-label">Imports near their peak</span>${arriving.map((i) =>
        name(i, ` <small>${esc(regionName(i.imports.from[m - 1][0]?.[0] ?? ''))}</small>`)).join(', ')}</p>`);
    }
  }
  el.lists.innerHTML = rows.join('') || '<p class="list-empty">Nothing local this month with the current filters.</p>';
}

/** Fade the specimen tray's right edge while there is more to scroll to. */
function fadeGallery() {
  const g = el.gallery;
  g.classList.toggle('fades', g.scrollLeft + g.clientWidth < g.scrollWidth - 4);
}
el.gallery.addEventListener('scroll', fadeGallery, { passive: true });
window.addEventListener('resize', fadeGallery);

const PART_GAP = 4;

/**
 * A plate as <img>, or, when it paints the fruit more than once and there is room, its separate views
 * side by side at the plate's own scale. `box` is the space it gets in CSS px (an unbounded width
 * always sets the views side by side); `cls` and `alt` go on the outer element.
 */
function plateHTML(art, { box = { w: Infinity, h: 1 }, cls = '', alt = '' } = {}) {
  const img = (p, attrs) => `<img src="${esc(p.file)}" width="${p.width}" height="${p.height}" decoding="async" ${attrs}>`;
  const parts = art.parts ?? [];
  const tallest = Math.max(...parts.map((p) => p.height));
  const wide = parts.reduce((sum, p) => sum + p.width, PART_GAP * (parts.length - 1));
  const sideBySide = Math.min(box.h / tallest, box.w / wide);
  const stacked = Math.min(box.h / art.height, box.w / art.width);
  if (!parts.length || sideBySide < stacked * 1.05) return img(art, `class="${cls}" alt="${esc(alt)}"`);
  const height = Number.isFinite(box.w) ? ` style="height:${Math.floor(sideBySide * tallest)}px"` : '';
  return `<span class="plate-parts ${cls}" role="img" aria-label="${esc(alt)}"${height}>${parts.map((p) =>
    img(p, `alt="" style="height:${(100 * p.height / tallest).toFixed(2)}%"`)).join('')}</span>`;
}

function plateCaption(art, item) {
  const variety = art.variety ? `‘${esc(art.variety)}’ ` : '';
  return `${variety}${esc(art.subject ?? item.name.toLowerCase())}, painted by ${esc(art.artist)}${art.year ? `, ${esc(art.year)}` : ''}`;
}

function renderFrontis(visible) {
  const fig = $('#frontis');
  const withArt = visible.filter((i) => i.art && !i.importOnly);
  const now = withArt.filter((i) => i.modes.fresh.includes(state.month));
  const pool = now.length ? now : withArt;
  const pick = country.items.find((i) => i.id === pinned && i.art) ?? pool[state.month % Math.max(1, pool.length)];
  if (!pick) {
    fig.hidden = true;
    return;
  }
  fig.hidden = false;
  if (fig.dataset.id === pick.id) return;
  fig.dataset.id = pick.id;
  fig.innerHTML = `${plateHTML(pick.art, { box: { w: 250, h: 260 }, alt: `Watercolour of ${pick.name.toLowerCase()}` })}
    <figcaption><span class="sc">${esc(pick.name)}</span>${plateCaption(pick.art, pick)}</figcaption>`;
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

/* ---------- Notes: about, sources, paintings ---------- */

function sourceItem(s) {
  const meta = [s.publisher, s.year, s.licence].filter(Boolean).map(esc).join(', ');
  return `<li><a href="${esc(s.url)}">${esc(s.title)}</a>. ${meta}.<span class="what">${esc(s.covers)}</span></li>`;
}

function renderNotes() {
  const c = country;
  const defs = {
    fresh: 'the main local season',
    shoulder: 'the first or last weeks, when there is little about',
    extended: 'kept going with heated glass or long cold storage',
    covered: 'grown under foil, fleece or unheated glass',
    heated: 'grown in heated glasshouses, which takes far more energy',
    stored: 'harvested earlier and kept in store',
  };
  const modes = c.modes.map((m) => `<span class="term">${esc(c.labels[m])}</span>: ${defs[m]}`);
  const about = [
    `<p>Each region uses a calendar published in that region, and nothing has been filled in from elsewhere. ${esc(c.note)}</p>`,
    `<p>${sentence(modes)}.</p>`,
  ];
  if (c.resolution === 'season') about.push('<p>The source lists produce by season rather than by month, so months come in blocks of three.</p>');
  if (c.imports) {
    about.push(`<p>Imports are monthly averages for ${c.imports.years[0]}–${c.imports.years.at(-1)} from official trade statistics
      (${esc(c.imports.publisher)}). Switch on <span class="term">Imports</span> to see a small silhouette under each row: how much
      arrives each month compared with that product’s busiest month. Hover a row for tonnages and countries of origin.
      Trade figures count everything that crosses the border, so trading hubs re-export part of what they import,
      and some trade codes group similar produce (cauliflower with broccoli, for example).</p>`);
  }
  $('#about').innerHTML = about.join('');
  $('#sources-region').textContent = c.name;
  $('#sources').innerHTML = allSources(c).map(sourceItem).join('');

  const plates = c.items.filter((i) => i.art).sort((a, b) => a.name.localeCompare(b.name));
  $('#plate-list').innerHTML = plates.map((i) => `<li><img src="${esc(i.art.thumb ?? i.art.file)}" alt="" loading="lazy" decoding="async">
    <span><strong>${esc(i.name)}</strong>: ${plateCaption(i.art, i)}.
      <a href="https://archive.org/details/usda-pomological-watercolor-collection/${esc(i.art.id)}.jpg">${esc(i.art.id)}</a></span></li>`).join('');
}

async function renderAllSources() {
  const list = $('#all-sources');
  if (list.dataset.done) return;
  list.dataset.done = '1';
  const all = await Promise.all(countries.map((e) => loadCountry(e).catch(() => null)));
  list.innerHTML = all.filter(Boolean).map((c) => `<li><strong>${esc(c.name)}</strong>: ${allSources(c).map((s) =>
    `<a href="${esc(s.url)}">${esc(s === c.imports ? `${s.cite} ${years(c)}` : s.cite)}</a>`).join(', ')}</li>`).join('');
}
$('.all-sources').addEventListener('toggle', renderAllSources);

/* ---------- Hover card ---------- */

let hoverId = null;

function applyFocus() {
  const id = hoverId ?? pinned;
  el.view.classList.toggle('has-focus', !!id);
  el.view.querySelectorAll('[data-id]').forEach((n) => n.classList.toggle('is-focus', n.dataset.id === id));
  document.querySelectorAll('.month [data-id]').forEach((n) => n.classList.toggle('is-focus', n.dataset.id === id));
}

function cardHTML(item) {
  const m = state.month;
  const rows = country.modes.filter((k) => item.modes[k].length)
    .map((k) => `<dt>${esc(country.labels[k])}</dt><dd>${describe(item.modes[k])}</dd>`).join('');
  let imports = '';
  if (item.imports) {
    const from = origins(item, m);
    imports = `<div class="imports"><dl><dt>Imports</dt><dd>${tonnes(item.imports.t[m - 1])} in ${MONTHS[m - 1]}${from.length ? `, from ${esc(from.join(', '))}` : ''}</dd></dl>
      <div class="spark">${tide(item.imports.rel, m)}</div>
      <div class="spark-axis">${MONTHS.map((x) => `<span>${x[0]}</span>`).join('')}</div></div>`;
  }
  const plate = item.art
    ? plateHTML(item.art, { box: { w: 274, h: 210 }, cls: 'card-plate' })
    : '';
  const credit = item.art
    ? `<p class="credit">${plateCaption(item.art, item)}. ${esc(PLATES.cite)}, National Agricultural Library.</p>`
    : '';
  const local = rows ? `<dl>${rows}</dl>` : `<p><em>Not in the ${esc(country.sources[0]?.cite ?? 'local')} calendar.</em></p>`;
  return `<span class="card-close" aria-hidden="true">×</span>${plate}<h3>${esc(item.name)}</h3><p class="latin">${esc(item.latin)}</p>${local}${imports}${credit}`;
}

function showCard(item, event) {
  el.card.innerHTML = cardHTML(item);
  el.card.classList.toggle('no-plate', !item.art);
  el.card.hidden = false;
  if (touch.matches || !event) return;
  const pad = 18;
  const { innerWidth: vw, innerHeight: vh } = window;
  const r = el.card.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + r.width > vw - 8) x = event.clientX - r.width - pad;
  if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
  el.card.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}

function setHover(id, event) {
  if (id !== hoverId) {
    hoverId = id;
    applyFocus();
  }
  if (touch.matches) return;
  const item = id && country.items.find((i) => i.id === id);
  if (!item) {
    el.card.hidden = true;
    return;
  }
  showCard(item, event);
  // the plate may still be loading; place the card again once it has its size
  el.card.querySelector('img')?.addEventListener('load', () => hoverId === id && showCard(item, event), { once: true });
}

function setPinned(id) {
  pinned = pinned === id ? null : id;
  render();
  if (touch.matches) {
    const item = pinned && country.items.find((i) => i.id === pinned);
    if (item) showCard(item);
    else el.card.hidden = true;
  }
}

function hitAt(event) {
  if (state.view === 'arch') return archHit(el.view, event);
  const row = event.target.closest('.tl-item');
  return { id: row?.dataset.id, month: timelineMonthAt(el.view, event) };
}

el.view.addEventListener('pointermove', (e) => {
  if (state.print || e.pointerType === 'touch') return;
  setHover(hitAt(e).id ?? null, e);
});
el.view.addEventListener('pointerleave', () => setHover(null));
el.view.addEventListener('click', (e) => {
  if (state.print) return;
  const label = e.target.closest('.tl-label');
  if (label) {
    setPinned(label.parentElement.dataset.id);
    return;
  }
  const btn = e.target.closest('[data-month]');
  const hit = hitAt(e);
  const month = btn ? Number(btn.dataset.month) : hit.month;
  if (touch.matches && hit.id && !btn) setPinned(hit.id);
  else if (month) setMonth(month);
});

const monthPanel = $('.month');
monthPanel.addEventListener('pointerover', (e) => {
  const id = e.target.closest('[data-id]')?.dataset.id ?? null;
  if (e.pointerType !== 'touch') setHover(id, e);
});
monthPanel.addEventListener('pointermove', (e) => {
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id && e.pointerType !== 'touch') setHover(id, e);
});
monthPanel.addEventListener('pointerleave', () => setHover(null));
monthPanel.addEventListener('focusin', (e) => {
  const target = e.target.closest('[data-id]');
  if (!target) return;
  const r = target.getBoundingClientRect();
  setHover(target.dataset.id, { clientX: r.right, clientY: r.top });
});
monthPanel.addEventListener('focusout', () => setHover(null));
monthPanel.addEventListener('click', (e) => {
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id) setPinned(id);
});
el.card.addEventListener('click', () => {
  if (touch.matches) setPinned(pinned);
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
  delete $('#frontis').dataset.id;
  const cats = [{ id: 'all', name: 'Everything' }, ...country.categories];
  if (!cats.some((c) => c.id === state.category)) state.category = 'all';
  el.category.innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  renderNotes();
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
el.offSeason.addEventListener('change', () => { state.offSeason = el.offSeason.checked; render(); });
el.imports.addEventListener('change', () => { state.imports = el.imports.checked; render(); });
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
  if (chart?.matches('.tl, .tl-cols')) {
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
  svg.querySelector('defs').insertAdjacentHTML('afterend',
    `<style>@import url('${FONT_CSS.replace(/&/g, '&amp;')}');</style><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ARCH_PAPER}"/>`);
  download(`${fileBase()}.svg`, 'image/svg+xml', `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`);
}

function exportCSV() {
  const cell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const withImports = !!country.imports;
  const head = ['name', 'category', ...MONTHS, ...(withImports ? MONTHS.map((m) => `${m} imports (t)`) : [])];
  const lines = [head.join(',')];
  for (const g of groups()) {
    for (const i of g.items) {
      const months = MONTHS.map((_, m) => modesIn(i, m + 1).filter((k) => state.offSeason || !OFF_SEASON.includes(k)).join('+'));
      const trade = withImports ? MONTHS.map((_, m) => (i.imports ? String(i.imports.t[m]) : '')) : [];
      lines.push([cell(i.name), cell(g.name), ...months, ...trade].join(','));
    }
  }
  lines.push('', `# Sources: ${cites(country).join('; ')}`);
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
  if (e.key !== 'Escape') return;
  if (state.print) setPrint(false);
  else if (pinned) setPinned(pinned);
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
  el.offSeason.checked = state.offSeason;
  el.imports.checked = state.imports;
  $('#paper').value = state.paper;
  document.querySelectorAll('[data-orient]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.orient === state.orientation));
  await setCountry(state.country ?? guessCountry());
  if (state.print) setPrint(true);
  if (document.fonts) document.fonts.ready.then(() => { if (state.print) fitSheet(); });
}

init();
