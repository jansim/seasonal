// Timeline: one row per item. The main season is a watercolour wash; produce grown under
// cover or glass is hatched in a thinner lane below, storage is a dotted line, and imports
// are a small bar chart along the bottom.
import { MONTHS, segments, seasonBands } from './data.js';
import { esc } from './util.js';

const pct = (n) => `${(n * 100).toFixed(4)}%`;

function bar(seg, kind, color) {
  const inset = 3;
  const left = `calc(${pct((seg.from - 1) / 12)} + ${seg.capStart ? inset : 0}px)`;
  const right = `calc(${pct((12 - seg.to) / 12)} + ${seg.capEnd ? inset : 0}px)`;
  const cls = ['bar', kind, seg.capStart ? '' : 'open-start', seg.capEnd ? '' : 'open-end'].filter(Boolean).join(' ');
  return `<span class="${cls}" style="left:${left};right:${right};--c:${color}"></span>`;
}

const bars = (item, kinds) => kinds.flatMap((k) => segments(item.modes[k]).map((s) => bar(s, k, item.color))).join('');

/** The lanes one item needs with the current layers switched on. */
export function lanes(item, { offSeason, imports, month }) {
  if (item.importOnly) return item.imports ? `<div class="lane lane-imports tall" aria-hidden="true">${tide(item.imports.rel, month)}</div>` : '';
  const out = [`<div class="lane lane-main">${bars(item, ['fresh', 'shoulder', ...(offSeason ? ['extended'] : [])])}</div>`];
  if (offSeason && (item.modes.covered.length || item.modes.heated.length)) {
    out.push(`<div class="lane lane-glass">${bars(item, ['covered', 'heated'])}</div>`);
  }
  if (offSeason && item.modes.stored.length) out.push(`<div class="lane lane-store">${bars(item, ['stored'])}</div>`);
  if (imports && item.imports) out.push(`<div class="lane lane-imports" aria-hidden="true">${tide(item.imports.rel, month)}</div>`);
  return out.join('');
}

/** Imports through the year as a stepped silhouette, the selected month picked out. */
export function tide(rel, month) {
  const h = (r) => (1 - r).toFixed(3);
  const path = `M0 1${rel.map((r, i) => `V${h(r)}H${i + 1}`).join('')}V1Z`;
  const r = rel[month - 1];
  return `<svg viewBox="0 0 ${rel.length} 1" preserveAspectRatio="none"><path d="${path}" class="tide"/>`
    + (r == null ? '' : `<rect x="${month - 1}" y="${h(r)}" width="1" height="${r.toFixed(3)}" class="tide-month"/>`) + '</svg>';
}

function thumb(item) {
  return item.art
    ? `<span class="thumb"><img src="${esc(item.art.thumb ?? item.art.file)}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="thumb" style="--c:${item.color}"><i></i></span>`;
}

/** Split groups into `n` columns of roughly equal length, continuing a group where it breaks. */
function columns(groups, n) {
  if (n < 2) return [groups];
  const total = groups.reduce((sum, g) => sum + g.items.length + 1.5, 0);
  const out = [[]];
  let used = 0;
  for (const g of groups) {
    let items = g.items;
    let cont = false;
    while (items.length) {
      const room = Math.max(1, Math.round(total / n - used - 1.5));
      const take = out.length < n && used + items.length + 1.5 > total / n + 2 ? items.slice(0, room) : items;
      out.at(-1).push({ ...g, items: take, cont });
      used += take.length + 1.5;
      items = items.slice(take.length);
      cont = true;
      if (items.length) {
        out.push([]);
        used = 0;
      }
    }
  }
  return out;
}

function table(groups, ctx, bands, months) {
  const { month, todayFraction, highlight } = ctx;
  const rows = groups.map((g) => `
    <div class="tl-group"><div class="tl-group-label"><h3>${esc(g.name)}</h3><span>${g.cont ? 'continued' : g.items.length}</span></div></div>
    ${g.items.map((item) => `
      <div class="tl-row tl-item${item.importOnly ? ' import-only' : ''}" data-id="${esc(item.id)}">
        <div class="tl-label">${thumb(item)}<span class="label-name">${esc(item.name)}</span></div>
        <div class="tl-track lanes">${lanes(item, ctx)}</div>
      </div>`).join('')}`).join('');
  return `
    <div class="tl" style="--m:${month}">
      <div class="tl-row tl-seasons" aria-hidden="true"><div></div><div class="tl-track">${bands}</div></div>
      <div class="tl-row tl-months"><div></div><div class="tl-track tl-month-grid">${months}</div></div>
      <div class="tl-body">
        <div class="tl-grid" aria-hidden="true"></div>
        ${highlight ? '<div class="tl-col-hl" aria-hidden="true"></div>' : ''}
        ${todayFraction != null ? `<div class="tl-today" style="--t:${todayFraction}" aria-hidden="true"><span>today</span></div>` : ''}
        ${rows}
      </div>
    </div>`;
}

/** `ctx.columns` > 1 sets the table in side-by-side columns (used for print). */
export function renderTimeline(el, groups, ctx) {
  const { country, month, highlight } = ctx;
  const bands = seasonBands(country.seasons).map((b) => `
    <span class="tl-season${b.to === b.from ? ' is-short' : ''}" style="left:${pct((b.from - 1) / 12)};right:${pct((12 - b.to) / 12)}">${b.to > b.from ? esc(b.name) : ''}</span>`).join('');

  const months = MONTHS.map((m, i) => `
    <button type="button" class="tl-month${highlight && i + 1 === month ? ' is-selected' : ''}" data-month="${i + 1}"
      aria-pressed="${i + 1 === month}">${m}</button>`).join('');

  const cols = columns(groups, ctx.columns ?? 1);
  el.innerHTML = cols.length > 1
    ? `<div class="tl-cols" style="--cols:${cols.length}">${cols.map((c) => table(c, ctx, bands, months)).join('')}</div>`
    : table(cols[0], ctx, bands, months);
}

/** Month (1–12) under a pointer event inside the timeline, or null. */
export function timelineMonthAt(el, event) {
  const track = el.querySelector('.tl-body .tl-track');
  if (!track) return null;
  const r = track.getBoundingClientRect();
  const x = (event.clientX - r.left) / r.width;
  return x >= 0 && x < 1 ? Math.floor(x * 12) + 1 : null;
}
