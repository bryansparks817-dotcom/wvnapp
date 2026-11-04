# The Pass: line cook screens

These are the screens a line cook sees. Chef-only screens (scaling, adding prep items, changing an item's pan) come later as their own set.

## Stations
A station drop-down in the header (where the station name sits) picks **Garde manger, Grill, Sauté, Pastry, Prep** (`src/data/stations.js`). Each station keeps its own close count, shift, gather list, collect and prep (saved per station; Garde manger keeps the original storage keys). The phone remembers the last station opened. Only Garde manger has items so far; the others say the chef still has to add their items. **Access:** in the beta every cook can open every station. The chef will toggle, in each cook's profile, which stations they can open (`person.stations` in the staff roster; no list = all).

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

## Gather
Once the count is confirmed, the cook lands on its own **Gather** page first: every raw ingredient that station's Prep list needs (carrots, shallots, tomato paste…), scaled to the grams each item has to make and summed across items, with which items use it. The cook ticks each one off as it comes out of the walk-in or dry storage. Each station's gather list is built from that station's own Prep list, so every station gets its own (today the app has one station, Garde manger; station switching comes later). A FINISH button at the bottom goes to the Collect & Prep page (1 · Collect, 2 · Prep), which has a "Back to gather list" link. Unticked items don't block finishing. Water and ice are left off. Items with no recipe in the app are named so the cook can gather from the recipe book. The list is grouped by storage zone (Protein, Dairy, Produce, House-made, Dry…) and follows whatever order the chef sets up (zone order, then item order within each zone), with a count per zone. The chef assigns every ingredient a zone (chef screen, later). Today's zones are draft guesses in `src/data/storageZones.json`.

Prep shows as one simple numbered step list, built by `buildPrepSteps` in `src/lib/lineList.js`:
- Each step is one thing to do now: a tag that says why it is there (START FIRST · LONGEST HANDS-OFF TIME, WHILE <recipe> · <its hands-off step>, BACK TO <recipe>, NEXT), the item, what to do (up to three method steps, then "+ N more"), hands-on minutes, and the hands-off time it kicks off with a one-tap TIMER.
- A recipe that opens with a hands-off step (preheat, soak) gets its own "start" step, so it is never skipped.
- When nothing hands-on is free, a dashed WAIT line says how long and what is still cooking.
- Expired backup to toss (when no prep is needed) comes first; items with no recipe times come last.
- The first unticked step is marked NOW. Each step has its own tick. Ticking an item's last step checks the item off (restock, labels, waste log). Unticking any step of a finished item reopens it.

## Code
- `src/linecook/`: the screens (LineCook, TodayScreen, CountScreen, Chrome, pass.css)
- `src/lib/lineList.js`: count → collect/prep lists → ordered prep plan
- `src/data/lineItems.json`: station items and pan sizes (sample data; the chef screens will edit this)
- Today's count is saved in localStorage (`thePass.lineDay.v1`) and resets each day.

## Counts and carry-over (agreed with Bryan, 2026-11-03)

Built on one phone (localStorage) in the line view; walk-in is sample data until the chef screens and Supabase exist. Code: `src/lib/inventory.js`.

**Setup**
- Each restaurant sets its service schedule during setup (for example, Wed–Sat dinner only, or Mon–Sun lunch and dinner). A count carries over to the **next scheduled shift**.
- Every item has a **line pan** (1/9, 1/6, 1/3…) with a **line par**, a **lowboy container** (quart or pint, with exceptions to come) with a **lowboy par**, and its weight in grams for a full pan, a quart and a pint. For example, relish: 1 qt = 950 g, full 1/9 pan = 1,000 g. The app does all the conversions, so the cook never does the math.
- Shelf life comes from the recipe sheet.

**At close**
- The **line cook** counts the line pans and the lowboy containers, both in 25% steps.
- The **chef** enters the walk-in count (chef screens).

**Next shift**
- The app opens straight to Collect and Prep, built from last night's counts. There is no "Count first" screen.
- The cook **confirms** each carried-over quantity, since the AM crew may have used some or something may have been tossed.
- **Collect** tops the line up from the lowboy and the walk-in combined, and names both (for example, "lowboy ½ qt + walk-in 1 qt"). Oldest batch first, always.
- **Prep** makes whatever is needed to bring the line **and** the lowboy back to par, in grams. It is ordered by the scheduler as before.
- **Shelf life:** each prepped item shows how much time it has left (for example, "relish · 3 days left"). Batches are tracked separately by the date they were made, which is stamped when the cook checks off the prep. On a batch's last day, the app says to toss it and make fresh, and the item goes on Prep. Shelf life counts calendar days, including days the restaurant is closed (assumed).

**Needs a shared database.** The walk-in count (chef's phone) and last night's count (closing cook's phone) both have to reach the next cook. The app currently only saves to the phone it runs on.

## Line cook tools (added 2026-11-03)
- **Who's on:** the cook taps their name, or enters their full name, at the start of each day. Each name is linked to its own initials in a staff roster (`thePass.staff.v1`): first + last initial, plus more letters of the last name if those are taken (Bryan Sparks → BS, Ben Smith → BSM). The chef screens will manage the roster. Those initials are stamped on the close count, the notes, every check-off, 86/low flags, waste entries and labels. Tap the initials pill to change cooks.
- **Recipe from a prep row:** tapping the row opens the recipe scaled to the grams Prep asks for, and the check on the left marks it done. Until a recipe has `yieldGrams`, scaling uses the total ingredient weight, which overstates yield for anything that reduces (like stock). The screen says so.
- **Timers:** every passive step has a TIMER button. A timer strip sits at the top of every screen (line and chef, "NO TIMERS RUNNING" when empty), and they beep and vibrate when done. They're saved, so they survive a reload.
- **Labels:** after prep is done, PRINT LABEL prints one label per container (the line pan plus each new qt/pt). Each shows the item, made date and time, initials, grams and USE BY (the last day of shelf life). The labels are sized for 62 mm continuous tape (DK-2205) on a Brother QL-820NWB, printed through the phone's print dialog (AirPrint / Mopria).
- **Notes for next shift:** written on the Close screen, then shown on the next shift's confirm screen and Today.
- **86 / running low:** cooks can flag any item. Tap a chip to clear it.
- **Waste log:** tossing a batch on its last day logs its grams, the reason, the cook and the time (`thePass.waste.v1`), so it can feed food cost later.
