// Turns Wandering Vine standard recipe sheets (.xlsx, one recipe per tab)
// into app recipes.
//
// A sheet arrives as a grid of cell values (rows of columns, merged cells
// carry their value in the top-left cell only). Fields are found by their
// labels rather than fixed cell addresses, so rows can be added to the sheet
// without breaking the import:
//   - header fields: a label cell spans two columns, its value sits two
//     columns to the right ("Recipe" in A -> value in C)
//   - ingredients: the row headed "Ingredient" / "Qty" / "Unit" / "g per cup /
//     each", read down until the first row with no ingredient name and no qty
//     past the last filled row (blank rows are skipped)
//   - steps: the row headed "Step" / "Active / Passive" / "Minutes" under
//     METHOD, read down to the next section

const GRAMS_PER_LB = 453.592;
export const PENDING_PREFIX = "__pending__";

// Sheet unit -> app unit, with the factor that converts a sheet quantity into
// the app unit. The app only knows lb, cup, tbsp, tsp and ea.
const UNIT_MAP = {
  lb: ["lb", 1],
  lbs: ["lb", 1],
  oz: ["lb", 1 / 16],
  g: ["lb", 1 / GRAMS_PER_LB],
  kg: ["lb", 1000 / GRAMS_PER_LB],
  cup: ["cup", 1],
  cups: ["cup", 1],
  qt: ["cup", 4],
  gal: ["cup", 16],
  pt: ["cup", 2],
  "fl oz": ["cup", 1 / 8],
  tbsp: ["tbsp", 1],
  tsp: ["tsp", 1],
  ea: ["ea", 1],
  each: ["ea", 1],
};

function text(value) {
  return value == null ? "" : String(value).trim();
}

function norm(value) {
  return text(value).toLowerCase();
}

function findRow(rows, predicate, start = 0) {
  for (let r = start; r < rows.length; r += 1) {
    if (predicate(rows[r] ?? [])) return r;
  }
  return -1;
}

function headerField(rows, label) {
  const key = label.toLowerCase();
  for (const row of rows) {
    const col = (row ?? []).findIndex((cell) => norm(cell).startsWith(key));
    if (col !== -1) return row[col + 2];
  }
  return undefined;
}

