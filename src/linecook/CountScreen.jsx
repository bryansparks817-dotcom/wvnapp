import { PassHeader, TabBar } from "./Chrome";
import CountCard from "./CountCard";

export function NoteCard({ notes }) {
  return (
    <div className="pass__note">
      <span className="pass__countlabel">NOTE FROM LAST SHIFT{notes.by ? ` · ${notes.by}` : ""}</span>
      <p>{notes.text}</p>
    </div>
  );
}

// mode "close": end-of-night count of line pans and lowboy.
// mode "confirm": next shift, the cook confirms what carried over.
export default function CountScreen({
  mode, station, screen, setScreen, onOpenChef,
  initials, onChangeCook,
  items, inventory, today, closedOnLabel, closedBy, notes, lastNotes, onChangeNotes, onChangeItem, onSubmit,
}) {
  const isClose = mode === "close";
  return (
    <div className="pass">
      <PassHeader station={station} initials={initials} onChangeCook={onChangeCook}>
        <span className="pass__date">{isClose ? "END OF NIGHT" : `FROM ${closedOnLabel}’S CLOSE${closedBy ? ` · ${closedBy}` : ""}`}</span>
        <h1 className="pass__title">{isClose ? "Close count" : "Confirm the count"}</h1>
        <p className="pass__hint">
          {isClose
            ? "Line pans and lowboy, in 25% steps. It carries over to the next shift."
            : "Last night’s count, carried over. Fix anything that changed, then build your list."}
        </p>
      </PassHeader>

      <main className="pass__main">
        {!isClose && lastNotes && <NoteCard notes={lastNotes} />}
        {items.map((item) => (
          <CountCard
            key={item.id}
            item={item}
            inv={inventory[item.id]}
            today={today}
            onChange={(next) => onChangeItem(item.id, next)}
          />
        ))}
        {isClose && (
          <div className="pass__card">
            <label className="pass__countlabel" htmlFor="pass-notes">NOTES FOR NEXT SHIFT</label>
            <textarea
              id="pass-notes"
              className="pass__input pass__notes"
              rows={3}
              value={notes}
              placeholder="Running low on shallots, stock needs to be strained first thing…"
              onChange={(e) => onChangeNotes(e.target.value)}
            />
          </div>
        )}
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
