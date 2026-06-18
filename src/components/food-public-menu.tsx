"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildGoogleReviewsUrl, buildTripAdvisorUrl } from "@/lib/contact-links";
import { addClientCartItem } from "@/lib/client-cart";
import { BookingOpenButton } from "@/components/booking-open-button";
import { ClientCartBar } from "@/components/client-cart-bar";
import { HoursOpenButton } from "@/components/hours-open-button";
import { PublicBookingPanel } from "@/components/public-booking-panel";
import { RestaurantHoursModal } from "@/components/restaurant-hours-modal";
import type { AvailableDay } from "@/lib/booking";
import {
  getMenuItemEffectivePrice,
  type Locale,
  type MenuCategory,
  type MenuItem,
  type Restaurant,
} from "@/lib/types";

type ItemModalState = {
  categoryName: string;
  item: MenuItem;
} | null;

const copy: Record<
  Locale,
  {
    viewMenu: string;
    book: string;
    orderNow: string;
    about: string;
    menu: string;
    reservations: string;
    loyalty: string;
    offers: string;
    reviews: string;
    contact: string;
    delivery: string;
    takeAway: string;
    onSite: string;
    signature: string;
    ingredients: string;
    allergens: string;
    recipe: string;
    details: string;
    addToCart: string;
    categoryOpen: string;
    noAllergen: string;
    menuIntro: string;
    loyaltyCopy: string;
    offersCopy: string;
    deliveryCopy: string;
  }
> = {
  fr: {
    viewMenu: "Voir le menu",
    book: "Réserver une table",
    orderNow: "Commander",
    about: "À propos",
    menu: "Menu",
    reservations: "Réservations",
    loyalty: "Loyalty",
    offers: "Offres",
    reviews: "Avis",
    contact: "Contact",
    delivery: "Livraison",
    takeAway: "À emporter",
    onSite: "Sur place",
    signature: "Signature",
    ingredients: "Ingrédients",
    allergens: "Allergènes",
    recipe: "Préparation",
    details: "Détails du plat",
    addToCart: "Ajouter au panier",
    categoryOpen: "Ouvrir la catégorie",
    noAllergen: "Aucun allergène déclaré",
    menuIntro: "Une carte italienne simple, généreuse et très lisible sur mobile.",
    loyaltyCopy: "Cumulez des points sur chaque commande et suivez votre progression depuis le portail client.",
    offersCopy: "Des formules déjeuner, des menus famille et des plats du moment mis en avant sur le menu.",
    deliveryCopy: "Sur place, à emporter ou en livraison: Food 1 reste conçu pour un service fluide.",
  },
  en: {
    viewMenu: "View menu",
    book: "Book a table",
    orderNow: "Order now",
    about: "About",
    menu: "Menu",
    reservations: "Reservations",
    loyalty: "Loyalty",
    offers: "Offers",
    reviews: "Reviews",
    contact: "Contact",
    delivery: "Delivery",
    takeAway: "Take away",
    onSite: "On site",
    signature: "Signature",
    ingredients: "Ingredients",
    allergens: "Allergens",
    recipe: "Recipe",
    details: "Dish details",
    addToCart: "Add to cart",
    categoryOpen: "Open category",
    noAllergen: "No allergens declared",
    menuIntro: "A simple, generous Italian menu designed to stay readable on mobile.",
    loyaltyCopy: "Earn points on every order and track your progress from the client portal.",
    offersCopy: "Lunch sets, family menus and highlighted dishes give the menu a food-first rhythm.",
    deliveryCopy: "Dine in, take away or delivery: Food 1 is built for a smooth service flow.",
  },
  it: {
    viewMenu: "Vedi menu",
    book: "Prenota un tavolo",
    orderNow: "Ordina ora",
    about: "Chi siamo",
    menu: "Menu",
    reservations: "Prenotazioni",
    loyalty: "Loyalty",
    offers: "Offerte",
    reviews: "Recensioni",
    contact: "Contatti",
    delivery: "Delivery",
    takeAway: "Da asporto",
    onSite: "In sala",
    signature: "Signature",
    ingredients: "Ingredienti",
    allergens: "Allergeni",
    recipe: "Preparazione",
    details: "Dettagli del piatto",
    addToCart: "Aggiungi al carrello",
    categoryOpen: "Apri categoria",
    noAllergen: "Nessun allergene dichiarato",
    menuIntro: "Una carta italiana semplice, generosa e leggibile su mobile.",
    loyaltyCopy: "Accumula punti su ogni ordine e segui i progressi dal portale clienti.",
    offersCopy: "Pranzi, menu famiglia e piatti del momento in evidenza sul menu.",
    deliveryCopy: "Dine in, asporto o delivery: Food 1 è pensato per un flusso fluido.",
  },
  es: {
    viewMenu: "Ver menú",
    book: "Reservar mesa",
    orderNow: "Pedir ahora",
    about: "Acerca de",
    menu: "Menú",
    reservations: "Reservas",
    loyalty: "Loyalty",
    offers: "Ofertas",
    reviews: "Reseñas",
    contact: "Contacto",
    delivery: "Delivery",
    takeAway: "Para llevar",
    onSite: "En sala",
    signature: "Signature",
    ingredients: "Ingredientes",
    allergens: "Alérgenos",
    recipe: "Preparación",
    details: "Detalles del plato",
    addToCart: "Añadir al carrito",
    categoryOpen: "Abrir categoría",
    noAllergen: "No hay alérgenos declarados",
    menuIntro: "Una carta italiana simple, generosa y muy clara en móvil.",
    loyaltyCopy: "Gana puntos en cada pedido y sigue tu progreso desde el portal del cliente.",
    offersCopy: "Menús del día, menús familiares y platos destacados con foco en comida.",
    deliveryCopy: "En sala, para llevar o delivery: Food 1 está pensado para un servicio fluido.",
  },
};

