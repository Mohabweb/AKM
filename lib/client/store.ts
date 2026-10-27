"use client";
import { useSyncExternalStore } from "react";

/** Tiny localStorage-backed store with cross-tab sync. Reads are validated; a corrupt value falls back to the default. */
export function createLocalStore<T>(key: string, fallback: T, validate: (v: unknown) => T | null) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;
  const read = (): T => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { /* private mode */ }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw) { try { value = validate(JSON.parse(raw)) ?? fallback; } catch { value = fallback; } }
    cache = { raw, value };
    return value;
  };
  const write = (v: T) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota/private mode: keep in memory only */ }
    cache = null; // force re-read so memory and storage can't diverge
    memory = v;
    listeners.forEach((l) => l());
  };
  let memory: T | null = null;
  const get = () => { const r = read(); return memory && cache?.raw === null ? memory : r; };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === key) { cache = null; cb(); } };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  };
  const useStore = (): T => useSyncExternalStore(subscribe, get, () => fallback);
  return { get, set: write, useStore };
}
