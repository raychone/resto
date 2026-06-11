"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/types";

const localeLabels: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  it: "IT",
  es: "ES",
};

const navLabels: Record<
  Locale,
  {
    menu: string;
    reserve: string;
  }
> = {
  fr: {
    menu: "Menu",
    reserve: "Réserver",
  },
  en: {
    menu: "Menu",
    reserve: "Book a table",
  },
  it: {
    menu: "Menù",
    reserve: "Prenota",
  },
  es: {
    menu: "Menú",
    reserve: "Reservar",
  },
};

export function PublicNavbar({
  restaurantSlug,
  logoUrl,
  locale,
}: {
  restaurantSlug: string;
  logoUrl?: string;
  locale: Locale;
}) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const labels = navLabels[locale];
  const displayLogo = logoUrl || "/logo.png";

  return (
    <header className="sticky top-0 z-50 w-full px-2 pt-2 sm:px-4 lg:px-0 lg:pt-0">
      <div className="relative rounded-[1.75rem] border border-white/10 bg-[#111111]/95 px-3 py-3 text-[#f5f1ea] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur sm:px-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-9 lg:py-4 xl:px-24">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link
            href="#top"
            className="flex items-center justify-start"
          >
            <img
              src={displayLogo}
              alt="Logo"
              className="h-12 w-auto max-w-[140px] object-contain sm:h-14 sm:max-w-[180px] lg:h-16 lg:max-w-[220px]"
            />
          </Link>

          <Link
            href="#menu"
            className="justify-self-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f1ea] shadow-sm transition hover:bg-white/10"
          >
            {labels.menu}
          </Link>

          <div className="relative justify-self-end">
            <button
              type="button"
              onClick={() => setLanguageOpen((value) => !value)}
              className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#f5f1ea] shadow-sm"
            >
              <span>{localeLabels[locale]}</span>
              <span className="text-[10px] opacity-60">▾</span>
            </button>

            {languageOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-28 overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                {(["fr", "en", "it", "es"] as Locale[]).map((nextLocale) => (
                  <Link
                    key={nextLocale}
                    href={`/r/${restaurantSlug}?lang=${nextLocale}`}
                    className={`block px-4 py-3 text-sm font-medium transition ${
                      locale === nextLocale
                        ? "bg-white text-black"
                        : "text-[#f5f1ea] hover:bg-white/5"
                    }`}
                    onClick={() => setLanguageOpen(false)}
                  >
                    {localeLabels[nextLocale]}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
