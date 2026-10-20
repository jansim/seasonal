// Loading and shaping the produce data.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

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

/** Load one country and merge it with the shared produce catalogue. */
export async function loadCountry(entry) {
  const [catalogue, country] = await Promise.all([
    getJSON('data/produce.json'),
    getJSON(`data/${entry.file}`),
  ]);
  const hemisphere = country.hemisphere === 'south' ? 'south' : 'north';
  // The growing year starts in January up north and in July down south.
  const yearStart = country.yearStart ?? (hemisphere === 'south' ? 7 : 1);

  const items = Object.entries(country.produce).map(([id, local]) => {
    const base = catalogue.items[id] ?? {};
    const item = {
      id,
      name: local.name ?? base.name ?? id,
      category: local.category ?? base.category ?? 'other',
      color: local.color ?? base.color ?? '#655D52',
      fresh: normaliseMonths(local.fresh),
      stored: normaliseMonths(local.stored),
    };
    item.sortKey = seasonKey(item, yearStart);
    return item;
  });

  const categories = Object.entries(catalogue.categories).map(([id, c]) => ({ id, name: c.name }));
  if (items.some((i) => !catalogue.categories[i.category])) categories.push({ id: 'other', name: 'Other' });

  return {
    code: country.code,
    name: country.name,
    note: country.note ?? '',
    hemisphere,
    seasons: country.seasons ?? SEASONS[hemisphere],
    categories,
    items,
  };
}

function normaliseMonths(list = []) {
  return [...new Set(list)].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
}

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
    if (r.full) return 'All year';
    const end = ((r.start + r.length - 2) % 12) + 1;
    return r.length === 1 ? MONTHS[r.start - 1] : `${MONTHS[r.start - 1]}–${MONTHS[end - 1]}`;
  }).join(', ');
}

/** Sort key: where the main fresh run starts, counted from the growing-year start. */
function seasonKey(item, yearStart) {
  const pick = (months) => runs(months).sort((a, b) => b.length - a.length)[0];
  const main = pick(item.fresh) ?? pick(item.stored);
  if (!main) return 99;
  const offset = (main.start - yearStart + 12) % 12;
  return offset + (item.fresh.length ? 0 : 12) + main.length / 100;
}

/** Group by category and sort, after applying the active filters. */
export function arrange(country, { category, query, sort, showStored }) {
  const q = query.trim().toLowerCase();
  const items = country.items
    .filter((i) => category === 'all' || i.category === category)
    .filter((i) => !q || i.name.toLowerCase().includes(q))
    .filter((i) => i.fresh.length || showStored)
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : a.sortKey - b.sortKey || a.name.localeCompare(b.name)));
  return country.categories
    .map((c) => ({ ...c, items: items.filter((i) => i.category === c.id) }))
    .filter((g) => g.items.length);
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
