#!/usr/bin/env python3
"""Cut the USDA pomological watercolours out of their paper and write img/plates/*.webp + data/art.json.

    pip install onnxruntime pillow numpy
    python3 scripts/art/build_art.py --model birefnet.onnx --metadata pom_metadata.csv --cache ./scans
    python3 scripts/art/build_art.py --thumbs     # just the small row thumbnails

Inputs, fetched once and kept in --cache so repeat runs never touch the network:
  * pom_metadata.csv  https://archive.org/download/usda_pomological_watercolors_20200211/pom_metadata.csv
  * scans             https://archive.org/download/usda-pomological-watercolor-collection/<id>.jpg
  * BiRefNet (MIT)    https://huggingface.co/onnx-community/BiRefNet-ONNX (onnx/model.onnx)

Downloads run one at a time with a pause in between; please keep it that way. The model's mask is
saved next to each scan (<id>.mask.png), so later runs only redo the cheap steps.
The model needs a few GB of memory; on a small machine run one plate at a time with --only.
"""
import argparse
import csv
import json
import pathlib
import time
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'img' / 'plates'
SIZE = 1024          # BiRefNet input
MAX_SIDE = 640       # exported plate size (shown at up to 320 CSS px)
THUMB_SIDE = 64      # row thumbnails, shown at up to 32 CSS px

# Catalogue item -> NAL identifier. Picked by eye for a clear, typical specimen that the painter's
# ruled frame or the sheet edge doesn't cut off (a cut twig or stalk end is fine).
PLATES = {
    'apples': 'POM00002053', 'pears': 'POM00006915', 'plums': 'POM00004918', 'cherries': 'POM00004671',
    'sour-cherries': 'POM00004432', 'peaches': 'POM00005228', 'grapes': 'POM00006020',
    'strawberries': 'POM00004312', 'oranges': 'POM00000339', 'mandarins': 'POM00006387',
    'lemons': 'POM00006422', 'persimmons': 'POM00001225', 'mangoes': 'POM00004494',
    'avocados': 'POM00004572', 'currants': 'POM00007150', 'gooseberries': 'POM00007152',
    'raspberries': 'POM00000866', 'blackberries': 'POM00007351', 'blueberries': 'POM00006846',
    'cranberries': 'POM00007174', 'melons': 'POM00007426', 'watermelons': 'POM00007419',
    'figs': 'POM00007441', 'quinces': 'POM00001288', 'pomegranates': 'POM00007501', 'kiwis': 'POM00007367',
    'feijoas': 'POM00007438', 'passionfruit': 'POM00007354', 'bananas': 'POM00000787',
    'chestnuts': 'POM00000125', 'hazelnuts': 'POM00007423', 'walnuts': 'POM00007473',
    'aubergines': 'POM00007167',
}
# The collection files these red currant varieties under gooseberries.
SUBJECT = {'currants': 'red currant'}


def fetch(url, path):
    if path.exists() and path.stat().st_size:
        return path
    req = urllib.request.Request(url, headers={'User-Agent': 'seasonal-calendar (https://github.com/jansim/seasonal)'})
    path.write_bytes(urllib.request.urlopen(req, timeout=300).read())
    time.sleep(3)
    return path


def mask(session, im):
    x = np.asarray(im.convert('RGB').resize((SIZE, SIZE), Image.BICUBIC), dtype=np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    out = session.run(None, {session.get_inputs()[0].name: x})[-1][0, 0]
    m = 1 / (1 + np.exp(-out))
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC), dtype=np.float32) / 255


