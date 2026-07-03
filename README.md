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
