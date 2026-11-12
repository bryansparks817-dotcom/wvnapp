// Shared data: every phone in the kitchen reads and writes the same data
// through Supabase.
//
// The app still reads and writes localStorage as before. This module mirrors
// it: each saved key is sent to the `kitchen_data` table (one row per key),
// and changes from other phones arrive over Supabase Realtime, are written
// to localStorage, and are announced with a `thepass:remote` event so the
// screens that care can reload. The last write to a key wins. Device keys
// (who's signed in on this phone, its station, its timers) never leave it.
//
// Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_
// names the Supabase–Vercel integration sets) the app runs on this phone
// only, exactly as before.
import { createClient } from "@supabase/supabase-js";
import { DEVICE_KEYS, setSaveListener } from "./storage";

const env = import.meta.env;
const URL = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TABLE = "kitchen_data";
export const KITCHEN = "wandering-vine";
const LOCAL_ONLY = "thePass.localOnly.v1";

export const supabase = URL && KEY ? createClient(URL, KEY) : null;
export const syncConfigured = Boolean(supabase);

const ours = (key) => (key.startsWith("thePass.") || key.startsWith("kitchenPrep.")) && !DEVICE_KEYS.has(key) && key !== LOCAL_ONLY;

// What we last sent or received per key, so an echo isn't sent back.
const lastSeen = new Map();
const pending = new Map();
let timer = null;
let started = false;
let status = { state: "off", error: null, lastSync: null };
const listeners = new Set();

function setStatus(next) {
  status = { ...status, ...next };
  for (const fn of listeners) fn(status);
}
export function onSyncStatus(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export function isLocalOnly() {
  try {
    return localStorage.getItem(LOCAL_ONLY) === "1";
  } catch {
    return false;
  }
}
export function setLocalOnly(on) {
  try {
    if (on) localStorage.setItem(LOCAL_ONLY, "1");
    else localStorage.removeItem(LOCAL_ONLY);
  } catch {
    // nothing to do
  }
}

function localKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && ours(k)) out.push(k);
  }
  return out;
}

function writeLocal(key, value) {
  const text = JSON.stringify(value);
  lastSeen.set(key, text);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    // storage full or blocked
  }
}

function announce(keys) {
  if (keys.length) window.dispatchEvent(new CustomEvent("thepass:remote", { detail: { keys } }));
}

async function flush() {
  timer = null;
  if (!pending.size) return;
  const rows = [...pending].map(([key, value]) => ({ kitchen_id: KITCHEN, key, value, updated_at: new Date().toISOString() }));
  pending.clear();
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "kitchen_id,key" });
  if (error) {
    // Put them back and try again shortly.
    for (const r of rows) if (!pending.has(r.key)) pending.set(r.key, r.value);
    setStatus({ state: "error", error: error.message });
    timer = setTimeout(flush, 5000);
  } else {
    setStatus({ state: "live", error: null, lastSync: Date.now() });
  }
}

function queue(key, value) {
  if (!ours(key)) return;
  const text = JSON.stringify(value ?? null);
  if (lastSeen.get(key) === text) return;
  lastSeen.set(key, text);
  pending.set(key, value ?? null);
  if (!timer) timer = setTimeout(flush, 400);
}

// Pull everything, then listen. On the first phone to connect (an empty
// table), this phone's data goes up so the others start from it.
export async function startSync() {
  if (!supabase || started || isLocalOnly()) return;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    setStatus({ state: "signedout" });
    return;
  }
  started = true;
  setStatus({ state: "connecting", error: null });
  const { data, error } = await supabase.from(TABLE).select("key, value").eq("kitchen_id", KITCHEN);
  if (error) {
    started = false;
    setStatus({ state: "error", error: error.message });
    return;
  }
  if (data.length === 0) {
    for (const k of localKeys()) {
      try {
        queue(k, JSON.parse(localStorage.getItem(k)));
      } catch {
        // skip unreadable entries
      }
    }
  } else {
    const remote = new Set(data.map((r) => r.key));
    for (const r of data) writeLocal(r.key, r.value);
    // Shared data this phone has that the kitchen doesn't (e.g. a new key) goes up.
    for (const k of localKeys()) if (!remote.has(k)) queue(k, JSON.parse(localStorage.getItem(k)));
    announce(data.map((r) => r.key));
  }
  setSaveListener(queue);
  supabase
    .channel("kitchen")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `kitchen_id=eq.${KITCHEN}` }, (msg) => {
      const row = msg.new && msg.new.key ? msg.new : msg.old;
      if (!row?.key || !ours(row.key)) return;
      const value = msg.eventType === "DELETE" ? null : msg.new.value;
      if (lastSeen.get(row.key) === JSON.stringify(value)) return;
      writeLocal(row.key, value);
      announce([row.key]);
    })
    .subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus({ state: "live", lastSync: Date.now() });
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus({ state: "error", error: "Live updates dropped. Retrying." });
    });
  setStatus({ state: "live", lastSync: Date.now() });
}

export async function signInKitchen(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  setLocalOnly(false);
  await startSync();
  return null;
}

export async function signOutKitchen() {
  await supabase?.auth.signOut();
  window.location.reload();
}

export async function hasKitchenSession() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// Screens call this to reload when another phone changed one of their keys.
export function onRemoteChange(fn) {
  const h = (e) => fn(e.detail.keys);
  window.addEventListener("thepass:remote", h);
  return () => window.removeEventListener("thepass:remote", h);
}