function money(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${formatted}€`;
}

function categoryCoverImage(category: MenuCategory) {
  return category.items[0]?.imageUrl ?? "/logo.png";
}

function DeliveryBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M3.5 8.5h10.2v7.2H3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
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

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FoodMenuShowcase({
  categories,
  locale,
  accent,
  restaurantSlug,
  orderFlowEnabled,
}: {
  categories: MenuCategory[];
  locale: Locale;
  accent: string;
  restaurantSlug: string;
  orderFlowEnabled: boolean;
}) {
  const text = copy[locale];
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [modalState, setModalState] = useState<ItemModalState>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const cartNoticeTimer = useRef<number | null>(null);
  const modalCloseTimer = useRef<number | null>(null);

  const closeModal = useCallback(() => {
    if (!modalState || isModalClosing) return;
    setIsModalClosing(true);
    modalCloseTimer.current = window.setTimeout(() => {
      setModalState(null);
      setIsModalClosing(false);
      modalCloseTimer.current = null;
    }, 180);
  }, [isModalClosing, modalState]);

  function openModal(item: MenuItem, categoryName: string) {
    if (modalCloseTimer.current) {
      window.clearTimeout(modalCloseTimer.current);
      modalCloseTimer.current = null;
    }
    setIsModalClosing(false);
    setModalState({ categoryName, item });
  }

  async function addItem(item: MenuItem, categoryName: string) {
    if (!orderFlowEnabled) return;
    addClientCartItem(restaurantSlug, {
      menuItemId: item.id,
      name: item.name,
      price: getMenuItemEffectivePrice(item),
      quantity: 1,
      categoryName,
    });
    setCartNotice(locale === "fr" ? "Ajouté au panier." : "Added to cart.");
    if (cartNoticeTimer.current) {
      window.clearTimeout(cartNoticeTimer.current);
    }
    cartNoticeTimer.current = window.setTimeout(() => {
      setCartNotice(null);
      cartNoticeTimer.current = null;
    }, 1800);
  }

  useEffect(() => {
    if (!modalState) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeModal, modalState]);

  useEffect(() => {
    if (!modalState) return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const previous = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };

    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = previous.position;
      bodyStyle.top = previous.top;
      bodyStyle.left = previous.left;
      bodyStyle.right = previous.right;
      bodyStyle.width = previous.width;
      bodyStyle.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [modalState]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [restaurantSlug, locale]);

  useEffect(() => {
    return () => {
      if (modalCloseTimer.current) {
        window.clearTimeout(modalCloseTimer.current);
      }
      if (cartNoticeTimer.current) {
        window.clearTimeout(cartNoticeTimer.current);
      }
    };
  }, []);

  const activeItemMeta = useMemo(() => {
    if (!modalState) return null;
    return modalState.item.allergens.length > 0 ? modalState.item.allergens.join(", ") : text.noAllergen;
  }, [modalState, text.noAllergen]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const isOpen = category.id === openCategoryId;
          const coverImage = categoryCoverImage(category);

          return (
            <section
              key={category.id}
              className="overflow-hidden rounded-[2rem] border border-[#eadfce] bg-white shadow-[0_18px_70px_rgba(70,35,22,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_90px_rgba(70,35,22,0.16)]"
            >
              <button
                type="button"
                onClick={() => setOpenCategoryId(isOpen ? null : category.id)}
                className="block w-full text-left"
                aria-label={`${text.categoryOpen} ${category.name}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f6efe6]">
                  <img
                    src={coverImage}
                    alt={category.name}
                    className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full bg-[#c41e1e] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                    {category.name}
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <p className="text-sm leading-6 text-white/86">{category.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-semibold leading-none text-[#24170f]">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#7f6c5a]">
                      {category.items.length} plats · {category.items[0]?.price ? money(category.items[0].price) : "—"}
                    </p>
                  </div>
                  <span
                    className={`text-2xl leading-none text-[#c41e1e] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    ▾
                  </span>
                </div>
              </button>

              <div
                className={`grid transition-all duration-500 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden border-t border-[#eadfce] px-4 pb-4 pt-1">
                  <div className="mt-2 grid gap-2">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-[#efe5d8] bg-[#faf7f2] px-4 py-3 text-left transition hover:border-[#d6c0ae] hover:bg-[#f8f1ea]"
                      >
                        <button
                          type="button"
                          onClick={() => openModal(item, category.name)}
                          className="min-w-0 flex-1 text-left"
                          aria-label={`${item.name} ${text.details}`}
                        >
                          <p className="text-[0.95rem] font-semibold leading-tight text-[#24170f]">
                            {item.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#6f5b4a]">
                            {item.description}
                          </p>
                        </button>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-[#c41e1e]">{money(getMenuItemEffectivePrice(item))}</p>
                          {orderFlowEnabled ? (
                            <button
                              type="button"
                              onClick={() => addItem(item, category.name)}
                              className="mt-1 inline-flex rounded-full border border-[#f0cbc8] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c41e1e] transition hover:bg-[#fff3f0]"
                            >
                              + Panier
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {modalState ? (
        <div
          className={`fixed inset-0 z-[80] bg-black/60 p-2 transition-opacity duration-200 sm:p-4 ${
            isModalClosing ? "opacity-0" : "opacity-100"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={text.details}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center">
            <section
              className={`grid h-[calc(100vh-1rem)] w-full overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] text-[#24170f] shadow-[0_40px_120px_rgba(0,0,0,0.28)] transition-all duration-300 sm:h-[calc(100vh-2rem)] ${
                isModalClosing ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#eadfce] px-4 py-4 sm:px-6">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">
                    {modalState.categoryName}
                  </p>
                  <h3 className="text-2xl font-semibold sm:text-3xl">{modalState.item.name}</h3>
                  <p className="text-sm leading-6 text-[#7f6c5a]">{text.details}</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e0d1c0] bg-white text-2xl leading-none text-[#24170f] transition hover:bg-[#faf7f2]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="grid flex-1 gap-5 overflow-y-auto p-4 sm:grid-cols-[0.95fr_1.05fr] sm:p-6">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-[#eadfce] bg-[#f7f2ea]">
                  <img
                    src={modalState.item.imageUrl}
                    alt={modalState.item.name}
                    className="h-[34vh] w-full object-cover sm:h-full sm:min-h-[320px]"
                  />
                  {modalState.item.isSignature ? (
                    <span className="absolute left-4 top-4 rounded-full bg-[#c41e1e] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                      {text.signature}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <p className="text-base leading-7 text-[#4d3e33]">{modalState.item.description}</p>

                  <div className="rounded-[1.4rem] border border-[#eadfce] bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">
                      {text.recipe}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#5f4e41]">{modalState.item.recipe}</p>
                  </div>

                  <div className="rounded-[1.4rem] border border-[#eadfce] bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">
                      {text.ingredients}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modalState.item.ingredients.map((ingredient) => (
                        <span
                          key={ingredient}
                          className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-1.5 text-sm text-[#4d3e33]"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-[#eadfce] bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">
                      {text.allergens}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#5f4e41]">{activeItemMeta}</p>
                  </div>

                  <div className="rounded-[1.4rem] border border-[#eadfce] bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Prix</p>
                    <p className="mt-2 text-3xl font-semibold text-[#c41e1e]">
                      {money(getMenuItemEffectivePrice(modalState.item))}
                    </p>
                  </div>

                  {orderFlowEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        addItem(modalState.item, modalState.categoryName);
                      }}
                      className="w-full rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#aa1818]"
                    >
                      {text.addToCart}
                    </button>
                  ) : (
                    <div className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-3 text-center text-sm text-[#7f6c5a]">
                      Commande désactivée pour ce restaurant.
                    </div>
                  )}

                  {cartNotice ? <p className="text-sm font-medium text-[#c41e1e]">{cartNotice}</p> : null}
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FoodPublicMenu({
  restaurant,
  locale,
  initialAvailability,
}: {
  restaurant: Restaurant;
  locale: Locale;
  initialAvailability: AvailableDay[];
}) {
  const text = copy[locale];
  const [burgerOpen, setBurgerOpen] = useState(false);
  useEffect(() => {
    if (!burgerOpen) return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const previous = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };

    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = previous.position;
      bodyStyle.top = previous.top;
      bodyStyle.left = previous.left;
      bodyStyle.right = previous.right;
      bodyStyle.width = previous.width;
      bodyStyle.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [burgerOpen]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [restaurant.slug, locale]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`;
  const wazeUrl = `https://www.waze.com/ul?q=${encodeURIComponent(restaurant.address)}&navigate=yes`;
  const reviewsUrl = buildGoogleReviewsUrl({
    reviewsUrl: restaurant.googleReviewsUrl,
    restaurantName: restaurant.name,
    address: restaurant.address,
  });
  const tripAdvisorReviewsUrl = buildTripAdvisorUrl({
    tripAdvisorUrl: restaurant.tripAdvisorUrl,
    restaurantName: restaurant.name,
    address: restaurant.address,
  });
  const serviceLabels = [
    { label: text.onSite, tone: "bg-[#c41e1e] text-white" },
    { label: text.takeAway, tone: "bg-[#f3e7d9] text-[#7d291f] border border-[#e3cdbb]" },
    { label: text.delivery, tone: "bg-[#fff3f0] text-[#c41e1e] border border-[#f0cbc8]" },
  ];
  const cleanPhone = restaurant.phone.replace(/[^\d+]/g, "");
  const cleanWhatsapp = restaurant.whatsappNumber.replace(/[^\d+]/g, "");

  return (
    <>
      <header className="sticky top-0 z-50 w-full px-2 pt-2 sm:px-4 lg:px-6">
        <div className="mx-auto max-w-[1440px] rounded-[1.75rem] border border-[#e9dfd4] bg-[#fffdf8]/98 px-3 py-3 text-[#24170f] shadow-[0_20px_60px_rgba(70,35,22,0.12)] backdrop-blur">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <a href="#top" className="flex items-center justify-start">
              <img
                src={restaurant.logoUrl || "/food-1-logo.svg"}
                alt={restaurant.name}
                className="h-11 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[180px]"
              />
            </a>

            <div className="flex items-center justify-center gap-2">
              <a
                href="#menu"
                className="rounded-full border border-[#e7ddd0] bg-[#faf7f2] px-4 py-2 text-sm font-semibold text-[#24170f]"
              >
                Menu
              </a>
              <a
                href="#reservations"
                className="hidden rounded-full border border-[#e7ddd0] bg-white px-4 py-2 text-sm font-semibold text-[#7f6c5a] sm:inline-flex"
              >
                Reservations
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#e7ddd0] bg-[#faf7f2] px-2 py-1">
                {(["fr", "en", "it", "es"] as Locale[]).map((nextLocale) => (
                  <a
                    key={nextLocale}
                    href={`/r/${restaurant.slug}?lang=${nextLocale}`}
                    onClick={() => setBurgerOpen(false)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      locale === nextLocale ? "bg-[#c41e1e] text-white" : "text-[#7f6c5a] hover:bg-white"
                    }`}
                  >
                    {nextLocale}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setBurgerOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7ddd0] bg-[#faf7f2] text-[#24170f]"
                aria-label="Open navigation"
              >
                <BurgerIcon />
              </button>
            </div>
          </div>

          {burgerOpen ? (
            <div className="mt-3 rounded-[1.5rem] border border-[#eadfce] bg-[#fffdf8] p-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { href: "#about", label: text.about },
                  { href: "#menu", label: text.menu },
                  { href: "#reservations", label: text.reservations },
                  { href: "#loyalty", label: text.loyalty },
                  { href: "#offers", label: text.offers },
                  { href: "#reviews", label: text.reviews },
                  { href: "#contact", label: text.contact },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setBurgerOpen(false)}
                    className="rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-sm font-medium text-[#24170f]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f]">
                  Google Maps
                </a>
                <a href={wazeUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f]">
                  Waze
                </a>
                <a href={reviewsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f]">
                  Google Reviews
                </a>
                <a href={tripAdvisorReviewsUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f]">
                  TripAdvisor
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main id="top" className="mx-auto min-h-screen w-full max-w-[1440px] bg-[#faf7f2] px-3 py-3 text-[#24170f] sm:px-4 lg:px-6 lg:py-4">
        <div className="grid gap-5">
          <section className="overflow-hidden rounded-[2.5rem] border border-[#eadfce] bg-white shadow-[0_28px_90px_rgba(70,35,22,0.08)]">
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="flex flex-col justify-between gap-6 p-4 sm:p-6 lg:p-10">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cbc8] bg-[#fff3f0] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c41e1e]">
                    Italian casual food
                  </div>
                  <div className="space-y-4">
                    <h1 className="max-w-3xl text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-7xl">
                      Food 1
                    </h1>
                    <p className="max-w-2xl text-base leading-8 text-[#6f5b4a] sm:text-lg">
                      {restaurant.tagline}
                    </p>
                    <p className="max-w-2xl text-base leading-8 text-[#6f5b4a]">
                      {text.menuIntro}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href="#menu"
                    className="rounded-full border border-[#c41e1e] bg-[#c41e1e] px-5 py-3 text-sm font-semibold text-white"
                  >
                    {text.viewMenu}
                  </a>
                <BookingOpenButton className="rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-semibold text-[#24170f]">
                  {text.book}
                </BookingOpenButton>
                <a
                    href={`/client/signup?restaurantSlug=${restaurant.slug}`}
                    className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-5 py-3 text-sm font-semibold text-[#24170f]"
                  >
                    {text.orderNow}
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { title: "Fresh pasta", text: "Pâtes fraîches, sauces nettes, portions généreuses." },
                    { title: "Wood-fired pizza", text: "Pizzas fines, croustillantes, servies rapidement." },
                    { title: "Family friendly", text: "Kids menu, offers and easy reservations." },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[1.5rem] border border-[#eadfce] bg-[#fffdf8] p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#6f5b4a]">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[420px] lg:min-h-full">
                <img src={restaurant.heroImage} alt={restaurant.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1d120f]/35 via-transparent to-transparent" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {serviceLabels.map((badge) => (
                    <span
                      key={badge.label}
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] shadow-[0_10px_20px_rgba(0,0,0,0.12)] ${
                        badge.tone
                      }`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <div className="absolute bottom-4 left-4 right-4 rounded-[1.5rem] border border-white/50 bg-white/88 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.about}</p>
                  <p className="mt-2 text-base leading-7 text-[#4d3e33]">{restaurant.description}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="about" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_20px_70px_rgba(70,35,22,0.06)] lg:scroll-mt-32 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.about}</p>
                <h2 className="mt-2 text-3xl font-semibold">Food 1</h2>
                <p className="mt-3 max-w-3xl text-base leading-8 text-[#6f5b4a]">{restaurant.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Address</p>
                  <p className="mt-2 text-sm leading-6 text-[#4d3e33]">{restaurant.address}</p>
                </div>
                <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Phone</p>
                  <p className="mt-2 text-sm leading-6 text-[#4d3e33]">{restaurant.phone}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="menu" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_20px_70px_rgba(70,35,22,0.06)] lg:scroll-mt-32 lg:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.menu}</p>
                <h2 className="mt-2 text-3xl font-semibold">Menu Food 1</h2>
              </div>
              <a
                href="#reservations"
                className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-semibold text-[#24170f]"
              >
                {text.reservations}
              </a>
            </div>
            <FoodMenuShowcase
              categories={restaurant.categories}
              locale={locale}
              accent={restaurant.accent}
              restaurantSlug={restaurant.slug}
              orderFlowEnabled={restaurant.features.orderFlowEnabled}
            />
          </section>

          <section id="reservations" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-[#fff8f2] p-5 shadow-[0_20px_70px_rgba(70,35,22,0.05)] lg:scroll-mt-32 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.reservations}</p>
                <h2 className="mt-2 text-3xl font-semibold">Réserver une table</h2>
                <p className="mt-3 max-w-2xl text-base leading-8 text-[#6f5b4a]">
                  Choisissez la date, l’heure et le nombre de personnes. Le staff reçoit la demande, puis
                  confirme, annule ou marque no-show.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <BookingOpenButton className="rounded-full border border-[#c41e1e] bg-[#c41e1e] px-5 py-3 text-sm font-semibold text-white">
                    {text.book}
                  </BookingOpenButton>
                  <HoursOpenButton className="rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-semibold text-[#24170f]">
                    Hours
                  </HoursOpenButton>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Date", value: "Select a day" },
                  { label: "Time", value: "Select a slot" },
                  { label: "Guests", value: "2 to 12" },
                  { label: "Status", value: "pending → confirmed" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-[#24170f]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="loyalty" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_20px_70px_rgba(70,35,22,0.06)] lg:scroll-mt-32 lg:p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.loyalty}</p>
            <h2 className="mt-2 text-3xl font-semibold">Points & benefits</h2>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#6f5b4a]">{text.loyaltyCopy}</p>
          </section>

          <section id="offers" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-[#fff8f2] p-5 shadow-[0_20px_70px_rgba(70,35,22,0.05)] lg:scroll-mt-32 lg:p-6">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.offers}</p>
            <h2 className="mt-2 text-3xl font-semibold">Lunch, family and seasonal offers</h2>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#6f5b4a]">{text.offersCopy}</p>
          </section>

          <section id="reviews" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_20px_70px_rgba(70,35,22,0.06)] lg:scroll-mt-32 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Google Reviews</p>
                <p className="mt-2 text-2xl font-semibold text-[#24170f]">{restaurant.googleRating.toFixed(1)} ⭐</p>
                <p className="mt-1 text-sm text-[#6f5b4a]">{restaurant.googleReviewsCount} reviews</p>
                <a
                  href={reviewsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-2 text-sm font-semibold text-white"
                >
                  {text.reviews}
                </a>
              </div>
              <div className="rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">TripAdvisor</p>
                <p className="mt-2 text-2xl font-semibold text-[#24170f]">4.9 ⭐</p>
                <p className="mt-1 text-sm text-[#6f5b4a]">Recent food and family experience reviews</p>
                <a
                  href={tripAdvisorReviewsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-semibold text-[#24170f]"
                >
                  {text.reviews}
                </a>
              </div>
            </div>
          </section>

          <section id="contact" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-[#fff8f2] p-5 shadow-[0_20px_70px_rgba(70,35,22,0.05)] lg:scroll-mt-32 lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.contact}</p>
                <h2 className="mt-2 text-3xl font-semibold">{text.contact}</h2>
              </div>
              <HoursOpenButton className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-semibold text-[#24170f]">
                Hours
              </HoursOpenButton>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <a
                href={`tel:${cleanPhone}`}
                className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 transition hover:border-[#c41e1e]/30 hover:shadow-[0_12px_30px_rgba(196,30,30,0.08)]"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Phone</p>
                <p className="mt-2 text-base font-semibold text-[#24170f]">{restaurant.phone}</p>
                <p className="mt-2 text-sm text-[#6f5b4a]">Call the restaurant</p>
              </a>
              <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Address</p>
                <p className="mt-2 text-base font-semibold text-[#24170f]">{restaurant.address}</p>
                <p className="mt-2 text-sm text-[#6f5b4a]">Central location and easy access.</p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 transition hover:border-[#c41e1e]/30 hover:shadow-[0_12px_30px_rgba(196,30,30,0.08)]"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Google Maps</p>
                <p className="mt-2 text-base font-semibold text-[#24170f]">Open directions</p>
                <p className="mt-2 text-sm text-[#6f5b4a]">Route, parking and access.</p>
              </a>
              {cleanWhatsapp ? (
                <a
                  href={`https://wa.me/${cleanWhatsapp.replace(/^\+/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 transition hover:border-[#c41e1e]/30 hover:shadow-[0_12px_30px_rgba(196,30,30,0.08)]"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">WhatsApp</p>
                  <p className="mt-2 text-base font-semibold text-[#24170f]">{restaurant.whatsappNumber}</p>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Tap to open chat from the mobile app.</p>
                </a>
              ) : (
                <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">WhatsApp</p>
                  <p className="mt-2 text-base font-semibold text-[#24170f]">
                    {cleanWhatsapp ? restaurant.whatsappNumber : "Not configured"}
                  </p>
                  <p className="mt-2 text-sm text-[#6f5b4a]">
                    {cleanWhatsapp ? "Tap to open chat from the mobile app." : "Add a WhatsApp number from manager or owner."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section id="delivery" className="scroll-mt-28 rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_20px_70px_rgba(70,35,22,0.06)] lg:scroll-mt-32 lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{text.delivery}</p>
                <h2 className="mt-2 text-3xl font-semibold">Delivery / Take away / On site</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-2 text-sm text-[#24170f]">
                <DeliveryBadge />
                <span>Food-only service</span>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#6f5b4a]">{text.deliveryCopy}</p>
          </section>
        </div>
      </main>

      {restaurant.features.orderFlowEnabled ? (
        <ClientCartBar
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          currency={restaurant.currency}
          enabled={restaurant.features.orderFlowEnabled}
          variant="light"
        />
      ) : null}
      <RestaurantHoursModal restaurant={restaurant} locale={locale} />
      {restaurant.features.bookingEnabled ? (
        <PublicBookingPanel
          restaurantSlug={restaurant.slug}
          locale={locale}
          seatsPerTable={restaurant.seatsPerTable}
          initialAvailability={initialAvailability}
        />
      ) : null}
      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 pb-8 pt-6 text-[#6f5b4a] sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfce] bg-white transition hover:bg-[#faf7f2]"
          >
            <span className="text-sm font-semibold text-[#24170f]">f</span>
          </a>
          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfce] bg-white transition hover:bg-[#faf7f2]"
          >
            <span className="text-sm font-semibold text-[#24170f]">◎</span>
          </a>
        </div>
        <p className="text-center text-[11px] uppercase tracking-[0.35em] text-[#7f6c5a]">
          Food 1 · Italian casual food
        </p>
        <div className="w-18 text-right text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">
          Service food-first
        </div>
      </footer>
    </>
  );
}