def keep_main(alpha):
    """Drop specks (pencil notes, stamps) far smaller than the painting itself."""
    solid = alpha > 0.5
    h, w = solid.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    # small images by now, so a plain flood fill is fast enough
    for y0, x0 in zip(*np.nonzero(solid)):
        if labels[y0, x0]:
            continue
        n = len(sizes)
        stack, count = [(y0, x0)], 0
        labels[y0, x0] = n
        while stack:
            y, x = stack.pop()
            count += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and solid[yy, xx] and not labels[yy, xx]:
                    labels[yy, xx] = n
                    stack.append((yy, xx))
        sizes.append(count)
    big = max(sizes)
    keep = np.isin(labels, [i for i, s in enumerate(sizes) if i and s >= big * 0.02])
    # keep the soft edge around kept parts, drop everything around removed ones
    grown = np.asarray(Image.fromarray(keep.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    return alpha * grown


def soften(x, r):
    """A box blur run three times (close to a Gaussian), for float arrays."""
    for _ in range(3):
        for axis in (0, 1):
            pad = [(r + 1, r) if i == axis else (0, 0) for i in range(x.ndim)]
            c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis)
            n = x.shape[axis]
            x = (np.take(c, np.arange(2 * r + 1, n + 2 * r + 1), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)
    return x


def cutout(src, session):
    """`session` is a function returning the model, so cached masks never load it."""
    im = Image.open(src).convert('RGB')
    im.thumbnail((2000, 2000), Image.LANCZOS)
    cached = src.with_name(src.stem + '.mask.png')
    if cached.exists() and Image.open(cached).size == im.size:
        a = np.asarray(Image.open(cached), dtype=np.float32) / 255
    else:
        a = mask(session(), im)
        Image.fromarray((a * 255).round().astype(np.uint8)).save(cached)
    rgb = np.asarray(im, dtype=np.float32)
    # Paper colour: median of what the model calls background.
    paper = np.median(rgb[a < 0.05], axis=0)
    small = Image.fromarray((a * 255).astype(np.uint8))
    small.thumbnail((700, 700))
    a_small = keep_main(np.asarray(small, dtype=np.float32) / 255)
    a = np.minimum(a, np.asarray(Image.fromarray((a_small > 0.01).astype(np.uint8) * 255).resize(im.size), dtype=np.float32) / 255)
    # Soft edges: where the mask is confident, un-mix the paper so no cream halo is left; fainter
    # pixels take the colour of the paint beside them, so paper and cast shadows can't turn into grey ghosts.
    solid = (a > 0.9).astype(np.float32)
    weight = soften(solid, 6)
    beside = soften(rgb * solid[..., None], 6) / np.maximum(weight, 1e-4)[..., None]
    beside = np.where((weight > 1e-3)[..., None], beside, rgb)
    unmixed = np.clip((rgb - (1 - a)[..., None] * paper) / np.maximum(a, 1e-3)[..., None], 0, 255)
    trust = np.clip((a - 0.25) / 0.5, 0, 1)[..., None]
    rgb = np.where((a < 0.98)[..., None], trust * unmixed + (1 - trust) * beside, rgb)
    a[a < 0.02] = 0
    out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA')
    box = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = 12
    out = out.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(out.width, box[2] + pad), min(out.height, box[3] + pad)))
    out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return out


def write_thumb(item):
    """A small copy for the timeline rows, so the list doesn't load every full plate."""
    img = Image.open(OUT / f'{item}.webp')
    img.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
    (OUT / 'small').mkdir(exist_ok=True)
    img.save(OUT / 'small' / f'{item}.webp', 'WEBP', quality=82, method=6)
    return f'img/plates/small/{item}.webp'


def artist(name):
    """'Passmore, Deborah Griscom, 1840-1911' -> ('Deborah Griscom Passmore', '1840-1911')."""
    parts = [p.strip() for p in name.split(',')]
    dates = parts.pop() if parts and any(c.isdigit() for c in parts[-1]) else ''
    if len(parts) >= 2:
        return f'{parts[1]} {parts[0]}', dates.replace('-', '–')
    return (parts[0] if parts else ''), dates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model')
    ap.add_argument('--metadata')
    ap.add_argument('--cache')
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--thumbs', action='store_true', help='only redo the small row thumbnails from existing plates')
    args = ap.parse_args()
    credits_path = ROOT / 'data' / 'art.json'

    def save(credits):
        body = ',\n'.join(f'  {json.dumps(k)}: {json.dumps(credits[k], ensure_ascii=False)}' for k in PLATES if k in credits)
        credits_path.write_text('{\n' + body + '\n}\n')

    if args.thumbs:
        credits = json.loads(credits_path.read_text())
        for item in credits:
            credits[item]['thumb'] = write_thumb(item)
        save(credits)
        return
    if not (args.model and args.metadata and args.cache):
        ap.error('--model, --metadata and --cache are needed to cut out plates')

    model = {}

    def session():
        if 'session' not in model:  # loaded on first use: cached masks don't need it
            import onnxruntime
            opts = onnxruntime.SessionOptions()
            opts.enable_cpu_mem_arena = False  # the 1024² model otherwise holds on to several GB between images
            opts.enable_mem_pattern = False
            model['session'] = onnxruntime.InferenceSession(args.model, opts, providers=['CPUExecutionProvider'])
        return model['session']

    meta = {r['id']: r for r in csv.DictReader(open(args.metadata, encoding='utf-8'))}
    cache = pathlib.Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    credits = json.loads(credits_path.read_text()) if credits_path.exists() else {}

    for item, pid in PLATES.items():
        if args.only and item not in args.only:
            continue
        scan = fetch(f'https://archive.org/download/usda-pomological-watercolor-collection/{pid}.jpg', cache / f'{pid}.jpg')
        img = cutout(scan, session)
        img.save(OUT / f'{item}.webp', 'WEBP', quality=80, method=6)
        r = meta[pid]
        name, dates = artist(r['artist'].split(' , ')[0])
        credits[item] = {
            'id': pid,
            'file': f'img/plates/{item}.webp',
            'thumb': write_thumb(item),
            'width': img.width,
            'height': img.height,
            'artist': name,
            'artistDates': dates,
            'year': r['year'] or None,
            'variety': r['variety'] or None,
            'subject': SUBJECT.get(item, r['common_name']),
            'scientific': r['sci_name'],
            'origin': r['geo_origin'] or None,
        }
        print(f'{item:14} {pid} {img.width}x{img.height} {name} {r["year"]}', flush=True)
        save(credits)


if __name__ == '__main__':
    main()
