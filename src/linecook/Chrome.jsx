// Header and bottom tabs shared by the line cook screens.

export function PassHeader({ station, children }) {
  return (
    <header className="pass__header">
      <div className="pass__brandrow">
        <div className="pass__brand">
          <span className="pass__brandbar" aria-hidden="true" />
          <span className="pass__wordmark">THE PASS</span>
        </div>
        <span className="pass__station">{station}</span>
      </div>
      {children}
    </header>
  );
}

const TABS = [
  { id: "today", label: "Today", path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { id: "count", label: "Count", path: "M4 6h16M4 12h16M4 18h10" },
  { id: "chef", label: "Chef", path: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

export function TabBar({ screen, setScreen, onOpenChef }) {
  return (
    <nav className="pass__tabs" aria-label="Main">
      {TABS.map((tab) => (
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
