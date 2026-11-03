# Chef screens (planned)

Chef-only screens in The Pass. Nothing here is built yet. These are Bryan's requirements, collected as they come up.

## Already decided
- **Edit station setup:** scaling, adding prep items, and changing an item's pan (e.g. ninth pan → sixth pan). Only the chef can do this.
- **Walk-in count:** the chef enters it at the end of the night. It's combined with the line cook's lowboy count to build the next shift's Collect list.
- **Staff roster:** manage names and their linked initials.
- **Storage zones:** set up the walk-in and dry-storage zones (Protein, Dairy, Produce, Dry…), give every ingredient a dedicated zone (AP flour to lobster stock), and set the order. The line cook's gather list follows that order. See `recipe-data-gaps.md`.

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
