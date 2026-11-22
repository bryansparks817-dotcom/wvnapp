import { useEffect, useState } from "react";
import { isLocalOnly, onSyncStatus, syncConfigured } from "../lib/sync";

// A thin note at the top when there's no signal, or when changes made offline
// are still waiting to reach the other phones.
export default function OfflineBar() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [sync, setSync] = useState({ unsynced: 0, state: "off" });
  const [update, setUpdate] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const stop = onSyncStatus(setSync);
    const upd = () => setUpdate(true);
    window.addEventListener("thepass:update", upd);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      stop();
      window.removeEventListener("thepass:update", upd);
    };
  }, []);
  const shared = syncConfigured && !isLocalOnly();
  if (!online) {
    return (
      <div className="pass__offline" role="status">
        <strong>NO SIGNAL</strong> · Keep going. Everything saves on this phone{shared ? " and syncs when you’re back online" : ""}.
      </div>
    );
  }
  if (shared && sync.unsynced > 0 && sync.state !== "live") {
    return (
      <div className="pass__offline is-syncing" role="status">
        <strong>SYNCING</strong> · {sync.unsynced} change{sync.unsynced === 1 ? "" : "s"} from this phone on the way to the kitchen.
      </div>
    );
  }
  if (update) {
    return (
      <div className="pass__offline is-syncing" role="status">
        <strong>NEW VERSION</strong> · Ready when you are.{" "}
        <button type="button" className="pass__linkbtn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
  return null;
}
