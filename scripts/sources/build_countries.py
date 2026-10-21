#!/usr/bin/env python3
"""Build data/produce.json and data/countries/*.json from the extracted sources.

    python3 scripts/sources/build_countries.py

Reads scripts/sources/extracted/*.json (see extract_pdfs.py and fetch_web.py) and
maps each source's own names and categories onto the shared catalogue below.
Everything a source does not cover is left out rather than guessed.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = pathlib.Path(__file__).parent / 'extracted'
ALL = list(range(1, 13))

# id: (name, category, colour, scientific name)
CATALOGUE = {
    # fruit
    'rhubarb':        ('Rhubarb', 'fruit', '#C4506B', 'Rheum × hybridum'),
    'strawberries':   ('Strawberries', 'fruit', '#C8372F', 'Fragaria × ananassa'),
    'gooseberries':   ('Gooseberries', 'fruit', '#97A94E', 'Ribes uva-crispa'),
    'currants':       ('Currants', 'fruit', '#8C2340', 'Ribes rubrum, R. nigrum'),
    'cherries':       ('Cherries', 'fruit', '#8E1B30', 'Prunus avium'),
    'sour-cherries':  ('Sour cherries', 'fruit', '#B5303B', 'Prunus cerasus'),
    'raspberries':    ('Raspberries', 'fruit', '#C23E66', 'Rubus idaeus'),
    'blackberries':   ('Blackberries', 'fruit', '#40284A', 'Rubus fruticosus'),
    'blueberries':    ('Blueberries', 'fruit', '#475E99', 'Vaccinium corymbosum'),
    'apricots':       ('Apricots', 'fruit', '#E0953A', 'Prunus armeniaca'),
    'peaches':        ('Peaches & nectarines', 'fruit', '#E4825A', 'Prunus persica'),
    'plums':          ('Plums', 'fruit', '#673A78', 'Prunus domestica'),
    'melons':         ('Melons', 'fruit', '#D3AD4B', 'Cucumis melo'),
    'watermelons':    ('Watermelons', 'fruit', '#D9645F', 'Citrullus lanatus'),
    'figs':           ('Figs', 'fruit', '#77496A', 'Ficus carica'),
    'grapes':         ('Grapes', 'fruit', '#8768AB', 'Vitis vinifera'),
    'pears':          ('Pears', 'fruit', '#B3A33A', 'Pyrus communis'),
    'apples':         ('Apples', 'fruit', '#7C9F35', 'Malus domestica'),
    'quinces':        ('Quinces', 'fruit', '#D5AF33', 'Cydonia oblonga'),
    'cranberries':    ('Cranberries', 'fruit', '#A1233A', 'Vaccinium macrocarpon'),
    'kiwis':          ('Kiwifruit', 'fruit', '#86773E', 'Actinidia deliciosa'),
    'persimmons':     ('Persimmons', 'fruit', '#DC7430', 'Diospyros kaki'),
    'pomegranates':   ('Pomegranates', 'fruit', '#A52A3E', 'Punica granatum'),
    'oranges':        ('Oranges', 'fruit', '#E8771F', 'Citrus sinensis'),
    'mandarins':      ('Mandarins', 'fruit', '#EE8E2E', 'Citrus reticulata'),
    'lemons':         ('Lemons', 'fruit', '#DDBE35', 'Citrus limon'),
    'mangoes':        ('Mangoes', 'fruit', '#EBA233', 'Mangifera indica'),
    'avocados':       ('Avocados', 'fruit', '#56693A', 'Persea americana'),
    'feijoas':        ('Feijoas', 'fruit', '#6E8B3D', 'Acca sellowiana'),
    'passionfruit':   ('Passionfruit', 'fruit', '#6B3B5E', 'Passiflora edulis'),
    'bananas':        ('Bananas', 'fruit', '#E1C34A', 'Musa acuminata'),
    'chestnuts':      ('Chestnuts', 'fruit', '#7A4A2B', 'Castanea sativa'),
    'hazelnuts':      ('Hazelnuts', 'fruit', '#A0784A', 'Corylus avellana'),
    'walnuts':        ('Walnuts', 'fruit', '#8A6C4A', 'Juglans regia'),
    # vegetables
    'asparagus':      ('Asparagus', 'vegetables', '#91A64A', 'Asparagus officinalis'),
    'radishes':       ('Radishes', 'vegetables', '#D45E78', 'Raphanus sativus'),
    'spinach':        ('Spinach', 'vegetables', '#2F6B44', 'Spinacia oleracea'),
    'lettuce':        ('Lettuce', 'vegetables', '#86B857', 'Lactuca sativa'),
    'lambs-lettuce':  ("Lamb's lettuce", 'vegetables', '#4A8739', 'Valerianella locusta'),
    'rocket':         ('Rocket', 'vegetables', '#5C8838', 'Eruca vesicaria'),
    'endive':         ('Endive', 'vegetables', '#A3C25E', 'Cichorium endivia'),
    'chicory':        ('Chicory', 'vegetables', '#D8CB92', 'Cichorium intybus var. foliosum'),
    'radicchio':      ('Radicchio', 'vegetables', '#8B2848', 'Cichorium intybus'),
    'peas':           ('Peas', 'vegetables', '#79B24C', 'Pisum sativum'),
    'broad-beans':    ('Broad beans', 'vegetables', '#9DB35C', 'Vicia faba'),
    'green-beans':    ('Green beans', 'vegetables', '#589244', 'Phaseolus vulgaris'),
    'tomatoes':       ('Tomatoes', 'vegetables', '#D4412A', 'Solanum lycopersicum'),
    'cucumbers':      ('Cucumbers', 'vegetables', '#3C7A48', 'Cucumis sativus'),
    'zucchini':       ('Zucchini', 'vegetables', '#3A6B39', 'Cucurbita pepo'),
    'aubergines':     ('Aubergines', 'vegetables', '#4A2D58', 'Solanum melongena'),
    'peppers':        ('Peppers', 'vegetables', '#CC662C', 'Capsicum annuum'),
    'sweetcorn':      ('Sweetcorn', 'vegetables', '#DDB23B', 'Zea mays'),
    'artichokes':     ('Artichokes', 'vegetables', '#6C8768', 'Cynara cardunculus var. scolymus'),
    'cauliflower':    ('Cauliflower', 'vegetables', '#BFAF88', 'Brassica oleracea var. botrytis'),
    'broccoli':       ('Broccoli', 'vegetables', '#3E6C4E', 'Brassica oleracea var. italica'),
    'cabbage':        ('Cabbage', 'vegetables', '#98B085', 'Brassica oleracea var. capitata'),
    'chinese-cabbage': ('Chinese cabbage', 'vegetables', '#C4CF87', 'Brassica rapa subsp. pekinensis'),
    'kohlrabi':       ('Kohlrabi', 'vegetables', '#94A96A', 'Brassica oleracea var. gongylodes'),
    'brussels-sprouts': ('Brussels sprouts', 'vegetables', '#557F30', 'Brassica oleracea var. gemmifera'),
    'kale':           ('Kale', 'vegetables', '#2D5853', 'Brassica oleracea var. sabellica'),
    'chard':          ('Chard', 'vegetables', '#9A384C', 'Beta vulgaris subsp. vulgaris'),
    'fennel':         ('Fennel', 'vegetables', '#C2CB86', 'Foeniculum vulgare'),
    'celery':         ('Celery', 'vegetables', '#9DBE67', 'Apium graveolens var. dulce'),
    'leeks':          ('Leeks', 'vegetables', '#8EB46C', 'Allium porrum'),
    'onions':         ('Onions', 'vegetables', '#B5874C', 'Allium cepa'),
    'garlic':         ('Garlic', 'vegetables', '#C6B89C', 'Allium sativum'),
    'carrots':        ('Carrots', 'vegetables', '#E4722A', 'Daucus carota'),
    'beetroot':       ('Beetroot', 'vegetables', '#7C1C46', 'Beta vulgaris'),
    'celeriac':       ('Celeriac', 'vegetables', '#AFA077', 'Apium graveolens var. rapaceum'),
    'parsnips':       ('Parsnips', 'vegetables', '#D3BE87', 'Pastinaca sativa'),
    'turnips':        ('Turnips', 'vegetables', '#B993B6', 'Brassica rapa subsp. rapa'),
    'swede':          ('Swede', 'vegetables', '#B6975A', 'Brassica napus var. napobrassica'),
    'salsify':        ('Salsify', 'vegetables', '#4B3B31', 'Scorzonera hispanica'),
    'jerusalem-artichoke': ('Jerusalem artichoke', 'vegetables', '#9E774F', 'Helianthus tuberosus'),
    'potatoes':       ('Potatoes', 'vegetables', '#AD854D', 'Solanum tuberosum'),
    'pumpkins':       ('Pumpkins & squash', 'vegetables', '#D5611B', 'Cucurbita maxima, C. moschata'),
    'mushrooms':      ('Mushrooms', 'vegetables', '#A39580', 'Agaricus bisporus'),
}


def load(name):
    return json.loads((SRC / f'{name}.json').read_text())


def union(*lists):
    return sorted(set().union(*[set(x or []) for x in lists]))


def put(out, item, **modes):
    """Merge month lists into out[item], dropping empty modes."""
    entry = out.setdefault(item, {})
    for mode, months in modes.items():
        months = union(entry.get(mode), months)
        if months:
            entry[mode] = months


def tidy(entry):
    """Shoulder and extended months are, by definition, outside the main season."""
    for mode in ('shoulder', 'extended'):
        if mode in entry:
            entry[mode] = [m for m in entry[mode] if m not in entry.get('fresh', [])]
            if not entry[mode]:
                del entry[mode]
    order = ['fresh', 'shoulder', 'covered', 'heated', 'extended', 'stored']
    return {k: entry[k] for k in order if k in entry}


# ---------- Germany: Verbraucherzentrale ----------

def germany():
    src = load('verbraucherzentrale')
    names = {
        'Äpfel': 'apples', 'Aprikosen': 'apricots', 'Birnen': 'pears', 'Brombeeren': 'blackberries',
        'Erdbeeren': 'strawberries', 'Heidelbeeren': 'blueberries', 'Himbeeren': 'raspberries',
        'Johannisbeeren': 'currants', 'Kirschen, sauer': 'sour-cherries', 'Kirschen, süß': 'cherries',
        'Mirabellen/Renekloden': 'plums', 'Pflaumen/Zwetschgen': 'plums', 'Pfirsiche/Nektarinen': 'peaches',
        'Quitten': 'quinces', 'Stachelbeeren': 'gooseberries', 'Tafeltrauben': 'grapes',
        'Auberginen': 'aubergines', 'Blumenkohl': 'cauliflower', 'Bohnen (Busch-, Stangenbohnen)': 'green-beans',
        'Brokkoli': 'broccoli', 'Chinakohl': 'chinese-cabbage', 'Dicke Bohnen (Acker-, Saubohnen)': 'broad-beans',
        'Erbsen, Zuckererbsen': 'peas', 'Fenchel': 'fennel', 'Grünkohl': 'kale',
        'Gurken (Salat-, Minigurken)': 'cucumbers', 'Gurken (Einlege-, Schälgurken)': 'cucumbers',
        'Kartoffeln': 'potatoes', 'Knoblauch': 'garlic', 'Kohlrabi': 'kohlrabi',
        'Kopfkohl (Rot-, Weiß-, Wirsingkohl)': 'cabbage', 'Kürbis': 'pumpkins', 'Möhren': 'carrots',
        'Mangold': 'chard', 'Pastinaken, Wurzelpetersilie': 'parsnips', 'Paprika': 'peppers',
        'Porree (Lauch)': 'leeks', 'Radieschen': 'radishes', 'Rhabarber': 'rhubarb', 'Rosenkohl': 'brussels-sprouts',
        'Rote Beete': 'beetroot', 'Schwarzwurzel': 'salsify', 'Sellerie, Knollensellerie': 'celeriac',
        'Sellerie, Stangensellerie': 'celery', 'Spargel': 'asparagus', 'Speiserüben (Mai-, Herbst rüben)': 'turnips',
        'Spinat': 'spinach', 'Steckrüben (Kohlrüben)': 'swede', 'Tomaten: geschützter Anbau': 'tomatoes',
        'Tomaten: Gewächshaus': 'tomatoes', 'Topinambur': 'jerusalem-artichoke', 'Zucchini': 'zucchini',
        'Zuckermais': 'sweetcorn', 'Zwiebeln': 'onions', 'Kopfsalat, bunte Salate': 'lettuce',
        'Endiviensalat': 'endive', 'Feldsalat': 'lambs-lettuce', 'Radicchio': 'radicchio', 'Rucola (Rauke)': 'rocket',
    }
    out = {}
    for label, item in names.items():
        row = src[label]
        # The poster's middle tier mixes foil/fleece cover and unheated or lightly heated glass;
        # it rates both as low-to-medium climate impact, so they share one mode here.
        put(out, item, fresh=row.get('field'), covered=union(row.get('covered'), row.get('greenhouse')),
            heated=row.get('heated'), stored=row.get('stored'))
    return {
        'note': 'Produce grown in Germany, by growing method. Timing shifts by region and weather.',
        'modeLabels': {'fresh': 'Open field', 'covered': 'Under cover or unheated glass'},
        'sources': [{
            'title': 'Heimisches Obst und Gemüse – Wann gibt es was?',
            'cite': 'Verbraucherzentralen 2022',
            'publisher': 'Verbraucherzentralen, with the Leibniz Institute of Vegetable and Ornamental Crops (IGZ) and the University of Bonn',
            'year': 2022,
            'url': 'https://www.verbraucherzentrale-bawue.de/sites/default/files/2023-02/saisonkalender_poster_a3.pdf',
            'covers': 'Local harvest, by open field, cover (foil, fleece or unheated glass), heated glass and storage',
        }],
        'produce': out,
    }


# ---------- Austria: DIE UMWELTBERATUNG via ORF ----------

def austria():
    src = load('umweltberatung')
    names = {
        'Äpfel': 'apples', 'Birnen': 'pears', 'Broccoli': 'broccoli', 'Brombeeren': 'blackberries',
        'Chinakohl': 'chinese-cabbage', 'Endivien': 'endive', 'Erbsen': 'peas', 'Erdäpfel': 'potatoes',
        'Erdbeeren': 'strawberries', 'Feldgurken': 'cucumbers', 'Fenchel': 'fennel', 'Fisolen': 'green-beans',
        'Häuptelsalat': 'lettuce', 'Heidelbeere': 'blueberries', 'Himbeeren': 'raspberries', 'Karfiol': 'cauliflower',
        'Karotte': 'carrots', 'Kirschen': 'cherries', 'Knoblauch': 'garlic', 'Kohl': 'cabbage', 'Kraut': 'cabbage',
        'Kohlrabi': 'kohlrabi', 'Kohlsprossen': 'brussels-sprouts', 'Kürbis': 'pumpkins', 'Mais': 'sweetcorn',
        'Mangold': 'chard', 'Marillen': 'apricots', 'Melanzani': 'aubergines', 'Paprika': 'peppers',
        'Pastinaken': 'parsnips', 'Pfirsiche': 'peaches', 'Porree': 'leeks', 'Quitten': 'quinces',
        'Radicchio': 'radicchio', 'Radieschen': 'radishes', 'Ribiseln': 'currants', 'Rote Rüben': 'beetroot',
        'Sellerie': 'celeriac', 'Spargel': 'asparagus', 'Spinat': 'spinach', 'Stangensellerie': 'celery',
        'Tomaten': 'tomatoes', 'Vogerlsalat': 'lambs-lettuce', 'Weintrauben': 'grapes', 'Zwiebel': 'onions',
        'Zucchini': 'zucchini', 'Zwetschken': 'plums',
    }
    out = {}
    for label, item in names.items():
        row = src[label]
        put(out, item, fresh=row.get('fresh'), stored=row.get('stored'))
    for entry in out.values():  # where Kohl and Kraut disagree, fresh wins
        if 'stored' in entry:
            entry['stored'] = [m for m in entry['stored'] if m not in entry.get('fresh', [])]
    return {
        'note': 'Produce ripe in Austria, and Austrian produce from storage.',
        'modeLabels': {'fresh': 'Ripe in Austria'},
        'sources': [{
            'title': 'Gemüse & Obst der Saison',
            'cite': 'DIE UMWELTBERATUNG 2018',
            'publisher': 'ORF / Mutter Erde, data from DIE UMWELTBERATUNG',
            'year': 2018,
            'url': 'https://extra.orf.at/rezepte/schmeckt-perfekt/lebensmittel-saisonkalender100.pdf',
            'covers': 'Local harvest and storage',
        }],
        'produce': out,
    }


# ---------- Belgium: Test-Aankoop ----------

def belgium():
    src = load('testaankoop')
    names = {
        'aardappel': 'potatoes', 'aardpeer': 'jerusalem-artichoke', 'andijvie': 'endive', 'asperge': 'asparagus',
        'aubergine': 'aubergines', 'bleekselder': 'celery', 'bloemkool': 'cauliflower', 'boerenkool': 'kale',
        '(prinsessen)boontjes': 'green-beans', 'broccoli': 'broccoli', 'champignon': 'mushrooms',
        'Chinese kool': 'chinese-cabbage', 'courgette': 'zucchini', 'knolselder': 'celeriac', 'komkommer': 'cucumbers',
        'koolrabi': 'kohlrabi', 'paprika': 'peppers', 'pastinaak': 'parsnips', 'peultjes': 'peas', 'pompoen': 'pumpkins',
        'prei': 'leeks', 'raap': 'turnips', 'rabarber': 'rhubarb', 'radijs': 'radishes', 'rode biet': 'beetroot',
        'rode kool': 'cabbage', 'witte kool': 'cabbage', 'savooikool': 'cabbage', 'schorseneer': 'salsify',
        'sla': 'lettuce', 'snijbiet of warmoes': 'chard', 'spinazie': 'spinach', 'spruit': 'brussels-sprouts',
        'tomaat': 'tomatoes', 'ui': 'onions', 'veldsla': 'lambs-lettuce', 'venkel': 'fennel', 'witlof': 'chicory',
        'appel': 'apples', 'bes, rood': 'currants', 'bes, zwart': 'currants', 'bes, blauw': 'blueberries',
        'braam': 'blackberries', 'druif': 'grapes', 'framboos': 'raspberries', 'kers': 'cherries',
        'kriek': 'sour-cherries', 'kruisbes': 'gooseberries', 'peer': 'pears', 'pruim': 'plums', 'aardbei': 'strawberries',
    }
    out = {}
    for label, item in names.items():
        row = src[label]
        put(out, item, fresh=row.get('original'), extended=row.get('extended'))
    # Bunched carrots are the fresh crop; 'bewaarwortel' is the storage carrot.
    put(out, 'carrots', fresh=src['busselwortel']['original'])
    put(out, 'carrots', stored=[m for m in src['bewaarwortel']['original'] if m not in src['busselwortel']['original']])
    return {
        'note': 'Belgian production. The extended season is when a crop is grown in heated glasshouses or kept in long cold storage.',
        'modeLabels': {'fresh': 'Original season', 'extended': 'Extended season'},
        'sources': [{
            'title': 'Groenten- en fruitkalender (Belgische productie)',
            'cite': 'Test-Aankoop',
            'publisher': 'Test-Aankoop / Test-Achats',
            'url': 'https://www.test-aankoop.be/-/media/hline/images/home/food%20and%20nutrition/healthy-food/fruits-and-vegetables-calendar/groenten-en-fruitkalendernl.pdf',
            'covers': 'Original season (field or cold glass) and extended season (heated glass or cold store)',
        }],
        'produce': out,
    }


# ---------- France: ADEME Impact CO2 ----------

def france():
    src = load('impactco2')
    names = {
        'abricot': 'apricots', 'cassis': 'currants', 'groseille': 'currants', 'cerise': 'cherries', 'citron': 'lemons',
        'clementine': 'mandarins', 'mandarine': 'mandarins', 'coing': 'quinces', 'figue': 'figs', 'fraise': 'strawberries',
        'framboise': 'raspberries', 'grenade': 'pomegranates', 'kaki': 'persimmons', 'kiwi': 'kiwis', 'melon': 'melons',
        'mure': 'blackberries', 'myrtille': 'blueberries', 'nectarine': 'peaches', 'peche': 'peaches', 'orange': 'oranges',
        'pasteque': 'watermelons', 'poire': 'pears', 'pomme': 'apples', 'prune': 'plums', 'reineclaude': 'plums',
        'raisin': 'grapes', 'rhubarbe': 'rhubarb', 'chataigne': 'chestnuts', 'noisette': 'hazelnuts', 'noix': 'walnuts',
        'ail': 'garlic', 'artichaut': 'artichokes', 'asperge': 'asparagus', 'aubergine': 'aubergines',
        'betterave': 'beetroot', 'blette': 'chard', 'brocoli': 'broccoli', 'carotte': 'carrots', 'celeri': 'celeriac',
        'chou': 'cabbage', 'choudebruxelles': 'brussels-sprouts', 'choufleur': 'cauliflower', 'concombre': 'cucumbers',
        'courge': 'pumpkins', 'potiron': 'pumpkins', 'courgette': 'zucchini', 'endive': 'chicory', 'epinard': 'spinach',
        'fenouil': 'fennel', 'haricotvert': 'green-beans', 'laitue': 'lettuce', 'mache': 'lambs-lettuce', 'navet': 'turnips',
        'oignon': 'onions', 'panais': 'parsnips', 'petitpois': 'peas', 'poireau': 'leeks', 'poivron': 'peppers',
        'radis': 'radishes', 'salsifis': 'salsify', 'tomate': 'tomatoes', 'topinambour': 'jerusalem-artichoke',
        'mais': 'sweetcorn',
    }
    out = {}
    for slug, item in names.items():
        put(out, item, fresh=src[slug]['fresh'])
    return {
        'note': 'Months each product counts as in season in France. Months from storage are not marked separately. Tropical imports listed all year by the source are left out.',
        'sources': [{
            'title': 'Fruits et légumes de saison (Impact CO₂ API)',
            'cite': 'ADEME Impact CO₂',
            'publisher': 'ADEME',
            'url': 'https://impactco2.fr/outils/fruitsetlegumes',
            'licence': 'Licence Ouverte 2.0',
            'covers': 'In-season months',
        }],
        'produce': out,
    }


# ---------- United Kingdom: BBC Good Food ----------

def uk():
    src = load('bbcgoodfood')
    names = {
        'apple': 'apples', 'bramley apple': 'apples', 'asparagus': 'asparagus', 'aubergine': 'aubergines',
        'beetroot': 'beetroot', 'blackberry': 'blackberries', 'blackcurrants': 'currants', 'redcurrant': 'currants',
        'broad bean': 'broad-beans', 'broccoli': 'broccoli', 'brussels sprouts': 'brussels-sprouts', 'cabbage': 'cabbage',
        'carrot': 'carrots', 'cauliflower': 'cauliflower', 'celeriac': 'celeriac', 'celery': 'celery', 'cherry': 'cherries',
        'chestnut': 'chestnuts', 'chicory': 'chicory', 'courgette': 'zucchini', 'cranberry': 'cranberries',
        'damson': 'plums', 'plum': 'plums', 'fennel bulb': 'fennel', 'garlic': 'garlic', 'globe artichoke': 'artichokes',
        'gooseberry': 'gooseberries', 'jerusalem artichoke': 'jerusalem-artichoke', 'kale': 'kale', 'kohlrabi': 'kohlrabi',
        "lamb's lettuce": 'lambs-lettuce', 'leek': 'leeks', 'lettuce': 'lettuce', 'onion': 'onions', 'parsnip': 'parsnips',
        'pear': 'pears', 'peas': 'peas', 'pepper': 'peppers', 'potato': 'potatoes', 'new potatoes': 'potatoes',
        'pumpkin': 'pumpkins', 'quince': 'quinces', 'radicchio': 'radicchio', 'radish': 'radishes',
        'raspberry': 'raspberries', 'rhubarb': 'rhubarb', 'runner bean': 'green-beans', 'salsify': 'salsify',
        'spinach': 'spinach', 'strawberry': 'strawberries', 'swede': 'swede', 'sweetcorn': 'sweetcorn',
        'swiss chard': 'chard', 'tomato': 'tomatoes', 'turnip': 'turnips',
    }
    out = {}
    for label, item in names.items():
        row = src[label]
        put(out, item, fresh=row['best'], shoulder=row['coming'])
    return {
        'note': 'Crops grown commercially in the UK. BBC Good Food also lists imported fruit (citrus, bananas, pomegranates, stone fruit), which is left out here.',
        'modeLabels': {'fresh': 'In season', 'shoulder': 'Coming into season'},
        'sources': [{
            'title': 'Seasonal calendar',
            'cite': 'BBC Good Food',
            'publisher': 'BBC Good Food',
            'url': 'https://www.bbcgoodfood.com/seasonal-calendar/all',
            'covers': 'In season and coming into season',
        }],
        'produce': out,
    }


# ---------- Canada (Ontario): Foodland Ontario ----------

def ontario():
    src = load('foodland')
    fresh = {
        'Apples': 'apples', 'Apricots': 'apricots', 'Blueberries': 'blueberries', 'Cherries': 'cherries',
        'Cranberries': 'cranberries', 'Currants': 'currants', 'Gooseberries': 'gooseberries', 'Grapes': 'grapes',
        'Muskmelon': 'melons', 'Nectarines': 'peaches', 'Peaches': 'peaches', 'Pears': 'pears', 'Plums': 'plums',
        'Raspberries': 'raspberries', 'Rhubarb': 'rhubarb', 'Strawberries (Field)': 'strawberries',
        'Watermelon': 'watermelons', 'Artichoke': 'artichokes', 'Asparagus': 'asparagus',
        'Beans (Green/Yellow)': 'green-beans', 'Beets': 'beetroot', 'Broccoli': 'broccoli',
        'Brussels Sprouts': 'brussels-sprouts', 'Cabbage': 'cabbage', 'Carrots': 'carrots', 'Cauliflower': 'cauliflower',
        'Celery': 'celery', 'Corn': 'sweetcorn', 'Cucumber (Field)': 'cucumbers', 'Eggplant': 'aubergines',
        'Garlic': 'garlic', 'Kale': 'kale', 'Leeks': 'leeks', 'Lettuce (Assorted)': 'lettuce', 'Mushrooms': 'mushrooms',
        'Nappa Cabbage': 'chinese-cabbage', 'Onions (Cooking)': 'onions', 'Parsnip': 'parsnips', 'Peas (Green)': 'peas',
        'Peppers (Field)': 'peppers', 'Potatoes': 'potatoes', 'Pumpkin': 'pumpkins', 'Winter Squash': 'pumpkins',
        'Radicchio': 'radicchio', 'Radishes': 'radishes', 'Rutabaga': 'swede', 'Spinach': 'spinach',
        'Summer Squash': 'zucchini', 'Zucchini': 'zucchini', 'Tomatoes (Field)': 'tomatoes',
    }
    heated = {
        'Rhubarb (Forced)': 'rhubarb', 'Strawberries (Greenhouse)': 'strawberries',
        'Cucumber (Greenhouse)': 'cucumbers', 'Lettuce (Greenhouse)': 'lettuce', 'Peppers (Greenhouse)': 'peppers',
        'Tomatoes (Greenhouse)': 'tomatoes',
    }
    out = {}
    for label, item in fresh.items():
        put(out, item, fresh=src[label]['available'])
    for label, item in heated.items():
        put(out, item, heated=src[label]['available'])
    return {
        'name': 'Canada (Ontario)',
        'note': 'When Ontario produce is available to buy. Availability includes produce from Ontario storage, which the source does not mark separately.',
        'modeLabels': {'fresh': 'Available', 'heated': 'Greenhouse'},
        'sources': [{
            'title': 'Foodland Ontario fruits and vegetables availability guide',
            'cite': 'Foodland Ontario',
            'publisher': 'Ontario Ministry of Agriculture, Food and Agribusiness',
            'url': 'https://data.ontario.ca/dataset/foodland-ontario-fruits-and-vegetables-availability-guide',
            'licence': 'Open Government Licence – Ontario',
            'covers': 'Available months, field and greenhouse',
        }],
        'produce': out,
    }


# ---------- Australia: Sustainable Table ----------

def australia():
    src = load('sustainabletable')
    names = {
        'apple': 'apples', 'apricot': 'apricots', 'avocado': 'avocados', 'asian greens avocado': 'avocados',
        'banana': 'bananas', 'blackberries': 'blackberries', 'blueberries': 'blueberries',
        'blueberries (start of nov.)': 'blueberries', 'cherries': 'cherries', 'cherry': 'cherries', 'currants': 'currants',
        'feijoa': 'feijoas', 'fig': 'figs', 'grapes': 'grapes', 'kiwi fruit': 'kiwis', 'lemon': 'lemons',
        'mandarin': 'mandarins', 'mango': 'mangoes', 'cantaloupe': 'melons', 'honeydew': 'melons',
        'nectarine': 'peaches', 'peach': 'peaches', 'orange': 'oranges', 'passionfruit': 'passionfruit',
        'pear': 'pears', 'persimmon': 'persimmons', 'plum': 'plums', 'pomegranate': 'pomegranates', 'quince': 'quinces',
        'raspberries': 'raspberries', 'rhubarb': 'rhubarb', 'strawberries': 'strawberries', 'watermelon': 'watermelons',
        'artichoke': 'artichokes', 'artichokes': 'artichokes', 'asparagus': 'asparagus', 'beans': 'green-beans',
        'beetroot': 'beetroot', 'broad beans': 'broad-beans', 'broccoli': 'broccoli', 'brussels sprouts': 'brussels-sprouts',
        'cabbage': 'cabbage', 'capsicum': 'peppers', 'carrot': 'carrots', 'cauliflower': 'cauliflower',
        'celeriac': 'celeriac', 'celery': 'celery', 'corn': 'sweetcorn', 'cucumber': 'cucumbers', 'cucumbers': 'cucumbers',
        'eggplant': 'aubergines', 'eggplants': 'aubergines', 'fennel': 'fennel', 'kale': 'kale', 'kohlrabi': 'kohlrabi',
        'leek': 'leeks', 'lettuce': 'lettuce', 'mushrooms': 'mushrooms', 'onion': 'onions', 'parsnip': 'parsnips',
        'peas': 'peas', 'snow peas': 'peas', 'potato': 'potatoes', 'pumpkin': 'pumpkins', 'squash': 'pumpkins',
        'radish': 'radishes', 'silverbeet': 'chard', 'spinach': 'spinach', 'swede': 'swede', 'tomato': 'tomatoes',
        'turnip': 'turnips', 'witlof': 'chicory', 'zucchini': 'zucchini',
    }
    out = {}
    for label, item in names.items():
        put(out, item, fresh=src[label]['fresh'])
    return {
        'note': 'Australia-wide, listed by season, so each season appears as a three-month block. Local timing varies a lot between states.',
        'resolution': 'season',
        'sources': [{
            'title': 'Seasonal Produce Guide',
            'cite': 'Sustainable Table 2023',
            'publisher': 'Sustainable Table',
            'year': 2023,
            'url': 'https://www.sustainabletable.org.au/all-things-ethical-eating/seasonal-produce-guide/',
            'covers': 'Produce in season, by season',
        }],
        'produce': out,
    }


COUNTRIES = [
    ('de', 'Germany', 'north', germany),
    ('at', 'Austria', 'north', austria),
    ('be', 'Belgium', 'north', belgium),
    ('fr', 'France', 'north', france),
    ('gb', 'United Kingdom', 'north', uk),
    ('ca-on', 'Canada (Ontario)', 'north', ontario),
    ('au', 'Australia', 'south', australia),
]


def dump(obj):
    """Readable JSON: one produce item per line."""
    head = {k: v for k, v in obj.items() if k != 'produce'}
    text = json.dumps(head, ensure_ascii=False, indent=2)[:-2]
    rows = ',\n'.join(f'    {json.dumps(k)}: {json.dumps(v)}' for k, v in obj['produce'].items())
    return f'{text},\n  "produce": {{\n{rows}\n  }}\n}}\n'


def main():
    order = list(CATALOGUE)
    produce = {
        'categories': {'fruit': {'name': 'Fruit'}, 'vegetables': {'name': 'Vegetables'}},
        'items': {k: {'name': n, 'category': c, 'color': col, 'latin': lat} for k, (n, c, col, lat) in CATALOGUE.items()},
    }
    lines = ',\n'.join(f'    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in produce['items'].items())
    (ROOT / 'data/produce.json').write_text(
        '{\n  "categories": ' + json.dumps(produce['categories']) + ',\n  "items": {\n' + lines + '\n  }\n}\n')

    index = []
    for code, name, hemisphere, build in COUNTRIES:
        data = build()
        unknown = set(data['produce']) - set(CATALOGUE)
        assert not unknown, f'{code}: not in catalogue: {unknown}'
        produce_rows = {k: tidy(v) for k, v in sorted(data.pop('produce').items(), key=lambda kv: order.index(kv[0]))}
        doc = {'code': code, 'name': data.pop('name', name), 'hemisphere': hemisphere, **data, 'produce': produce_rows}
        (ROOT / f'data/countries/{code}.json').write_text(dump(doc))
        entry = {'code': code, 'name': doc['name'], 'file': f'countries/{code}.json'}
        if (ROOT / f'data/imports/{code}.json').exists():
            entry['imports'] = f'imports/{code}.json'
        index.append(entry)
        print(f'{code}: {len(produce_rows)} items')
    (ROOT / 'data/countries.json').write_text(
        '[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in index) + '\n]\n')


if __name__ == '__main__':
    main()
