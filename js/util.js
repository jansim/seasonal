const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

let regions;
/** 'ES' -> 'Spain', using the browser's own country names. */
export function regionName(code) {
  try {
    regions ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 67535 -> '68,000 t', 812 -> '810 t', rounded to two significant figures. */
export function tonnes(t) {
  if (!t) return '0 t';
  const digits = Math.max(0, Math.floor(Math.log10(t)) - 1);
  const rounded = Math.round(t / 10 ** digits) * 10 ** digits;
  return `${rounded.toLocaleString('en-GB')} t`;
}

/** ['a', 'b', 'c'] -> 'a, b and c'. */
export function sentence(list) {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
