# Converts raw.json (from extract.py) into The Pass recipe library JSON.
import json, re, sys, unicodedata
raw = json.load(open(sys.argv[1])); OUT = sys.argv[2]; REPORT = sys.argv[3]

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')
def key(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()
def cap(s):
    s = s.strip()
    return s[:1].upper() + s[1:]

EXISTING = {  # file -> (app id, app name) for the five recipes already in the app
 'Lobster_Stock.xlsx': ('lobster-stock', 'Lobster stock'),
 'Clam_Chowder_Veloute.xlsx': ('clam-chowder-veloute', 'Clam chowder veloute'),
 'Lobster_and_shrimp_bolognese.xlsx': ('lobster-and-shrimp-bolognese', 'Lobster and shrimp bolognese'),
 'apple_cider-thyme_mignonette.xlsx': ('apple-cider-thyme-mignonette', 'Apple cider-thyme mignonette'),
 'Atomic_whipped_horseradish_cream.xlsx': ('atomic-whipped-horseradish-cream', 'Atomic whipped horseradish cream'),
}
ID_OVERRIDE = {
 'Lobster_Shell_Pangrattato.xlsx': 'lobster-shell-pangrattato',
 'Preserved_lemon_and_fennel_relish.xlsx': 'preserved-lemon-fennel-relish',
 'Pasta_Dough.xlsx': 'pasta-dough',
}
DISHES = {'Albondigas_Finished_Dish_Winter_26_27.xlsx','Butternut_Soup_Build.xlsx','Calamari_Dish_Build.xlsx','Deviled_Eggs_-_full_dish.xlsx',
 'Fig_Pumpkin_Burrata_Salad.xlsx','Oysters_Rockefeller_Build.xlsx','Provoleta_Dish_Build.xlsx','Salmon_Wellington_Entree_Build.xlsx',
 'Scallop_Entree_Build.xlsx','Spanish_Fried_Quail_One_Order.xlsx','Steakhouse_Wedge_Salad_Dish_Build.xlsx'}
STATION = {'garde': 'garde-manger', 'garde manger': 'garde-manger', 'grill': 'grill', 'fry': 'grill', 'saute': 'saute', 'sauté': 'saute', 'pastry': 'pastry', 'prep': 'prep'}

# Ingredient name (lowercased, before the first comma) -> recipe file it is made from.
REF = {
 'albondigas sauce': 'Albondigas_Sauce.xlsx', 'gf beef & pork albondigas': 'Albondigas_Meatballs_GF_Oatmeal.xlsx',
 'balsamic reduction': 'Balsamic_Vinegar_reduction.xlsx', 'house balsamic reduction': 'Balsamic_Vinegar_reduction.xlsx',
 'blackberry demi-glace': 'Blackberry_Demi_Glace.xlsx', 'butternut squash & feta tart': 'Scallop_Butternut_Feta_Tart.xlsx',
 'butternut squash puree': 'Scallop_Squash_Puree.xlsx', 'butternut squash soup': 'Butternut_Squash_Soup.xlsx',
 'caramelized miso aioli': 'Calamari_Caramelized_Miso_Aioli.xlsx', 'chicken flour seasoning': 'Chicken_Flour_Seasoning.xlsx',
 'chicken stock': 'Chicken_Stock.xlsx', 'chicken or vegetable stock': 'Chicken_Stock.xlsx',
 'clam chowder veloute': 'Clam_Chowder_Veloute.xlsx', 'cooked holy trinity': 'Scallop_Holy_Trinity.xlsx',
 'crispy caper & preserved lemon crumb': 'Caper_Preserved_Lemon_Crumb.xlsx', 'crispy sage leaves': 'Crispy_Sage_Leaves.xlsx',
 'creme fraiche ranch': 'ranch_dressing.xlsx', 'drained pickled mustard seeds': 'Pickled_Yellow_Mustard_Seeds.xlsx',
 'pickled yellow mustard seeds': 'Pickled_Yellow_Mustard_Seeds.xlsx', 'duck breast prosciutto': 'Duck_Breast_Prosciutto.xlsx',
 'feta custard': 'Scallop_Feta_Custard.xlsx', 'foie gras butter': 'Foie_Gras_Butter.xlsx',
 'house-made hot honey glaze': 'House_Made_Hot_Honey_Glaze.xlsx', 'house-made mole': 'Black_Cherry_Pepita_Black_Lime_Mole_1_Gallon.xlsx',
 'house-made pepper sauce': 'Beaver_Dam_Pepper_Sauce.xlsx', 'house-made tomato sauce': 'DOP_San_Marzano_Tomato_Sauce_2x10_Cans.xlsx',
 'individual salmon wellington': 'Salmon_Wellington_Individual.xlsx', 'lobster stock': 'Lobster_Stock.xlsx',
 'lobster-shell pangrattato (magic dust)': 'Lobster_Shell_Pangrattato.xlsx', 'marcona almond praline': 'Marcona_Almond_Praline.xlsx',
 'oven-roasted bacon crumbs': 'bacon_crumbs.xlsx', 'poached figs': 'Poached_Figs.xlsx',
 'preserved lemon & bacon butter': 'Oysters_Rockefeller_Bacon_Butter.xlsx', 'quick-pickled shishito peppers': 'Calamari_Pickled_Shishitos.xlsx',
 'red wine vinaigrette': 'Red_wine_vinaigrette.xlsx', 'rice paper & nori chips': 'Calamari_Rice_Paper_Nori_Chips.xlsx',
 'roasted butternut squash': 'Scallop_Roasted_Squash_Dice.xlsx', 'roasted garlic puree': 'Roasted_Garlic_Puree_.xlsx',
 'roasted pumpkin': 'Roasted_Pumpkin.xlsx', 'savory bacon-challah bread pudding': 'Savory_Bacon_Challah_Bread_Pudding.xlsx',
 'slow-roasted steakhouse tomatoes': 'Slow roasted steakhouse tomatoes.xlsx', 'spanish quail buttermilk brine': 'Spanish_Quail_Buttermilk_Brine.xlsx',
 'spinach & oyster mushroom duxelle': 'Spinach_Oyster_Mushroom_Duxelle.xlsx', 'togarashi flour dredge': 'Calamari_Togarashi_Flour.xlsx',
 'winter rockefeller filling': 'Oysters_Rockefeller_Filling.xlsx', 'yukon gold pommes puree': 'Yukon_Gold_Pommes_Puree.xlsx',
 'black garlic egg filling': 'black_garlic_deviled_egg_filling.xlsx',
}
# Links that are Claude's reading of the sheet, not written on it.
REF_GUESS = {'chicken or vegetable stock': 'Sheet says chicken or vegetable stock; linked to the house chicken stock.',
 'house-made pepper sauce': 'Linked to the Beaver Dam pepper sauce (the only house pepper sauce).',
 'house-made tomato sauce': 'Linked to the D.O.P. San Marzano sauce for winter; the farm heirloom sauce is the summer version.'}

ALIAS = {
 'a/p flour': 'All-purpose flour', 'ap flour': 'All-purpose flour', 'all-purpose flour': 'All-purpose flour',
 'bay leaves': 'Bay leaf', 'bay leaf': 'Bay leaf', 'black peppercorn': 'Black peppercorns', 'black peppercorns': 'Black peppercorns',
 'creme fraiche': 'Crème fraîche', 'egg yolk': 'Egg yolks', 'egg yolks': 'Egg yolks', 'eggs': 'Whole eggs', 'whole egg': 'Whole eggs', 'whole eggs': 'Whole eggs',
 'evoo': 'Extra virgin olive oil', 'extra virgin olive oil': 'Extra virgin olive oil', 'fennel': 'Fennel bulb', 'fennel fronds': 'Fennel frond',
 'fresh lemon juice': 'Lemon juice', 'fresh lemon zest': 'Lemon zest', 'fresh parsley': 'Parsley', 'parsley': 'Parsley', 'flat-leaf parsley': 'Parsley',
 'italian parsley': 'Parsley', 'fresh parsley leaves': 'Parsley', 'fresh thyme': 'Thyme', 'thyme': 'Thyme', 'fresh chives': 'Chives', 'minced chives': 'Chives',
 'chives': 'Chives', 'fresh dill': 'Dill', 'fresh dill fronds': 'Dill', 'fresh oregano': 'Oregano', 'fresh basil': 'Basil', 'fresh rosemary': 'Rosemary',
 'fresh sage': 'Sage', 'fresh sage leaves': 'Sage', 'fresh black pepper': 'Black pepper', 'cracked black pepper': 'Black pepper', 'garlic cloves': 'Garlic',
 'granulated sugar': 'Sugar', 'sugar': 'Sugar', 'heavy whipping cream': 'Heavy cream', 'fine kosher salt': 'Kosher salt',
 'panko bread crumbs': 'Panko breadcrumbs', 'panko breadcrumbs': 'Panko breadcrumbs', 'ruby port wine': 'Ruby port', 'shallots': 'Shallot',
 'worcestershire': 'Worcestershire sauce', 'cold unsalted butter': 'Unsalted butter', 'cold water': 'Water', 'roasted garlic puree': 'Roasted garlic purée',
 'dark aged miso (your product)': 'Dark aged miso', 'dijon mustard': 'Dijon mustard',
}
NO_SPLIT = {'cooked, peeled chestnuts': ('Chestnuts', 'cooked, peeled')}

def split_name(full):
    k = key(full)
    for ns, v in NO_SPLIT.items():
        if k == key(ns): return v
    depth = 0
    for i, ch in enumerate(full):
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        elif ch == ',' and depth == 0:
            return full[:i].strip(), full[i+1:].strip()
    return full.strip(), ''

def num(v):
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)): return float(v)
    if isinstance(v, str) and v.startswith('=') and re.fullmatch(r'=[\d\.\s\+\-\*/\(\)]+', v): return float(eval(v[1:]))
    return None

