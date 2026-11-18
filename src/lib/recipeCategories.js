// Groups recipes for chef screens (Prices first): finished dish builds on
// top, then house recipes by what they are. Library recipes are placed by
// id; anything else (a recipe the chef adds later) is placed by keywords in
// its name, and lands in "Other recipes" if nothing matches.

export const DISH_GROUP = "Full dish builds";

// Order here is the order the groups show on screen.
export const RECIPE_GROUPS = [
  DISH_GROUP,
  "Proteins",
  "Stocks, soups & sauces",
  "Dressings & cold sauces",
  "Butters & fats",
  "Veg production",
  "Starches, doughs & pastry",
  "Pickles, relishes & condiments",
  "Fillings",
  "Garnishes & crunch",
  "Seasonings & dredges",
  "Other recipes",
];

const BY_ID = {
  // Proteins
  "12-hour-braised-wagyu-short-rib": "Proteins",
  "albondigas-meatballs": "Proteins",
  "cherry-smoked-dart-rohan-duck-breast": "Proteins",
  "duck-breast-prosciutto-dry-cured": "Proteins",
  "individual-salmon-wellington-make-ahead-assembly": "Proteins",
  "spanish-quail-buttermilk-brine": "Proteins",
  "venison-osso-bucco-traditional-braise": "Proteins",
  // Stocks, soups & sauces
  "albondigas-sauce": "Stocks, soups & sauces",
  "balsamic-reduction": "Stocks, soups & sauces",
  "beaver-dam-pepper-sauce": "Stocks, soups & sauces",
  "black-cherry-pepita-black-lime-mole": "Stocks, soups & sauces",
  "blackberry-demi-glace-scallop-sauce": "Stocks, soups & sauces",
  "butternut-squash-soup": "Stocks, soups & sauces",
  "chicken-stock": "Stocks, soups & sauces",
  "clam-chowder-veloute": "Stocks, soups & sauces",
  "d-o-p-san-marzano-tomato-sauce": "Stocks, soups & sauces",
  "farm-heirloom-tomato-sauce": "Stocks, soups & sauces",
  "lobster-and-shrimp-bolognese": "Stocks, soups & sauces",
  "lobster-stock": "Stocks, soups & sauces",
  "wagyu-braising-reduction": "Stocks, soups & sauces",
  // Dressings & cold sauces
  "apple-cider-thyme-mignonette": "Dressings & cold sauces",
  "atomic-whipped-horseradish-cream": "Dressings & cold sauces",
  "caesar-dressing": "Dressings & cold sauces",
  "caramelized-miso-aioli": "Dressings & cold sauces",
  "ranch-dressing": "Dressings & cold sauces",
  "red-wine-vinaigrette": "Dressings & cold sauces",
  // Butters & fats
  "calabrian-chili-butter": "Butters & fats",
  "foie-gras-butter": "Butters & fats",
  "preserved-lemon-bacon-butter": "Butters & fats",
  "whipped-butter": "Butters & fats",
  // Veg production
  "brown-butter-roasted-cauliflower": "Veg production",
  "butternut-squash-puree-tart-layer": "Veg production",
  "cooked-holy-trinity-tart-filling": "Veg production",
  "gigante-beans-expo-garnish": "Veg production",
  "pumpkin-chestnut-oyster-mushroom-topping": "Veg production",
  "roasted-butternut-squash-dice-tart-filling": "Veg production",
  "roasted-garlic-puree": "Veg production",
  "roasted-pumpkin-small-dice": "Veg production",
  "shaved-brussels-sprout-green-apple-garnish": "Veg production",
  "silky-cauliflower-puree": "Veg production",
  "slow-roasted-steakhouse-tomatoes": "Veg production",
  "spinach-oyster-mushroom-duxelle": "Veg production",
  "poached-figs": "Veg production",
  // Starches, doughs & pastry
  "brussels-sprout-gnocchi-pickup": "Starches, doughs & pastry",
  "butternut-squash-feta-tart-for-duck-prosciutto-scallops": "Starches, doughs & pastry",
  "feta-custard-tart-layer": "Starches, doughs & pastry",
  "fluffed-phyllo-clarified-butter-tart-top": "Starches, doughs & pastry",
  "house-potato-gnocchi": "Starches, doughs & pastry",
  "pasta-dough": "Starches, doughs & pastry",
  "robuchon-style-yukon-gold-pommes-puree": "Starches, doughs & pastry",
  "savory-bacon-challah-bread-pudding": "Starches, doughs & pastry",
  "sweet-potato-parsnip-gruyere-pave": "Starches, doughs & pastry",
  // Pickles, relishes & condiments
  "cherry-smoked-grape-chutney": "Pickles, relishes & condiments",
  "house-made-hot-honey-glaze": "Pickles, relishes & condiments",
  "parsley-lemon-gremolata": "Pickles, relishes & condiments",
  "pickled-yellow-mustard-seeds": "Pickles, relishes & condiments",
  "preserved-lemon-fennel-relish": "Pickles, relishes & condiments",
  "quick-pickled-shishito-peppers": "Pickles, relishes & condiments",
  "suncrisp-apple-butter": "Pickles, relishes & condiments",
  // Fillings
  "black-garlic-deviled-egg-filling": "Fillings",
  "winter-rockefeller-filling": "Fillings",
  // Garnishes & crunch
  "bacon-crumbs": "Garnishes & crunch",
  "crispy-caper-preserved-lemon-crumb": "Garnishes & crunch",
  "crispy-sage-leaves-brown-butter-finish": "Garnishes & crunch",
  "lobster-shell-pangrattato": "Garnishes & crunch",
  "marcona-almond-praline-honey-caramel": "Garnishes & crunch",
  "rice-paper-nori-chips": "Garnishes & crunch",
  "toasted-hazelnuts": "Garnishes & crunch",
  // Seasonings & dredges
  "chicken-flour-seasoning": "Seasonings & dredges",
  "togarashi-flour-dredge": "Seasonings & dredges",
};

