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
// Keys changed on this phone that the kitchen hasn't received yet (e.g. made
// with no signal). Kept across reloads; never synced itself.
const UNSYNCED = "thePass.unsynced.v1";

export const supabase = URL && KEY ? createClient(URL, KEY) : null;
export const syncConfigured = Boolean(supabase);

const ours = (key) => (key.startsWith("thePass.") || key.startsWith("kitchenPrep.")) && !DEVICE_KEYS.has(key) && key !== LOCAL_ONLY && key !== UNSYNCED;

// What we last sent or received per key, so an echo isn't sent back.
const lastSeen = new Map();
const pending = new Map();
let timer = null;
let started = false;
let retry = null;
let status = { state: "off", error: null, lastSync: null, unsynced: 0, online: typeof navigator === "undefined" ? true : navigator.onLine !== false };
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

function loadUnsynced() {
  try {
    return new Set(JSON.parse(localStorage.getItem(UNSYNCED) ?? "[]"));
  } catch {
    return new Set();
  }
}
const unsynced = loadUnsynced();
function saveUnsynced() {
  try {
    if (unsynced.size) localStorage.setItem(UNSYNCED, JSON.stringify([...unsynced]));
    else localStorage.removeItem(UNSYNCED);
  } catch {
    // storage blocked
  }
  if (status.unsynced !== unsynced.size) setStatus({ unsynced: unsynced.size });
}
status.unsynced = unsynced.size;

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return undefined;
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
  let error;
  try {
    ({ error } = await supabase.from(TABLE).upsert(rows, { onConflict: "kitchen_id,key" }));
  } catch (e) {
    error = { message: e?.message ?? "No connection" };
  }
  if (error) {
    // Put them back and try again shortly.
    for (const r of rows) if (!pending.has(r.key)) pending.set(r.key, r.value);
    setStatus({ state: "error", error: error.message });
    timer = setTimeout(flush, 5000);
  } else {
    for (const r of rows) if (!pending.has(r.key)) unsynced.delete(r.key);
    saveUnsynced();
    setStatus({ state: "live", error: null, lastSync: Date.now() });
  }
}

function queue(key, value) {
  if (!ours(key)) return;
  const text = JSON.stringify(value ?? null);
  if (lastSeen.get(key) === text) return;
  lastSeen.set(key, text);
  // Remember it until the kitchen has it, even across a reload.
  if (!unsynced.has(key)) {
    unsynced.add(key);
    saveUnsynced();
  }
  if (!started) return; // sent when sync (re)starts
  pending.set(key, value ?? null);
  if (!timer) timer = setTimeout(flush, 400);
}

// Record changes from the moment the app opens, signal or not.
let watching = false;
export function watchChanges() {
  if (!supabase || watching || isLocalOnly()) return;
  watching = true;
  setSaveListener(queue);
  window.addEventListener("online", () => {
    setStatus({ online: true });
    if (!started) startSync();
    else {
      // Send everything this phone changed while offline, right away.
      for (const k of unsynced) {
        const v = readLocal(k);
        if (v !== undefined) pending.set(k, v);
      }
      if (timer) clearTimeout(timer);
      timer = null;
      if (pending.size) flush();
      catchUp();
    }
  });
  window.addEventListener("offline", () => setStatus({ online: false }));
}

// Back online after a gap: fetch what other phones changed meanwhile (live
// updates were missed), keeping this phone's own unsent changes.
async function catchUp() {
  let data;
  try {
    ({ data } = await supabase.from(TABLE).select("key, value").eq("kitchen_id", KITCHEN));
  } catch {
    return;
  }
  if (!data) return;
  const changed = data.filter((r) => ours(r.key) && !unsynced.has(r.key) && lastSeen.get(r.key) !== JSON.stringify(r.value) && localStorage.getItem(r.key) !== JSON.stringify(r.value));
  for (const r of changed) writeLocal(r.key, r.value);
  announce(changed.map((r) => r.key));
}

