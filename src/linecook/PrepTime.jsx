import { useEffect, useState } from "react";
import { formatMinutes } from "../lib/format";
import { prepForecast } from "../lib/prepTime";
import { loadChefSettings } from "../lib/storage";
import { todayAt } from "../lib/crew";

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const hhmm = (s) => clock(todayAt(s));

// Prep: how much work the list is. The big number is the cook's own hands-on
// time, with what's left under it. Then when the list will really be done,
// checked against the chef's prep deadline (Chef Home: PREP DONE BY), and
// anything that won't make it: start it next, or it holds over to tomorrow.
export default function PrepTime({ time, startAt = null }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const settings = loadChefSettings();
  const prepDueAt = todayAt(settings.prepDueAt);
  const f = prepForecast(time, { startAt, now, prepDueAt });
  // During the shift, the hands-on time still to do counts down under the total.
  const started = time.handsOnLeft != null;
  const late = f.doneAt != null && f.overByMin > 0;
  // Building the list after today's deadline (planning for tomorrow): no
  // finish time until the cook starts.
  const pastDue = !startAt && now > prepDueAt;
  return (
    <div className="pass__preptime" aria-live="polite">
      <span className="pass__countlabel">YOUR HANDS-ON TIME · {time.count} ITEM{time.count === 1 ? "" : "S"}</span>
      <span className="pass__preptimebig">{time.handsOn ? formatMinutes(time.handsOn) : "0 min"}</span>
      {started && time.handsOn > 0 && (
        <span className="pass__preptimeleft">
          {time.handsOnLeft > 0 ? `${formatMinutes(time.handsOnLeft)} hands-on left` : "All hands-on work done ✓"}
        </span>
      )}
      <span className="pass__hint pass__mono">PREP DONE BY {hhmm(settings.prepDueAt)} · STATIONS READY {hhmm(settings.readyAt)} · SERVICE {hhmm(settings.serviceAt.dinner)}</span>
      {pastDue && time.count > 0 && (
        <span className="pass__hint">Today’s prep deadline ({hhmm(settings.prepDueAt)}) has passed. The finish time shows once you start.</span>
      )}
      {!pastDue && f.doneAt != null && (
        <span className={`pass__hint ${late ? "chef__late" : "pass__vine"}`}>
          All done by about {clock(f.doneAt)}
          {late ? `: ${formatMinutes(f.overByMin)} past ${hhmm(settings.prepDueAt)}` : `: ${formatMinutes(-f.overByMin)} to spare`}
          {f.behindMin > 0 ? ` (running ${formatMinutes(f.behindMin)} behind the plan)` : ""}.
        </span>
      )}
      {!pastDue && f.late.length > 0 && (
        <button type="button" className="pass__ghost pass__latebtn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {f.late.length} WON’T MAKE {hhmm(settings.prepDueAt).toUpperCase()} {open ? "▴" : "▾"}
        </button>
      )}
      {!pastDue && open && f.overloaded && time.count > 0 && (
        <span className="pass__hint chef__late">
          Too much for today: {formatMinutes(time.handsOnLeft ?? time.handsOn)} of hands-on work and {formatMinutes(f.minutesLeft)} until {hhmm(settings.prepDueAt)}. Ask the chef what holds over to tomorrow.
        </span>
      )}
      {!pastDue && open && f.late.length > 0 && (
        <ul className="pass__preplate">
          {f.late.map((t, i) => (
            <li key={t.id}>
              <strong>{t.name}</strong>{" "}
              {t.holdsOver
                ? `runs until about ${clock(t.endsAt)}, past ${hhmm(settings.prepDueAt)} (${formatMinutes(t.minutes)} start to finish). It holds over: ${t.first ? "start it earlier, or hand the end of it to the line." : "start it first thing next shift."}`
                : `would finish about ${clock(t.endsAt)}.${i === f.late.findIndex((x) => !x.holdsOver) && !f.overloaded ? ` Start it next to make ${hhmm(settings.prepDueAt)}.` : ""}`}
            </li>
          ))}
        </ul>
      )}
      {time.tomorrow?.length > 0 && (
        <span className="pass__hint">
          Overnight: {time.tomorrow.map((t) => `${t.name} rests overnight${t.handsOn ? `, about ${formatMinutes(t.handsOn)} to finish tomorrow` : ""}`).join("; ")}.
        </span>
      )}
    </div>
  );
}
