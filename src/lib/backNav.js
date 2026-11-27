// Phone and browser back stay inside The Pass. The app keeps one extra
// history entry; when back is pressed it puts it back and asks the open
// screens, deepest first, to step back. Nothing to step back to: it stays.
import { useEffect, useRef } from "react";

const handlers = new Set();
let installed = false;

export function installBackTrap() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.history.pushState({ pass: true }, "");
  window.addEventListener("popstate", () => {
    window.history.pushState({ pass: true }, "");
    const list = [...handlers].sort((a, b) => b.depth - a.depth);
    for (const h of list) if (h.ref.current?.()) return;
  });
}

// `onBack` returns true when it stepped back. Deeper screens (higher depth)
// get the first go.
export function useBack(onBack, depth) {
  const ref = useRef(onBack);
  useEffect(() => { ref.current = onBack; });
  useEffect(() => {
    const h = { depth, ref };
    handlers.add(h);
    return () => { handlers.delete(h); };
  }, [depth]);
}
