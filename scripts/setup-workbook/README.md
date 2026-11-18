# Setup workbook → The Pass

Loads Bryan's kitchen setup workbook into the app's data files.

- `stations.py` reads the "Stations & containers" tab and writes `src/data/stationItems.json`
  (line items for Garde manger, Grill and Sauté, each linked to its library recipe).
  Blank containers get house defaults (1/9 pan 1,000 g, 1/6 pan 2,500 g, 1/3 pan 4,000 g,
  deli quart 950 g, 3-day shelf life). These are listed in the item's `unconfirmed`.
- `prices.py` reads the Wandering Vine inventory sheet and writes `src/data/ingredientPrices.json`
  ($/kg per recipe ingredient name, from case cost ÷ case weight). Each phone fills in prices the chef
  hasn't set, once per `PRICE_SEED_REV` (src/lib/storage.js). Bump it after a rebuild.

```
python3 scripts/setup-workbook/stations.py the-pass-kitchen-setup-filled.xlsx src/data/recipeLibrary.json src/data/lineItems.json src/data/stationItems.json
python3 scripts/setup-workbook/prices.py wandering-vine-inventory.xlsx catalog.py src/data/recipeLibrary.json,src/data/builtInRecipesV1.json src/data/ingredientPrices.json
```