def parse_yield(t):
    if not t or not isinstance(t, str): return None
    s = t.replace(',', '').lower()
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*(kg|g)\b(?!\w)(\s*raw)?', s)
    if not m: return None
    if m.group(4) and not re.search(r'\(.*raw', s[m.start():]) and 'raw' in s[m.end()-4:m.end()+1]:
        return None
    if 'peppers plus' in s or 'leaves +' in s or 'raw duck' in s: return None
    a = float(m.group(1)); b = float(m.group(2)) if m.group(2) else a
    v = (a + b) / 2 * (1000 if m.group(3) == 'kg' else 1)
    # "8 QT - 7560 g": the grams are the second number
    m2 = re.search(r'qt\s*-\s*(\d+)\s*g', s)
    if m2: v = float(m2.group(1))
    # "800 - 1000 g"
    m3 = re.search(r'(\d+)\s*-\s*(\d+)\s*g', s)
    if m3 and not m2: v = (float(m3.group(1)) + float(m3.group(2))) / 2
    return round(v)

def shelf_days(t):
    if not isinstance(t, str): return None
    m = re.match(r'\s*(\d+)\s*(day|hour)', t.lower())
    if not m: return None
    n = int(m.group(1)); return n if m.group(2) == 'day' else max(1, round(n / 24))

