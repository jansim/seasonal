#!/usr/bin/env python3
"""Fetch the web-published seasonal sources into plain month lists.

    pip install openpyxl     # only needed for `foodland`
    python3 scripts/sources/fetch_web.py impactco2 bbcgoodfood foodland sustainabletable

Output goes to scripts/sources/extracted/<name>.json. See README.md for what each source covers.
"""
import html
import io
import json
import re
import sys
import time
import urllib.request

from extract_pdfs import write

UA = {'User-Agent': 'seasonal-calendar data import (https://github.com/jansim/seasonal)'}


def get(url):
    time.sleep(1)  # be gentle with the publishers' servers
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def text(raw):
    s = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw.decode('utf-8', 'replace'), flags=re.S)
    s = html.unescape(re.sub(r'<[^>]+>', '\n', s))
    return '\n'.join(line.strip() for line in s.split('\n') if line.strip())


def split_list(s):
    return [x.strip().rstrip('.').strip() for x in re.split(r'[,.]\s+|,\s*', s) if x.strip()]


def impactco2():
    """ADEME Impact CO2 'Fruits et légumes de saison' API (France). Months each product is in season."""
    rows = {}
    for m in range(1, 13):
        for item in json.loads(get(f'https://impactco2.fr/api/v1/fruitsetlegumes?month={m}'))['data']:
            rows[item['slug']] = {'name': item['name'], 'category': item['category'], 'fresh': item['months']}
    return dict(sorted(rows.items()))


def bbcgoodfood():
    """BBC Good Food seasonal calendar (UK). Each month is marked 'best' (in season) or 'coming' (coming into season)."""
    raw = get('https://www.bbcgoodfood.com/seasonal-calendar/all').decode('utf-8', 'replace')
    keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec']
    dec = json.JSONDecoder()
    rows = {}
    for m in re.finditer(r'"rows":\[', raw):
        for row in dec.raw_decode(raw, m.end() - 1)[0]:
            if row.get('foodtype') not in ('Fruit', 'Veg'):
                continue
            name = html.unescape(re.sub(r'<[^>]+>', '', row['ingredient'])).strip()
            marks = {k: (re.findall(r'alt="([^"]*)"', row.get(k, '')) or [''])[0] for k in keys}
            rows[name.lower()] = {
                'category': row['foodtype'],
                'best': [i + 1 for i, k in enumerate(keys) if marks[k].startswith('best')],
                'coming': [i + 1 for i, k in enumerate(keys) if marks[k] == 'coming'],
            }
    return dict(sorted(rows.items()))


def foodland():
    """Foodland Ontario availability guide, Ontario Data Catalogue (Open Government Licence – Ontario)."""
    import openpyxl
    base = 'https://data.ontario.ca/dataset/d7b3123b-ccc7-4cd2-ac7b-82717cf6da18/resource'
    files = {
        'fruit': f'{base}/a1ee172c-9571-4b8a-b31c-96b59a1176ca/download/foodland_ontario_availability_guide-fruits_en.xlsx',
        'vegetables': f'{base}/b8f9333b-527b-43b0-a0b0-fb976a33251e/download/foodland_ontario_availability_guide-vegetables_en.xlsx',
    }
    rows = {}
    for category, url in files.items():
        sheet = openpyxl.load_workbook(io.BytesIO(get(url)), data_only=True).worksheets[0]
        for row in list(sheet.iter_rows(values_only=True))[1:]:
            if row[0]:
                rows[row[0].replace('\xa0', ' ').strip()] = {'available': [m + 1 for m, v in enumerate(row[1:13]) if v == 1]}
    return dict(sorted(rows.items()))


def sustainabletable():
    """Sustainable Table 'Seasonal Produce Guide' (Australia), listed by season."""
    page = text(get('https://www.sustainabletable.org.au/all-things-ethical-eating/seasonal-produce-guide/'))
    seasons = {'Summer': [12, 1, 2], 'Autumn': [3, 4, 5], 'Winter': [6, 7, 8], 'Spring': [9, 10, 11]}
    rows = {}
    for season, months in seasons.items():
        block = page.split(f'\n{season}\nFruits\n', 1)[1]
        fruit_line = block.split('\n', 1)[0]
        veg_line = block.split('\nVegetables\n', 1)[1].split('\n', 1)[0]
        for kind, line in (('fruit', fruit_line), ('vegetables', veg_line)):
            for name in split_list(line.replace('*', '')):
                entry = rows.setdefault(name.lower(), {'fresh': []})
                entry['fresh'] = sorted(set(entry['fresh']) | set(months))
    return dict(sorted(rows.items()))


if __name__ == '__main__':
    for name in sys.argv[1:]:
        write(name, globals()[name]())
