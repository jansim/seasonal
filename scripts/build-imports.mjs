#!/usr/bin/env node
// Builds data/imports/<code>.json from official monthly trade statistics:
// Eurostat Comext for EU members, HMRC Overseas Trade Statistics for the UK.
//
//   node scripts/build-imports.mjs            # all countries
//   node scripts/build-imports.mjs de gb      # some
//
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 so fetch() uses it.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const YEARS = [2023, 2024, 2025];
const OUT = join(import.meta.dirname, '..', 'data', 'imports');

// Trade codes per catalogue item. Six digits = HS subheading, eight = CN subheading.
// Items whose code also covers other produce (e.g. carrots with turnips) are noted.
const CODES = {
  apples: ['080810'],
  pears: ['080830'],
  quinces: ['080840'],
  apricots: ['080910'],
  'sour-cherries': ['080921'],
  cherries: ['080929'],
  peaches: ['080930'],
  plums: ['080940'],
  strawberries: ['081010'],
  raspberries: ['08102010'],
  blackberries: ['08102090'], // with mulberries and loganberries
  currants: ['08103010', '08103030'],
  gooseberries: ['08103090'], // with white currants
  blueberries: ['081040'], // with cranberries and bilberries
  kiwis: ['081050'],
  persimmons: ['081070'],
  grapes: ['080610'],
  melons: ['080719'],
  watermelons: ['080711'],
  figs: ['080420'],
  oranges: ['080510'],
  mandarins: ['080521', '080522', '080529'],
  lemons: ['08055010'],
  avocados: ['080440'],
  chestnuts: ['080241', '080242'],
  hazelnuts: ['080221', '080222'],
  walnuts: ['080231', '080232'],
  tomatoes: ['070200'],
  onions: ['070310'], // with shallots
  garlic: ['070320'],
  leeks: ['070390'],
  cauliflower: ['07041010'],
  broccoli: ['07041090'],
  'brussels-sprouts': ['070420'],
  cabbage: ['07049010'],
  lettuce: ['070511', '070519'],
  chicory: ['070521'],
  carrots: ['070610'], // with turnips
  celeriac: ['07069010'],
  cucumbers: ['07070005'],
  peas: ['070810'],
  'green-beans': ['070820'],
  asparagus: ['070920'],
  aubergines: ['070930'],
  celery: ['070940'],
  mushrooms: ['070951'],
  peppers: ['07096010'],
  spinach: ['070970'],
  artichokes: ['070991'],
  zucchini: ['07099310'],
  pumpkins: ['07099390'],
  fennel: ['07099950'],
  sweetcorn: ['07099960'],
  potatoes: ['070190'],
};

const COMEXT = {
  title: 'EU trade since 1988 by HS2-4-6 and CN8 (DS-045409)',
  cite: 'Eurostat Comext',
  publisher: 'Eurostat',
  url: 'https://ec.europa.eu/eurostat/comext/newxtweb/',
  licence: 'CC BY 4.0',
};
const HMRC = {
  title: 'Overseas Trade Statistics',
  cite: 'HMRC',
  publisher: 'HM Revenue & Customs',
  url: 'https://www.uktradeinfo.com/trade-data/',
  licence: 'Open Government Licence v3.0',
};
const COUNTRIES = { de: 'comext', at: 'comext', be: 'comext', fr: 'comext', gb: 'hmrc' };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// One request at a time with a pause in between: these are public services.
async function get(url, as = 'text') {
  await pause(1000);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url).catch((err) => ({ ok: false, status: err.message }));
    if (res.ok) return res[as]();
    if (attempt >= 3) throw new Error(`${res.status} for ${url}`);
    await pause(5000 * 2 ** attempt);
  }
}

/** [{ month: 'YYYY-MM', partner: 'ES', kg }] for one reporter and a list of codes. */
async function comext(reporter, codes) {
  const key = `M.${reporter.toUpperCase()}..${codes.join('+')}.1.QUANTITY_IN_100KG`;
  const url = `https://ec.europa.eu/eurostat/api/comext/dissemination/sdmx/2.1/data/DS-045409/${key}`
    + `?startPeriod=${YEARS[0]}-01&endPeriod=${YEARS.at(-1)}-12&format=SDMX-CSV`;
  const [header, ...lines] = (await get(url)).trim().split(/\r?\n/);
  const col = Object.fromEntries(header.split(',').map((h, i) => [h, i]));
  return lines.map((l) => l.split(',')).filter((c) => /^[A-Z]{2}$/.test(c[col.partner]))
    .map((c) => ({ month: c[col.TIME_PERIOD], partner: c[col.partner] === 'XS' ? 'RS' : c[col.partner], kg: Number(c[col.OBS_VALUE]) * 100 }));
}

let hmrcCountries;
async function hmrc(codes) {
  hmrcCountries ??= Object.fromEntries((await get('https://api.uktradeinfo.com/Country', 'json')).value
    .map((c) => [c.CountryId, c.CountryCodeAlpha]));
  const range = codes.map((c) => {
    const lo = Number(c.padEnd(8, '0'));
    const hi = Number(c.padEnd(8, '9'));
    return `(CommodityId ge ${lo} and CommodityId le ${hi})`;
  }).join(' or ');
  const filter = `MonthId ge ${YEARS[0]}01 and MonthId le ${YEARS.at(-1)}12 and (FlowTypeId eq 1 or FlowTypeId eq 3) and (${range})`;
  const apply = `filter(${filter})/groupby((MonthId,CountryId),aggregate(NetMass with sum as NetMass))`;
  const rows = (await get(`https://api.uktradeinfo.com/OTS?$apply=${encodeURIComponent(apply)}`, 'json')).value;
  return rows.map((r) => ({ month: `${String(r.MonthId).slice(0, 4)}-${String(r.MonthId).slice(4)}`, partner: hmrcCountries[r.CountryId], kg: r.NetMass }))
    .filter((r) => /^[A-Z]{2}$/.test(r.partner ?? ''));
}

/** Average per calendar month over YEARS: tonnes, plus the top origins with their share. */
function summarise(rows) {
  const total = Array(12).fill(0);
  const byPartner = Array.from({ length: 12 }, () => new Map());
  for (const r of rows) {
    const m = Number(r.month.slice(5)) - 1;
    total[m] += r.kg;
    byPartner[m].set(r.partner, (byPartner[m].get(r.partner) ?? 0) + r.kg);
  }
  return {
    t: total.map((kg) => Math.round(kg / 1000 / YEARS.length)),
    from: byPartner.map((map, m) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([p, kg]) => [p, Math.round((100 * kg) / total[m])]).filter(([, pct]) => pct >= 3)),
  };
}

async function build(code) {
  const kind = COUNTRIES[code];
  const items = {};
  for (const [item, codes] of Object.entries(CODES)) {
    const rows = kind === 'hmrc' ? await hmrc(codes) : await comext(code, codes);
    const s = summarise(rows);
    if (s.t.some((t) => t > 0)) items[item] = s;
    process.stdout.write('.');
  }
  const source = { ...(kind === 'hmrc' ? HMRC : COMEXT), covers: `Imports by month and origin, ${YEARS[0]}–${YEARS.at(-1)} average` };
  const body = Object.entries(items).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${code}.json`),
    `{\n  "source": ${JSON.stringify(source)},\n  "years": ${JSON.stringify(YEARS)},\n  "items": {\n${body}\n  }\n}\n`);
  console.log(` ${code}: ${Object.keys(items).length} items`);
}

const wanted = process.argv.slice(2);
for (const code of wanted.length ? wanted : Object.keys(COUNTRIES)) await build(code);
