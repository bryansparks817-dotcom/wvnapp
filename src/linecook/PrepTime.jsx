import { formatMinutes } from "../lib/format";

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Prep: how much work the list is. The big number is the cook's own hands-on
// time; the line under it says when everything would be finished (long
// simmers and rests run alongside other work) and what takes the longest.
export default function PrepTime({ time, startAt = null }) {
  const doneAt = (startAt ?? Date.now()) + time.total * 60000;
  return (
    <div className="pass__preptime" aria-live="polite">
      <span className="pass__countlabel">YOUR HANDS-ON TIME · {time.count} ITEM{time.count === 1 ? "" : "S"}</span>
      <span className="pass__preptimebig">{time.handsOn ? formatMinutes(time.handsOn) : "0 min"}</span>
      {time.total > 0 && (
        <span className="pass__hint">
          All done by about {clock(doneAt)}{time.longest && time.total > time.handsOn ? ` (${time.longest.name} takes longest: ${formatMinutes(time.longest.minutes)} start to finish)` : ""}.
        </span>
      )}
      {time.tomorrow?.length > 0 && (
        <span className="pass__hint">
          Overnight: {time.tomorrow.map((t) => `${t.name} rests overnight${t.handsOn ? `, about ${formatMinutes(t.handsOn)} to finish tomorrow` : ""}`).join("; ")}.
        </span>
      )}
    </div>
  );
}
