// Loading and shaping the produce data.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * How produce reaches the shelf, in drawing order. `fresh` is the main local season;
 * the rest only appear where a source distinguishes them.
 */
export const MODES = ['fresh', 'shoulder', 'extended', 'covered', 'heated', 'stored'];
export const OFF_SEASON = ['extended', 'covered', 'heated', 'stored'];
const MODE_LABELS = {
  fresh: 'In season',
  shoulder: 'Early or late',
  extended: 'Extended season',
  covered: 'Under cover',
  heated: 'Heated glasshouse',
  stored: 'From store',
};

const SEASONS = {
  north: [
    { name: 'Winter', months: [12, 1, 2] },
    { name: 'Spring', months: [3, 4, 5] },
    { name: 'Summer', months: [6, 7, 8] },
    { name: 'Autumn', months: [9, 10, 11] },
  ],
  south: [
    { name: 'Summer', months: [12, 1, 2] },
    { name: 'Autumn', months: [3, 4, 5] },
    { name: 'Winter', months: [6, 7, 8] },
    { name: 'Spring', months: [9, 10, 11] },
  ],
};

const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(path);
}

export const loadCountries = () => getJSON('data/countries.json');

/** Load one region and merge it with the catalogue, its imports and the illustrations. */
export async function loadCountry(entry) {
  const [catalogue, country, art, imports] = await Promise.all([
    getJSON('data/produce.json'),
    getJSON(`data/${entry.file}`),
    getJSON('data/art.json').catch(() => ({})),
    entry.imports ? getJSON(`data/${entry.imports}`) : null,
  ]);
  const hemisphere = country.hemisphere === 'south' ? 'south' : 'north';
  // The growing year starts in January up north and in July down south.
  const yearStart = country.yearStart ?? (hemisphere === 'south' ? 7 : 1);

  const make = (id, local = {}) => {
    const base = catalogue.items[id] ?? {};
    const modes = Object.fromEntries(MODES.map((m) => [m, normaliseMonths(local[m])]));
    const trade = imports?.items[id];
    const peak = trade ? Math.max(...trade.t) : 0;
    const item = {
      id,
      name: local.name ?? base.name ?? id,
      category: local.category ?? base.category ?? 'other',
      color: local.color ?? base.color ?? '#6B6155',
      latin: base.latin ?? '',
      art: art[id] ?? null,
      modes,
      local: normaliseMonths(MODES.flatMap((m) => modes[m])),
      imports: peak > 0 ? { t: trade.t, rel: trade.t.map((t) => t / peak), from: trade.from, peak } : null,
    };
    item.importOnly = !item.local.length;
    item.sortKey = seasonKey(item, yearStart);
    return item;
  };

  const items = Object.entries(country.produce).map(([id, local]) => make(id, local));
  // Produce the region imports but does not grow (oranges in Germany, say).
  for (const id of Object.keys(imports?.items ?? {})) {
    if (!country.produce[id] && catalogue.items[id]) items.push(make(id));
  }

  const categories = Object.entries(catalogue.categories).map(([id, c]) => ({ id, name: c.name }));
  if (items.some((i) => !catalogue.categories[i.category])) categories.push({ id: 'other', name: 'Other' });
  const present = new Set(items.flatMap((i) => MODES.filter((m) => i.modes[m].length)));

  return {
    code: country.code,
    name: country.name,
    note: country.note ?? '',
    hemisphere,
    resolution: country.resolution ?? 'month',
    seasons: country.seasons ?? SEASONS[hemisphere],
    sources: country.sources ?? [],
    imports: imports ? { ...imports.source, years: imports.years } : null,
    labels: { ...MODE_LABELS, ...country.modeLabels },
    modes: MODES.filter((m) => present.has(m)),
    categories,
    items,
  };
}

function normaliseMonths(list = []) {
  return [...new Set(list)].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
}

