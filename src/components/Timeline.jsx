import { formatMinutes } from "../lib/format";

const PALETTE = [
  "#2f6f4f",
  "#a8562c",
  "#3b5b8c",
  "#8c3b6e",
  "#7a7a2f",
  "#2f7a7a",
  "#8c4b3b",
  "#5b3b8c",
];

function buildColorMap(recipeIds) {
  const map = new Map();
  recipeIds.forEach((id, i) => map.set(id, PALETTE[i % PALETTE.length]));
  return map;
}

function TimelineRow({ label, blocks, totalMinutes, colorMap }) {
  return (
    <div className="timeline-row">
      <div className="timeline-row__label">{label}</div>
      <div className="timeline-row__track">
        {blocks.map((block, i) => {
          const left = (block.start / totalMinutes) * 100;
          const width = ((block.end - block.start) / totalMinutes) * 100;
          return (
            <div
              key={i}
              className="timeline-block"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: colorMap.get(block.recipeId),
              }}
              title={`${block.recipeName} — ${block.stepName} (${formatMinutes(block.start)}–${formatMinutes(block.end)})`}
            >
              <span className="timeline-block__label">
                {block.recipeName}: {block.stepName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Timeline({ chefTimeline, passiveLanes, totalOptimizedMinutes, totalSequentialMinutes }) {
  const allRecipeIds = Array.from(
    new Set([
      ...chefTimeline.map((b) => b.recipeId),
      ...passiveLanes.lanes.map((b) => b.recipeId),
    ])
  );
  const colorMap = buildColorMap(allRecipeIds);

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((totalOptimizedMinutes / tickCount) * i)
  );

  const savedMinutes = totalSequentialMinutes - totalOptimizedMinutes;

  const passiveByLane = [];
  for (const block of passiveLanes.lanes) {
    if (!passiveByLane[block.lane]) passiveByLane[block.lane] = [];
    passiveByLane[block.lane].push(block);
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

      <div className="timeline-axis">
        {ticks.map((t, i) => (
          <span key={i} className="timeline-axis__tick" style={{ left: `${(i / tickCount) * 100}%` }}>
            {formatMinutes(t)}
          </span>
        ))}
      </div>

      <TimelineRow label="Chef (active)" blocks={chefTimeline} totalMinutes={totalOptimizedMinutes} colorMap={colorMap} />

      {passiveByLane.map((blocks, i) => (
        <TimelineRow
          key={i}
          label={i === 0 ? "Passive" : ""}
          blocks={blocks}
          totalMinutes={totalOptimizedMinutes}
          colorMap={colorMap}
        />
      ))}
    </div>
  );
}
