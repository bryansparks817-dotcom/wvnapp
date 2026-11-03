import { useEffect, useRef, useState } from "react";

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

// A short three-beep alarm, made in the browser so there's no audio file.
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.25;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // no audio available
  }
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    // no vibration available
  }
}

// The timer strip: pinned to the top of every screen, line or chef. It stays
// visible when nothing is running so the space is always there to glance at.
export default function TimerBar({ timers, onDismiss }) {
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef(new Set());

  useEffect(() => {
    if (timers.length === 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers.length]);

  useEffect(() => {
    for (const t of timers) {
      if (t.endsAt <= now && !alerted.current.has(t.id)) {
        alerted.current.add(t.id);
        beep();
      }
    }
  }, [timers, now]);

  if (timers.length === 0) {
    return (
      <div className="pass__timers pass__timers--empty" role="status" aria-live="polite">
        <span className="pass__timerempty">NO TIMERS RUNNING</span>
      </div>
    );
  }
  return (
    <div className="pass__timers" role="status" aria-live="polite">
      {timers.map((t) => {
        const done = t.endsAt <= now;
        return (
          <div key={t.id} className={`pass__timer${done ? " is-done" : ""}`}>
            <span className="pass__timerlabel">{t.label}</span>
            <span className="pass__timertime">{done ? "DONE" : fmt(t.endsAt - now)}</span>
            <button type="button" className="pass__timerx" aria-label={done ? `Clear ${t.label} timer` : `Cancel ${t.label} timer`} onClick={() => onDismiss(t.id)}>
              {done ? "OK" : "✕"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
