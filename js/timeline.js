// View 02 · Timeline — one row per item, rounded bars across Jan–Dec.
import { MONTHS, segments, seasonBands } from './data.js';
import { esc } from './util.js';

const pct = (n) => `${(n * 100).toFixed(4)}%`;

function bar(seg, kind, color) {
  const inset = kind === 'fresh' ? 4 : 6;
  const left = `calc(${pct((seg.from - 1) / 12)} + ${seg.capStart ? inset : 0}px)`;
  const right = `calc(${pct((12 - seg.to) / 12)} + ${seg.capEnd ? inset : 0}px)`;
  const cls = ['tl-bar', kind, seg.capStart ? '' : 'open-start', seg.capEnd ? '' : 'open-end'].join(' ');
  return `<span class="${cls}" style="left:${left};right:${right};--c:${color}"></span>`;
}

export function renderTimeline(el, groups, ctx) {
  const { country, month, showStored, todayFraction, highlight } = ctx;
  const bands = seasonBands(country.seasons).map((b) => `
    <span class="tl-season season-${b.name.toLowerCase()}" style="left:${pct((b.from - 1) / 12)};right:${pct((12 - b.to) / 12)}">
      ${b.to - b.from >= 1 ? esc(b.name) : ''}
    </span>`).join('');

  const months = MONTHS.map((m, i) => `
    <button type="button" class="tl-month${highlight && i + 1 === month ? ' is-selected' : ''}" data-month="${i + 1}"
      aria-pressed="${i + 1 === month}">${m.toUpperCase()}</button>`).join('');

  const rows = groups.map((g) => `
    <div class="tl-group"><span>${esc(g.name.toUpperCase())} · ${g.items.length}</span></div>
    ${g.items.map((item) => `
      <div class="tl-row tl-item" data-id="${esc(item.id)}">
        <div class="tl-label"><span class="dot" style="--c:${item.color}"></span>${esc(item.name)}</div>
        <div class="tl-track">
          ${showStored ? segments(item.stored).map((s) => bar(s, 'stored', item.color)).join('') : ''}
          ${segments(item.fresh).map((s) => bar(s, 'fresh', item.color)).join('')}
        </div>
      </div>`).join('')}`).join('');

  el.innerHTML = `
    <div class="tl" style="--m:${month}">
      <div class="tl-row tl-seasons" aria-hidden="true"><div></div><div class="tl-track">${bands}</div></div>
      <div class="tl-row tl-months"><div></div><div class="tl-track tl-month-grid">${months}</div></div>
      <div class="tl-body">
        ${highlight ? '<div class="tl-col-hl" aria-hidden="true"></div>' : ''}
        ${todayFraction != null ? `<div class="tl-today" style="--t:${todayFraction}" aria-hidden="true"><span>NOW</span></div>` : ''}
        ${rows}
      </div>
    </div>`;
}

/** Month (1–12) under a pointer event inside the timeline, or null. */
export function timelineMonthAt(el, event) {
  const track = el.querySelector('.tl-body .tl-track');
  if (!track) return null;
  const r = track.getBoundingClientRect();
  const x = (event.clientX - r.left) / r.width;
  return x >= 0 && x < 1 ? Math.floor(x * 12) + 1 : null;
}
