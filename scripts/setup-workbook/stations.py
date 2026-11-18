"""Station line items for The Pass, from the setup workbook's "Stations & containers" tab.

Usage: python3 stations.py <setup.xlsx> <recipeLibrary.json> <lineItems.json> <out stationItems.json>
Garde manger items already in lineItems.json are kept as they are; only new ones are added.
Containers the workbook leaves blank get house defaults, listed in each item's "unconfirmed".
"""
import json, re, sys, openpyxl
wbf, libf, gardef, out = sys.argv[1:5]
lib = json.load(open(libf)); by_name = {r['name'].strip().lower(): r for r in lib}
garde = json.load(open(gardef))
STN = {'Garde manger': 'garde-manger', 'Grill': 'grill', 'Sauté': 'saute', 'Pastry': 'pastry', 'Prep': 'prep'}
PAN_G = {'1/9': 1000, '1/6': 2500, '1/3': 4000, '1/2': 6000}   # same defaults as the garde items
QT_G = 950
slug = lambda s: re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower().replace('&', 'and'))).strip('-')
ws = openpyxl.load_workbook(wbf, data_only=True)['Stations & containers']
res = {k: [] for k in STN.values()}
seen = {k: set() for k in STN.values()}
for i in garde['items']: seen['garde-manger'].update({i['recipeId'], i['id']})
skipped = []
for row in ws.iter_rows(min_row=3, values_only=True):
    stn, name, rname, pan, pang, linepar, backup, lowpar, walkpar, shelf = row[:10]
    if not stn or not name: continue
    sid = STN[stn]; r = by_name.get((rname or '').strip().lower())
    if not r: skipped.append(f'{stn}: {name} (no recipe)'); continue
    if r['id'] in seen[sid]: continue
    seen[sid].add(r['id'])
    p = (pan or '1/6').replace(' pan', '').strip()
    unconf = ['pan', 'lowboySize', 'qtGrams', 'lowboyPar']
    item = dict(id=r['id'], name=name, pan=p, panGrams=pang or PAN_G.get(p, 2500),
                lowboySize='pt' if backup and 'pint' in backup.lower() else 'qt', qtGrams=QT_G,
                lowboyPar=lowpar or 1, shelfLifeDays=shelf or r.get('shelfLifeDays') or 3, recipeId=r['id'])
    if not pang: unconf.append('panGrams')
    if not (shelf or r.get('shelfLifeDays')): unconf.append('shelfLifeDays')
    item['unconfirmed'] = unconf
    res[sid].append(item)
json.dump({'_note': "Built from the kitchen setup workbook by scripts/setup-workbook/stations.py. Fields in an item's 'unconfirmed' are Claude's defaults for the chef to check.",
           'stations': {k: v for k, v in res.items() if v}}, open(out, 'w'), indent=1, ensure_ascii=False)
print({k: len(v) for k, v in res.items()}, 'skipped:', skipped)
