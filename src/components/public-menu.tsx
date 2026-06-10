import { getAvailabilityForRestaurant } from "@/lib/engagement-store";
import { buildGoogleReviewsUrl } from "@/lib/contact-links";
import type { Locale, Restaurant } from "@/lib/types";
import { BookingOpenButton } from "@/components/booking-open-button";
import { PublicBookingPanel } from "@/components/public-booking-panel";
import { HoursOpenButton } from "@/components/hours-open-button";
import { RestaurantHoursModal } from "@/components/restaurant-hours-modal";
import { PublicNavbar } from "@/components/public-navbar";

const copy: Record<
  Locale,
  {
    address: string;
    phone: string;
    hours: string;
    weeklyOpen: string;
    category: string;
    signature: string;
    price: string;
    allergens: string;
    noAllergen: string;
    qrReady: string;
    scanToOpen: string;
    menuLink: string;
    qrLink: string;
    capacity: string;
    maps: string;
    waze: string;
    program: string;
    googleReviews: string;
    seeReviews: string;
    reserve: string;
  }
> = {
  fr: {
    address: "Adresse",
    phone: "Téléphone",
    hours: "Horaires",
    weeklyOpen: "Ouverture hebdomadaire",
    category: "Catégorie",
    signature: "Signature",
    price: "Prix",
    allergens: "Allergènes",
    noAllergen: "Aucun allergène déclaré",
    qrReady: "QR prêt",
    scanToOpen: "Scanner pour ouvrir le menu",
    menuLink: "Lien du menu",
    qrLink: "QR dédié",
    capacity: "Capacité",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programme",
    googleReviews: "Avis Google",
    seeReviews: "Voir les avis",
    reserve: "Réserver une table",
  },
  en: {
    address: "Address",
    phone: "Phone",
    hours: "Hours",
    weeklyOpen: "Weekly opening",
    category: "Category",
    signature: "Signature",
    price: "Price",
    allergens: "Allergens",
    noAllergen: "No allergens declared",
    qrReady: "QR ready",
    scanToOpen: "Scan to open the menu",
    menuLink: "Menu link",
    qrLink: "Dedicated QR",
    capacity: "Capacity",
    maps: "Google Maps",
    waze: "Waze",
    program: "Program",
    googleReviews: "Google reviews",
    seeReviews: "See reviews",
    reserve: "Book a table",
  },
  it: {
    address: "Indirizzo",
    phone: "Telefono",
    hours: "Orari",
    weeklyOpen: "Apertura settimanale",
    category: "Categoria",
    signature: "Signature",
    price: "Prezzo",
    allergens: "Allergeni",
    noAllergen: "Nessun allergene dichiarato",
    qrReady: "QR pronto",
    scanToOpen: "Scansiona per aprire il menu",
    menuLink: "Link menu",
    qrLink: "QR dedicato",
    capacity: "Capacità",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programma",
    googleReviews: "Recensioni Google",
    seeReviews: "Vedi recensioni",
    reserve: "Prenota un tavolo",
  },
  es: {
    address: "Dirección",
    phone: "Teléfono",
    hours: "Horario",
    weeklyOpen: "Apertura semanal",
    category: "Categoría",
    signature: "Signature",
    price: "Precio",
    allergens: "Alérgenos",
    noAllergen: "No hay alérgenos declarados",
    qrReady: "QR listo",
    scanToOpen: "Escanea para abrir el menú",
    menuLink: "Enlace del menú",
    qrLink: "QR dedicado",
    capacity: "Capacidad",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programa",
    googleReviews: "Reseñas Google",
    seeReviews: "Ver reseñas",
    reserve: "Reservar una mesa",
  },
};

