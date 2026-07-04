import { useState } from "react";
import { buildScheduleRows } from "../lib/scheduleRows";
import { formatMinutes, formatClockTime } from "../lib/format";

function formatDiff(diffMinutes) {
  if (diffMinutes === 0) return "on time";
  const sign = diffMinutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(diffMinutes)} min`;
}

export default function TimelineList({ chefTimeline, passiveLanes, totalOptimizedMinutes, totalSequentialMinutes }) {
  const [startTime, setStartTime] = useState("09:00");
  const [completed, setCompleted] = useState({});

  const rows = buildScheduleRows({ chefTimeline, passiveLanes });
  const savedMinutes = totalSequentialMinutes - totalOptimizedMinutes;

  function handleDone(row) {
    const planned = row.end - row.start;
    const input = window.prompt(`Actual minutes for "${row.stepName}"?`, String(planned));
    if (input === null) return;
    const actualMinutes = Number(input);
    if (!Number.isFinite(actualMinutes) || actualMinutes < 0) return;
    setCompleted((prev) => ({ ...prev, [row.key]: actualMinutes }));
  }

  return (
    <div className="timeline">
      <div className="timeline-summary">
        <div className="timeline-summary__stat">
          <span className="timeline-summary__value">{formatMinutes(totalOptimizedMinutes)}</span>
          <span className="timeline-summary__caption">Optimized total</span>
        </div>
        <div className="timeline-summary__stat">
          <span className="timeline-summary__value">{formatMinutes(totalSequentialMinutes)}</span>
          <span className="timeline-summary__caption">Sequential (naive) total</span>
        </div>
        <div className="timeline-summary__stat timeline-summary__stat--highlight">
          <span className="timeline-summary__value">{formatMinutes(Math.max(0, savedMinutes))}</span>
          <span className="timeline-summary__caption">Time saved</span>
        </div>
      </div>

      <label className="schedule-start">
        Start time
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </label>

      <ul className="schedule-list">
        {rows.map((row) => {
          const planned = row.end - row.start;
          const actualMinutes = completed[row.key];
          const isDone = actualMinutes !== undefined;
          const diff = isDone ? actualMinutes - planned : null;

          return (
            <li key={row.key} className={`schedule-row ${isDone ? "schedule-row--done" : ""}`}>
              <span className="schedule-row__time">
                {formatClockTime(startTime, row.start)} – {formatClockTime(startTime, row.end)}
              </span>

              <span className={`schedule-row__badge schedule-row__badge--${row.type}`}>{row.type}</span>

              <span className="schedule-row__info">
                <span className="schedule-row__name">{row.stepName}</span>
                <span className="schedule-row__recipe">{row.recipeName}</span>
              </span>

              <span className="schedule-row__duration">
                {isDone ? (
                  <>
                    {formatMinutes(planned)} planned · {formatMinutes(actualMinutes)} actual (
                    {formatDiff(diff)})
                  </>
                ) : (
                  `${formatMinutes(planned)}`
                )}
              </span>

              <span className="schedule-row__actions">
                {isDone ? (
                  <span className="schedule-row__done-mark">Done</span>
                ) : (
                  <button type="button" className="schedule-row__done-button" onClick={() => handleDone(row)}>
                    Done
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
