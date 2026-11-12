// Setup: the things a chef configures now and then, kept out of the daily
// oversight tabs. Recipes live here instead of having their own tab.
const ROWS = [
  { id: "manage", name: "Recipes", sub: "Add, edit or import recipe sheets." },
  { id: "prices", name: "Ingredient prices", sub: "$ per kg. Drives recipe cost, waste $ and food cost." },
  { id: "staff", name: "Staff & station access", sub: "Add people, set roles, stations and PINs." },
  { id: "plan", name: "Prep plan tool", sub: "Pick recipes and see a gather list and timeline." },
  { id: null, name: "Stations, items & pars", sub: "Pans, line and lowboy pars per station. Coming." },
  { id: null, name: "Storage zones", sub: "Walk-in and dry storage zones and their order. Coming." },
];

export default function ChefSetup({ onOpen }) {
  return (
    <ul className="chef__setup">
      {ROWS.map((r) => (
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
  );
}
