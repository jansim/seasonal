#!/usr/bin/env node
// Checks the JSON data files. No dependencies: `node scripts/validate.mjs`.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dirname, '..');
const root = join(repo, 'data');
const errors = [];
const read = (file) => {
  try {
    return JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (err) {
    errors.push(`${file}: ${err.message}`);
    return null;
  }
};
const MODES = ['fresh', 'shoulder', 'extended', 'covered', 'heated', 'stored'];
const isMonthList = (v) => Array.isArray(v) && v.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)
  && new Set(v).size === v.length;
const isColor = (v) => /^#[0-9a-f]{6}$/i.test(v);
const isURL = (v) => typeof v === 'string' && /^https:\/\/\S+$/.test(v);

function checkSource(where, s) {
  for (const key of ['title', 'publisher', 'covers']) {
    if (!s?.[key]) errors.push(`${where} needs a "${key}"`);
  }
  if (!isURL(s?.url)) errors.push(`${where} needs an https "url"`);
}

const catalogue = read('produce.json');
const countries = read('countries.json');
const art = existsSync(join(root, 'art.json')) ? read('art.json') : {};

if (catalogue) {
  for (const [id, item] of Object.entries(catalogue.items)) {
    if (!item.name) errors.push(`produce.json: "${id}" has no name`);
    if (!catalogue.categories[item.category]) errors.push(`produce.json: "${id}" has unknown category "${item.category}"`);
    if (!isColor(item.color)) errors.push(`produce.json: "${id}" has invalid color "${item.color}"`);
  }
}

for (const [id, plate] of Object.entries(art ?? {})) {
  const where = `art.json: "${id}"`;
  if (catalogue && !catalogue.items[id]) errors.push(`${where} is not in produce.json`);
  if (!/^POM\d{8}$/.test(plate.id)) errors.push(`${where} needs a NAL identifier like POM00001234`);
  if (!plate.artist) errors.push(`${where} needs an artist`);
  if (!plate.file || !existsSync(join(repo, plate.file))) errors.push(`${where}: image "${plate.file}" is missing`);
}

const codes = new Set();
for (const entry of countries ?? []) {
  if (codes.has(entry.code)) errors.push(`countries.json: duplicate code "${entry.code}"`);
  codes.add(entry.code);
  const file = entry.file;
  const country = read(file);
  if (!country || !catalogue) continue;
  if (country.code !== entry.code) errors.push(`${file}: code "${country.code}" does not match countries.json "${entry.code}"`);
  if (!['north', 'south'].includes(country.hemisphere)) errors.push(`${file}: hemisphere must be "north" or "south"`);
  if (!country.sources?.length) errors.push(`${file}: list at least one entry in "sources"`);
  (country.sources ?? []).forEach((s, i) => checkSource(`${file}: sources[${i}]`, s));
  for (const key of Object.keys(country.modeLabels ?? {})) {
    if (!MODES.includes(key)) errors.push(`${file}: modeLabels has unknown mode "${key}"`);
  }
  for (const [id, p] of Object.entries(country.produce ?? {})) {
    const where = `${file}: "${id}"`;
    const base = catalogue.items[id];
    if (!base && !(p.name && p.category && p.color)) errors.push(`${where} is not in produce.json, so it needs name, category and color`);
    if (p.category && !catalogue.categories[p.category]) errors.push(`${where} has unknown category "${p.category}"`);
    if (p.color && !isColor(p.color)) errors.push(`${where} has invalid color "${p.color}"`);
    for (const key of Object.keys(p)) {
      if (!MODES.includes(key) && !['name', 'category', 'color'].includes(key)) errors.push(`${where} has unknown key "${key}"`);
    }
    for (const key of MODES) {
      if (p[key] !== undefined && !isMonthList(p[key])) errors.push(`${where}.${key} must be a list of unique months 1–12`);
    }
    if (!MODES.some((m) => p[m]?.length)) errors.push(`${where} has no months`);
    for (const key of ['shoulder', 'extended']) {
      const overlap = (p.fresh ?? []).filter((m) => (p[key] ?? []).includes(m));
      if (overlap.length) errors.push(`${where} is both fresh and ${key} in month(s) ${overlap.join(', ')}`);
    }
  }

  if (entry.imports) {
    const imports = read(entry.imports);
    if (!imports) continue;
    checkSource(`${entry.imports}: source`, imports.source);
    for (const [id, row] of Object.entries(imports.items ?? {})) {
      const where = `${entry.imports}: "${id}"`;
      if (!catalogue.items[id]) errors.push(`${where} is not in produce.json`);
      if (!Array.isArray(row.t) || row.t.length !== 12 || row.t.some((t) => !(t >= 0))) errors.push(`${where}.t must be 12 tonnages`);
      if (!Array.isArray(row.from) || row.from.length !== 12) errors.push(`${where}.from must list origins for 12 months`);
      for (const month of row.from ?? []) {
        for (const [code, pct] of month) {
          if (!/^[A-Z]{2}$/.test(code) || !(pct > 0 && pct <= 100)) errors.push(`${where}.from has a bad entry ${JSON.stringify([code, pct])}`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in data/:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ data/ is valid (${codes.size} regions, ${Object.keys(catalogue.items).length} catalogue items, ${Object.keys(art ?? {}).length} plates)`);
