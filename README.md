# Kitchen Prep — Phase 1

A tool for a chef to select the recipes they're prepping today and get back a
consolidated gather list and an optimized prep timeline. See
[`PHASE_1_BRIEF.md`](./PHASE_1_BRIEF.md) for the full spec.

## Run it

```
npm install
npm run dev
```

## How it works

- Recipe data lives in `src/data/sampleRecipes.json` (no backend yet).
- `src/lib/gatherList.js` groups and sums ingredients across selected recipes.
- `src/lib/scheduler.js` simulates a single resource (the chef) working through
  active steps one at a time while passive steps (braising, proofing, etc.)
  run in the background. It always advances whichever ready recipe has the
  most total remaining time left, then compares the result against a naive
  recipe-by-recipe sequential total.

## Importing recipe sheets

Manage recipes → **Import recipe sheet (.xlsx)** reads the Wandering Vine
standard recipe sheet (download a blank one from the same screen, or
`public/recipe-sheet-template.xlsx`). Each tab is one recipe; the blank
`Template` tab is skipped. `src/lib/recipeSheetImport.js` finds fields by their
labels, converts sheet units to app units (oz/g → lb, qt/gal → cup), takes
"g per cup / each" into the ingredient registry, and turns an ingredient with
unit `batch` into a sub-recipe reference. A recipe with the same name as an
existing one replaces it. Recipes with missing data are skipped and listed so
they can be fixed in the sheet and imported again.
