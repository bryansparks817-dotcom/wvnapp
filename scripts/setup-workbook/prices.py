"""Ingredient prices ($/kg) for The Pass, from the Wandering Vine inventory sheet.

Usage: python3 prices.py <inventory.xlsx> <catalog.py> <recipeLibrary.json[,builtInRecipesV1.json]> <out.json>
Each inventory product with a case cost and case weight gives $/kg = cost / (lb x 0.4536).
The price goes on every recipe ingredient name the catalog maps to that product.
"""
import json, re, sys, openpyxl
inv, cat, lib, out = sys.argv[1:5]
ns = {}; exec(open(cat).read(), ns)
alias = {p: keys for rows in ns['CAT'].values() for p, keys in rows}
names = {}
def walk(r):
    for i in r.get('ingredients') or []:
        if i.get('name') and not i.get('recipeRef'): names.setdefault(i['name'].strip().lower(), i['name'].strip())
for f in lib.split(','):
    for r in json.load(open(f)): walk(r)
# Recipe names the inventory catalog doesn't list yet (built-in recipes and
# small spelling differences).
EXTRA = {'Basil': ['basil'], 'Dill': ['dill'], 'Oregano, fresh': ['oregano'], 'Rosemary': ['rosemary'], 'Sage': ['sage'],
         'Thyme': ['thyme', 'fresh thyme sprigs'], 'All-purpose flour': ['all-purpose flour'],
         'Masa harina, GF': ['certified gluten-free masa harina'], 'Panko': ['panko breadcrumbs'], 'Puff pastry': ['puff pastry sheet'],
         'Butter, unsalted': ['butter', 'cold butter'], 'Yellow onions': ['onion'], 'Heavy cream': ['heavy cream'],
         'Parmigiano-Reggiano': ['parmigiano-reggiano'], 'Lemons': ['lemon juice']}
for p, ks in EXTRA.items(): alias[p] = list(dict.fromkeys(alias.get(p, []) + ks))
ws = openpyxl.load_workbook(inv, data_only=True).active
prices, src, unmatched = {}, {}, []
for row in ws.iter_rows(min_row=7, values_only=True):
    prod, vendor, size, lb, _y, _u, cost = row[:7]
    if prod not in alias or not isinstance(cost, (int, float)) or not isinstance(lb, (int, float)) or lb <= 0: continue
    per_kg = round(cost / (lb * 0.45359237), 2)
    hit = [k for k in alias[prod] if k in names]
    if not hit: unmatched.append(prod); continue
    for k in hit:
        prices[k] = per_kg; src[k] = f"{prod} · {vendor or 'recipe sheet'} · ${cost:,.2f} / {size}"
json.dump({'prices': dict(sorted(prices.items())), 'source': dict(sorted(src.items()))}, open(out, 'w'), indent=1, ensure_ascii=False)
print(len(prices), 'ingredient prices;', len(names), 'raw ingredient names in the library; products with a price but no recipe name match:', unmatched)
