// Half-year arch: one concentric ring per item, Jan on the left, Dec on the right.
import { MONTHS, MONTHS_LONG, segments } from './data.js';
import { esc } from './util.js';

const INNER_R = 250;
const STEP = 16;
const GROUP_GAP = 18;
const WIDTH = { track: 10, fresh: 12, shoulder: 12, extended: 12, covered: 9, heated: 9, stored: 4 };
const INK = '#2B251F';
const SOFT = '#5E554A';
const FAINT = '#716659';
const RUBRIC = '#9E3A2A';
const PAPER = '#F3EDE1';
const SERIF = "'EB Garamond', Garamond, Georgia, serif";

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

/** Hatching and stipple as masks, so each ring keeps its own colour. */
function defs(x, y, w, h) {
  const area = `x="${x}" y="${y}" width="${w}" height="${h}"`;
  return `<defs>
    <pattern id="p-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect width="1.3" height="4" fill="#fff"/></pattern>
    <pattern id="p-cross" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-45)"><rect width="1.3" height="4" fill="#fff"/></pattern>
    <pattern id="p-dots" patternUnits="userSpaceOnUse" width="4" height="4"><circle cx="2" cy="2" r="1" fill="#fff"/></pattern>
    <mask id="m-covered" maskUnits="userSpaceOnUse" ${area}><rect ${area} fill="url(#p-hatch)"/></mask>
    <mask id="m-heated" maskUnits="userSpaceOnUse" ${area}><rect ${area} fill="url(#p-hatch)"/><rect ${area} fill="url(#p-cross)"/></mask>
    <mask id="m-extended" maskUnits="userSpaceOnUse" ${area}><rect ${area} fill="url(#p-dots)"/></mask>
  </defs>`;
}

const SHAPE = {
  fresh: (c) => `fill="${c}" fill-opacity="0.86"`,
  shoulder: (c) => `fill="${c}" fill-opacity="0.34"`,
  extended: (c) => `fill="${c}" mask="url(#m-extended)"`,
  covered: (c) => `fill="${c}" mask="url(#m-covered)"`,
  heated: (c) => `fill="${c}" mask="url(#m-heated)"`,
  stored: (c) => `fill="${c}" fill-opacity="0.6"`,
};

export function renderArch(el, groups, ctx) {
  const { country, month, offSeason, todayFraction, highlight, inSeason } = ctx;
  const { rings, outer } = layout(groups);
  const longest = Math.max(4, ...rings.map((x) => x.item.name.length));
  const side = outer + 56;
  const top = outer + 44;
  const bottom = 22 + longest * 7;
  const parts = [defs(-side, -top, side * 2, top + bottom)];

  if (highlight) {
    parts.push(`<path d="${sector(INNER_R - 16, outer + 12, month - 1, month)}" fill="#E9E0CE"/>`);
  }
  for (let k = 1; k < 12; k++) {
    const [x0, y0] = pt(INNER_R - 16, angle(k));
    const [x1, y1] = pt(outer + 12, angle(k));
    parts.push(`<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#E2D9C8" stroke-width="1"/>`);
  }

  MONTHS.forEach((m, i) => {
    const [x, y] = pt(INNER_R - 36, angle(i + 0.5));
    const selected = highlight && i + 1 === month;
    parts.push(`<g class="arch-month" data-month="${i + 1}"><text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central"
      font-family="${SERIF}" font-size="21" letter-spacing="1" style="font-variant-caps:all-small-caps" fill="${selected ? RUBRIC : SOFT}">${m}</text></g>`);
  });

  const kinds = ['stored', 'covered', 'heated', 'extended', 'shoulder', 'fresh'].filter((k) => offSeason || !['stored', 'covered', 'heated', 'extended'].includes(k));
  for (const { item, r } of rings) {
    const shapes = [`<path d="${band(r, WIDTH.track, 0, 12, false, false)}" fill="#E6DDCB"/>`];
    for (const kind of kinds) {
      for (const s of segments(item.modes[kind])) {
        shapes.push(`<path d="${band(r, WIDTH[kind], s.from - 1, s.to, s.capStart, s.capEnd)}" ${SHAPE[kind](item.color)}/>`);
      }
    }
    for (const x of [-r, r]) {
      shapes.push(`<text transform="translate(${x} 12) rotate(90)" dominant-baseline="central" font-family="${SERIF}" font-size="14"
        ${item.importOnly ? `font-style="italic" fill="${SOFT}"` : `fill="${INK}"`}>${esc(item.name)}</text>`);
    }
    parts.push(`<g class="ring" data-id="${esc(item.id)}" data-r="${r}">${shapes.join('')}</g>`);
  }

  if (todayFraction != null) {
    const a = angle(todayFraction * 12);
    const [x0, y0] = pt(INNER_R - 16, a);
    const [x1, y1] = pt(outer + 18, a);
    const [tx, ty] = pt(outer + 26, a);
    const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
    parts.push(`<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${RUBRIC}" stroke-width="1.2"/>`
      + `<text x="${f(tx)}" y="${f(ty)}" text-anchor="${anchor}" dominant-baseline="central" font-family="${SERIF}" font-style="italic" font-size="20" fill="${RUBRIC}">today</text>`);
  }

  parts.push(`<line x1="${-side + 16}" y1="1" x2="${side - 16}" y2="1" stroke="${INK}" stroke-width="1"/>`);

  const centre = highlight
    ? `<text x="0" y="-118" text-anchor="middle" font-family="${SERIF}" font-size="21" letter-spacing="2" style="font-variant-caps:all-small-caps" fill="${FAINT}">${esc(country.name)}</text>`
      + `<text x="0" y="-48" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="76" fill="${INK}">${MONTHS_LONG[month - 1]}</text>`
      + `<text x="0" y="-14" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="21" fill="${SOFT}">${inSeason} in season</text>`
    : `<text x="0" y="-96" text-anchor="middle" font-family="${SERIF}" font-size="21" letter-spacing="2" style="font-variant-caps:all-small-caps" fill="${FAINT}">January to December</text>`
      + `<text x="0" y="-30" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="${country.name.length > 12 ? 52 : 70}" fill="${INK}">${esc(country.name)}</text>`;
  parts.push(centre);

  const label = `Half-year arch of ${rings.length} items in ${country.name}`;
  el.innerHTML = `<svg class="arch" xmlns="http://www.w3.org/2000/svg" viewBox="${-side} ${-top} ${side * 2} ${top + bottom}"
    role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

export const ARCH_PAPER = PAPER;

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
