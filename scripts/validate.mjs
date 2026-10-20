#!/usr/bin/env node
// Checks the JSON data files. No dependencies: `node scripts/validate.mjs`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'data');
const errors = [];
const read = (file) => {
  try {
    return JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (err) {
    errors.push(`${file}: ${err.message}`);
    return null;
  }
};
const isMonthList = (v) => Array.isArray(v) && v.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)
  && new Set(v).size === v.length;
const isColor = (v) => /^#[0-9a-f]{6}$/i.test(v);

const catalogue = read('produce.json');
const countries = read('countries.json');

if (catalogue) {
  for (const [id, item] of Object.entries(catalogue.items)) {
    if (!item.name) errors.push(`produce.json: "${id}" has no name`);
    if (!catalogue.categories[item.category]) errors.push(`produce.json: "${id}" has unknown category "${item.category}"`);
    if (!isColor(item.color)) errors.push(`produce.json: "${id}" has invalid color "${item.color}"`);
  }
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
  for (const [id, p] of Object.entries(country.produce ?? {})) {
    const where = `${file}: "${id}"`;
    const base = catalogue.items[id];
    if (!base && !(p.name && p.category && p.color)) errors.push(`${where} is not in produce.json, so it needs name, category and color`);
    if (p.category && !catalogue.categories[p.category]) errors.push(`${where} has unknown category "${p.category}"`);
    if (p.color && !isColor(p.color)) errors.push(`${where} has invalid color "${p.color}"`);
    for (const key of ['fresh', 'stored']) {
      if (p[key] !== undefined && !isMonthList(p[key])) errors.push(`${where}.${key} must be a list of unique months 1–12`);
    }
    if (!p.fresh?.length && !p.stored?.length) errors.push(`${where} has no months`);
    const overlap = (p.fresh ?? []).filter((m) => (p.stored ?? []).includes(m));
    if (overlap.length) errors.push(`${where} is both fresh and stored in month(s) ${overlap.join(', ')}`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in data/:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ data/ is valid (${codes.size} countries, ${Object.keys(catalogue.items).length} catalogue items)`);
