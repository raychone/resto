"use client";

import { useCallback, useEffect, useState } from "react";
import { clearClientCart, getClientCartCount, getClientCartTotal, listClientCartItems } from "@/lib/client-cart";
import type { ClientCartItem } from "@/lib/client-cart";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
  currency: string;
  enabled: boolean;
  variant?: "dark" | "light";
};

function formatMoney(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR" ? `${formatted}€` : formatted;
}

export function ClientCartBar({
  restaurantSlug,
  restaurantName,
  currency,
  enabled,
  variant = "dark",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ClientCartItem[]>([]);

  const refresh = useCallback(() => {
    const nextItems = listClientCartItems(restaurantSlug);
    setItems(nextItems);
    setCount(getClientCartCount(restaurantSlug));
    setTotal(getClientCartTotal(restaurantSlug));
  }, [restaurantSlug]);

  useEffect(() => {
    const onStorage = () => refresh();
    const onCartChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ restaurantSlug?: string }>;
      if (customEvent.detail?.restaurantSlug && customEvent.detail.restaurantSlug !== restaurantSlug) {
        return;
      }
      refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    window.addEventListener("meniu:client-cart-changed", onCartChange as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
      window.removeEventListener("meniu:client-cart-changed", onCartChange as EventListener);
    };
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  if (!enabled || !mounted || count === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-3 z-30 mx-auto mt-4 w-full max-w-[1440px] px-2 sm:px-4 lg:px-6">
      <div
        className={`rounded-[1.5rem] border p-3 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur ${
          variant === "light"
            ? "border-[#e7ddd0] bg-white/95 text-[#24170f]"
            : "border-white/10 bg-[#111111]/95 text-[#f5f1ea]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={`text-[11px] uppercase tracking-[0.28em] ${
                variant === "light" ? "text-[#7f6c5a]" : "text-white/35"
              }`}
            >
              {restaurantName}
            </p>
            <p className={`mt-1 text-sm ${variant === "light" ? "text-[#45382f]" : "text-white/70"}`}>
              {count} article{count > 1 ? "s" : ""} · {formatMoney(total, currency)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&focus=cart#client-cart`}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                variant === "light"
                  ? "border-[#c41e1e] bg-[#c41e1e] text-white"
                  : "border-white/10 bg-white text-black"
              }`}
            >
              Confirmer
            </a>
            <button
              type="button"
              onClick={() => {
                clearClientCart(restaurantSlug);
                refresh();
              }}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                variant === "light"
                  ? "border-[#e7ddd0] bg-[#faf7f2] text-[#24170f]"
                  : "border-white/10 bg-white/5 text-white"
              }`}
            >
              Vider
            </button>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                variant === "light"
                  ? "border-[#e7ddd0] bg-[#faf7f2] text-[#24170f]"
                  : "border-white/10 bg-white/5 text-white"
              }`}
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
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${
                  variant === "light"
                    ? "border-[#eadfce] bg-[#faf7f2] text-[#24170f]"
                    : "border-white/10 bg-black/20 text-[#f5f1ea]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.quantity} × {item.name}</p>
                  <p className={`truncate text-xs ${variant === "light" ? "text-[#7f6c5a]" : "text-white/50"}`}>
                    {item.categoryName || "—"}
                  </p>
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
