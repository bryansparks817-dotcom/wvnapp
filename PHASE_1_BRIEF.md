Kitchen Prep App — Phase 1 Build Brief
What we're building
A tool for a chef to select the recipes they're prepping today, and get back:

1. A consolidated gather list — every ingredient across the selected recipes, combined and summed.
2. An optimized prep timeline — the most efficient order to do the work, given that some steps need a cook's hands ("active") and some don't ("passive" — braising, roasting, proofing, chilling, etc). Passive steps should start as early as possible so they run in the background while active work continues on other recipes.
This is Phase 1 of a larger system. Ignore everything else for now — no stations, no user accounts, no inventory, no PMIX, no licensing. Just recipe selection → gather list → timeline, for a single user, with no login.
Stack

* Frontend: React
* No backend needed yet — recipe data can live in a local file/array for now. We'll add Supabase (auth + database) in a later phase.
Data model (Phase 1 only)

```
Recipe
  - id
  - name
  - ingredients: [{ name, qty, unit }]
  - steps: [{ name, type: "active" | "passive", duration_minutes }]
    (steps run in order, one after another, within a recipe)
```

Use the attached `sample-recipes.json` as the seed data — 8 recipes with real ingredients and timed steps.
Feature 1: Recipe selector
A simple checklist/grid of the 8 sample recipes. User checks the ones they're making today.
Feature 2: Gather list
When the user clicks "Generate," combine every ingredient across the selected recipes:

* Group by ingredient name + unit
* Sum the quantities
* Display as a clean list, sorted alphabetically
Feature 3: Prep timeline (the core logic)
This is a single-resource scheduling problem — "the chef" is the one resource, and only one active step can happen at a time. Passive steps don't need the chef and can run in the background, even multiple at once.
Algorithm:

1. For each selected recipe, walk its steps in order. Any leading passive steps run automatically as soon as they're reachable (no chef needed) — track when each recipe's next active step becomes ready.
2. The chef works through active steps one at a time. When choosing which recipe's active step to do next, prefer whichever ready recipe has the most total remaining time left (this tends to unlock long passive steps earlier and minimizes total finish time).
3. When the chef finishes an active step, that recipe's clock advances, any subsequent passive steps cascade automatically, and the loop repeats until every recipe is done.
4. Track: what the chef is doing and when (one timeline), and what's cooking/resting passively and when (can overlap, may need multiple visual "lanes").
Output to show:

* Total time to finish everything, optimized
* Total time if done recipe-by-recipe in sequence (for comparison)
* A visual timeline: one row for the chef's active work, and however many rows are needed for overlapping passive items, each block labeled with the recipe + step name and start/end time
Definition of done for Phase 1

* Can select any combination of the 8 sample recipes
* Gather list correctly sums shared ingredients (test with recipes that share an ingredient, e.g. carrots or butter)
* Timeline correctly overlaps passive steps with active steps instead of running everything sequentially
* Total optimized time is visibly less than the naive sequential total when passive-heavy recipes are selected together
* Something you can click through and visually verify — not just working code, a working screen