def txt(v):
    if v is None: return ''
    if isinstance(v, float) and v.is_integer(): v = int(v)
    return str(v).strip()

ids = {}
for r in raw:
    f = r['file']
    ids[f] = EXISTING[f][0] if f in EXISTING else ID_OVERRIDE.get(f) or slug(r['name'])
assert len(set(ids.values())) == len(ids), 'duplicate ids'

lib, report = [], []
for r in raw:
    f = r['file']; rid = ids[f]; notes = []
    name = EXISTING[f][1] if f in EXISTING else cap(r['name'])
    is_dish = f in DISHES
    st_raw = [s.strip().lower() for s in re.split(r'[,/&]| and ', r['station'] or '') if s.strip()]
    stations = []
    for s in st_raw:
        if s in STATION and STATION[s] not in stations: stations.append(STATION[s])
        elif s not in STATION: notes.append(f'Unknown station "{s}"')
    drafts = [k for k in r['blue'] if k in ('category', 'station', 'batchYield', 'portion', 'storage', 'shelfLife', 'allergens', 'sub', 'name')]
    ingredients = []
    for i in r['ingredients']:
        base, prep = split_name(i['name'])
        k = key(base)
        unit = txt(i['unit']).lower()
        q = num(i['qty'])
        note_bits = [prep] if prep else []
        if txt(i['note']): note_bits.append(txt(i['note']))
        ing = {}
        ref = REF.get(k)
        if ref:
            ing['name'] = cap(base) if k not in ALIAS else ALIAS[k]
            ing['recipeRef'] = ids[ref]
        else:
            ing['name'] = ALIAS.get(k, cap(base))
        as_needed = None
        if unit in ('litre', 'liter', 'l'):
            if k in ('water', 'cold water'): q = q * 1000 if q is not None else None; unit = 'g'
            else: notes.append(f'{i["name"]}: litre kept as cups'); q = q * 4.22675 if q is not None else None; unit = 'cup'
        if unit == 'portion': unit = 'ea'
        if unit in ('to taste', 'as needed', 'light', 'seams only', '—', '-', ''):
            as_needed = txt(i['qty']) if isinstance(i['qty'], str) else unit if unit not in ('—', '-', '') else 'As needed'
            unit = 'g'; q = None
        if isinstance(i['qty'], str) and q is None and not as_needed: as_needed = txt(i['qty'])
        if q is None or q == 0:
            as_needed = cap(as_needed or ('to taste' if q == 0 else 'amount not set'))
            if as_needed == 'Amount not set': notes.append(f'{i["name"]}: no quantity on the sheet')
            q = 0
        if unit not in ('g', 'lb', 'ea', 'cup', 'tbsp', 'tsp'):
            notes.append(f'{i["name"]}: unit "{unit}" not supported'); unit = 'g'
        ing['qty'] = round(q, 4); ing['unit'] = unit
        if as_needed: ing['asNeeded'] = as_needed
        if note_bits: ing['note'] = '; '.join(note_bits)
        if i['blue']: ing['draft'] = True
        if k in REF_GUESS:
            ing['draft'] = True; ing['note'] = '; '.join(filter(None, [ing.get('note'), REF_GUESS[k]]))
        ingredients.append(ing)
    steps = []
    for s in r['steps']:
        m = num(s['min'])
        st = {'name': s['text'], 'type': 'passive' if txt(s['type']).lower().startswith('p') else 'active', 'duration_minutes': m if m is not None else 0}
        if s['blue']: st['draft'] = True
        if m is None: notes.append(f'Step "{s["text"][:40]}…" has no minutes')
        steps.append(st)
    if not steps: notes.append('No method steps on the sheet')
    rec = {'id': rid, 'name': name, 'isSubRecipe': not is_dish, 'kind': 'dish' if is_dish else 'prep', 'stations': stations,
           'ingredients': ingredients, 'steps': steps}
    y = parse_yield(r['batchYield'])
    if y and not is_dish: rec['yieldGrams'] = y
    for fld, v in [('category', r['category']), ('yieldText', r['batchYield']), ('portion', r['portion']), ('storage', r['storage']), ('shelfLife', r['shelfLife'])]:
        if txt(v): rec[fld] = txt(v)
    pn = num(r['portions'])
    if pn: rec['portions'] = round(pn, 2)
    sd = shelf_days(r['shelfLife'])
    if sd: rec['shelfLifeDays'] = sd
    rec['allergens'] = r['allergens']
    if txt(r['plating']):
        rec['plating'] = txt(r['plating'])
        if r['platingBlue']: rec['platingDraft'] = True
    if r['hasServiceware']:
        rec['serviceware'] = {'plate': '', 'liner': '', 'vessels': '', 'utensils': ''}
    rename = {'batchYield': 'yieldText'}
    rec['drafts'] = sorted(set(rename.get(d, d) for d in drafts))
    rec['source'] = {'sheet': f, 'rev': txt(r['rev']), 'createdBy': txt(r['createdBy'])}
    if notes: rec['needsReview'] = notes
    lib.append(rec)
    report.append((name, rid, stations, len(ingredients), len(steps), notes))

# dishes first in the file? keep sub-recipes first then dishes, each alphabetical
lib.sort(key=lambda x: (x['kind'] == 'dish', x['name'].lower()))
json.dump(lib, open(OUT, 'w'), indent=1, ensure_ascii=False)
for row in report: print(row)
json.dump(report, open(REPORT, 'w'), indent=1, ensure_ascii=False)
