"use client";
import { useState } from "react";
import { BagIcon } from "@/components/icons";
import { cartCount, useCart } from "@/lib/client/cart";
import { MiniCart } from "./MiniCart";

export function CartButton() {
  const n = cartCount(useCart());
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Open cart, ${n} item${n === 1 ? "" : "s"}`} className="relative grid size-11 place-items-center rounded-full hover:bg-ink/5">
        <BagIcon />
        {n > 0 && <span className="tabular absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[11px] font-bold leading-5 text-white">{n}</span>}
      </button>
      <MiniCart open={open} onClose={() => setOpen(false)} />
    </>
  );
}