function columnIndex(headerRow, label) {
  return headerRow.findIndex((cell) => norm(cell).startsWith(label));
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

// Parses one sheet. Returns { recipe, conversions, errors }, where
// conversions are ingredient-registry fields to upsert ({ name, fields }).
// `context.findIngredient(name)` and `context.findSubRecipe(name)` look up
// what the app already has.
export function parseRecipeSheet(rows, context) {
  const errors = [];
  const name = text(headerField(rows, "Recipe"));
  if (!name) return { recipe: null, conversions: [], errors: ["No recipe name (the Recipe box is empty)."] };

  const isSubRecipe = norm(headerField(rows, "Sub-recipe")).startsWith("y");

  // Ingredients
  const ingHeader = findRow(rows, (row) => columnIndex(row, "ingredient") !== -1 && columnIndex(row, "qty") !== -1);
  const ingredients = [];
  const conversions = [];
  if (ingHeader === -1) {
    errors.push("Couldn't find the ingredient table.");
  } else {
    const head = rows[ingHeader];
    const cName = columnIndex(head, "ingredient");
    const cQty = columnIndex(head, "qty");
    const cUnit = columnIndex(head, "unit");
    const cGrams = columnIndex(head, "g per");
    for (let r = ingHeader + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      // The ingredient table ends where the cost/allergen block starts.
      if (row.some((cell) => /^(allergens|ingredient total)/.test(norm(cell)))) break;
      const ingName = text(row[cName]);
      if (!ingName) continue;
      const qty = Number(row[cQty]);
      const sheetUnit = norm(row[cUnit]);
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push(`"${ingName}" needs a quantity.`);
        continue;
      }

      if (sheetUnit === "batch") {
        const sub = context.findSubRecipe(ingName);
        if (!sub) {
          errors.push(`"${ingName}" is listed in batches but there's no sub-recipe with that name in the app yet.`);
          continue;
        }
        ingredients.push({ subRecipeId: sub.id, qty });
        continue;
      }

      const mapped = UNIT_MAP[sheetUnit];
      if (!mapped) {
        errors.push(`"${ingName}" has unit "${text(row[cUnit])}", which the app can't use.`);
        continue;
      }
      const [unit, factor] = mapped;
      ingredients.push({ name: ingName, qty: round(qty * factor), unit });

      if (unit === "lb") continue;
      const field = unit === "ea" ? "gramsPerEach" : "gramsPerCup";
      const grams = Number(row[cGrams]);
      if (Number.isFinite(grams) && grams > 0) {
        conversions.push({ name: ingName, fields: { [field]: grams } });
      } else if (context.findIngredient(ingName)?.[field] == null) {
        errors.push(`"${ingName}" needs grams per ${unit === "ea" ? "each" : "cup"} (the app hasn't seen it before).`);
      }
    }
  }
  if (ingredients.length === 0 && ingHeader !== -1) errors.push("No ingredients filled in.");

  // Steps
  const methodRow = findRow(rows, (row) => norm(row[0]) === "method");
  const stepHeader =
    methodRow === -1 ? -1 : findRow(rows, (row) => columnIndex(row, "step") !== -1, methodRow);
  const steps = [];
  if (stepHeader === -1) {
    errors.push("Couldn't find the METHOD steps.");
  } else {
    const head = rows[stepHeader];
    const cStep = columnIndex(head, "step");
    const cType = columnIndex(head, "active");
    const cMin = columnIndex(head, "min");
    for (let r = stepHeader + 1; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const stepName = text(row[cStep]);
      // A section bar (e.g. PLATING) has text in column A and nothing else.
      if (!stepName && text(row[0]) && !Number.isFinite(Number(row[0]))) break;
      if (!stepName) continue;
      const minutes = Number(row[cMin]);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        errors.push(`Step "${stepName}" needs minutes.`);
        continue;
      }
      const type = norm(row[cType]).startsWith("p") ? "passive" : "active";
      steps.push({ name: stepName, type, duration_minutes: minutes });
    }
  }
  if (steps.length === 0 && stepHeader !== -1) errors.push("No method steps filled in.");

  return { recipe: { name, ingredients, steps, isSubRecipe }, conversions, errors };
}

// Parses every tab of a workbook (as [{ sheet, data }]), skipping the blank
// Template tab. Sub-recipes are parsed first so a dish on a later tab can use
// one defined earlier in the same file.
export function parseRecipeWorkbook(sheets, { recipes, findIngredient }) {
  const results = [];
  const pending = new Map(); // lowercased name -> parsed sub-recipe from this file
  const seenConversions = new Map(); // lowercased name -> fields given on an earlier tab
  const findKnownIngredient = (name) => {
    const fromFile = seenConversions.get(name.toLowerCase());
    return fromFile ? { ...findIngredient(name), ...fromFile } : findIngredient(name);
  };
  const findSubRecipe = (name) => {
    const key = name.toLowerCase();
    return pending.get(key) ?? recipes.find((r) => r.isSubRecipe && r.name.toLowerCase() === key);
  };

  const tabs = sheets.filter(({ sheet }) => sheet.toLowerCase() !== "template");
  const isSubTab = ({ data }) => norm(headerField(data, "Sub-recipe")).startsWith("y");
  const ordered = [...tabs.filter(isSubTab), ...tabs.filter((t) => !isSubTab(t))];

  for (const { sheet, data } of ordered) {
    const parsed = parseRecipeSheet(data, { findIngredient: findKnownIngredient, findSubRecipe });
    for (const { name, fields } of parsed.conversions) {
      const key = name.toLowerCase();
      seenConversions.set(key, { ...seenConversions.get(key), ...fields });
    }
    if (!parsed.recipe && parsed.errors.length === 1 && tabs.length > 1) continue; // empty tab
    // Only a sub-recipe that will actually be imported can be used by later tabs.
    if (parsed.recipe?.isSubRecipe && parsed.errors.length === 0) {
      // Placeholder id so later tabs can reference it; importRecipes() swaps
      // in the real id once the sub-recipe is saved.
      const key = parsed.recipe.name.toLowerCase();
      pending.set(key, { id: `${PENDING_PREFIX}${key}` });
    }
    results.push({ sheet, ...parsed });
  }
  return results;
}
