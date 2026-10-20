// View 07 · Half-year arch — one concentric ring per item, Jan on the left, Dec on the right.
import { MONTHS, MONTHS_LONG, segments } from './data.js';
import { esc } from './util.js';

const INNER_R = 250;
const STEP = 16;
const GROUP_GAP = 18;
const WIDTH = { track: 10, fresh: 12, stored: 9 };
const INK = '#26221D';
const MUTED = '#655D52';
const MONO = "'DM Mono', ui-monospace, monospace";
const SANS = 'Figtree, system-ui, sans-serif';
const SERIF = "'Instrument Serif', Georgia, serif";

const angle = (k) => Math.PI * (1 - k / 12); // k = months elapsed since 1 Jan, 0–12
const pt = (r, a) => [r * Math.cos(a), -r * Math.sin(a)];
const f = (n) => n.toFixed(1);

/** A ring segment as a filled shape, with rounded or flat ends. */
function band(r, width, k0, k1, capStart, capEnd) {
  const h = width / 2;
  const pad = (h + 2) / r;
  const a0 = angle(k0) - (capStart ? pad : 0);
  const a1 = angle(k1) + (capEnd ? pad : 0);
  if (a0 <= a1) return '';
  const large = a0 - a1 > Math.PI ? 1 : 0;
  const [ax, ay] = pt(r + h, a0);
  const [bx, by] = pt(r + h, a1);
  const [cx, cy] = pt(r - h, a1);
  const [dx, dy] = pt(r - h, a0);
  return `M${f(ax)} ${f(ay)}A${r + h} ${r + h} 0 ${large} 1 ${f(bx)} ${f(by)}`
    + (capEnd ? `A${h} ${h} 0 0 1 ${f(cx)} ${f(cy)}` : `L${f(cx)} ${f(cy)}`)
    + `A${r - h} ${r - h} 0 ${large} 0 ${f(dx)} ${f(dy)}`
    + (capStart ? `A${h} ${h} 0 0 1 ${f(ax)} ${f(ay)}` : '') + 'Z';
}

function sector(r0, r1, k0, k1) {
  const [ax, ay] = pt(r1, angle(k0));
  const [bx, by] = pt(r1, angle(k1));
  const [cx, cy] = pt(r0, angle(k1));
  const [dx, dy] = pt(r0, angle(k0));
  return `M${f(ax)} ${f(ay)}A${r1} ${r1} 0 0 1 ${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}A${r0} ${r0} 0 0 0 ${f(dx)} ${f(dy)}Z`;
}

function layout(groups) {
  const rings = [];
  let r = INNER_R;
  groups.forEach((g, gi) => {
    if (gi) r += GROUP_GAP;
    for (const item of g.items) {
      rings.push({ item, r });
      r += STEP;
    }
  });
  return { rings, outer: rings.length ? rings[rings.length - 1].r : INNER_R };
}

export function renderArch(el, groups, ctx) {
  const { country, month, showStored, todayFraction, highlight, inSeason } = ctx;
  const { rings, outer } = layout(groups);
  const longest = Math.max(4, ...rings.map((x) => x.item.name.length));
  const side = outer + 56;
  const top = outer + 44;
  const bottom = 22 + longest * 6.6;
  const parts = [];

  if (highlight) {
    parts.push(`<path d="${sector(INNER_R - 16, outer + 12, month - 1, month)}" fill="#ECE3D2"/>`);
  }
  for (let k = 1; k < 12; k++) {
    const [x0, y0] = pt(INNER_R - 16, angle(k));
    const [x1, y1] = pt(outer + 12, angle(k));
    parts.push(`<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#E2D9C8" stroke-width="1"/>`);
  }

  MONTHS.forEach((m, i) => {
    const [x, y] = pt(INNER_R - 34, angle(i + 0.5));
    const selected = highlight && i + 1 === month;
    parts.push(`<g class="arch-month" data-month="${i + 1}">`
      + (selected ? `<rect x="${f(x - 21)}" y="${f(y - 11)}" width="42" height="22" rx="11" fill="${INK}"/>` : '')
      + `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" font-size="12" fill="${selected ? '#F6F1E7' : MUTED}">${m.toUpperCase()}</text></g>`);
  });

  for (const { item, r } of rings) {
    const shapes = [`<path d="${band(r, WIDTH.track, 0, 12, false, false)}" fill="#EAE2D3"/>`];
    if (showStored) {
      for (const s of segments(item.stored)) {
        shapes.push(`<path d="${band(r, WIDTH.stored, s.from - 1, s.to, s.capStart, s.capEnd)}" fill="${item.color}" fill-opacity="0.35"/>`);
      }
    }
    for (const s of segments(item.fresh)) {
      shapes.push(`<path d="${band(r, WIDTH.fresh, s.from - 1, s.to, s.capStart, s.capEnd)}" fill="${item.color}"/>`);
    }
    for (const x of [-r, r]) {
      shapes.push(`<text transform="translate(${x} 12) rotate(90)" dominant-baseline="central" font-family="${SANS}" font-size="12" font-weight="600" fill="${INK}">${esc(item.name)}</text>`);
    }
    parts.push(`<g class="ring" data-id="${esc(item.id)}" data-r="${r}">${shapes.join('')}</g>`);
  }

  if (todayFraction != null) {
    const a = angle(todayFraction * 12);
    const [x0, y0] = pt(INNER_R - 16, a);
    const [x1, y1] = pt(outer + 18, a);
    const [tx, ty] = pt(outer + 26, a);
    const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
    parts.push(`<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4" stroke-linecap="round"/>`
      + `<text x="${f(tx)}" y="${f(ty)}" text-anchor="${anchor}" dominant-baseline="central" font-family="${MONO}" font-size="11" fill="${INK}">NOW</text>`);
  }

  parts.push(`<line x1="${-side + 16}" y1="1" x2="${side - 16}" y2="1" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`);

  const centre = highlight
    ? `<text x="0" y="-92" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="2" fill="${MUTED}">${esc(country.name.toUpperCase())}</text>`
      + `<text x="0" y="-38" text-anchor="middle" font-family="${SERIF}" font-size="60" fill="${INK}">${MONTHS_LONG[month - 1]}</text>`
      + `<text x="0" y="-14" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="1" fill="${MUTED}">${inSeason} IN SEASON</text>`
    : `<text x="0" y="-78" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="2" fill="${MUTED}">JAN ↗ JUL ↘ DEC</text>`
      + `<text x="0" y="-24" text-anchor="middle" font-family="${SERIF}" font-size="60" fill="${INK}">${esc(country.name)}</text>`;
  parts.push(centre);

  const label = `Half-year arch of ${rings.length} items in ${country.name}`;
  el.innerHTML = `<svg class="arch" xmlns="http://www.w3.org/2000/svg" viewBox="${-side} ${-top} ${side * 2} ${top + bottom}"
    role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

/** What is under the pointer: the ring's item id and/or the month (1–12). */
export function archHit(el, event) {
  const svg = el.querySelector('svg');
  if (!svg) return {};
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const out = {};
  if (p.y < 0) {
    const a = Math.atan2(-p.y, p.x);
    out.month = Math.min(12, Math.floor((1 - a / Math.PI) * 12) + 1);
  }
  const r = p.y < 0 ? Math.hypot(p.x, p.y) : Math.abs(p.x);
  for (const g of svg.querySelectorAll('.ring')) {
    const ringR = Number(g.dataset.r);
    if (Math.abs(r - ringR) <= STEP / 2) out.id = g.dataset.id;
  }
  return out;
}
