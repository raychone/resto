"use client";

import { useCallback, useEffect, useState } from "react";
import { clearClientCart, getClientCartCount, getClientCartTotal, listClientCartItems } from "@/lib/client-cart";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
  currency: string;
  enabled: boolean;
};

function formatMoney(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR" ? `${formatted}€` : formatted;
}

export function ClientCartBar({ restaurantSlug, restaurantName, currency, enabled }: Props) {
  const [count, setCount] = useState(() => getClientCartCount(restaurantSlug));
  const [total, setTotal] = useState(() => getClientCartTotal(restaurantSlug));
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => listClientCartItems(restaurantSlug));

  const refresh = useCallback(() => {
    const nextItems = listClientCartItems(restaurantSlug);
    setItems(nextItems);
    setCount(getClientCartCount(restaurantSlug));
    setTotal(getClientCartTotal(restaurantSlug));
  }, [restaurantSlug]);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, [refresh]);

  if (!enabled || count === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-3 z-30 mx-auto mt-4 w-full max-w-[1440px] px-2 sm:px-4 lg:px-6">
      <div className="rounded-[1.5rem] border border-white/10 bg-[#111111]/95 p-3 text-[#f5f1ea] shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">{restaurantName}</p>
            <p className="mt-1 text-sm text-white/70">
              {count} article{count > 1 ? "s" : ""} · {formatMoney(total, currency)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/client?focus=cart"
              className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Confirmer
            </a>
            <button
              type="button"
              onClick={() => {
                clearClientCart(restaurantSlug);
                refresh();
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
            >
              Vider
            </button>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
            >
              {open ? "Masquer" : "Détails"}
            </button>
          </div>
        </div>

        {open ? (
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <div
                key={`${item.menuItemId}-${item.note ?? ""}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.quantity} × {item.name}</p>
                  <p className="truncate text-xs text-white/50">{item.categoryName || "—"}</p>
                </div>
                <p className="font-semibold">{formatMoney(item.price * item.quantity, currency)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
