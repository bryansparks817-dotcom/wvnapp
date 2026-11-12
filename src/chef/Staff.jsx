import { useState } from "react";
import { STATIONS } from "../data/stations";
import { loadStaff, saveStaff } from "../lib/storage";
import { activeStaff, hashPin, initialsFor, initialsProblem, isChef, normalizeName, validPin } from "../lib/staff";

const ROLE_LABEL = { cook: "Cook", chef: "Chef" };

function stationsLabel(p) {
  if (!Array.isArray(p.stations) || p.stations.length === 0 || p.stations.length === STATIONS.length) return "All stations";
  return STATIONS.filter((s) => p.stations.includes(s.id)).map((s) => s.name).join(", ");
}

// Add or edit one person.
function PersonForm({ person, roster, onSave, onCancel, onRemove, isLastChef }) {
  const [name, setName] = useState(person?.name ?? "");
  const [initials, setInitials] = useState(person?.initials ?? "");
  const [touchedInitials, setTouchedInitials] = useState(Boolean(person));
  const [role, setRole] = useState(person?.role ?? "cook");
  const [stations, setStations] = useState(() => (Array.isArray(person?.stations) && person.stations.length ? person.stations : STATIONS.map((s) => s.id)));
  const [pin, setPin] = useState("");

  const others = roster.filter((p) => p !== person);
  const shownInitials = touchedInitials ? initials : initialsFor(name, others);
  const nameOk = normalizeName(name).split(" ").length >= 2;
  const dupName = others.some((p) => p.active !== false && p.name.toLowerCase() === normalizeName(name).toLowerCase());
  const initialsErr = shownInitials ? initialsProblem(shownInitials, others) : null;
  const pinErr = pin && !validPin(pin) ? "4 digits." : null;
  const chefLosingRole = isLastChef && role !== "chef";
  const ok = nameOk && !dupName && shownInitials && !initialsErr && !pinErr && stations.length > 0 && !chefLosingRole;

  function toggle(id) {
    setStations((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <form
      className="chef__staffform"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        const next = {
          ...(person ?? {}),
          name: normalizeName(name),
          initials: shownInitials.trim().toUpperCase(),
          role,
          stations: stations.length === STATIONS.length ? undefined : stations,
          active: true,
        };
        if (pin) next.pinHash = hashPin(pin);
        if (!next.stations) delete next.stations;
        onSave(next);
      }}
    >
      <label className="pass__countlabel" htmlFor="staff-name">FULL NAME</label>
      <input id="staff-name" className="pass__input" value={name} autoCapitalize="words" placeholder="First and last name" onChange={(e) => setName(e.target.value)} />
      {dupName && <p className="pass__hint chef__late">Already on the staff list.</p>}

      <div className="chef__staffrow">
        <label className="chef__stafffield">
          <span className="pass__countlabel">INITIALS</span>
          <input
            className="pass__input"
            value={shownInitials}
            maxLength={4}
            autoCapitalize="characters"
            onChange={(e) => { setTouchedInitials(true); setInitials(e.target.value.toUpperCase()); }}
          />
        </label>
        <label className="chef__stafffield">
          <span className="pass__countlabel">{person?.pinHash ? "NEW PIN (OPTIONAL)" : "PIN"}</span>
          <input className="pass__input" type="password" inputMode="numeric" maxLength={4} placeholder="4 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      {(initialsErr || pinErr) && <p className="pass__hint chef__late">{initialsErr ?? pinErr}</p>}

      <span className="pass__countlabel">ROLE</span>
      <div className="chef__servicetoggle" role="group" aria-label="Role">
        {["cook", "chef"].map((r) => (
          <button key={r} type="button" className={role === r ? "is-on" : ""} aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE_LABEL[r].toUpperCase()}</button>
        ))}
      </div>
      {chefLosingRole && <p className="pass__hint chef__late">This is the only chef. Make someone else a chef first.</p>}
      <p className="pass__hint">Chefs can open the chef view. Everyone can sign in on the line.</p>

      <span className="pass__countlabel">STATIONS THEY CAN OPEN</span>
      <div className="chef__stationpicks">
        {STATIONS.map((s) => (
          <label key={s.id} className={`chef__stationpick ${stations.includes(s.id) ? "is-on" : ""}`}>
            <input type="checkbox" checked={stations.includes(s.id)} onChange={() => toggle(s.id)} />
            {s.name}
          </label>
        ))}
      </div>

      <div className="chef__sampleactions">
        <button type="submit" className="pass__cta" disabled={!ok}>{person ? "SAVE" : "ADD TO STAFF"}</button>
        <button type="button" className="pass__ghost" onClick={onCancel}>Cancel</button>
        {person && onRemove && <button type="button" className="pass__ghost chef__late" disabled={isLastChef} onClick={onRemove}>Remove</button>}
      </div>
    </form>
  );
}

// Setup → Staff: add and maintain everyone who signs in.
export default function Staff() {
  const [roster, setRoster] = useState(() => loadStaff());
  const [editing, setEditing] = useState(null); // person, "new", or null
  const people = activeStaff(roster).sort((a, b) => (isChef(b) - isChef(a)) || a.name.localeCompare(b.name));
  const chefs = people.filter(isChef);

  function commit(next) {
    setRoster(next);
    saveStaff(next);
    setEditing(null);
  }

  if (editing) {
    const person = editing === "new" ? null : editing;
    return (
      <PersonForm
        person={person}
        roster={roster}
        isLastChef={Boolean(person && isChef(person) && chefs.length === 1)}
        onCancel={() => setEditing(null)}
        onSave={(p) => commit(person ? roster.map((x) => (x === person ? p : x)) : [...roster.filter((x) => !(x.active === false && x.initials === p.initials)), p])}
        onRemove={() => commit(roster.map((x) => (x === person ? { ...x, active: false } : x)))}
      />
    );
  }

  return (
    <section className="chef__data">
      <div className="pass__sectionhead">
        <h2>Staff</h2>
        <span className="pass__countlabel">{people.length} PEOPLE</span>
      </div>
      <ul className="chef__setup">
        {people.map((p) => (
          <li key={p.initials}>
            <button type="button" className="chef__setuprow" onClick={() => setEditing(p)}>
              <span className="pass__personinit">{p.initials}</span>
              <span className="pass__rowtext">
                <span className="pass__rowname">{p.name}{p.sample ? " (sample)" : ""}</span>
                <span className="pass__rowsub">{ROLE_LABEL[p.role ?? "cook"]} · {stationsLabel(p)}{p.pinHash ? "" : " · no PIN yet"}</span>
              </span>
              <span className="pass__open">EDIT ›</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="pass__cta" onClick={() => setEditing("new")}>+ ADD A PERSON</button>
      <p className="pass__hint">Everyone signs in by tapping their name and entering their PIN. Removing someone keeps their name on old counts and history.</p>
    </section>
  );
}