function money(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildWazeUrl(address: string) {
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export async function PublicMenu({
  restaurant,
  locale,
}: {
  restaurant: Restaurant;
  locale: Locale;
}) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const availability = await getAvailabilityForRestaurant(restaurant, {
    locale,
    startDate: startOfMonth,
    dayCount: 42,
  });

  const mapsUrl = buildMapsUrl(restaurant.address);
  const wazeUrl = buildWazeUrl(restaurant.address);
  const reviewsUrl = buildGoogleReviewsUrl({
    reviewsUrl: restaurant.googleReviewsUrl,
    restaurantName: restaurant.name,
    address: restaurant.address,
  });
  const text = copy[locale];

  return (
    <>
      <PublicNavbar restaurantSlug={restaurant.slug} locale={locale} />
      <main className="mx-auto min-h-screen w-full max-w-[1440px] px-2 py-3 sm:px-4 lg:px-6 lg:py-4">
      <div className="grid gap-4">
        <div className="space-y-6">
          <section
            className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur"
            style={{
              borderColor: `${restaurant.accent}33`,
            }}
          >
            <div
              className="absolute inset-0 opacity-85"
              style={{
                background: `radial-gradient(circle at top left, ${restaurant.accent}24, transparent 34%), linear-gradient(135deg, #fffdf8 0%, #fff 100%)`,
              }}
            />

            <div className="relative grid gap-4 p-3 sm:p-4 lg:grid-cols-[1.05fr_0.95fr] lg:p-6">
              <div className="flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h1 className="font-display text-4xl leading-none sm:text-5xl lg:text-6xl">
                      {restaurant.name}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-black/70 sm:text-lg">
                      {restaurant.tagline}
                    </p>
                  </div>
                </div>

                  <div className="grid gap-3 text-sm text-black/70 sm:grid-cols-2">
                    <div className="rounded-3xl border border-black/8 bg-white/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                      {text.address}
                      </p>
                      <p className="mt-2">{restaurant.address}</p>
                    </div>
                    <div className="rounded-3xl border border-black/8 bg-white/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                      {text.phone}
                      </p>
                      <p className="mt-2">{restaurant.phone}</p>
                    </div>
                  </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    {text.maps}
                  </a>
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    {text.waze}
                  </a>
                  <BookingOpenButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black">
                    {text.reserve}
                  </BookingOpenButton>
                  <HoursOpenButton className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black">
                    {text.program}
                  </HoursOpenButton>
                </div>

                <div className="inline-flex w-fit items-center gap-3 rounded-[1.5rem] border border-black/8 bg-white/85 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                        {text.googleReviews}
                      </p>
                      <p className="text-sm font-semibold text-black">
                        {restaurant.googleRating.toFixed(1)} Google
                      </p>
                    </div>
                  </div>
                  <a
                    href={reviewsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    {text.seeReviews}
                  </a>
                </div>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-black shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                  <img
                    src={restaurant.heroImage}
                    alt={restaurant.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div
                  className="absolute -bottom-4 left-4 rounded-3xl border border-white/70 bg-white px-4 py-3 text-sm shadow-xl"
                  style={{ boxShadow: `0 20px 50px ${restaurant.accent}24` }}
                >
                  <span className="block text-[11px] uppercase tracking-[0.25em] text-black/40">
                    {text.qrReady}
                  </span>
                  <span className="mt-1 block font-medium">
                    {text.scanToOpen}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div id="menu" className="scroll-mt-28 grid gap-4 lg:scroll-mt-32">
              {restaurant.categories.map((category) => (
                <section
                  key={category.id}
                  className="rounded-[2rem] border border-black/8 bg-white/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-4 lg:p-5"
                >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                      {text.category}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">{category.name}</h2>
                  </div>
                  <span
                    className="inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${restaurant.accent}12`,
                      color: restaurant.accent,
                    }}
                  >
                    {category.items.length} plats
                  </span>
                </div>

                <p className="mt-2 text-sm text-black/60">{category.description}</p>

                <div className="mt-5 grid gap-4">
                  {category.items.map((item) => (
                    <article
                      key={item.id}
                      className="grid gap-4 rounded-[1.5rem] border border-black/8 bg-white p-4 sm:grid-cols-[140px_1fr]"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-40 w-full rounded-[1.25rem] object-cover sm:h-full"
                      />
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold">{item.name}</h3>
                              {item.isSignature ? (
                                <span
                                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]"
                                  style={{
                                    backgroundColor: `${restaurant.accent}12`,
                                    color: restaurant.accent,
                                  }}
                                >
                                  {text.signature}
                                </span>
                              ) : null}
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-black/70">
                              {item.description}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-black px-4 py-3 text-right text-white">
                            <span className="block text-[11px] uppercase tracking-[0.25em] text-white/60">
                              {text.price}
                            </span>
                            <span className="mt-1 block text-2xl font-semibold">
                              {money(item.price)}
                            </span>
                          </div>
                        </div>

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

                        <div className="grid gap-3 sm:grid-cols-1">
                          <div className="rounded-2xl border border-black/8 bg-black/3 p-4">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                              {text.allergens}
                            </p>
                            <p className="mt-2 text-sm text-black/70">
                              {item.allergens.length > 0
                                ? item.allergens.join(", ")
                                : text.noAllergen}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                </section>
              ))}
            </div>
        </div>

      </div>
      </main>
      <RestaurantHoursModal restaurant={restaurant} locale={locale} />
      <PublicBookingPanel
        restaurantSlug={restaurant.slug}
        locale={locale}
        seatsPerTable={restaurant.seatsPerTable}
        initialAvailability={availability}
      />
    </>
  );
}
