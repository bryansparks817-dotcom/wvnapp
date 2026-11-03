# The Pass: line cook screens

These are the screens a line cook sees. Chef-only screens (scaling, adding prep items, changing an item's pan) come later as their own set.

## Opening the app
- **No count yet today:** "Count first." with a Start Count button. The prep list is built from the count.
- **Count done:** the Today screen. It shows the 86 board (when there's anything on it), then **1 · Collect**, then **2 · Prep**.

## The count
- Each item is counted in **25% steps of the pan it lives in**. For example, the relish lives in a ninth pan, so half full is 50%.
- Par is a full pan (100%) for now.
- If the item is under par, the cook marks what's in the back: **None**, **Lowboy** or **Walk-in**.

## Collect vs Prep
- **COLLECT**: more is already made in the lowboy or walk-in, so just restock the line. Cooks clear these first to take them off their mind.
- **PREP**: nothing is in the back, so it gets made from scratch.

## Prep order
The prep order comes from the optimization formula in `src/lib/scheduler.js`. Whatever recipe has the most time left starts first, and its passive time (simmer, braise, chill) is filled with hands-on steps from the other recipes. Step times come from each recipe's Active/Passive method steps. Items without a recipe in the app are listed under "No recipe times yet."

## Code
- `src/linecook/`: the screens (LineCook, TodayScreen, CountScreen, Chrome, pass.css)
- `src/lib/lineList.js`: count → collect/prep lists → ordered prep plan
- `src/data/lineItems.json`: station items and pan sizes (sample data; the chef screens will edit this)
- Today's count is saved in localStorage (`thePass.lineDay.v1`) and resets each day.
