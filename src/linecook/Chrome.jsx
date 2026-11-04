import { TABS } from "./tabs";
// Header and bottom tabs shared by the line cook screens.

export function PassHeader({ station, initials, onChangeCook, children }) {
  return (
    <header className="pass__header">
      <div className="pass__brandrow">
        <div className="pass__brand">
          <span className="pass__brandbar" aria-hidden="true" />
          <span className="pass__wordmark">THE PASS</span>
        </div>
        <span className="pass__headright">
          {typeof station === "string" ? <span className="pass__station">{station}</span> : station}
          {initials && (
            <button type="button" className="pass__initials" onClick={onChangeCook} aria-label={`Signed in as ${initials}. Change cook`}>
              {initials}
            </button>
          )}
        </span>
      </div>
      {children}
    </header>
  );
}

// Station picker: a drop-down of the stations this cook can open. Each keeps
// its own counts and lists. Uses the phone's own picker.
export function StationTabs({ stations, current, onPick }) {
  return (
    <label className="pass__stationpick">
      <span className="pass__visuallyhidden">Station</span>
      <select value={current} onChange={(e) => onPick(e.target.value)}>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </label>
  );
}

export function TabBar({ screen, setScreen, onOpenChef, tabs = TABS }) {
  return (
    <nav className="pass__tabs" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`pass__tab${screen === tab.id ? " is-active" : ""}`}
          aria-current={screen === tab.id ? "page" : undefined}
          onClick={() => (tab.id === "chef" ? onOpenChef() : setScreen(tab.id))}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={tab.path} />
          </svg>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function CheckBox({ checked, tone = "vine" }) {
  return (
    <span className={`pass__check pass__check--${tone}${checked ? " is-checked" : ""}`} aria-hidden="true">
      {checked && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}
