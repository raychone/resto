import { getAvailabilityForRestaurant } from "@/lib/engagement-store";
import { buildGoogleReviewsUrl, buildTripAdvisorUrl } from "@/lib/contact-links";
import { getHappyHourStatus, type Locale, type Restaurant } from "@/lib/types";
import { BookingOpenButton } from "@/components/booking-open-button";
import { ClientCartBar } from "@/components/client-cart-bar";
import { PublicBookingPanel } from "@/components/public-booking-panel";
import { HoursOpenButton } from "@/components/hours-open-button";
import { RestaurantHoursModal } from "@/components/restaurant-hours-modal";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicMenuCategories } from "@/components/public-menu-categories";
import { HappyHourCard } from "@/components/happy-hour-card";

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
    capacity: string;
    maps: string;
    waze: string;
    program: string;
    googleReviews: string;
    tripAdvisorReviews: string;
    seeReviews: string;
    delivery: string;
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
    capacity: "Capacité",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programme",
    googleReviews: "Avis Google",
    tripAdvisorReviews: "Avis TripAdvisor",
    seeReviews: "Voir les avis",
    delivery: "Livraison",
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
    capacity: "Capacity",
    maps: "Google Maps",
    waze: "Waze",
    program: "Program",
    googleReviews: "Google reviews",
    tripAdvisorReviews: "TripAdvisor reviews",
    seeReviews: "See reviews",
    delivery: "Delivery",
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
    capacity: "Capacità",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programma",
    googleReviews: "Recensioni Google",
    tripAdvisorReviews: "Recensioni TripAdvisor",
    seeReviews: "Vedi recensioni",
    delivery: "Consegna",
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
    capacity: "Capacidad",
    maps: "Google Maps",
    waze: "Waze",
    program: "Programa",
    googleReviews: "Reseñas Google",
    tripAdvisorReviews: "Reseñas TripAdvisor",
    seeReviews: "Ver reseñas",
    delivery: "Entrega",
    reserve: "Reservar una mesa",
  },
};

function buildMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildWazeUrl(address: string) {
  return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z"
        fill="#EA4335"
      />
      <path
        d="M12 14.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z"
        fill="#4285F4"
      />
      <path
        d="M12 4.1a7.9 7.9 0 0 1 5.6 2.3l-1.5 1.5A5.8 5.8 0 0 0 12 6.3a5.8 5.8 0 0 0-4.1 1.6L6.4 6.4A7.9 7.9 0 0 1 12 4.1Z"
        fill="#34A853"
      />
      <path d="M6.4 6.4 7.9 7.9A5.8 5.8 0 0 0 6.3 12H4.1a7.9 7.9 0 0 1 2.3-5.6Z" fill="#FBBC05" />
    </svg>
  );
}

function WazeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 4.5c-4.14 0-7.5 2.86-7.5 6.4 0 2.1 1.07 4 2.93 5.19l-.56 2.24 2.53-1.05A9.7 9.7 0 0 0 12 17.8c4.14 0 7.5-2.86 7.5-6.4S16.14 4.5 12 4.5Z"
        fill="#25B6D2"
      />
      <path
        d="M8.7 10.4c.2-.7 1-.9 1.6-.5l.8.6c.2.1.5.1.7 0l.9-.6c.6-.4 1.4-.1 1.6.5"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M9 12.9c.8.8 1.7 1.2 3 1.2s2.2-.4 3-1.2"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3.5 8.5h10.2v7.2H3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M13.7 11h3.1l2 2.2V15h-5.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="16.8" r="1.5" fill="currentColor" />
      <circle cx="17" cy="16.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 8.5V7c0-.8.5-1 1-1h2V3h-2.8C11.9 3 11 4.8 11 7v1.5H9V12h2v9h3v-9h2.4l.6-3.5H14Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7Zm5 3.2A4.8 4.8 0 1 1 7.2 13 4.8 4.8 0 0 1 12 8.2Zm0 2A2.8 2.8 0 1 0 14.8 13 2.8 2.8 0 0 0 12 10.2ZM17.8 6.9a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1Z"
      />
    </svg>
  );
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
  const uberEatsUrl = restaurant.uberEatsUrl.trim();
  const tripAdvisorUrl = restaurant.tripAdvisorUrl.trim();
  const reviewsUrl = buildGoogleReviewsUrl({
    reviewsUrl: restaurant.googleReviewsUrl,
    restaurantName: restaurant.name,
    address: restaurant.address,
  });
  const tripAdvisorReviewsUrl = buildTripAdvisorUrl({
    tripAdvisorUrl,
    restaurantName: restaurant.name,
    address: restaurant.address,
  });
  const happyHour = getHappyHourStatus(restaurant);
  const text = copy[locale];

  return (
    <>
      <PublicNavbar
        restaurantSlug={restaurant.slug}
        logoUrl={restaurant.logoUrl}
        locale={locale}
      />
      <main
        id="top"
        className="mx-auto min-h-screen w-full max-w-[1440px] scroll-mt-32 px-2 py-3 sm:px-4 lg:px-6 lg:py-4"
      >
      <div className="grid gap-4">
        <div className="space-y-6">
          <section
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#121212]/95 shadow-[0_30px_120px_rgba(0,0,0,0.34)] backdrop-blur"
            style={{
              borderColor: `${restaurant.accent}33`,
            }}
          >
            <div
              className="absolute inset-0 opacity-95"
              style={{
                background: `radial-gradient(circle at top left, ${restaurant.accent}25, transparent 34%), linear-gradient(135deg, #181818 0%, #121212 100%)`,
              }}
            />

            <div className="relative grid gap-4 p-3 sm:p-4 lg:grid-cols-[1.05fr_0.95fr] lg:p-6">
              <div className="flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h1 className="font-display text-4xl leading-none text-[#f5f1ea] sm:text-5xl lg:text-6xl">
                      {restaurant.name}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                      {restaurant.tagline}
                    </p>
                  </div>
                </div>

                  <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
                      {text.address}
                      </p>
                      <p className="mt-2">{restaurant.address}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
                      {text.phone}
                      </p>
                      <p className="mt-2">{restaurant.phone}</p>
                    </div>
                  </div>

                <div className="flex flex-wrap items-center gap-2">
                  <HoursOpenButton className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white">
                    {text.program}
                  </HoursOpenButton>
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={text.waze}
                    title={text.waze}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <WazeIcon />
                  </a>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={text.maps}
                    title={text.maps}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <MapIcon />
                  </a>
                  {uberEatsUrl ? (
                    <a
                      href={uberEatsUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={text.delivery}
                      title={text.delivery}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      <DeliveryIcon />
                      <span>{text.delivery}</span>
                    </a>
                  ) : null}
                  {restaurant.features.bookingEnabled ? (
                    <BookingOpenButton className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white">
                      {text.reserve}
                    </BookingOpenButton>
                  ) : null}
                </div>

                {restaurant.features.googleReviewsEnabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex w-full items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⭐</span>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">
                            {text.googleReviews}
                          </p>
                          <p className="text-sm font-semibold text-[#f5f1ea]">
                            {restaurant.googleRating.toFixed(1)} Google
                          </p>
                        </div>
                      </div>
                      <a
                        href={reviewsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black"
                      >
                        {text.seeReviews}
                      </a>
                    </div>
                    {tripAdvisorUrl ? (
                      <div className="flex w-full items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
                        <div className="flex items-start gap-2">
                          <span className="text-xl leading-none">⭐</span>
                          <div className="leading-tight">
                            <span className="block text-[11px] uppercase tracking-[0.25em] text-white/35">
                              TripAdvisor
                            </span>
                            <span className="block text-sm font-semibold text-[#f5f1ea]">
                              5.0
                            </span>
                          </div>
                        </div>
                        <a
                          href={tripAdvisorReviewsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black"
                        >
                          {text.seeReviews}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
                  <img
                    src={restaurant.heroImage}
                    alt={restaurant.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                {happyHour ? (
                  <div
                    className="absolute -bottom-4 left-4 right-4"
                  >
                    <HappyHourCard happyHour={happyHour} accent={restaurant.accent} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section
            id="menu"
            className="scroll-mt-28 rounded-[2rem] border border-black/10 bg-[#0f0f0f] px-3 py-4 text-[#f5f1ea] shadow-[0_30px_120px_rgba(15,23,42,0.14)] lg:scroll-mt-32 lg:px-4 lg:py-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3 px-1 sm:px-2">
              <div>
                <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Menu</h2>
              </div>
            </div>
            <PublicMenuCategories
              categories={restaurant.categories}
              locale={locale}
              accent={restaurant.accent}
              restaurantSlug={restaurant.slug}
              orderFlowEnabled={restaurant.features.orderFlowEnabled}
            />
          </section>
        </div>

      </div>
      </main>
      {restaurant.features.orderFlowEnabled ? (
        <ClientCartBar
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          currency={restaurant.currency}
          enabled={restaurant.features.orderFlowEnabled}
        />
      ) : null}
      <RestaurantHoursModal restaurant={restaurant} locale={locale} />
      {restaurant.features.bookingEnabled ? (
        <PublicBookingPanel
          restaurantSlug={restaurant.slug}
          locale={locale}
          seatsPerTable={restaurant.seatsPerTable}
          initialAvailability={availability}
        />
      ) : null}
      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 pb-8 pt-6 text-[#f5f1ea]/70 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
          >
            <InstagramIcon />
          </a>
        </div>
        <p className="text-center text-[11px] uppercase tracking-[0.35em] text-[#f5f1ea]/45">
          Powered by <span className="text-[#f5f1ea]">LACStudio</span>
        </p>
        <div className="w-18" />
      </footer>
    </>
  );
}
