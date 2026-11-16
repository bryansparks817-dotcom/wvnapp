# Recipe library build

`src/data/recipeLibrary.json` is generated from Bryan's cleaned recipe sheets
(`recipes/round-2/cleaned/` in the project files). To rebuild it after the
sheets change:

```
pip install openpyxl
python3 scripts/recipe-library/extract.py /tmp/raw.json "<folder of cleaned .xlsx sheets>"
python3 scripts/recipe-library/convert.py /tmp/raw.json src/data/recipeLibrary.json /tmp/report.json
```

Then bump `LIBRARY_REV` in `src/lib/recipeLibrary.js` if existing library
recipes should be refreshed on phones where nobody has edited them.

What the conversion does:
- Grams are the unit. Water given in litres becomes grams (1 L = 1,000 g).
- Stations: `garde` → Garde manger, `saute` → Sauté, `grill`, `prep`,
  `pastry`. "Fry" is Grill. A sheet with two stations ("garde, grill") lists
  the recipe on both.
- Light-blue cells (Claude drafts) become `draft: true` on that ingredient or
  step, `platingDraft`, or a name in the recipe's `drafts` list for header
  fields. The app shows them in light blue until the chef confirms them.
- "As needed" / "to taste" / blank quantities are kept with `qty: 0` and an
  `asNeeded` label, so they show on the recipe but don't count toward grams.
- A component made from another house recipe (lobster stock in the velouté,
  the miso aioli on the calamari) keeps its own line with `recipeRef` pointing
  at that recipe. It is not expanded into raw ingredients, because those are
  prepped on their own and collected from the walk-in.
- Dish build sheets get `kind: "dish"` and an empty `serviceware` block.
- Anything the converter couldn't read cleanly goes in `needsReview`.