/** The modes an item is in during one month, e.g. ['fresh', 'stored']. */
export const modesIn = (item, month) => MODES.filter((m) => item.modes[m].includes(month));

/**
 * Contiguous runs of months, wrapping around the new year.
 * Returns [{ start, length }] where start is 1–12.
 */
export function runs(months) {
  const set = new Set(months);
  if (set.size === 12) return [{ start: 1, length: 12, full: true }];
  const out = [];
  for (const m of set) {
    const prev = m === 1 ? 12 : m - 1;
    if (set.has(prev)) continue;
    let length = 1;
    while (set.has(((m - 1 + length) % 12) + 1)) length++;
    out.push({ start: m, length });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Runs split into drawable segments within Jan–Dec. A segment that continues
 * across the year boundary gets an open (flat) end on that side.
 */
export function segments(months) {
  const segs = [];
  for (const r of runs(months)) {
    const end = r.start + r.length - 1;
    if (r.full) segs.push({ from: 1, to: 12, capStart: false, capEnd: false });
    else if (end <= 12) segs.push({ from: r.start, to: end, capStart: true, capEnd: true });
    else {
      segs.push({ from: r.start, to: 12, capStart: true, capEnd: false });
      segs.push({ from: 1, to: end - 12, capStart: false, capEnd: true });
    }
  }
  return segs;
}

/** Human readable run list, e.g. "Apr–Jun, Sep–Nov". */
export function describe(months) {
  if (!months.length) return '';
  return runs(months).map((r) => {
    if (r.full) return 'all year';
    const end = ((r.start + r.length - 2) % 12) + 1;
    return r.length === 1 ? MONTHS[r.start - 1] : `${MONTHS[r.start - 1]}–${MONTHS[end - 1]}`;
  }).join(', ');
}

/** Months where imports run at three quarters of their yearly peak or more. */
export const importPeak = (item) => (item.imports ? item.imports.rel.map((r, i) => (r >= 0.75 ? i + 1 : 0)).filter(Boolean) : []);

/** Sort key: where the main local run starts, counted from the growing-year start. */
function seasonKey(item, yearStart) {
  const pick = (months) => runs(months).sort((a, b) => b.length - a.length)[0];
  const order = [item.modes.fresh, item.modes.shoulder, item.modes.extended, item.modes.covered, item.modes.heated, item.modes.stored, importPeak(item)];
  const tier = order.findIndex((m) => m.length);
  const main = tier >= 0 ? pick(order[tier]) : null;
  if (!main) return 999;
  const offset = (main.start - yearStart + 12) % 12;
  return (tier >= 2 ? 12 : 0) + (tier === 6 ? 24 : 0) + offset + main.length / 100;
}

/** Group by category and sort, after applying the active filters. */
export function arrange(country, { category, query, sort, offSeason, imports }) {
  const q = query.trim().toLowerCase();
  const visible = (i) => (i.importOnly ? imports
    : i.modes.fresh.length || i.modes.shoulder.length || offSeason);
  const items = country.items
    .filter((i) => category === 'all' || i.category === category)
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.latin.toLowerCase().includes(q))
    .filter(visible)
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : a.sortKey - b.sortKey || a.name.localeCompare(b.name)));
  return [
    ...country.categories.map((c) => ({ ...c, items: items.filter((i) => i.category === c.id && !i.importOnly) })),
    { id: 'imported', name: 'Imported, not in the local calendar', items: items.filter((i) => i.importOnly) },
  ].filter((g) => g.items.length);
}

/** Season bands for Jan–Dec: consecutive months of the same season merged. */
export function seasonBands(seasons) {
  const byMonth = (m) => seasons.find((s) => s.months.includes(m))?.name ?? '';
  const bands = [];
  for (let m = 1; m <= 12; m++) {
    const name = byMonth(m);
    const last = bands[bands.length - 1];
    if (last && last.name === name) last.to = m;
    else bands.push({ name, from: m, to: m });
  }
  return bands;
}
