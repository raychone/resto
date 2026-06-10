import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listRestaurants } from "@/lib/restaurant-store";
import { locales, translateRestaurant, type Locale } from "@/lib/types";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query, restaurants] = await Promise.all([
    params,
    searchParams,
    listRestaurants(),
  ]);
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    return { title: "Menu A3 indisponible" };
  }

  const locale = resolveLocale(query.lang);
  const localizedRestaurant = translateRestaurant(restaurant, locale);

  return {
    title: `${localizedRestaurant.name} | Menu A3`,
    description: `Menu A3 imprimable pour ${localizedRestaurant.name}.`,
  };
}

export default async function A3MenuPage({ params, searchParams }: Props) {
  const [{ slug }, query, restaurants] = await Promise.all([
    params,
    searchParams,
    listRestaurants(),
  ]);
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    notFound();
  }

  const locale = resolveLocale(query.lang);
  const localizedRestaurant = translateRestaurant(restaurant, locale);
  const localeLabels: Record<Locale, string> = {
    fr: "Français",
    en: "English",
    it: "Italiano",
    es: "Español",
  };

  return (
    <main className="min-h-screen bg-[#f3eee5] px-3 py-3 sm:px-6 sm:py-6 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A3 portrait;
          margin: 0;
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[297mm] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:min-h-screen print:rounded-none print:shadow-none">
        <div className="no-print flex items-center justify-between gap-3 border-b border-black/8 px-5 py-4 sm:px-8">
          <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
            Format A3 imprimable
          </p>
          <PrintButton label={locale === "fr" ? "Imprimer" : "Print"} />
        </div>

        <header className="grid gap-4 border-b border-black/8 px-5 py-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-black/3 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-black/60">
              <img
                src={restaurant.logoUrl || "/logo.png"}
                alt={`${localizedRestaurant.name} logo`}
                className="h-8 w-8 rounded-xl object-cover"
              />
              <span>{localizedRestaurant.name}</span>
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-5xl leading-none sm:text-6xl lg:text-7xl">
                {localizedRestaurant.name}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-black/65">
                {localizedRestaurant.tagline}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(["fr", "en", "it", "es"] as Locale[]).map((nextLocale) => (
                <Link
                  key={nextLocale}
                  href={`/a3/${restaurant.slug}?lang=${nextLocale}`}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    locale === nextLocale
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black"
                  }`}
                >
                  {localeLabels[nextLocale]}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.75rem] border border-black/8 bg-black/2 p-4 sm:grid-cols-2 lg:p-5">
            <div className="rounded-[1.4rem] border border-black/8 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Adresse</p>
              <p className="mt-2 text-sm leading-6 text-black/70">{localizedRestaurant.address}</p>
            </div>
            <div className="rounded-[1.4rem] border border-black/8 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Téléphone</p>
              <p className="mt-2 text-sm leading-6 text-black/70">{localizedRestaurant.phone}</p>
            </div>
            <div className="rounded-[1.4rem] border border-black/8 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Lien web</p>
              <p className="mt-2 break-all text-sm font-medium text-black/70">
                /r/{restaurant.slug}?lang={locale}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-black/8 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Format</p>
              <p className="mt-2 text-sm leading-6 text-black/70">A3 portrait, prêt à imprimer.</p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:py-8">
          <section className="space-y-6">
            {localizedRestaurant.categories.map((category) => (
              <article
                key={category.id}
                className="break-inside-avoid rounded-[1.75rem] border border-black/8 bg-[#fbfaf7] p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                      Catégorie
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold">{category.name}</h2>
                  </div>
                  <span className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white">
                    {category.items.length} plats
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-black/60">{category.description}</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {category.items.map((item) => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-[1.4rem] border border-black/8 bg-white"
                    >
                      <div className="h-44 w-full overflow-hidden bg-black/3">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold">{item.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-black/65">
                              {item.description}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-black px-3 py-2 text-right text-white">
                            <span className="block text-[11px] uppercase tracking-[0.25em] text-white/60">
                              Prix
                            </span>
                            <span className="mt-1 block text-lg font-semibold">
                              €{item.price}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm leading-6 text-black/65">{item.recipe}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.ingredients.map((ingredient) => (
                            <span
                              key={ingredient}
                              className="rounded-full border border-black/10 bg-black/3 px-3 py-1.5 text-black/70"
                            >
                              {ingredient}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs uppercase tracking-[0.22em] text-black/35">
                          {item.allergens.length > 0
                            ? item.allergens.join(" · ")
                            : "Sans allergènes déclarés"}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-black/8 bg-black/2 p-5">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                QR / Print
              </p>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Cette page est pensée pour l&apos;impression en A3 ou pour être ouverte
                directement depuis le QR code.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-black/8 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                QR destination
              </p>
              <p className="mt-2 break-all text-sm font-medium text-black/70">
                /a3/{restaurant.slug}?lang={locale}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
