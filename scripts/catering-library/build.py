"""Builds src/data/cateringLibrary.json: the Castle Catering Recipe & Production
Book (working edition, 2026-11-25) as recipes and per-piece build guides for
The Pass's private chef & catering side. Values Claude filled in (amounts the
book didn't give, each-weights, step times) carry draft flags (light blue in
the app) until Bryan confirms them.

Run: python3 scripts/catering-library/build.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = {"sheet": "The Castle Catering Recipe & Production Book", "rev": "Working edition 2026-11-25", "createdBy": "BS"}
TIMES_NOTE = "Step times are Claude's estimates for scheduling; confirm."


def g(name, qty, unit="g", note=None, draft=False, ref=None, sub=None, as_needed=None):
    i = {"name": name, "qty": qty, "unit": unit}
    if ref: i["recipeRef"] = ref
    if sub: i = {"subRecipeId": sub, "qty": qty, "name": name}
    if note: i["note"] = note
    if draft: i["draft"] = True
    if as_needed: i["asNeeded"] = as_needed
    return i


def need(name, note=None, word="As needed"):
    return g(name, 0, "g", note=note, as_needed=word)


def s(text, minutes, passive=False):
    return {"name": text, "type": "passive" if passive else "active", "duration_minutes": minutes}


def prep(id, name, ingredients, steps, *, yield_text=None, yield_grams=None, portion=None, portions=None,
         allergens=(), review=(), drafts=("allergens",), storage=None, category="Catering · The Castle"):
    r = {
        "id": f"castle-{id}", "name": name, "isSubRecipe": True, "kind": "prep", "book": "catering",
        "stations": [], "category": category, "ingredients": ingredients, "steps": steps,
        "allergens": list(allergens), "drafts": list(drafts), "plating": "", "source": SOURCE,
        "needsReview": [*review, TIMES_NOTE],
    }
    for k, v in (("yieldText", yield_text), ("yieldGrams", yield_grams), ("portion", portion), ("portions", portions), ("storage", storage)):
        if v is not None: r[k] = v
    return r


def build(id, name, pieces, lines, assembly, *, review=(), allergens=(), menu=None):
    r = {
        "id": f"castle-{id}-build", "name": f"{name} · Build", "isSubRecipe": False, "kind": "dish", "book": "catering",
        "stations": [], "category": "Catering build · The Castle", "ingredients": lines, "steps": [],
        "yieldText": "One piece", "portion": f"Production target {pieces} pieces", "portions": 1,
        "allergens": list(allergens), "drafts": ["allergens"], "plating": assembly + (f"\n\nMenu: {menu}" if menu else ""),
        "serviceware": {"plate": "", "liner": "", "vessels": "", "utensils": ""},
        "source": SOURCE, "needsReview": list(review),
    }
    return r


R = []

# 1. Country ham & aged cheddar scone -------------------------------------
R.append(prep("ham-cheddar-scone-dough", "Country Ham & Aged Cheddar Scone Dough", [
    g("All-purpose flour", 1100), g("Baking powder", 44), g("Granulated sugar", 28), g("Fine sea salt", 11),
    g("Cracked black pepper", 4), g("Unsalted butter", 275, note="Cold"), g("Aged white cheddar", 330, note="Grated"),
    g("Country ham", 275, note="Finely diced; sautéed to render, drained and chilled"), g("Fresh chives", 22),
    g("Buttermilk", 500), g("Whole eggs", 80),
    g("Whole eggs", 2, "ea", note="Egg wash"), g("Heavy cream", 30, note="Egg wash"),
], [
    s("Briefly sauté diced country ham to render and develop color. Drain and chill.", 10),
    s("Combine flour, baking powder, sugar, salt and pepper.", 3),
    s("Cut cold butter into the dry ingredients until pea-sized pieces remain.", 5),
    s("Fold in cheddar, ham and chives.", 2),
    s("Combine buttermilk and egg; add to the dry mixture.", 2),
    s("Mix just until incorporated.", 2),
    s("Press into an approximately 1-inch slab.", 3),
    s("Chill 30–45 minutes.", 40, passive=True),
    s("Portion into 60 pieces.", 8),
    s("Apply egg wash (2 eggs + 30 g heavy cream).", 4),
    s("Bake at 375°F convection for approximately 14–18 minutes. Validate with the production oven.", 16, passive=True),
], yield_text="60 scones, about 45 g raw dough each", portion="45 g raw dough", portions=60,
    allergens=["Gluten", "Dairy", "Egg"], review=[
        "Development recipe.",
        "Evaluate dough salt after tasting: country ham saltiness varies.",
    ], storage="Raw slab chilled until portioning; bake day of"))

R.append(prep("whipped-cultured-honey-butter", "Whipped Cultured Honey Butter", [
    g("Unsalted cultured butter", 250), g("Honey", 45), g("Flaky sea salt", 3), g("Apple cider vinegar", 5),
], [s("Whip until light and aerated.", 6)],
    yield_text="303 g", yield_grams=303, portion="Light brush per warm scone (about 4 g)", allergens=["Dairy"], drafts=("allergens", "portion"),
    review=["Service: brush warm scones right after baking, then finish with flaky salt."]))

# 2. Steak tartare crostini -------------------------------------------------
R.append(prep("beef-tartare", "Beef Tartare", [
    g("Beef tenderloin", 1100, note="Or center-cut striploin; trimmed weight"), g("Dijon mustard", 25),
    g("Worcestershire sauce", 12), g("Capers", 25, note="Minced"), g("Shallot", 25, note="Minced"),
    g("Cornichons", 30, note="Minced"), g("Extra virgin olive oil", 25), g("Lemon juice", 12),
    g("Fine sea salt", 8), g("Black pepper", 3), g("Chives", 12),
], [
    s("Trim beef and keep it refrigerated.", 15),
    s("Hand-cut into approximately ⅛-inch dice.", 30),
    s("Prepare the seasoning separately.", 10),
    s("Combine shortly before service.", 3),
    s("Portion 20 g per crostini.", 10),
], yield_text="1,277 g", portion="20 g per crostini", portions=63, allergens=["Mustard", "Fish (Worcestershire)"],
    storage="Raw beef held at 41°F or below; combine shortly before service"))

R.append(prep("smoked-mussel-aioli", "House-Smoked Mussel Aioli", [
    g("House-smoked mussel meat", 75), g("Smoked mussel liquor", 30, note="Reserved from smoking"),
    g("Pasteurized egg yolks", 36), g("Dijon mustard", 10), g("Lemon juice", 15), g("Sherry vinegar", 5),
    g("Garlic", 2), g("Neutral oil", 220), g("Extra virgin olive oil", 20), need("White pepper", word="To taste"),
], [
    s("Blend mussel meat and liquor until smooth.", 3),
    s("Add egg yolks, Dijon, garlic, lemon juice and vinegar.", 2),
    s("Slowly emulsify with the neutral oil.", 6),
    s("Finish with olive oil.", 1),
    s("Adjust consistency and pass through a fine chinois if desired.", 4),
], yield_text="413 g", portion="5 g per crostini", allergens=["Shellfish (mussel)", "Egg", "Mustard"],
    review=["Do not add smoked paprika.", "Evaluate salt before seasoning: mussel liquor can be salty."]))

R.append(prep("fine-mirepoix", "Fine Mirepoix (carrot, celery root, green apple)", [
    g("Carrot", 50, note="Fine brunoise, 1–2 mm", draft=True), g("Celery root", 50, note="Fine brunoise, 1–2 mm", draft=True),
    g("Green apple", 50, note="Fine brunoise, 1–2 mm", draft=True), g("Champagne vinegar", 5, draft=True),
    g("Extra virgin olive oil", 5, draft=True), g("Fine sea salt", 1, draft=True),
], [
    s("Cut carrot, celery root and green apple into 1–2 mm brunoise.", 25),
    s("Lightly dress with champagne vinegar, olive oil and salt.", 2),
    s("Drain before assembly.", 2),
], yield_text="About 160 g", portion="2–3 g per crostini", allergens=["Celery"],
    review=["The book gives no amounts; Claude drafted ~160 g, enough for 50 pieces at 2–3 g."]))

R.append(prep("baguette-crostini", "Baguette Crostini", [
    g("Baguette", 2, "ea", note="About 250 g per loaf (estimate)", draft=True), g("Extra virgin olive oil", 50), g("Salt", 3),
], [
    s("Cut baguette into ¼-inch bias slices.", 15),
    s("Brush lightly with oil and season.", 8),
    s("Bake at 325°F until golden.", 15, passive=True),
    s("Cool and store dry.", 20, passive=True),
], yield_text="About 100 slices from 2 loaves", portion="1 slice (about 5.5 g)", portions=100,
    allergens=["Gluten"], drafts=("allergens", "yieldText", "portion"),
    review=["Slices per loaf is Claude's estimate; count one production run."], storage="Airtight, dry"))

# 3. Mini New England lobster roll -----------------------------------------
R.append(prep("tangzhong", "Tangzhong", [g("Bread flour", 250), g("Whole milk", 1250)], [
    s("Whisk together and cook over medium-low heat, stirring continuously, until thickened.", 10),
    s("Cool completely.", 45, passive=True),
], yield_text="1,500 g", yield_grams=1500, allergens=["Gluten", "Dairy"]))

R.append(prep("japanese-milk-bread", "Japanese Milk Bread Buns (Tangzhong)", [
    g("Bread flour", 4200), g("Whole milk", 1250), g("Whole eggs", 500), g("Granulated sugar", 400),
    g("Unsalted butter", 500, note="Softened"), g("Instant yeast", 65), g("Fine sea salt", 85),
    g("Prepared tangzhong", 1, sub="castle-tangzhong", note="1 batch (1,500 g), cooled"),
], [
    s("Combine flour, sugar, yeast, milk, eggs and cooled tangzhong.", 5),
    s("Mix until cohesive.", 5),
    s("Add salt.", 1),
    s("Incorporate softened butter gradually.", 8),
    s("Mix to a strong windowpane.", 10),
    s("Bulk ferment until approximately doubled.", 75, passive=True),
    s("Divide and shape into elongated side-split rolls, half the length of a standard bun.", 30),
    s("Proof until expanded and airy.", 50, passive=True),
    s("Bake at approximately 350°F until golden and fully baked.", 18, passive=True),
    s("Cool completely.", 45, passive=True),
], yield_text="8,500 g dough; about 66 buns at 127.5 g", portion="125–130 g dough per bun; 113 g baked target", portions=66,
    allergens=["Gluten", "Dairy", "Egg"], drafts=("allergens", "yieldText", "portions"), review=[
        "Development formula: dough portion (125–130 g) not yet reconciled with the 113 g baked target. Test 6–8 buns, measure bake loss and size, then recalculate the batch.",
    ]))

R.append(prep("new-england-lobster-salad", "New England Lobster Salad", [
    g("Cooked lobster meat", 2600, note="Chilled, picked and drained"), g("House mayonnaise", 200, note="House recipe not in this book yet"),
    g("Crème fraîche", 100), g("Celery", 100, note="Fine brunoise"), g("Fresh lemon juice", 35), g("Lemon zest", 5),
    g("Dijon mustard", 15), g("Worcestershire sauce", 5), g("Fine sea salt", 8), g("White pepper", 1),
], [
    s("Cook lobster using the established kitchen procedure.", 30),
    s("Chill thoroughly and pick carefully for shell fragments and cartilage.", 45),
    s("Drain thoroughly and weigh.", 5),
    s("Cut into generous bite-size pieces, keeping larger pieces where possible.", 20),
    s("Combine mayonnaise, crème fraîche, Dijon, Worcestershire, lemon juice, zest, salt and white pepper.", 5),
    s("Fold in celery.", 2),
    s("Gently fold the dressing into the lobster.", 3),
    s("Refrigerate until service.", 30, passive=True),
], yield_text="3,069 g", yield_grams=3069, portion="60 g per roll", portions=51,
    allergens=["Shellfish", "Egg", "Dairy", "Mustard", "Fish (Worcestershire)"], review=[
        "Chives (25 g) removed from the salad in favor of celery leaf as a separate garnish.",
        "Open decision: reserve tail meat for the visible top layer and use claw/knuckle in the salad?",
    ], storage="Refrigerated until service"))

R.append(prep("dressed-celery-leaf", "Dressed Celery Leaf Garnish", [
    need("Celery leaves", note="Whole, attractive leaves"), need("Lemon juice"), need("Extra virgin olive oil"), need("Smoked sea salt", word="To finish"),
], [s("Lightly dress celery leaves with lemon juice and olive oil; finish with smoked sea salt. Dress immediately before service.", 3)],
    portion="Small garnish per roll", allergens=["Celery"]))

# 4. Bacon-wrapped scallop crostini -----------------------------------------
R.append(prep("bacon-wrapped-scallop-halves", "Bacon-Wrapped Scallop Halves", [
    g("U-10 sea scallops", 30, "ea", note="Large; about 45 g each (estimate)", draft=True),
    g("Thin-cut bacon", 600, note="60 wrapping portions; about 10 g each (estimate)", draft=True),
], [
    s("Cut each large sea scallop horizontally in half before cooking.", 10),
    s("Wrap each half individually with thin-cut bacon. Secure with a toothpick if needed.", 25),
    s("Cook until the bacon is crisp and the scallop is just cooked, without drying out.", 15),
], yield_text="60 scallop halves", portion="1 half", portions=60, allergens=["Shellfish (scallop)", "Pork"],
    review=["Scallop size and bacon per wrap are Claude's estimates."]))

# 5. Mini flank steak slider ----------------------------------------------
R.append(prep("grilled-flank-steak", "Grilled Flank Steak (sliced)", [
    g("Flank steak", 3800, note="Raw; about 75% cooked yield (estimate)", draft=True),
], [
    s("Grill flank steak whole.", 15),
    s("Rest appropriately.", 15, passive=True),
    s("Identify grain direction and slice thinly against the grain.", 20),
    s("Portion by cooked weight, 45–50 g per slider.", 10),
], yield_text="About 2,850 g cooked", yield_grams=2850, portion="45–50 g cooked per slider", portions=60,
    allergens=[], drafts=("allergens", "yieldGrams", "yieldText"), review=[
        "Raw purchase weight and cooked yield are estimates until the real cooking yield is measured.",
    ]))

R.append(prep("lemon-dijon-arugula", "Lemon-Dijon Dressed Arugula", [
    g("Arugula", 300, draft=True), g("Lemon juice", 15, draft=True), g("Dijon mustard", 5, draft=True),
    g("Extra virgin olive oil", 25, draft=True), g("Fine sea salt", 1, draft=True),
], [s("Whisk lemon, Dijon and olive oil. Toss arugula to a light coat, not wet, just before service.", 4)],
    yield_text="About 346 g", portion="Small tuft per slider (about 5 g)", allergens=["Mustard"],
    review=["Working dressing direction only (lemon, Dijon, olive oil); amounts are Claude's drafts."]))

# 6. Mini lump crab cake ---------------------------------------------------
R.append(prep("mini-lump-crab-cake", "Mini Lump Crab Cake", [
    g("Jumbo lump crab meat", 3000, note="Formula pending; costed as all crab until it's set", draft=True),
], [
    s("Mix with minimal binder, keeping lumps whole (formula pending).", 20),
    s("Portion 50 g raw cakes.", 20),
    s("Pan-sear or griddle to a delicate golden crust.", 20),
], yield_text="3,000 g raw mixture; 60 cakes", portion="50 g raw", portions=60,
    allergens=["Shellfish (crab)"], review=[
        "Crab cake formula is still pending: jumbo lump dominant, minimal binder, delicate crust, golden sear, standalone presentation.",
    ]))

R.append(prep("celery-root-remoulade", "Celery Root Remoulade", [
    g("Celery root", 400, note="Peeled, fine 1–2 mm julienne"), g("House mayonnaise", 220, note="House recipe not in this book yet"),
    g("Dijon mustard", 30), g("Whole-grain mustard", 20), g("Crème fraîche", 50), g("Lemon juice", 25),
    g("Champagne vinegar", 15), g("Worcestershire sauce", 4), g("Prepared horseradish", 8),
    g("Fine sea salt", 5), g("White pepper", 1), g("Fresh parsley", 5, note="Finely minced"),
], [
    s("Peel celery root and cut into fine 1–2 mm julienne.", 25),
    s("Combine mayonnaise, both mustards, crème fraîche, lemon juice, champagne vinegar, Worcestershire and horseradish.", 4),
    s("Season with salt and white pepper.", 1),
    s("Fold in celery root and parsley.", 2),
    s("Refrigerate at least 30 minutes.", 30, passive=True),
    s("Adjust acidity and consistency before service.", 3),
], yield_text="783 g", yield_grams=783, portion="10–12 g per cake", allergens=["Celery", "Egg", "Dairy", "Mustard", "Fish (Worcestershire)"],
    review=["Texture: creamy but structured, crisp celery root; holds a small quenelle or sits neatly under the cake."]))

R.append(prep("preserved-lemon-gel", "Preserved Lemon Gel", [
    g("Preserved lemon liquid", 150), g("Water", 100), g("Fresh lemon juice", 25), g("Granulated sugar", 10), g("Agar-agar", 2.5),
], [
    s("Combine preserved lemon liquid, water, lemon juice and sugar.", 2),
    s("Thoroughly disperse the agar-agar.", 2),
    s("Bring to a full boil while stirring; hold the boil 60–90 seconds.", 5),
    s("Pour into a shallow container and refrigerate until fully set.", 60, passive=True),
    s("Break into pieces and blend until smooth.", 4),
    s("Pass through a fine chinois and transfer to squeeze bottles.", 5),
], yield_text="About 287.5 g before blending adjustments", yield_grams=287.5, portion="3–5 g per cake", allergens=[],
    review=["Adjust water and acidity after tasting the preserved lemon liquid. Too firm: blend in a little water. Too loose: raise agar next batch."]))

R.append(prep("coastal-herb-garnish", "Coastal Herb Garden Garnish", [
    need("Dill fronds"), need("Fennel fronds"), need("Flat-leaf parsley leaves"), need("Celery leaves"),
    need("Chive sticks"), need("Micro basil"), need("Red sorrel"), need("Extra virgin olive oil"), need("Lemon juice"),
], [s("Lightly dress herbs with olive oil and lemon immediately before plating.", 3)],
    portion="Small composed arrangement per cake", allergens=["Celery"],
    review=["Dill and fennel for height, parsley and celery for volume, chive sticks for direction, micro basil for sweetness, red sorrel for color and acidity."]))

# Build guides (one piece each) -------------------------------------------
ref = lambda id: f"castle-{id}"
R.append(build("ham-cheddar-scone", "Country Ham & Aged Cheddar Scone", 60, [
    g("Ham & cheddar scone", 45, ref=ref("ham-cheddar-scone-dough"), note="45 g raw dough, baked"),
    g("Whipped cultured honey butter", 4, ref=ref("whipped-cultured-honey-butter"), note="Light brush while warm", draft=True),
    need("Flaky sea salt", word="To finish"),
], "Lightly brush warm scones with whipped cultured honey butter immediately after baking. Finish with flaky salt.",
    allergens=["Gluten", "Dairy", "Egg"]))

R.append(build("steak-tartare-crostini", "Steak Tartare Crostini", 50, [
    g("Baguette crostini", 5.5, ref=ref("baguette-crostini"), note="1 slice", draft=True),
    g("House-smoked mussel aioli", 5, ref=ref("smoked-mussel-aioli")),
    g("Beef tartare", 20, ref=ref("beef-tartare")),
    g("Fine mirepoix", 2.5, ref=ref("fine-mirepoix"), note="2–3 g"),
    need("Fresh dill", note="1 small frond"),
], "Crostini, then aioli, then tartare, then mirepoix, then a small frond of fresh dill.",
    allergens=["Gluten", "Shellfish (mussel)", "Egg", "Mustard", "Fish (Worcestershire)", "Celery"],
    review=["The BEO lists this slot as Kansas City strip on crostini with horseradish (50 pieces)."]))

R.append(build("mini-lobster-roll", "Mini New England Lobster Roll", 50, [
    g("Japanese milk bun", 127.5, ref=ref("japanese-milk-bread"), note="1 side-split bun (dough weight)", draft=True),
    g("New England lobster salad", 60, ref=ref("new-england-lobster-salad")),
    g("Unsalted butter", 3, note="For toasting; as needed", draft=True),
    need("Dressed celery leaf", note="Small garnish"),
    need("Smoked sea salt", word="To finish"),
], "Butter-toast the outside of the side-split bun. Fill with lobster salad. Arrange whole dressed celery leaves on top and finish with smoked sea salt.",
    allergens=["Gluten", "Dairy", "Egg", "Shellfish", "Mustard", "Fish (Worcestershire)", "Celery"],
    review=["Open decision: tail meat on top, claw/knuckle in the salad?"]))

R.append(build("bacon-scallop-crostini", "Bacon-Wrapped Scallop Crostini", 60, [
    g("Baguette crostini", 5.5, ref=ref("baguette-crostini"), note="1 slice", draft=True),
    g("Caramelized miso aioli", 9, ref="caramelized-miso-aioli", note="8–10 g; Wandering Vine recipe"),
    g("Bacon-wrapped scallop half", 32.5, ref=ref("bacon-wrapped-scallop-halves"), note="1 half", draft=True),
    g("Crispy sage leaf", 1, ref="crispy-sage-leaves-brown-butter-finish", note="1 leaf, fried in clarified butter", draft=True),
], "Crostini, caramelized miso aioli, cooked bacon-wrapped scallop half, one crispy sage leaf. Fry sage gently in clarified butter until crisp, drain well and add right before service.",
    allergens=["Gluten", "Shellfish (scallop)", "Pork", "Egg", "Soy", "Sesame"],
    review=["Sage here is fried in clarified butter; the linked Wandering Vine sage recipe finishes in brown butter."]))

R.append(build("flank-steak-slider", "Mini Flank Steak Slider", 60, [
    g("Mini slider bun", 1, "ea", note="About 35 g (estimate); lightly toasted", draft=True),
    g("Grilled flank steak", 47.5, ref=ref("grilled-flank-steak"), note="45–50 g cooked, sliced against the grain"),
    g("Pickled red onion", 9, note="8–10 g, drained; recipe not in this book yet"),
    g("Lemon-Dijon dressed arugula", 5, ref=ref("lemon-dijon-arugula"), note="Small tuft", draft=True),
], "Lightly toast the bun. Layer sliced flank steak, then drained pickled red onion, then lightly dressed arugula. Close with the top bun.",
    allergens=["Gluten", "Mustard"]))

R.append(build("mini-crab-cake", "Mini Lump Crab Cake", 60, [
    g("Celery root remoulade", 11, ref=ref("celery-root-remoulade"), note="10–12 g, small foundation or swipe"),
    g("Mini lump crab cake", 50, ref=ref("mini-lump-crab-cake"), note="1 × 50 g raw"),
    g("Preserved lemon gel", 4, ref=ref("preserved-lemon-gel"), note="3–5 g in precise accents"),
    need("Coastal herb garden garnish", note="Small composed arrangement"),
], "Remoulade as a small foundation or swipe, crab cake as the centerpiece, lemon gel in precise accents, herbs arranged organically around and above the cake.",
    allergens=["Shellfish (crab)", "Celery", "Egg", "Dairy", "Mustard", "Fish (Worcestershire)"],
    menu="Mini Lump Crab Cake | Celery Root Remoulade | Preserved Lemon Gel | Coastal Herb Garden",
    review=["Crab cake formula pending."]))

out = ROOT / "src/data/cateringLibrary.json"
out.write_text(json.dumps(R, indent=1, ensure_ascii=False) + "\n")
print(len(R), "recipes ->", out)