// For recipes not in the library list. First match wins.
const BY_NAME = [
  [/dressing|vinaigrette|aioli|mayo|mignonette|ranch|remoulade|crema\b/i, "Dressings & cold sauces"],
  [/\b(oil|butter|lard|tallow|fat|schmaltz)\b/i, "Butters & fats"],
  [/stock|broth|sauce|demi|jus|reduction|veloute|velouté|soup|bisque|chowder|mole|gravy|glace/i, "Stocks, soups & sauces"],
  [/pickle|relish|chutney|jam|gremolata|compote|glaze|mostarda|salsa|chimichurri|pesto/i, "Pickles, relishes & condiments"],
  [/filling/i, "Fillings"],
  [/crumb|chip|crisp|praline|pangrattato|toasted|candied|brittle|tuile/i, "Garnishes & crunch"],
  [/dredge|seasoning|rub|spice|dust|brine|cure\b/i, "Seasonings & dredges"],
  [/dough|pasta|gnocchi|bread|pave|pavé|potato|risotto|rice|polenta|tart|pastry|phyllo|puff/i, "Starches, doughs & pastry"],
  [/beef|pork|chicken|duck|lamb|veal|venison|quail|wagyu|short rib|meatball|salmon|fish|shrimp|scallop|lobster|crab|oyster|confit|braise/i, "Proteins"],
  [/roasted|puree|purée|squash|pumpkin|cauliflower|carrot|beet|mushroom|onion|tomato|brussels|kale|spinach|bean|fig|apple|pear|veg/i, "Veg production"],
];

export function isDishBuild(r) {
  if (r.kind) return r.kind === "dish";
  return r.isSubRecipe === false;
}

export function recipeGroup(r) {
  if (isDishBuild(r)) return DISH_GROUP;
  if (BY_ID[r.id]) return BY_ID[r.id];
  const hit = BY_NAME.find(([re]) => re.test(r.name || ""));
  return hit ? hit[1] : "Other recipes";
}

// [{ name, recipes }] in RECIPE_GROUPS order, A–Z inside each, empty groups left out.
export function groupRecipes(recipes) {
  const map = new Map(RECIPE_GROUPS.map((g) => [g, []]));
  for (const r of recipes) map.get(recipeGroup(r)).push(r);
  return [...map]
    .filter(([, list]) => list.length)
    .map(([name, list]) => ({ name, recipes: list.sort((a, b) => a.name.localeCompare(b.name)) }));
}
