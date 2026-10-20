# seasonal

A calendar with information on seasonal produce.

An interactive, printable seasonal fruit & vegetable calendar with two views:

- **Timeline**: one row per item, with rounded bars across Jan–Dec.
- **Half-year arch**: one concentric ring per item, with Jan on the left and Dec on the right.

You can switch country, filter by category, search, sort, show or hide produce from storage, step through months (or click a month in either chart), and hover over an item to highlight it. The URL keeps the current state, so any view can be shared.

**Print / export** opens a page preview (A4, A3 or Letter, in landscape or portrait). From there you can print or save as PDF, and download the arch as SVG or the current data as CSV. Printing straight from the browser (Ctrl/Cmd + P) uses the same print layout.

## Stack

Plain HTML, CSS and JavaScript modules. There is no build step and nothing to install.

```
index.html
css/style.css
js/app.js        state, controls, print/export
js/timeline.js   timeline view
js/arch.js       arch view (SVG)
js/data.js       loading + month maths
data/            JSON data (see below)
scripts/validate.mjs
```

Run it locally with any static server, for example:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

### Deployment

`.github/workflows/deploy.yml` validates the data and deploys the site to GitHub Pages on every push to `main`. Pull requests only get the validation step. To turn it on, go to the repo's **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

## Data

All data is plain JSON in `data/`. Months are numbers from `1` (Jan) to `12` (Dec). Runs that cross the new year (e.g. `[11, 12, 1, 2]`) are handled automatically.

**`data/produce.json`** is the shared catalogue: categories, plus a display name, category and colour for each item.

```json
{
  "categories": { "fruit": { "name": "Fruit" }, "vegetables": { "name": "Vegetables" } },
  "items": {
    "apples": { "name": "Apples", "category": "fruit", "color": "#7EAA2F" }
  }
}
```

**`data/countries.json`** lists the countries in the picker:

```json
[{ "code": "de", "name": "Germany", "file": "countries/de.json" }]
```

**`data/countries/<code>.json`** holds the months for each item in that country:

```json
{
  "code": "de",
  "name": "Germany",
  "hemisphere": "north",
  "note": "Shown in the footer.",
  "produce": {
    "apples": { "fresh": [8, 9, 10, 11], "stored": [12, 1, 2, 3, 4] },
    "zucchini": { "name": "Courgettes", "fresh": [6, 7, 8, 9] },
    "feijoa": { "name": "Feijoa", "category": "fruit", "color": "#6E8B3D", "fresh": [3, 4, 5] }
  }
}
```

- `fresh` and `stored` are both optional, but each item needs at least one of them. The same month can't be in both.
- A country can override `name`, `category` or `color` for an item (e.g. "Courgettes" in the UK). It can also add items that aren't in the catalogue, as long as it gives all three.
- `hemisphere` (`north`/`south`) sets the season bands and the order used by "by season" sorting. You can also give an explicit `seasons` array (`[{ "name": "Winter", "months": [12, 1, 2] }, …]`) or a `yearStart` month.

### Adding a country

1. Create `data/countries/<code>.json`.
2. Add it to `data/countries.json`.
3. Run `node scripts/validate.mjs`.

The site picks a default country from the browser language (e.g. `en-GB` gives the United Kingdom). You can also link to one directly with `?country=<code>`.

The bundled seasons are typical averages. They vary by region and year.
