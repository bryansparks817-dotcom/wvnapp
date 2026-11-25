import { useEffect, useState } from "react";
import { KITCHEN_MODES } from "../lib/events";
import { isLocalOnly, onSyncStatus, setLocalOnly, signOutKitchen, syncConfigured, syncNow } from "../lib/sync";

// Setup: the things a chef configures now and then, kept out of the daily
// oversight tabs. Recipes live here instead of having their own tab.
const ROWS = [
  { id: "manage", name: "Recipes", sub: "Add, edit or import recipe sheets." },
  { id: "prices", name: "Ingredient prices", sub: "$ per kg. Drives recipe cost, waste $ and food cost." },
  { id: "staff", name: "Staff & station access", sub: "Add people, set roles, stations and PINs." },
  { id: "plan", name: "Prep plan tool", sub: "Pick recipes and see a gather list and timeline." },
  { id: "stations", name: "Stations, items & pars", sub: "Add stations and items. Pan size, line and lowboy pars, shelf life." },
  { id: null, name: "Storage zones", sub: "Walk-in and dry storage zones and their order. Coming." },
];

function SyncRow() {
  const [st, setSt] = useState({ state: "off" });
  useEffect(() => onSyncStatus(setSt), []);
  if (!syncConfigured) return <p className="pass__hint">Shared data isn’t set up for this build yet, so everything stays on this phone.</p>;
  const label = isLocalOnly()
    ? "This phone is on its own: nothing is shared."
    : navigator.onLine === false ? `No signal: working on this phone${st.unsynced ? `, ${st.unsynced} change${st.unsynced === 1 ? "" : "s"} waiting to sync` : ""}.`
    : st.unsynced > 0 ? `${st.unsynced} change${st.unsynced === 1 ? "" : "s"} from this phone waiting to sync.`
    : st.state === "live" ? "Connected: this phone shares data with the kitchen."
    : st.state === "error" ? `Not syncing: ${st.error}`
    : st.state === "connecting" ? "Connecting…" : "Not connected.";
  return (
    <div className="chef__syncrow">
      <span className={`pass__mono ${st.state === "live" && !isLocalOnly() ? "pass__vine" : "pass__amber"}`}>{label}</span>
      {isLocalOnly() ? (
        <button type="button" className="pass__ghost" onClick={() => { setLocalOnly(false); window.location.reload(); }}>Connect to the kitchen</button>
      ) : (
        <>
          {st.unsynced > 0 && <button type="button" className="pass__ghost" onClick={syncNow}>Sync now</button>}
          <button type="button" className="pass__ghost" onClick={signOutKitchen}>Disconnect this phone</button>
        </>
      )}
    </div>
  );
}

// Restaurant line or private chef & catering, for this phone.
function ModeRow({ mode, onMode }) {
  const current = KITCHEN_MODES.find((m) => m.id === mode);
  return (
    <div className="chef__mode">
      <span className="pass__countlabel">KITCHEN TYPE</span>
      <div className="chef__servicetoggle" role="group" aria-label="Kitchen type">
        {KITCHEN_MODES.map((m) => (
          <button key={m.id} type="button" className={mode === m.id ? "is-on" : undefined} aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
            {m.id === "private" ? "PRIVATE CHEF" : "RESTAURANT"}
          </button>
        ))}
      </div>
      <p className="pass__hint">{current?.name}: {current?.sub} Only this phone switches; events are shared.</p>
    </div>
  );
}

export default function ChefSetup({ onOpen, mode = "restaurant", onMode }) {
  // Private chef mode has no stations, pans or line counts.
  const rows = mode === "private" ? ROWS.filter((r) => !["stations", "plan"].includes(r.id) && r.name !== "Storage zones") : ROWS;
  return (
    <>
    {onMode && <ModeRow mode={mode} onMode={onMode} />}
    <SyncRow />
    <ul className="chef__setup">
      {rows.map((r) => (
        <li key={r.name}>
          <button type="button" className="chef__setuprow" disabled={!r.id} onClick={() => r.id && onOpen(r.id)}>
            <span className="pass__rowtext">
              <span className="pass__rowname">{r.name}</span>
              <span className="pass__rowsub">{r.sub}</span>
            </span>
            {r.id && <span className="pass__open">OPEN ›</span>}
          </button>
        </li>
      ))}
    </ul>
    </>
  );
}