// Pull everything, then listen. On the first phone to connect (an empty
// table), this phone's data goes up so the others start from it.
export async function startSync() {
  if (!supabase || started || isLocalOnly()) return;
  watchChanges();
  let session = { session: null };
  try {
    ({ data: session } = await supabase.auth.getSession());
  } catch {
    // no signal: tried again when it comes back
  }
  if (!session.session) {
    setStatus({ state: "signedout" });
    return;
  }
  started = true;
  setStatus({ state: "connecting", error: null });
  let data;
  let error;
  try {
    ({ data, error } = await supabase.from(TABLE).select("key, value").eq("kitchen_id", KITCHEN));
  } catch (e) {
    error = { message: e?.message ?? "No connection" };
  }
  if (error || !Array.isArray(data)) {
    error = error ?? { message: "No connection" };
    // No signal (or the database is down): keep working on this phone and
    // try again when the connection comes back.
    started = false;
    setStatus({ state: "error", error: navigator.onLine === false ? "No signal. Saved on this phone." : error.message });
    if (!retry) retry = setTimeout(() => { retry = null; startSync(); }, 30000);
    return;
  }
  if (data.length === 0) {
    for (const k of localKeys()) {
      const v = readLocal(k);
      if (v === undefined) continue;
      pending.set(k, v);
      lastSeen.set(k, JSON.stringify(v));
    }
    if (pending.size && !timer) timer = setTimeout(flush, 0);
  } else {
    const remote = new Set(data.map((r) => r.key));
    // What this phone changed while offline wins over the kitchen's older copy.
    const fresh = data.filter((r) => !unsynced.has(r.key));
    for (const r of fresh) writeLocal(r.key, r.value);
    for (const k of localKeys()) {
      if (remote.has(k) && !unsynced.has(k)) continue;
      const v = readLocal(k);
      if (v === undefined) continue;
      pending.set(k, v);
      lastSeen.set(k, JSON.stringify(v));
    }
    if (pending.size && !timer) timer = setTimeout(flush, 0);
    announce(fresh.map((r) => r.key));
  }
  supabase
    .channel("kitchen")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `kitchen_id=eq.${KITCHEN}` }, (msg) => {
      const row = msg.new && msg.new.key ? msg.new : msg.old;
      if (!row?.key || !ours(row.key)) return;
      const value = msg.eventType === "DELETE" ? null : msg.new.value;
      if (lastSeen.get(row.key) === JSON.stringify(value)) return;
      // This phone has its own newer change on the way: keep it.
      if (unsynced.has(row.key)) return;
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

// Join link: the chef texts a link that carries the kitchen login, so a new
// phone connects by opening it (no email or password to type). It sits in the
// link's query so a phone that adds the page to its home screen keeps it, and
// is only used when the phone has no kitchen login yet.
const JOIN_PARAM = "join";
const b64 = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (str) => decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/"))));

export async function kitchenEmail() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

// Checks the password, then builds the link.
export async function makeJoinLink(password) {
  const email = await kitchenEmail();
  if (!email) return { error: "This phone isn’t connected to the kitchen." };
  const err = await signInKitchen(email, password);
  if (err) return { error: err === "Invalid login credentials" ? "That isn’t the kitchen password." : err };
  return { link: `${window.location.origin}/?${JOIN_PARAM}=${b64(JSON.stringify({ e: email, p: password }))}` };
}

export function joinFromLink() {
  try {
    const raw = new URLSearchParams(window.location.search).get(JOIN_PARAM);
    if (!raw) return null;
    const { e, p } = JSON.parse(unb64(raw));
    return e && p ? { email: e, password: p } : null;
  } catch {
    return null;
  }
}

export async function signOutKitchen() {
  await supabase?.auth.signOut();
  window.location.reload();
}

// A saved kitchen login on this phone, even if it can't be checked right now.
function savedSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token") && localStorage.getItem(k)) return true;
    }
  } catch {
    // storage blocked
  }
  return false;
}

export async function hasKitchenSession() {
  if (!supabase) return false;
  // No signal: a phone that has joined the kitchen before goes straight in.
  if (navigator.onLine === false) return savedSession();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (data.session) return true;
    return error ? savedSession() : false;
  } catch {
    return savedSession();
  }
}

// Screens call this to reload when another phone changed one of their keys.
export function onRemoteChange(fn) {
  const h = (e) => fn(e.detail.keys);
  window.addEventListener("thepass:remote", h);
  return () => window.removeEventListener("thepass:remote", h);
}

// Send anything still waiting right now (the chef's "Sync now").
export function syncNow() {
  if (!started) return startSync();
  if (pending.size && !timer) return flush();
  return null;
}
