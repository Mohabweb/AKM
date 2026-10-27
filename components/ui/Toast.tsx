"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type T = { id: number; text: string };
const Ctx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Storefront only. Never mounted on cart / checkout / payment / confirmation. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { id, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {list.map((t) => (
          <div key={t.id} className="pointer-events-auto reveal rounded-full bg-ink px-5 py-3 text-sm font-semibold text-sand shadow-lg">{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
