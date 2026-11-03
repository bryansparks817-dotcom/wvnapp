import { PassHeader, TabBar } from "./Chrome";
import CountCard from "./CountCard";

// mode "close": end-of-night count of line pans and lowboy.
// mode "confirm": next shift, the cook confirms what carried over.
export default function CountScreen({
  mode, station, screen, setScreen, onOpenChef,
  items, inventory, today, closedOnLabel, onChangeItem, onSubmit,
}) {
  const isClose = mode === "close";
  return (
    <div className="pass">
      <PassHeader station={station}>
        <span className="pass__date">{isClose ? "END OF NIGHT" : `FROM ${closedOnLabel}’S CLOSE`}</span>
        <h1 className="pass__title">{isClose ? "Close count" : "Confirm the count"}</h1>
        <p className="pass__hint">
          {isClose
            ? "Line pans and lowboy, in 25% steps. It carries over to the next shift."
            : "Last night’s count, carried over. Fix anything that changed, then build your list."}
        </p>
      </PassHeader>

      <main className="pass__main">
        {items.map((item) => (
          <CountCard
            key={item.id}
            item={item}
            inv={inventory[item.id]}
            today={today}
            onChange={(next) => onChangeItem(item.id, next)}
          />
        ))}
      </main>

      <div className="pass__footer">
        <button type="button" className="pass__cta" onClick={onSubmit}>
          {isClose ? "SAVE CLOSE COUNT" : "CONFIRMED · BUILD MY LIST →"}
        </button>
      </div>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
