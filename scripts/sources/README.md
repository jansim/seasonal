# Where the data comes from

Every region's calendar is taken from one published source for that region, and
nothing is filled in from elsewhere. These scripts turn each source into plain month
lists (`extracted/*.json`), then `build_countries.py` maps them onto the shared
catalogue and writes `data/countries/*.json`.

The extracted files are committed, so the build runs offline:

```sh
python3 scripts/sources/build_countries.py
```

Re-extract only when a source publishes a new edition. The fetchers send one request
at a time with a pause in between, and they need to run only rarely.

| Region | Source | What it covers | How it is read |
|---|---|---|---|
| Germany | Verbraucherzentralen, *Heimisches Obst und Gemüse – Wann gibt es was?*, 6th ed. 2022, compiled with the Leibniz Institute of Vegetable and Ornamental Crops (IGZ) and the University of Bonn. [PDF](https://www.verbraucherzentrale-bawue.de/sites/default/files/2023-02/saisonkalender_poster_a3.pdf) | Open field, cover (foil, fleece, unheated glass), heated glass, storage | `extract_pdfs.py verbraucherzentrale`: cell colours, plus the icon drawn inside the yellow cells |
| Austria | ORF / Mutter Erde, *Gemüse & Obst der Saison*, data from DIE UMWELTBERATUNG, 2018. [PDF](https://extra.orf.at/rezepte/schmeckt-perfekt/lebensmittel-saisonkalender100.pdf) | Ripe in Austria, Austrian storage | `extract_pdfs.py umweltberatung`: samples the colour of each cell |
| Belgium | Test-Aankoop, *Groenten- en fruitkalender (Belgische productie)*. [PDF](https://www.test-aankoop.be/-/media/hline/images/home/food%20and%20nutrition/healthy-food/fruits-and-vegetables-calendar/groenten-en-fruitkalendernl.pdf) | Original season, extended season (heated glass or long cold storage) | `extract_pdfs.py testaankoop`: the drawn season lines |
| France | ADEME, *Fruits et légumes de saison*, [Impact CO₂ API](https://impactco2.fr/outils/fruitsetlegumes), Licence Ouverte 2.0 | In-season months | `fetch_web.py impactco2` |
| United Kingdom | BBC Good Food, [seasonal calendar](https://www.bbcgoodfood.com/seasonal-calendar/all) | In season, coming into season | `fetch_web.py bbcgoodfood`, from the table embedded in the page |
| Canada (Ontario) | Ontario Ministry of Agriculture, Food and Agribusiness, [Foodland Ontario availability guide](https://data.ontario.ca/dataset/foodland-ontario-fruits-and-vegetables-availability-guide), Open Government Licence – Ontario | Available months, field and greenhouse | `fetch_web.py foodland`, from the published spreadsheets |
| Australia | Sustainable Table, [Seasonal Produce Guide](https://www.sustainabletable.org.au/all-things-ethical-eating/seasonal-produce-guide/), 2023 | In season, by season (three-month blocks) | `fetch_web.py sustainabletable` |

The PDFs are not stored here. Download them from the links above and pass the file path:

```sh
pip install pymupdf openpyxl
python3 scripts/sources/extract_pdfs.py verbraucherzentrale saisonkalender_poster_a3.pdf
python3 scripts/sources/fetch_web.py impactco2 bbcgoodfood foodland sustainabletable
```

## Choices made while mapping

- Sources name produce differently. `build_countries.py` holds an explicit name map per
  source, and merges a few rows that the catalogue treats as one item: plums with
  mirabelles and greengages, red with black currants, red with white and savoy cabbage.
  Herbs and less common crops are left out.
- **Germany**: the poster's middle tier mixes foil or fleece cover with unheated or lightly
  heated glass. It rates both as low-to-medium climate impact, so both become `covered`.
- **Belgium**: the bunched carrot ("busselwortel") is the fresh crop. The storage carrot
  ("bewaarwortel") counts as `stored` in the months the fresh crop is absent.
- **France**: ADEME lists tropical imports (bananas, pineapple, mango and the like) as in
  season all year. They are left out, because the calendar is about local production.
- **United Kingdom**: BBC Good Food also covers imported fruit (citrus, bananas,
  pomegranates, stone fruit, dates). Only crops grown commercially in the UK are kept.
- **Ontario** and **France** don't mark storage separately, so stored apples, onions and
  potatoes count as in season. The region notes on the site say so.

## Imports

`scripts/build-imports.mjs` reads monthly import volumes from
[Eurostat Comext](https://ec.europa.eu/eurostat/comext/newxtweb/) (dataset DS-045409,
CC BY 4.0) for Germany, Austria, Belgium and France, and from
[HMRC Overseas Trade Statistics](https://www.uktradeinfo.com/trade-data/) (Open Government
Licence v3.0) for the UK. It averages 2023–2025 per calendar month and keeps the three main
origins per month. Some trade codes cover more than one product; they are listed in the script.
