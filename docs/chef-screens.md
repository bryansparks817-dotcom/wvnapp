# Chef screens (planned)

Chef-only screens in The Pass, with Bryan's requirements collected as they come up. The chef sign-in and Home screen are built; the rest is planned.

## Built: chef sign-in and Home (Bryan, 2026-11-04)
The chef side looks and works like the line cook side: same header, initials pill (tap to sign out), and bottom tabs **Home · Plan · Recipes · Line**. The chef signs in by name on the same sign-in screen as the cooks (`thePass.chef.v1`, once a day). Code: `src/chef/ChefHome.jsx`, `src/lib/crew.js`.

Home shows, top to bottom:
1. **Covers** for Lunch or Dinner (picked by time of day, tap to switch), typed in by the chef until OpenTable is connected (`thePass.covers.v1`), plus the **service time** for that shift.
2. **Crew:** each cook on an open shift, with green / yellow (IN MARGIN) / red (BEHIND), steps done, minutes behind, start time, and **projected finish against service** (flagged AFTER SERVICE when late). The chef sets the margin ("RED AFTER N MIN BEHIND", `thePass.chefSettings.v1`, default 15). A cook who signed in but hasn't confirmed a count shows as SIGNED IN. Stations with items but nobody on them show under **NO ONE ON**. Scheduled-but-not-in needs the staff schedule (later).
3. **86 / Low** board (tap a chip to clear).
4. **Low ingredients:** today's SHORT alerts with each item's scaled amount, newest first, with GOT IT to acknowledge. Walk-in stock levels join this once the walk-in count exists.
5. **Last close** per station: when, who, the note left for the next shift, and anything tossed today.
6. **Your to-dos:** shifts never closed, prep items with no recipe in the app, and stations with no items set up.

How status is worked out: the clock starts at the cook's gather FINISH (`shift.gatherDoneAt`). Every prep step has a planned start (`at`) and hands-on time; the first unticked step that should already be done sets how far behind the cook is. Projected finish = start + planned total + minutes behind. Until the shared database exists, the board only sees the cooks on this phone.

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
