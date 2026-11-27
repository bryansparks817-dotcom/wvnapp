import { useState } from "react";
import { CheckBox, PassHeader, TabBar } from "./Chrome";
import { NoteCard } from "./CountScreen";
import { formatMinutes } from "../lib/format";
import { containerLabel, formatG, shelfLabel } from "../lib/inventory";
import PrepSteps from "./PrepSteps";
import GatherList from "./GatherList";
import RecipePicker from "./RecipePicker";
import PrepTime from "./PrepTime";
import { madeAtName } from "../data/stations";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateLine() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function stamp(m) {
  if (!m) return "";
  const time = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${m.by ?? ""} · ${time}`;
}

// The 86 board, plus a way for the cook to raise an 86 or a running-low.
function FlagBoard({ flags, items, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pass__flags">
      {flags.length > 0 && (
        <div className="pass__86">
          <span className="pass__86label">86 / LOW</span>
          {flags.map((f) => (
            <button
              key={f.name}
              type="button"
              className={`pass__86chip${f.kind === "low" ? " is-low" : ""}`}
              onClick={() => onRemove(f.name)}
              aria-label={`Clear ${f.kind === "low" ? "running low" : "86"}: ${f.name}`}
            >
              {f.kind === "low" ? "LOW " : "86 "}
              {f.name}
              {f.by ? ` · ${f.by}` : ""} ✕
            </button>
          ))}
        </div>
      )}
      <button type="button" className="pass__flagbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Done flagging" : "+ Flag 86 / running low"}
      </button>
      {open && (
        <ul className="pass__flaglist">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span className="pass__flagactions">
                <button type="button" onClick={() => onAdd(item.name, "low")}>LOW</button>
                <button type="button" onClick={() => onAdd(item.name, "86")}>86</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Changes the chef made to this list: do-first, skips, one-off items. The
// cook taps GOT IT; acknowledged ones drop off.
function ChefCard({ notes, onAck }) {
  const open = notes.filter((m) => !m.seenAt);
  if (open.length === 0) return null;
  return (
    <section className="pass__chefcard" aria-label="From the chef">
      <span className="pass__countlabel">FROM CHEF</span>
      {open.map((m) => (
        <div key={m.id} className="pass__chefmsg">
          <span className="pass__rowtext">
            <span className="pass__rowname">{m.text}</span>
            <span className="pass__rowsub">{m.by} · {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </span>
          <button type="button" className="pass__chefack" onClick={() => onAck(m.id)}>GOT IT</button>
        </div>
      ))}
    </section>
  );
}

const WHERE = { lowboy: "LOWBOY", "walk-in": "WALK-IN", prep: "PREP BACKUP" };

function TakeLine({ item, take, today }) {
  return (
    <span className="pass__take">
      <span className="pass__where">{WHERE[take.where]}</span> {containerLabel(take)}
      <span className="pass__muted"> · {shelfLabel(item, take.madeOn, today)}</span>
    </span>
  );
}

// Prep: pick recipes to add to today's list, then add them all at once.
function AddMore({ items, onAdd, timeWith }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const time = timeWith(picked);
  if (!open) return <button type="button" className="pass__ghostbtn" onClick={() => setOpen(true)}>+ ADD RECIPES TO MY LIST</button>;
  return (
    <div className="pass__note">
      {picked.length > 0 && <p className="pass__hint pass__amber">With these: {formatMinutes(time.handsOn)} of hands-on work.</p>}
      <RecipePicker items={items} picked={picked} onChange={setPicked} />
      <button type="button" className="pass__cta" disabled={!picked.length} onClick={() => { onAdd(picked); setPicked([]); setOpen(false); }}>
        {picked.length ? `ADD ${picked.length} TO MY LIST` : "TAP RECIPES TO ADD"}
      </button>
      <button type="button" className="pass__ghost" onClick={() => { setOpen(false); setPicked([]); }}>Cancel</button>
    </div>
  );
}

export default function TodayScreen({
  station, screen, setScreen, onOpenChef, initials, onChangeCook,
  lastNotes, flags, onAddFlag, onRemoveFlag, items, itemsById, today,
  collect, chefNotes = [], bump = null, onAckChef, gather, gathered, short, onShort, cantMake, gatherDone, onToggleGather, onFinishGather, onReopenGather, tossOnly, plan, done, stepsDone, meta, wasteToday, timers, onToggle, onToggleStep, onOpenPrep, onStartTimer,
  lineRequests = [], asked = {}, onAddRequest, madeToday = () => false,
  addable = null, onAddRecipe, isPrep = false, timeWith = null, prepTime = null, prepStartAt = null, onStartPrep = null,
  canAsk = null, checkAsk, onSendAsk, onCancelAsk, asks = [], bumped = {},
}) {
  // Line: the item the cook is asking Prep to take, with Prep's answer.
  const [askFor, setAskFor] = useState(null);
  const header = { station, initials, onChangeCook };
  const hasGather = gather.items.length > 0 || gather.missing.length > 0;
  if (hasGather && !gatherDone) {
    const got = gather.items.filter((g) => gathered[g.name.toLowerCase()]).length;
    return (
      <div className="pass">
        <PassHeader {...header}>
          <span className="pass__date">{dateLine()} · {isPrep ? "FROM THE LINE’S CLOSES" : "COUNT CONFIRMED"}</span>
          <h1 className="pass__title">Gather</h1>
          <p className="pass__lede">Pull these from the walk-in and dry storage first. Amounts cover all of today’s prep.</p>
        </PassHeader>
        <main className="pass__main">
          {isPrep && prepTime && <PrepTime time={prepTime} startAt={prepStartAt} onStart={onStartPrep} />}
          {addable && <AddMore items={addable} onAdd={onAddRecipe} timeWith={timeWith} />}
          <ChefCard notes={chefNotes} onAck={onAckChef} />
          <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
          {lastNotes && <NoteCard notes={lastNotes} />}
          <section>
            <div className="pass__sectionhead">
              <h2>GATHER LIST</h2>
              <span className="pass__mono pass__amber">{got} of {gather.items.length}</span>
            </div>
            <GatherList gather={gather} gathered={gathered} short={short} onToggle={onToggleGather} onShort={onShort} />
          </section>
        </main>
        <div className="pass__footer">
          <button type="button" className="pass__cta" onClick={onFinishGather}>
            FINISH · TO COLLECT &amp; PREP →
          </button>
          {got < gather.items.length && <span className="pass__hint">{gather.items.length - got} not ticked yet. You can still go on.</span>}
        </div>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const collectDone = collect.filter((r) => done[`c:${r.id}`]).length;
  const prepRows = [...new Map(plan.steps.filter((s) => s.item).map((s) => [s.item.id, s.item])).values(), ...plan.untimed];
  const prepTotal = prepRows.length + tossOnly.length;
  const prepDone = [...prepRows, ...tossOnly].filter((r) => done[`p:${r.id}`]).length;
  const wasteG = wasteToday.reduce((s, w) => s + w.grams, 0);

  return (
    <div className="pass">
      <PassHeader {...header}>
        <span className="pass__date">{dateLine()} · {isPrep ? "FROM THE LINE’S CLOSES" : "COUNT CONFIRMED"}</span>
        <h1 className="pass__title">Today</h1>
      </PassHeader>
      <main className="pass__main">
        {isPrep && prepTime && <PrepTime time={prepTime} startAt={prepStartAt} onStart={onStartPrep} />}
        {addable && <AddMore items={addable} onAdd={onAddRecipe} timeWith={timeWith} />}
        <ChefCard notes={chefNotes} onAck={onAckChef} />
        <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
        {lastNotes && !hasGather && <NoteCard notes={lastNotes} />}
        {hasGather && (
          <button type="button" className="pass__ghost pass__backgather" onClick={onReopenGather}>
            ‹ Back to gather list
          </button>
        )}

        {isPrep && Object.keys(bumped).length > 0 && (
          <div className="pass__note">
            <span className="pass__countlabel">BUMPED TO TOMORROW</span>
            {Object.values(bumped).map((b, i) => <p key={i}>{b.name}, to make room for {b.for}’s {b.item}.</p>)}
          </div>
        )}
        {lineRequests.length > 0 && (
          <div className="pass__note">
            <span className="pass__countlabel">LINE STATIONS NEED FROM YOU</span>
            {lineRequests.map((q, i) => (
              <p key={i}>
                {q.ask ? `${q.station} asks you to make ` : `${q.station}: `}{formatG(q.grams)} {q.name}{q.ask && q.bump?.length ? ` (bumps ${q.bump.map((b) => b.name).join(", ")} to tomorrow)` : ""}
                {(asked[`${q.stationId}:${q.itemId}`] ?? 0) >= q.grams
                  ? " · on your prep list"
                  : madeToday(q.itemId)
                    ? " · already made today, send them what you made."
                    : <>{" · "}<button type="button" className="pass__linkbtn" onClick={() => onAddRequest(q)}>ADD TO MY LIST</button></>}
              </p>
            ))}
          </div>
        )}

        {!isPrep && <section>
          <div className="pass__sectionhead">
            <h2><span className="pass__vine">1</span> · COLLECT</h2>
            <span className="pass__mono pass__vine">{collectDone} of {collect.length}</span>
          </div>
          <p className="pass__hint">Already made. Oldest first. Top up and get it off your mind.</p>
          {collect.length === 0 && <p className="pass__empty">Nothing to collect.</p>}
          <ul className="pass__list">
            {collect.map((row) => {
              const item = itemsById.get(row.id);
              const isDone = Boolean(done[`c:${row.id}`]);
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={isDone} className={`pass__row pass__row--tall${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle("c", row)}>
                    <CheckBox checked={isDone} />
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{item.name}</span>
                      {isDone && <span className="pass__rowsub">✓ {stamp(meta[`c:${row.id}`])}</span>}
                      {!isDone && row.toLine.length > 0 && (
                        <span className="pass__takes">
                          <span className="pass__takehead">TO LINE ({item.pan} pan)</span>
                          {row.toLine.map((t, i) => <TakeLine key={i} item={item} take={t} today={today} />)}
                        </span>
                      )}
                      {!isDone && row.toLowboy.length > 0 && (
                        <span className="pass__takes">
                          <span className="pass__takehead">TO LOWBOY</span>
                          {row.toLowboy.map((t, i) => <TakeLine key={i} item={item} take={t} today={today} />)}
                        </span>
                      )}
                      {!isDone && row.pullEach > 0 && (
                        <span className="pass__rowsub">Collect {row.pullEach} from the walk-in, thawed (the chef pulled {row.pullEach === 1 ? "it" : "them"} from the freezer). No prep.</span>
                      )}
                      {!isDone && row.shortG > 0 && (
                        <span className="pass__rowsub pass__amber">
                          SHORT {formatG(row.shortG)} · {row.from ? `${madeAtName(row)} has been asked to make it.` : `${madeAtName(row)} makes this. Ask them for it.`}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>}

        <section>
          <div className="pass__sectionhead">
            <h2>
              {isPrep ? null : <span className="pass__amber">2</span>}{isPrep ? "" : " · "}PREP
              {plan.totalMinutes > 0 && <span className="pass__timetag">{formatMinutes(plan.totalMinutes)} TOTAL</span>}
            </h2>
            <span className="pass__mono pass__amber">{prepDone} of {prepTotal}</span>
          </div>
          <p className="pass__hint">
            Top to bottom. The long hands-off recipe starts first and the rest fill its downtime. Tap STEPS to see them, or QUICK FINISH when it’s made.
          </p>
          {askFor && (
            <div className={`pass__note pass__asknote${askFor.check.ok ? "" : " is-no"}`}>
              <span className="pass__countlabel">ASK PREP TO MAKE {askFor.row.name.toUpperCase()} · {formatG(askFor.row.makeG)}</span>
              {askFor.check.ok ? (
                <>
                  <p>Prep can take it and still be done by about {new Date(askFor.check.doneAt ?? Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.{askFor.check.bump.length ? ` To make room, ${askFor.check.bump.map((b) => b.name).join(", ")} ${askFor.check.bump.length === 1 ? "moves" : "move"} to tomorrow (not needed tonight).` : ""}</p>
                  <button type="button" className="pass__cta" onClick={() => { onSendAsk(askFor.row, askFor.check); setAskFor(null); }}>SEND TO PREP</button>
                </>
              ) : (
                <p>No: {askFor.check.reason} Make it yourself.</p>
              )}
              <button type="button" className="pass__ghost" onClick={() => setAskFor(null)}>{askFor.check.ok ? "Cancel" : "OK"}</button>
            </div>
          )}
          {asks.length > 0 && (
            <div className="pass__note">
              <span className="pass__countlabel">ASKED PREP</span>
              {asks.map((a) => (
                <p key={a.id}>
                  {formatG(a.grams)} {a.name} · {a.got ? "✓ got it" : a.made ? "Prep made it: collect it." : a.taken ? "Prep took it." : "waiting for Prep to take it."}
                  {!a.got && (a.made || a.taken) && <>{" "}<button type="button" className="pass__linkbtn" onClick={() => onToggle("p", a.row)}>GOT IT</button></>}
                  {!a.got && !a.taken && <>{" "}<button type="button" className="pass__linkbtn" onClick={() => onCancelAsk(a.id)}>TAKE IT BACK</button></>}
                </p>
              ))}
            </div>
          )}
          {prepTotal === 0 && <p className="pass__empty">Nothing to prep from scratch.</p>}
          {cantMake.length > 0 && (
            <p className="pass__holdnote pass__cantmake">
              CAN’T MAKE · {cantMake.map((r) => `${r.name} (out of ${r.limitedBy.map((l) => l.name).join(", ")})`).join("; ")}. Chef alerted.
            </p>
          )}
          <PrepSteps
            plan={plan}
            bump={bump}
            tossOnly={tossOnly}
            done={done}
            stepsDone={stepsDone}
            timers={timers}
            onToggleStep={onToggleStep}
            onToggleItem={(row) => onToggle("p", row)}
            onAsk={canAsk ? (row) => (canAsk(row) ? () => setAskFor({ row, check: checkAsk(row) }) : null) : null}
            onOpenPrep={onOpenPrep}
            onStartTimer={onStartTimer}
          />
          {wasteG > 0 && (
            <p className="pass__waste">
              Tossed today: {formatG(wasteG)} ({wasteToday.map((w) => w.name).join(", ")}). Logged for food cost.
            </p>
          )}
        </section>
      </main>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
