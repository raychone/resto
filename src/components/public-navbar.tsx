"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingOpenButton } from "@/components/booking-open-button";
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
    about: string;
    hours: string;
    reserve: string;
  }
> = {
  fr: {
    menu: "Menu",
    about: "À propos",
    hours: "Horaires",
    reserve: "Réserver",
  },
  en: {
    menu: "Menu",
    about: "About",
    hours: "Hours",
    reserve: "Book a table",
  },
  it: {
    menu: "Menù",
    about: "Info",
    hours: "Orari",
    reserve: "Prenota",
  },
  es: {
    menu: "Menú",
    about: "Sobre",
    hours: "Horario",
    reserve: "Reservar",
  },
};

export function PublicNavbar({
  restaurantSlug,
  locale,
}: {
  restaurantSlug: string;
  locale: Locale;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const labels = navLabels[locale];

  return (
    <header className="sticky top-0 z-50 w-full px-2 pt-2 sm:px-4 lg:px-0 lg:pt-0">
      <div className="relative rounded-[1.75rem] border border-black/8 bg-white/90 px-3 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-9 lg:py-4 xl:px-24">
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm"
            aria-label="Open menu"
          >
            <span className="flex flex-col gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-black" />
              <span className="h-0.5 w-4 rounded-full bg-black" />
              <span className="h-0.5 w-4 rounded-full bg-black" />
            </span>
          </button>

          <Link
            href={`/r/${restaurantSlug}?lang=${locale}`}
            className="flex min-w-0 flex-1 items-center justify-center"
          >
            <img
              src="/logo.png"
              alt="Logo"
              className="h-12 w-auto max-w-[180px] object-contain sm:h-14 sm:max-w-[220px]"
            />
          </Link>

          <BookingOpenButton className="inline-flex shrink-0 rounded-full bg-gradient-to-r from-black to-black/80 px-4 py-3 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)] transition hover:scale-[1.01] sm:px-5 sm:text-sm">
            {labels.reserve}
          </BookingOpenButton>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLanguageOpen((value) => !value)}
              className="flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-sm font-semibold text-black shadow-sm"
            >
              <span>{localeLabels[locale]}</span>
              <span className="text-[10px] opacity-60">▾</span>
            </button>

            {languageOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-28 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                {(["fr", "en", "it", "es"] as Locale[]).map((nextLocale) => (
                  <Link
                    key={nextLocale}
                    href={`/r/${restaurantSlug}?lang=${nextLocale}`}
                    className={`block px-4 py-3 text-sm font-medium transition ${
                      locale === nextLocale
                        ? "bg-black text-white"
                        : "text-black hover:bg-black/5"
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

        <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-6">
            <Link href="#menu" className="text-sm font-medium text-black/65 transition hover:text-black">
              {labels.menu}
            </Link>
            <Link href="#about" className="text-sm font-medium text-black/65 transition hover:text-black">
              {labels.about}
            </Link>
            <Link href="#hours" className="text-sm font-medium text-black/65 transition hover:text-black">
              {labels.hours}
            </Link>
          </div>

          <Link
            href={`/r/${restaurantSlug}?lang=${locale}`}
            className="flex min-w-0 items-center justify-center"
          >
            <img
              src="/logo.png"
              alt="Logo"
              className="h-16 w-auto max-w-[280px] object-contain"
            />
          </Link>

          <div className="flex items-center justify-end gap-2">
            <BookingOpenButton className="inline-flex rounded-full bg-gradient-to-r from-black to-black/80 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)] transition hover:scale-[1.01]">
              {labels.reserve}
            </BookingOpenButton>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLanguageOpen((value) => !value)}
                className="flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-sm font-semibold text-black shadow-sm"
              >
                <span>{localeLabels[locale]}</span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>

              {languageOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] w-28 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                  {(["fr", "en", "it", "es"] as Locale[]).map((nextLocale) => (
                    <Link
                      key={nextLocale}
                      href={`/r/${restaurantSlug}?lang=${nextLocale}`}
                      className={`block px-4 py-3 text-sm font-medium transition ${
                        locale === nextLocale
                          ? "bg-black text-white"
                          : "text-black hover:bg-black/5"
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

        {menuOpen ? (
          <div className="mt-3 rounded-[1.5rem] border border-black/8 bg-black/2 p-3 lg:hidden">
            <div className="flex flex-col gap-2">
              <Link
                href="#menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
              >
                {labels.menu}
              </Link>
              <Link
                href="#about"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
              >
                {labels.about}
              </Link>
              <Link
                href="#hours"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
              >
                {labels.hours}
              </Link>
              <BookingOpenButton className="rounded-2xl bg-gradient-to-r from-black to-black/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                {labels.reserve}
              </BookingOpenButton>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
