# Chef screens (planned)

Chef-only screens in The Pass, with Bryan's requirements collected as they come up. The chef sign-in and Home screen are built; the rest is planned.

## Built: chef sign-in and Home (Bryan, 2026-11-04)
The chef side looks and works like the line cook side: same header, initials pill (tap to sign out), and bottom tabs **Home · Crew · Stock · Line**. **The chef pages are for management, oversight and hole plugging, not recipe access (Bryan, 2026-11-04).** Setup is done once and then only for new menu items, so it's a link at the bottom of Home, not a tab. It holds Recipes, the prep plan tool, and (coming) stations/items/pars, staff and station access, and storage zones.

- **Crew:** every cook's card with status, plus what they're on NOW, collect progress, and each prep item's state (not started, n/N steps, done, no recipe, can't make, skipped; ↓ = scaled down).
- **Hole plugging (Crew, 2026-11-04)** (`src/lib/chefActions.js`). Each change is saved on that station's shift and shows on the cook's screen in a blue **FROM CHEF** card (GOT IT clears it):
  - **DO FIRST:** the scheduler puts that item's recipe (and any sub-recipe it needs) ahead of the longest-remaining rule (`shift.bump`). The cook's list re-orders and the item's steps are tagged CHEF: DO THIS FIRST. Ticks are saved per recipe step (`parts`), so re-ordering keeps them.
  - **SKIP / PUT BACK:** takes an item off today's list (`shift.skip`) or puts it back. Skipped items leave the gather list, prep steps and the cook's status.
  - **+ Add a one-off item:** any recipe, any grams, added to that cook's list (`extra: true`). It joins the gather list and prep steps; finishing it doesn't change the count or print a label, since it has no pan or par.
  - Not built yet: moving an item to another cook or station. That needs a second station with items (station setup). Until the shared database exists, changes only reach cooks on the same phone.
- **Stock:** the 86 / low board (the chef can flag any item on any station), short-ingredient alerts, last close and waste. The walk-in count and the end-of-night par report go here next. The chef signs in by name on the same sign-in screen as the cooks (`thePass.chef.v1`, once a day). Code: `src/chef/ChefHome.jsx`, `src/lib/crew.js`.

Home shows, top to bottom:
0. **Last 7 days (Bryan, 2026-11-04):** rolling food %, labor % and prime % (food + labor) of sales, each with its change vs the week before (▲ red = cost went up). The chef types in each day's sales, food purchases and labor $ until the POS and payroll are connected (`thePass.dailyNumbers.v1`, `src/lib/numbers.js`). Food is purchases ÷ sales for now; a true food cost needs the walk-in count and ingredient pricing.
1. **Covers** for Lunch or Dinner (picked by time of day, tap to switch), typed in by the chef until OpenTable is connected (`thePass.covers.v1`), plus the **service time** for that shift.
2. **Crew:** each cook on an open shift, with green / yellow (IN MARGIN) / red (BEHIND), steps done, minutes behind, start time, and **projected finish against service** (flagged AFTER SERVICE when late). The chef sets the margin ("RED AFTER N MIN BEHIND", `thePass.chefSettings.v1`, default 15). A cook who signed in but hasn't confirmed a count shows as SIGNED IN. Stations with items but nobody on them show under **NO ONE ON**. Scheduled-but-not-in needs the staff schedule (later).
3. **86 / Low** board (tap a chip to clear).
4. **Low ingredients:** today's SHORT alerts with each item's scaled amount, newest first, with GOT IT to acknowledge. Walk-in stock levels join this once the walk-in count exists.
5. **Last close** per station: when, who, the note left for the next shift, and anything tossed today.
6. **Your to-dos:** shifts never closed, prep items with no recipe in the app, and stations with no items set up.

How status is worked out: the clock starts at the cook's gather FINISH (`shift.gatherDoneAt`). Every prep step has a planned start (`at`) and hands-on time; the first unticked step that should already be done sets how far behind the cook is. Projected finish = start + planned total + minutes behind. Until the shared database exists, the board only sees the cooks on this phone.

## Built: Data tab, prices and recipe lookup (Bryan, 2026-11-05)
The chef side is mostly about collecting and analyzing data, not the daily grind, but the chef must still be able to reach recipes. Tabs are now **Home · Crew · Stock · Data · Line**.

What gets collected:
- **Shift history** (`thePass.history.v1`, `src/lib/history.js`): when a cook saves the close count, the shift is boiled down to one record: cook, planned vs actual finish, minutes behind (only for finished lists; unfinished ones are counted separately), and per item the grams planned/made and the real time it took (only when every step of that item was ticked). Step ticks are now timestamps.
- **Flag log** (`thePass.flagLog.v1`): every 86 / low flag, from cooks or the chef.
- **Ingredient prices** (`thePass.prices.v1`, `src/chef/Prices.jsx`): $ per kg as bought, typed in under Setup → Ingredient prices. Recipe cost per kg is worked out from them (`src/lib/costing.js`), sub-recipes included. Vendor CSV import comes later.

