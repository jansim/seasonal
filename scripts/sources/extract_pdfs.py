#!/usr/bin/env python3
"""Turn the printed seasonal calendars we rely on into plain month lists.

Each calendar is a vector PDF, so instead of reading the charts by eye we read
the drawing instructions: the coloured cells, bars and icons, and where they sit
relative to the month headers and row labels.

    pip install pymupdf
    python3 scripts/sources/extract_pdfs.py verbraucherzentrale saisonkalender_poster_a3.pdf
    python3 scripts/sources/extract_pdfs.py testaankoop groenten-en-fruitkalendernl.pdf
    python3 scripts/sources/extract_pdfs.py umweltberatung lebensmittel-saisonkalender100.pdf

Output goes to scripts/sources/extracted/<name>.json. Download URLs are in README.md.
"""
import collections
import json
import pathlib
import sys

import pymupdf

OUT = pathlib.Path(__file__).parent / 'extracted'


def write(name, rows):
    """One row per line, so diffs stay readable."""
    OUT.mkdir(exist_ok=True)
    body = ',\n'.join(f' {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in rows.items())
    (OUT / f'{name}.json').write_text('{\n' + body + '\n}\n')
    print(f'{name}: {len(rows)} rows -> {OUT / (name + ".json")}')


def rgb(d, key):
    return tuple(round(x, 2) for x in (d.get(key) or ()))


def verbraucherzentrale(path):
    """'Heimisches Obst und Gemüse – Wann gibt es was?' (Verbraucherzentralen, 6th ed. 2022).

    Cells are filled rectangles: green = open field, red = heated glasshouse,
    yellow = one of covered / unheated glasshouse / storage, told apart by the icon
    drawn inside (tunnel, house or crate). Split cells hold two half-width rects.
    """
    green, yellow, red = (0.4, 0.76, 0.55), (1.0, 0.92, 0.37), (0.91, 0.4, 0.33)
    page = pymupdf.open(path)[0]
    drawings = page.get_drawings()
    cells = [d for d in drawings if rgb(d, 'fill') in (green, yellow, red) and d['rect'].y0 < 1000]
    strokes = [d for d in drawings if not d.get('fill')]

    def kind(d):
        if rgb(d, 'fill') == green:
            return 'field'
        if rgb(d, 'fill') == red:
            return 'heated'
        r = d['rect']
        centre = lambda s: pymupdf.Point((s['rect'].x0 + s['rect'].x1) / 2, (s['rect'].y0 + s['rect'].y1) / 2)
        ops = collections.Counter(it[0] for s in strokes if r.contains(centre(s)) for it in s['items'])
        if ops.get('re'):
            return 'stored'        # crate
        if ops.get('l', 0) >= 4:
            return 'greenhouse'    # unheated or lightly heated glasshouse
        return 'covered'           # foil tunnel or fleece

    months = ['Jan.', 'Feb.', 'März', 'April', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.']
    words = page.get_text('words')
    heads = [w for w in words if w[4] in months]
    labels = []
    lines = collections.defaultdict(list)
    for w in words:
        if w[4] not in months:
            lines[(w[5], w[6])].append(w)
    for ws in lines.values():
        labels.append({'text': ' '.join(w[4] for w in ws), 'x0': min(w[0] for w in ws), 'x1': max(w[2] for w in ws),
                       'y': (min(w[1] for w in ws) + max(w[3] for w in ws)) / 2})

    def month(r):
        cx = (r.x0 + r.x1) / 2
        return months.index(min(heads, key=lambda h: abs((h[0] + h[2]) / 2 - cx))[4]) + 1

    def label(r):
        cy = (r.y0 + r.y1) / 2
        left = r.x1 < 420  # vegetables on the left with labels before the cells; the rest labelled on the right
        near = [l for l in labels if (l['x1'] < 110 if left else l['x0'] > 708) and abs(l['y'] - cy) < 9]
        return ' '.join(l['text'] for l in sorted(near, key=lambda l: l['y'])).replace('ﬁ ', 'fi').replace('ﬀ ', 'ff') or None

    out = collections.defaultdict(lambda: collections.defaultdict(set))
    for d in cells:
        name = label(d['rect'])
        if name:
            out[name][kind(d)].add(month(d['rect']))
    return out


def testaankoop(path):
    """'Groenten- en fruitkalender (Belgische productie)' (Test-Aankoop).

    Dark green (vegetables) or orange (fruit) lines mark the original season;
    white pills mark the extended season (heated glasshouse or long cold storage).
    """
    page = pymupdf.open(path)[0]
    words = page.get_text('words')
    names = ['JAN', 'FEB', 'MAA', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
    centres = [(w[0] + w[2]) / 2 for w in sorted((w for w in words if w[4] in names and w[1] < 100), key=lambda w: w[0])]
    lines = collections.defaultdict(list)
    for w in words:
        if w[0] < 190 and w[4] not in names and 60 < w[1] < 1280:
            lines[(w[5], w[6])].append(w)
    labels = [{'text': ' '.join(x[4] for x in ws), 'y': (min(x[1] for x in ws) + max(x[3] for x in ws)) / 2} for ws in lines.values()]

    # Later shapes are drawn over earlier ones; where a white pill covers a line, the pill is what readers see.
    seen = collections.defaultdict(dict)
    for d in page.get_drawings():
        r = d['rect']
        if not 60 < r.y0 < 1280 or r.width <= 5:
            continue
        if d['type'] == 's' and rgb(d, 'color') in ((0.0, 0.44, 0.26), (0.95, 0.39, 0.19)):
            kind = 'original'
        elif d['type'] == 'f' and rgb(d, 'fill') == (1.0, 1.0, 1.0) and r.height < 10:
            kind = 'extended'
        else:
            continue
        y = (r.y0 + r.y1) / 2
        best = min(labels, key=lambda l: abs(l['y'] - y))
        if abs(best['y'] - y) < 9:
            for i, c in enumerate(centres):
                if r.x0 - 2 <= c <= r.x1 + 2:
                    seen[best['text']][i + 1] = kind
    out = collections.defaultdict(lambda: collections.defaultdict(set))
    for name, months in seen.items():
        for month, kind in months.items():
            out[name][kind].add(month)
    return out


def umweltberatung(path):
    """'Gemüse & Obst der Saison' (ORF / Mutter Erde, data: DIE UMWELTBERATUNG, 2018).

    Cells are raster colour: red = ripe in Austria, green = Austrian storage.
    We sample the colour at every month/row intersection.
    """
    months = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    zoom = 3
    out = collections.defaultdict(lambda: collections.defaultdict(set))
    for page in pymupdf.open(path):
        words = page.get_text('words')
        heads = {w[4]: (w[0] + w[2]) / 2 for w in words if w[4] in months}
        xs = [heads[m] for m in months]
        right = max(xs) + 14
        lines = collections.defaultdict(list)
        for w in words:
            if right + 15 < w[0] < right + 120 and w[1] > 60:
                lines[(w[5], w[6])].append(w)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        for ws in lines.values():
            name = ' '.join(w[4] for w in ws)
            y = (min(w[1] for w in ws) + max(w[3] for w in ws)) / 2
            for i, x in enumerate(xs):
                r, g, b = pix.pixel(int(x * zoom), int(y * zoom))[:3]
                if r > 150 and g < 90:
                    out[name]['fresh'].add(i + 1)
                elif g > 150 and r < 170 and b < 190:
                    out[name]['stored'].add(i + 1)
    return {k: v for k, v in out.items() if v}


if __name__ == '__main__':
    name, path = sys.argv[1], sys.argv[2]
    data = globals()[name](path)
    write(name, {k: {kk: sorted(vv) for kk, vv in sorted(v.items())} for k, v in sorted(data.items())})
