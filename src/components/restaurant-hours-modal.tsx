"use client";

import { useEffect, useState } from "react";
import type { Locale, Restaurant } from "@/lib/types";

type Props = {
  restaurant: Restaurant;
  locale: Locale;
};

const labels: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    close: string;
    open: string;
    closed: string;
    program: string;
  }
> = {
  fr: {
    title: "Programme",
    subtitle: "Horaires hebdomadaires du restaurant",
    close: "Fermer",
    open: "Ouvert",
    closed: "Fermé",
    program: "Programme",
  },
  en: {
    title: "Hours",
    subtitle: "Restaurant weekly opening times",
    close: "Close",
    open: "Open",
    closed: "Closed",
    program: "Program",
  },
  it: {
    title: "Orari",
    subtitle: "Orari settimanali del ristorante",
    close: "Chiudi",
    open: "Aperto",
    closed: "Chiuso",
    program: "Programma",
  },
  es: {
    title: "Horario",
    subtitle: "Horario semanal del restaurante",
    close: "Cerrar",
    open: "Abierto",
    closed: "Cerrado",
    program: "Programa",
  },
};

export function RestaurantHoursModal({ restaurant, locale }: Props) {
  const [open, setOpen] = useState(false);
  const text = labels[locale];

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-hours-modal", onOpen);
    return () => window.removeEventListener("open-hours-modal", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 p-2 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] text-[#f5f1ea] shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">
                {text.program}
              </p>
              <h2 className="text-2xl font-semibold">{text.title}</h2>
              <p className="text-sm leading-6 text-white/65">{text.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5f1ea] hover:bg-white/10"
            >
              {text.close}
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-2">
              {restaurant.weeklyHours.map((entry) => (
                <div
                  key={entry.day}
                  className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm md:grid-cols-[130px_1fr]"
                >
                  <span className="font-medium">{entry.label}</span>
                  <div className="text-white/65">
                    {entry.closed ? (
                      <span>{text.closed}</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {entry.intervals
                          .filter((interval) => interval.start && interval.end)
                          .map((interval, index) => (
                            <span key={`${entry.day}-${index}`}>
                              {interval.start} - {interval.end}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