The Data tab (`src/chef/Insights.jsx`, `src/lib/analytics.js`), last 7 or 28 days:
1. **Waste in dollars:** waste log × recipe cost, by item and reason.
2. **Par check:** RAISE (86'd or low often), LOWER (tossed for shelf life often), WATCH, OK.
3. **Prep per 100 covers:** grams made per 100 covers per item, plus a forecast for a covers number the chef types in. Prep made stands in for usage until real usage is counted.
4. **Cooks:** average minutes behind, on-time %, unfinished lists, per cook.
5. **Real recipe times:** planned vs real time per recipe. USE REAL scales that recipe's hands-on steps by the drift (clamped 0.5–2×) so the scheduler plans with real times; older shifts are ignored after that.
6. **Shortages:** which ingredients ran short, how often.
7. **Food cost:** theoretical (prep made × recipe cost) vs actual (purchases ÷ sales). Theoretical only covers prep made in The Pass, so it reads far below actual until the full menu is in.

**Sample crew (Bryan, 2026-11-05):** "Try it with a sample crew and six weeks of history" adds one made-up cook per station, each with a random effectiveness (one per band, weak to strong). Effectiveness sets how fast they really work against recipe times (0.85×–1.5×) and how often they burn or drop a batch. It writes 42 days of shift history, waste, flags and shortages (marked `sample`, next to real data, never over it), and puts every cook on today's shift part way through their list so Crew and hole plugging have something to work on. Reshuffle, restart today's shifts, or remove it all from the Sample crew card on Data (`src/lib/sampleData.js`). Grill, Sauté, Pastry and Prep items and recipes are made up (`src/data/sampleStations.json`) until the real menu goes in.

**Plan at a cook's pace:** Data → Cooks shows how fast each cook works against the recipe times. PLAN AT 1.2× stretches the hands-on steps on that cook's prep list (line screen and crew board) to their real speed (`thePass.chefSettings.v1` `cookPace`, `src/lib/pace.js`). The par check now only counts shelf-life tosses; burned or dropped batches say nothing about the par.

**Recipe lookup** on Home: search, then a read-only recipe (ingredients and method). Editing stays under Setup → Recipes. A "Chef? Open the chef view" link sits on the line sign-in screen.

Until the shared database exists, all of this lives on one phone.

## Built: staff profiles and PINs (Bryan, 2026-11-09)
Setup → Staff & station access (`src/chef/Staff.jsx`): add, edit and remove people. Each has a name, initials (unique), role (cook or chef), the stations they can open, and a 4-digit PIN. Removing someone keeps their name on old counts and history (`active: false`).
- Sign-in: tap your name, enter your PIN. A wrong PIN is refused; the chef resets forgotten ones.
- Only chefs can open the chef view. The very first chef sign-in sets up the first chef with a PIN; after that, new names can't add themselves on the sign-in screens.
- The last chef can't be removed or made a cook.
- The PIN keeps one cook from signing in as another on a shared phone. Real accounts come with the shared database.

## Already decided
- **Edit station setup:** scaling, adding prep items, and changing an item's pan (e.g. ninth pan → sixth pan). Only the chef can do this.
- **Walk-in count:** the chef enters it at the end of the night. It's combined with the line cook's lowboy count to build the next shift's Collect list.
- **Staff roster:** manage names and their linked initials.
- **Station access (Bryan, 2026-11-04):** in each cook's profile, the chef toggles which stations (Garde manger, Grill, Sauté, Pastry, Prep) that cook can open. In the beta every cook can open all of them.
- **Storage zones:** set up the walk-in and dry-storage zones (Protein, Dairy, Produce, Dry…), give every ingredient a dedicated zone (AP flour to lobster stock), and set the order. The line cook's gather list follows that order. See `recipe-data-gaps.md`.

## Short alerts (Bryan, 2026-11-04)
- When an ingredient is too short for a full production run, The Pass scales the affected items down to what's on hand (the lowest ingredient sets the batch) and sends the chef a message naming the ingredient: station, grams needed vs. on hand, and each item's planned vs. scaled amount, who flagged it and when. Stored today in `thePass.chefAlerts.v1`.

## Live crew board (Bryan, 2026-11-03)
- Shows **who is logged on**, on each station.
- Each cook is color-coded **green, yellow, or red** based on productivity, meaning how far along they are on their prep list for the day.
- Shows each cook's notes.
- **Colors (Bryan, 2026-11-03).** Each cook is compared against the schedule from their optimized prep plan:
  - **Green:** on schedule or ahead of it.
  - **Yellow:** some steps done on time and some behind, but still within a **margin of error the chef sets**.
  - **Red:** behind by more than that margin.
- **Schedule start (Bryan, 2026-11-03):** the clock starts when the cook finishes their gather list and is given their prep list (they tap FINISH on the Gather page). Gather itself isn't timed.
- **Possible add-in:** a set amount of time for gather that scales with the size of the gather list, so gather could be timed too.

## End-of-night par report (Bryan, 2026-11-03)
- At the end of the night, the chef receives **one consolidated list** of the levels of every item on every station against its pars (line par and lowboy par). It's built from each station's close count, plus the walk-in.
- Open questions for later: whether it is pushed as a notification, a screen, or a printout, and whether it flags items under par or lists everything.

## Needs first
Both the crew board and the par report need a **shared database** (Supabase, deferred). Today each phone only saves to itself, so the chef's phone can't see the cooks' progress or counts yet.
