import { useEffect, useState } from "react";
import { PassHeader } from "./Chrome";
import { hasKitchenSession, isLocalOnly, joinFromLink, setLocalOnly, signInKitchen, startSync, syncConfigured, watchChanges } from "../lib/sync";
import "./pass.css";

// Before anyone signs in, the phone itself joins the kitchen: one shared
// kitchen account (set up by the chef in Supabase), entered once per phone.
// After that, every phone sees the same recipes, counts, shifts and staff.
function ConnectScreen({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div className="pass">
      <PassHeader station="Setup">
        <h1 className="pass__title">Connect this phone</h1>
        <p className="pass__lede">Sign in with the kitchen account once. Then every phone shares the same recipes, counts, shifts and staff.</p>
      </PassHeader>
      <main className="pass__main">
        <form
          className="pass__gate"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const err = await signInKitchen(email.trim(), password);
            setBusy(false);
            if (err) setError(err);
            else onDone();
          }}
        >
          <label className="pass__countlabel" htmlFor="kitchen-email">KITCHEN EMAIL</label>
          <input id="kitchen-email" className="pass__input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="pass__countlabel" htmlFor="kitchen-password">PASSWORD</label>
          <input id="kitchen-password" className="pass__input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="pass__hint chef__late" aria-live="polite">{error === "Invalid login credentials" ? "That email and password don’t match the kitchen account." : error}</p>}
          <button type="submit" className="pass__cta" disabled={busy || !email || !password}>{busy ? "CONNECTING…" : "CONNECT →"}</button>
        </form>
        <p className="pass__hint">Easiest: ask the chef to text you the join link, then open it. Each person still signs in with their own name and PIN after this.</p>
        <button
          type="button"
          className="pass__ghost"
          onClick={() => { setLocalOnly(true); onDone(); }}
        >
          Use this phone on its own (nothing shared)
        </button>
      </main>
    </div>
  );
}

export default function SyncGate({ children }) {
  const [state, setState] = useState(() => (!syncConfigured || isLocalOnly() ? "ok" : "checking"));
  useEffect(() => {
    if (state !== "checking") return;
    hasKitchenSession().then(async (yes) => {
      if (yes) {
        watchChanges();
        startSync();
        setState("ok");
        return;
      }
      // Opened from the chef's join link: connect without asking.
      const join = joinFromLink();
      if (join && !(await signInKitchen(join.email, join.password))) {
        watchChanges();
        setState("ok");
        return;
      }
      setState("connect");
    });
  }, [state]);
  if (state === "checking") return null;
  if (state === "connect") return <ConnectScreen onDone={() => setState("ok")} />;
  return children;
}
