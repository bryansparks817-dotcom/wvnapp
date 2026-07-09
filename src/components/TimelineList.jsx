import { useMemo, useState } from "react";
import { buildScheduleRows } from "../lib/scheduleRows";
import { recomputeRows } from "../lib/rescheduler";
import { formatMinutes, formatClockTime } from "../lib/format";

function formatDiff(diffMinutes) {
  if (diffMinutes === 0) return "on time";
  const sign = diffMinutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(diffMinutes)} min`;
}

export default function TimelineList({ chefTimeline, passiveLanes, totalOptimizedMinutes, totalSequentialMinutes }) {
  const [startTime, setStartTime] = useState("09:00");
  const [completed, setCompleted] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  const baseRows = useMemo(
    () => buildScheduleRows({ chefTimeline, passiveLanes }),
    [chefTimeline, passiveLanes]
  );

  const rows = useMemo(() => {
    const adjusted = recomputeRows(baseRows, completed);
    return baseRows
      .map((row) => ({ ...row, adjStart: adjusted.get(row.key).start, adjEnd: adjusted.get(row.key).end }))
      .sort((a, b) => a.adjStart - b.adjStart || a.adjEnd - b.adjEnd);
  }, [baseRows, completed]);

  const savedMinutes = totalSequentialMinutes - totalOptimizedMinutes;

  function startEditing(row) {
    setEditingKey(row.key);
    setDraftValue(String(row.end - row.start));
  }

  function cancelEditing() {
    setEditingKey(null);
    setDraftValue("");
  }

  function confirmDone(row) {
    const actualMinutes = Number(draftValue);
    if (!Number.isFinite(actualMinutes) || actualMinutes < 0) return;
    setCompleted((prev) => ({ ...prev, [row.key]: actualMinutes }));
    setEditingKey(null);
    setDraftValue("");
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
          const isEditing = editingKey === row.key;
          const diff = isDone ? actualMinutes - planned : null;

          return (
            <li key={row.key} className={`schedule-row ${isDone ? "schedule-row--done" : ""}`}>
              <span className="schedule-row__time">
                {formatClockTime(startTime, row.adjStart)} – {formatClockTime(startTime, row.adjEnd)}
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
                ) : isEditing ? (
                  "actual minutes:"
                ) : (
                  `${formatMinutes(planned)}`
                )}
              </span>

              <span className="schedule-row__actions">
                {isDone ? (
                  <span className="schedule-row__done-mark">Done</span>
                ) : isEditing ? (
                  <span className="schedule-row__edit">
                    <input
                      type="number"
                      min="0"
                      className="schedule-row__edit-input"
                      value={draftValue}
                      autoFocus
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmDone(row);
                        if (e.key === "Escape") cancelEditing();
                      }}
                    />
                    <button type="button" className="schedule-row__save-button" onClick={() => confirmDone(row)}>
                      Save
                    </button>
                    <button type="button" className="schedule-row__cancel-button" onClick={cancelEditing}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className="schedule-row__done-button" onClick={() => startEditing(row)}>
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
