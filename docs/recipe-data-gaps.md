# Recipe data gaps

This is the to-do list for the recipe data entry pass. Everything here runs on **sample values** today, and the app works either way. Filling these in makes the numbers real.

Each line item in `src/data/lineItems.json` has an `unconfirmed` list naming its sample fields. When a value is confirmed, take it off that list.

## Per line item (station setup)

| Field | What it is | Used for |
|---|---|---|
| `pan` | Line pan size (1/9, 1/6, 1/3…) | Count screen, labels |
| `panGrams` | Grams in a full line pan | Collect/Prep math |
| `lowboySize` | Lowboy container: qt or pt (exceptions to come) | Count screen, labels |
| `qtGrams` | Grams in a full quart (a pint is half) | Collect/Prep math |
| `lowboyPar` | How many containers the lowboy should hold | Prep amount |
| `shelfLifeDays` | Calendar days from made date | Days left, toss, USE BY on labels |
| `recipeId` | Link to the recipe in the app | Prep order, scaled recipe, timers |

**Confirmed so far:** relish is a 1/9 pan = 1,000 g, and 1 qt = 950 g (Bryan, 2026-11-03).

| Item | Unconfirmed | Recipe in app? |
|---|---|---|
| Preserved lemon & fennel relish | lowboyPar, shelfLifeDays | **No** |
| Apple cider thyme mignonette | all six | Yes |
| Atomic horseradish cream | all six | Yes |
| Magic dust | all six | **No** |
| Clam chowder veloute | all six | Yes |
| Lobster & shrimp bolognese | all six | Yes |
| Pasta dough | all six | **No** |
| Lobster stock | all six | Yes |

The station list itself (Garde manger, with these 8 items) is a placeholder. The full list of stations and items still needs to be entered.

## Per recipe

| Field | Status | Why it matters |
|---|---|---|
| `yieldGrams` (finished yield) | **Missing on all 5 recipes** | Scaling uses the total ingredient weight until it's set. That runs high for anything that reduces (lobster stock: 54 kg of ingredients vs a much smaller finished yield). |
| `shelfLifeDays` | Missing in the app (it's on the recipe sheet template) | Should live on the recipe and feed the line item |
| Step Active/Passive + minutes | Present on all 5, not yet confirmed by Bryan | Prep order and timers |
| Ingredient conversions (g per cup / g each) | Complete for the current 5 | Gather list and scaling |

**Recipes to add:** preserved lemon & fennel relish, magic dust, pasta dough (they have cost sheets in the project files but aren't in the app yet), plus everything else on the menu.

## Other data, later
- Restaurant service schedule (e.g. Wed–Sat dinner), which decides which shift a count carries over to
- Walk-in count (chef screens)
- Label exceptions: containers that aren't a qt or pt
- **Storage zone for every ingredient (chef assigns).** The walk-in and dry storage are split into zones (Protein, Dairy, Produce, Dry, etc.). The chef gives every ingredient a dedicated zone, from AP flour to lobster stock, and the gather list is grouped by zone in walking order. Today `src/data/storageZones.json` holds Claude's draft guesses for the sample recipes' ingredients. Needed: the restaurant's real zone list and walking order, each ingredient's zone, and a chef screen to set them. Ingredients without a zone show under "No zone yet".
