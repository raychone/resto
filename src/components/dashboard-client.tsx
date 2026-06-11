"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankRestaurant,
  createId,
  getMenuItemEffectivePrice,
  slugify,
  type HappyHourSchedule,
  weeklyDayLabels,
  type Reservation,
  type Restaurant,
  type User,
  type WeeklyHour,
} from "@/lib/types";
import type { AuditEntry } from "@/lib/audit-store";
import {
  buildNotificationLabel,
  buildNotificationLink,
  buildWhatsAppReservationMessage,
  buildGoogleReviewsUrl,
} from "@/lib/contact-links";

type Props = {
  initialRestaurants: Restaurant[];
  initialSelectedSlug?: string;
  allowRestaurantCreate?: boolean;
};

function cloneRestaurant(restaurant: Restaurant) {
  return JSON.parse(JSON.stringify(restaurant)) as Restaurant;
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinTags(values: string[]) {
  return values.join(", ");
}

const happyHourDays: WeeklyHour["day"][] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function defaultHappyHourSchedule(): HappyHourSchedule {
  return {
    enabled: false,
    label: "Happy Hour",
    days: [...happyHourDays],
    start: "18:30",
    end: "20:30",
  };
}

function formatWeeklySummary(weeklyHours: WeeklyHour[]) {
  const openDays = weeklyHours.filter((entry) => !entry.closed);

  if (openDays.length === 0) {
    return "Fermé toute la semaine";
  }

  const first = openDays[0];
  const last = openDays[openDays.length - 1];

  const allDefaultSingleSlot =
    openDays.length === 7 &&
    openDays.every(
      (entry) =>
        entry.intervals.length >= 1 &&
        entry.intervals[0]?.start === "12:00" &&
        entry.intervals[0]?.end === "23:00" &&
        (entry.intervals[1]?.start ?? "") === "" &&
        (entry.intervals[1]?.end ?? "") === "",
    );

  if (allDefaultSingleSlot) {
    return "Tous les jours 12:00 - 23:00";
  }

  return `${first.label} - ${last.label}, ${summarizeDay(first)} / ${summarizeDay(last)}`;
}

function summarizeDay(day: WeeklyHour) {
  if (day.closed || day.intervals.length === 0) {
    return "Fermé";
  }

  return day.intervals
    .map((interval) => `${interval.start} - ${interval.end}`)
    .join(" / ");
}

function money(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR"
    ? `${formatted.replace(".", ",")}€`
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(rounded);
}

function formatReservationDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatReservationDateShort(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatTodayKey() {
  return new Intl.DateTimeFormat("fr-CA").format(new Date());
}

function statusMeta(status: Reservation["status"]) {
  if (status === "confirmed") {
    return {
      label: "CONFIRMÉE",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "cancelled") {
    return {
      label: "ANNULÉE",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  if (status === "no_show") {
    return {
      label: "NO SHOW",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  return {
    label: "EN ATTENTE",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  };
}

function statusRank(status: Reservation["status"]) {
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  if (status === "cancelled") return 2;
  if (status === "no_show") return 3;
  return 3;
}

function buildConfirmationMessage(reservation: Reservation, restaurantName: string) {
  const fullName = `${reservation.firstName} ${reservation.lastName}`.trim() || reservation.name;
  return `Bonjour ${fullName},\n\nVotre réservation au restaurant ${restaurantName} est confirmée.\n\nDate: ${formatReservationDate(reservation.date)}\nHeure: ${reservation.time}\nNombre de personnes: ${reservation.guestCount}\n\nNous vous attendons.\n`;
}

export function DashboardClient({
  initialRestaurants,
  initialSelectedSlug,
  allowRestaurantCreate = false,
}: Props) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const initialSlug = initialSelectedSlug ?? initialRestaurants[0]?.slug ?? "";
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [draft, setDraft] = useState<Restaurant>(() =>
    cloneRestaurant(
      initialRestaurants.find((restaurant) => restaurant.slug === initialSlug) ??
        createBlankRestaurant(),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [reservationFilter, setReservationFilter] = useState<
    "all" | "pending" | "confirmed" | "cancelled" | "no_show" | "today"
  >("all");
  const [auditOpen, setAuditOpen] = useState(false);
  const [newStaffUser, setNewStaffUser] = useState({
    name: "",
    username: "",
    temporaryPassword: "",
  });

  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.slug === activeSlug) ??
    restaurants[0] ??
    null;

  const todayKey = formatTodayKey();

  const reservationStats = useMemo(() => {
    const pending = reservations.filter((reservation) => reservation.status === "pending").length;
    const confirmed = reservations.filter((reservation) => reservation.status === "confirmed").length;
    const cancelled = reservations.filter((reservation) => reservation.status === "cancelled").length;
    const noShow = reservations.filter((reservation) => reservation.status === "no_show").length;
    const today = reservations.filter((reservation) => reservation.date === todayKey).length;

    return { pending, confirmed, cancelled, noShow, today };
  }, [reservations, todayKey]);

  const visibleReservations = useMemo(() => {
    const sorted = [...reservations].sort((left, right) => {
      const statusDelta = statusRank(left.status) - statusRank(right.status);
      if (statusDelta !== 0) return statusDelta;

      const dateDelta = left.date.localeCompare(right.date);
      if (dateDelta !== 0) return dateDelta;

      return left.time.localeCompare(right.time);
    });

    if (reservationFilter === "all") {
      return sorted;
    }

    if (reservationFilter === "today") {
      return sorted.filter((reservation) => reservation.date === todayKey);
    }

    return sorted.filter((reservation) => reservation.status === reservationFilter);
  }, [reservations, reservationFilter, todayKey]);

  async function reloadRestaurants(nextSelectedSlug?: string) {
    const response = await fetch("/api/restaurants", {
      cache: "no-store",
    });
    const nextRestaurants = (await response.json()) as Restaurant[];
    setRestaurants(nextRestaurants);

    const fallbackSlug = nextSelectedSlug ?? nextRestaurants[0]?.slug ?? "";
    setActiveSlug(fallbackSlug);
    const nextRestaurant =
      nextRestaurants.find((restaurant) => restaurant.slug === fallbackSlug) ?? null;
    setDraft(
      nextRestaurant ? cloneRestaurant(nextRestaurant) : cloneRestaurant(createBlankRestaurant()),
    );
    if (fallbackSlug) {
      await loadReservations(fallbackSlug);
    }
  }

  async function loadReservations(slug: string) {
    if (!slug) return;
    setLoadingReservations(true);
    const response = await fetch(`/api/restaurants/${slug}/reservations`, {
      cache: "no-store",
    });

    if (response.ok) {
      const payload = (await response.json()) as { reservations: Reservation[] };
      setReservations(payload.reservations);
    }

    setLoadingReservations(false);
  }

  async function loadUsers(slug: string) {
    if (!slug) return;
    setLoadingUsers(true);

    const response = await fetch(`/api/restaurants/${slug}/users`, {
      cache: "no-store",
    });

    if (response.ok) {
      const payload = (await response.json()) as { users: User[] };
      setUsers(payload.users);
    }

    setLoadingUsers(false);
  }

  async function loadAudit(slug: string) {
    if (!slug) return;
    setLoadingAudit(true);

    const response = await fetch(`/api/restaurants/${slug}/audit`, {
      cache: "no-store",
    });

    if (response.ok) {
      const payload = (await response.json()) as { auditEntries: AuditEntry[] };
      setAuditEntries(payload.auditEntries);
    }

    setLoadingAudit(false);
  }

  function updateField<K extends keyof Restaurant>(key: K, value: Restaurant[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateFeatureField<K extends keyof Restaurant["features"]>(
    key: K,
    value: Restaurant["features"][K],
  ) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        features: {
          ...current.features,
          [key]: value,
        },
      };
    });
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReservations(activeSlug);
      void loadUsers(activeSlug);
      void loadAudit(activeSlug);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeSlug]);

  function updateWeeklyHourField(
    index: number,
    updater: (current: WeeklyHour) => WeeklyHour,
  ) {
    setDraft((current) => {
      if (!current) return current;
      const weeklyHours = [...current.weeklyHours];
      weeklyHours[index] = updater(weeklyHours[index]);
      return { ...current, weeklyHours };
    });
  }

  function updateWeeklyIntervalField(
    dayIndex: number,
    slotIndex: number,
    key: "start" | "end",
    value: string,
  ) {
    updateWeeklyHourField(dayIndex, (current) => {
      const intervals = [...current.intervals];
      const nextInterval = {
        start: intervals[slotIndex]?.start ?? "",
        end: intervals[slotIndex]?.end ?? "",
      };
      nextInterval[key] = value;
      intervals[slotIndex] = nextInterval;

      return {
        ...current,
        intervals,
      };
    });
  }

  function updateCategoryField(index: number, key: "name" | "description", value: string) {
    setDraft((current) => {
      if (!current) return current;
      const categories = [...current.categories];
      categories[index] = { ...categories[index], [key]: value };
      return { ...current, categories };
    });
  }

  function updateItemField(
    categoryIndex: number,
    itemIndex: number,
    key:
      | "name"
      | "description"
      | "recipe"
      | "ingredients"
      | "allergens"
      | "price"
      | "happyHourEnabled"
      | "happyHourPrice"
      | "imageUrl"
      | "isSignature",
    value: string | number | boolean,
  ) {
    setDraft((current) => {
      if (!current) return current;
      const categories = [...current.categories];
      const items = [...categories[categoryIndex].items];
      const item = { ...items[itemIndex] };

      switch (key) {
        case "ingredients":
          item.ingredients = splitTags(String(value));
          break;
        case "allergens":
          item.allergens = splitTags(String(value));
          break;
        case "price":
          item.price = Number(value);
          break;
        case "happyHourEnabled":
          item.happyHourEnabled = Boolean(value);
          if (!value) {
            item.happyHourPrice = null;
          }
          break;
        case "happyHourPrice":
          item.happyHourPrice = String(value).trim() ? Number(value) : null;
          break;
        case "isSignature":
          item.isSignature = Boolean(value);
          break;
        case "name":
          item.name = String(value);
          break;
        case "description":
          item.description = String(value);
          break;
        case "recipe":
          item.recipe = String(value);
          break;
        case "imageUrl":
          item.imageUrl = String(value);
          break;
        default:
          break;
      }

      items[itemIndex] = item;
      categories[categoryIndex] = { ...categories[categoryIndex], items };
      return { ...current, categories };
    });
  }

  function addCategory() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        categories: [
          ...current.categories,
          {
            id: createId("category"),
            name: "Nouvelle catégorie",
            description: "Description de section.",
            items: [],
          },
        ],
      };
    });
  }

  function removeCategory(index: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        categories: current.categories.filter((_, categoryIndex) => categoryIndex !== index),
      };
    });
  }

  function addItem(categoryIndex: number) {
    setDraft((current) => {
      if (!current) return current;
      const categories = [...current.categories];
      categories[categoryIndex] = {
        ...categories[categoryIndex],
        items: [
          ...categories[categoryIndex].items,
          {
            id: createId("item"),
            name: "Nouveau plat",
            description: "Description du plat.",
            recipe: "Note de préparation.",
            ingredients: ["ingrédient 1", "ingrédient 2"],
            allergens: [],
            price: 0,
            imageUrl:
              "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
            isSignature: false,
          },
        ],
      };
      return { ...current, categories };
    });
  }

  function removeItem(categoryIndex: number, itemIndex: number) {
    setDraft((current) => {
      if (!current) return current;
      const categories = [...current.categories];
      categories[categoryIndex] = {
        ...categories[categoryIndex],
        items: categories[categoryIndex].items.filter((_, index) => index !== itemIndex),
      };
      return { ...current, categories };
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setNotice(null);

    const trimmedSlug = slugify(draft.slug || draft.name);
    const payload = {
      ...draft,
      openingHours: formatWeeklySummary(draft.weeklyHours),
      slug: trimmedSlug,
    };

    const isExisting = restaurants.some((restaurant) => restaurant.slug === activeSlug);
    const response = await fetch(
      isExisting ? `/api/restaurants/${activeSlug}` : "/api/restaurants",
      {
        method: isExisting ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      setSaving(false);
      setNotice("Impossible d'enregistrer le menu.");
      return;
    }

    const saved = (await response.json()) as Restaurant;
    setNotice("Enregistré et publié.");
    await reloadRestaurants(saved.slug);
    setSaving(false);
  }

  async function changeReservationStatus(
    reservationId: string,
    status: "confirmed" | "cancelled" | "no_show",
  ) {
    if (!activeSlug) return;

    const response = await fetch(`/api/restaurants/${activeSlug}/reservations/${reservationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setNotice("Impossible de mettre à jour la réservation.");
      return;
    }

    setNotice(
      status === "confirmed"
        ? "Réservation confirmée."
        : status === "cancelled"
          ? "Réservation annulée."
          : "Réservation marquée no show.",
    );
    await loadReservations(activeSlug);
  }

  async function createStaffUser() {
    if (!activeSlug || !newStaffUser.name || !newStaffUser.username || !newStaffUser.temporaryPassword) {
      setNotice("Complète le nom, le username et la mot de passe temporaire.");
      return;
    }

    const response = await fetch(`/api/restaurants/${activeSlug}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newStaffUser),
    });

    if (!response.ok) {
      setNotice("Impossible de créer l'utilisateur staff.");
      return;
    }

    setNewStaffUser({
      name: "",
      username: "",
      temporaryPassword: "",
    });
    setNotice("Utilisateur staff créé.");
    await loadUsers(activeSlug);
  }

  async function toggleStaffStatus(user: User) {
    if (!activeSlug) return;

    const response = await fetch(`/api/restaurants/${activeSlug}/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: user.status === "active" ? "disabled" : "active",
      }),
    });

    if (!response.ok) {
      setNotice("Impossible de modifier le statut du staff.");
      return;
    }

    setNotice(user.status === "active" ? "Utilisateur désactivé." : "Utilisateur activé.");
    await loadUsers(activeSlug);
  }

  async function resetStaffPassword(user: User) {
    if (!activeSlug) return;

    const temporaryPassword = `Tmp#${createId("pw").slice(-4)}!`;
    const response = await fetch(`/api/restaurants/${activeSlug}/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resetPassword: true,
        temporaryPassword,
      }),
    });

    if (!response.ok) {
      setNotice("Impossible de réinitialiser le mot de passe.");
      return;
    }

    setNotice(`Mot de passe réinitialisé: ${temporaryPassword}`);
    await loadUsers(activeSlug);
  }

  function startNewRestaurant() {
    const template = cloneRestaurant(createBlankRestaurant());
    template.slug = `restaurant-${createId("new")}`;
    setDraft(template);
    setActiveSlug(template.slug);
  }

  if (!draft) {
    return (
      <div className="rounded-[2rem] border border-black/8 bg-white/80 p-8 text-sm text-black/60 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        Chargement du tableau de bord...
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
            Restaurants
          </p>
          <h2 className="text-2xl font-semibold">Sélection rapide</h2>
        </div>

        {allowRestaurantCreate ? (
          <button
            type="button"
            onClick={startNewRestaurant}
            className="w-full rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Nouveau restaurant
          </button>
        ) : null}

        <div className="space-y-3">
          {restaurants.map((restaurant) => {
            const selected = restaurant.slug === activeSlug;
            return (
              <button
                key={restaurant.slug}
                type="button"
                onClick={() => {
                  setActiveSlug(restaurant.slug);
                  setDraft(cloneRestaurant(restaurant));
                }}
                className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                  selected
                    ? "border-transparent text-white shadow-lg"
                    : "border-black/8 bg-black/3 text-black hover:bg-black/5"
                }`}
                style={
                  selected
                    ? {
                        background: `linear-gradient(135deg, ${restaurant.accent}, #111827)`,
                      }
                    : undefined
                }
              >
                <span className="block text-[11px] uppercase tracking-[0.28em] opacity-70">
                  {restaurant.slug}
                </span>
                <span className="mt-2 block text-lg font-semibold">{restaurant.name}</span>
                <span className="mt-1 block text-sm opacity-80">{restaurant.tagline}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[1.5rem] border border-black/8 bg-black/3 p-4 text-sm text-black/70">
          <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">État</p>
          <p className="mt-2">{notice ?? "Prêt à éditer."}</p>
        </div>
      </aside>

      <div className="space-y-6">
        <section className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Tableau du restaurant
              </p>
              <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                {draft.name}
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-black/65">
                Modifie l&apos;image, les prix, les ingrédients, les allergènes et chaque
                plat sans toucher au code.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/r/${slugify(draft.slug || draft.name)}`}
                className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Voir le menu public
              </Link>
              <Link
                href={`/qr/${slugify(draft.slug || draft.name)}`}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Voir le QR code
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nom du restaurant">
                  <input
                    value={draft.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Slug public">
                  <input
                    value={draft.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Slogan">
                  <input
                    value={draft.tagline}
                    onChange={(event) => updateField("tagline", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Couleur d'accent">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={draft.accent}
                      onChange={(event) => updateField("accent", event.target.value)}
                      className="h-12 w-16 rounded-xl border border-black/10 bg-white p-1"
                    />
                    <input
                      value={draft.accent}
                      onChange={(event) => updateField("accent", event.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    />
                  </div>
                </Field>
                <Field label="Téléphone">
                  <input
                    value={draft.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Numéro téléphone notifications">
                  <input
                    value={draft.whatsappNumber}
                    onChange={(event) => updateField("whatsappNumber", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Google rating">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={5}
                    value={draft.googleRating}
                    onChange={(event) =>
                      updateField("googleRating", Number(event.target.value) as Restaurant["googleRating"])
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Google avis">
                  <input
                    type="number"
                    min={0}
                    value={draft.googleReviewsCount}
                    onChange={(event) =>
                      updateField(
                        "googleReviewsCount",
                        Number(event.target.value) as Restaurant["googleReviewsCount"],
                      )
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="URL Google reviews">
                  <div className="flex gap-3">
                    <input
                      value={draft.googleReviewsUrl}
                      onChange={(event) => updateField("googleReviewsUrl", event.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    />
                    <a
                      href={buildGoogleReviewsUrl({
                        reviewsUrl: draft.googleReviewsUrl,
                        restaurantName: draft.name,
                        address: draft.address,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white"
                    >
                      Tester
                    </a>
                  </div>
                </Field>
                <Field label="Monnaie">
                  <input
                    value={draft.currency}
                    readOnly
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Nombre de tables">
                  <input
                    type="number"
                    min={1}
                    value={draft.tableCount}
                    onChange={(event) =>
                      updateField("tableCount", Number(event.target.value) as Restaurant["tableCount"])
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Places par table">
                  <input
                    type="number"
                    min={1}
                    value={draft.seatsPerTable}
                    onChange={(event) =>
                      updateField(
                        "seatsPerTable",
                        Number(event.target.value) as Restaurant["seatsPerTable"],
                      )
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Happy hour">
                  <div className="grid gap-4 rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>Activer le happy hour</span>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.happyHourSchedule?.enabled)}
                        onChange={(event) =>
                          updateField("happyHourSchedule", {
                            ...(draft.happyHourSchedule ?? defaultHappyHourSchedule()),
                            enabled: event.target.checked,
                          })
                        }
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                        Libellé
                      </span>
                      <input
                        value={draft.happyHourSchedule?.label ?? "Happy Hour"}
                        onChange={(event) =>
                          updateField("happyHourSchedule", {
                            ...(draft.happyHourSchedule ?? defaultHappyHourSchedule()),
                            label: event.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                      />
                    </label>

                    <div className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                        Jours
                      </span>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                        {happyHourDays.map((day) => {
                          const currentSchedule = draft.happyHourSchedule ?? defaultHappyHourSchedule();
                          const isSelected = currentSchedule.days.includes(day);

                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const nextDays = isSelected
                                  ? currentSchedule.days.filter((entry) => entry !== day)
                                  : [...currentSchedule.days, day];
                                updateField("happyHourSchedule", {
                                  ...currentSchedule,
                                  days: nextDays,
                                });
                              }}
                              className={`rounded-2xl border px-3 py-2 text-sm transition ${
                                isSelected
                                  ? "border-black bg-black text-white"
                                  : "border-black/10 bg-white text-black/70"
                              }`}
                            >
                              {weeklyDayLabels[day]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                          De
                        </span>
                        <input
                          type="time"
                          value={draft.happyHourSchedule?.start ?? "18:30"}
                          onChange={(event) =>
                            updateField("happyHourSchedule", {
                              ...(draft.happyHourSchedule ?? defaultHappyHourSchedule()),
                              start: event.target.value,
                            })
                          }
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                          À
                        </span>
                        <input
                          type="time"
                          value={draft.happyHourSchedule?.end ?? "20:30"}
                          onChange={(event) =>
                            updateField("happyHourSchedule", {
                              ...(draft.happyHourSchedule ?? defaultHappyHourSchedule()),
                              end: event.target.value,
                            })
                          }
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                        />
                      </label>
                    </div>
                  </div>
                </Field>
                <Field label="Options commerciales">
                  <div className="grid gap-3 rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>Réservation en ligne</span>
                      <input
                        type="checkbox"
                        checked={draft.features.bookingEnabled}
                        onChange={(event) =>
                          updateFeatureField("bookingEnabled", event.target.checked)
                        }
                      />
                    </label>
                    <label className="grid gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>QR code destination</span>
                      <select
                        value={draft.features.qrMode}
                        onChange={(event) =>
                          updateFeatureField(
                            "qrMode",
                            event.target.value as Restaurant["features"]["qrMode"],
                          )
                        }
                        className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none"
                      >
                        <option value="pdf">PDF A3</option>
                        <option value="menu">Menu web</option>
                        <option value="off">Désactivé</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>Alertes WhatsApp</span>
                      <input
                        type="checkbox"
                        checked={draft.features.whatsappAlertsEnabled}
                        onChange={(event) =>
                          updateFeatureField("whatsappAlertsEnabled", event.target.checked)
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>Alertes SMS</span>
                      <input
                        type="checkbox"
                        checked={draft.features.smsAlertsEnabled}
                        onChange={(event) =>
                          updateFeatureField("smsAlertsEnabled", event.target.checked)
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>Avis Google visibles</span>
                      <input
                        type="checkbox"
                        checked={draft.features.googleReviewsEnabled}
                        onChange={(event) =>
                          updateFeatureField("googleReviewsEnabled", event.target.checked)
                        }
                      />
                    </label>
                  </div>
                </Field>
                <Field label="Adresse">
                  <input
                    value={draft.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                  />
                </Field>
                <Field label="Horaires hebdomadaires">
                  <div className="rounded-[1.5rem] border border-black/10 bg-white p-4">
                    <p className="text-xs text-black/50">
                      Résumé: {formatWeeklySummary(draft.weeklyHours)}
                    </p>
                    <div className="mt-4 grid gap-3">
                      {draft.weeklyHours.map((entry, index) => (
                        <div
                          key={entry.day}
                          className="grid gap-3 rounded-2xl border border-black/8 bg-black/2 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center text-sm font-medium">
                              {weeklyDayLabels[entry.day]}
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={entry.closed}
                                onChange={(event) =>
                                  updateWeeklyHourField(index, (current) => ({
                                    ...current,
                                    closed: event.target.checked,
                                  }))
                                }
                              />
                              Fermé
                            </label>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {[0, 1].map((slotIndex) => {
                              const interval = entry.intervals[slotIndex];
                              const isEnabled = !entry.closed;

                              return (
                                <div
                                  key={slotIndex}
                                  className="rounded-2xl border border-black/8 bg-white p-3"
                                >
                                  <p className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                                    Créneau {slotIndex + 1}
                                  </p>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <label className="grid gap-1">
                                      <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                                        De
                                      </span>
                                      <input
                                        type="time"
                                        value={interval?.start ?? ""}
                                        onChange={(event) =>
                                          updateWeeklyIntervalField(
                                            index,
                                            slotIndex,
                                            "start",
                                            event.target.value,
                                          )
                                        }
                                        disabled={!isEnabled}
                                        className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none disabled:opacity-50"
                                      />
                                    </label>
                                    <label className="grid gap-1">
                                      <span className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                                        À
                                      </span>
                                      <input
                                        type="time"
                                        value={interval?.end ?? ""}
                                        onChange={(event) =>
                                          updateWeeklyIntervalField(
                                            index,
                                            slotIndex,
                                            "end",
                                            event.target.value,
                                          )
                                        }
                                        disabled={!isEnabled}
                                        className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none disabled:opacity-50"
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={4}
                  className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                />
              </Field>

              <Field label="Image principale">
                <input
                  value={draft.heroImage}
                  onChange={(event) => updateField("heroImage", event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                />
              </Field>
              <Field label="Logo du restaurant">
                <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateField("logoUrl", String(reader.result ?? ""));
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                  />
                  <div className="flex items-center justify-center rounded-[1.5rem] border border-black/10 bg-white p-3">
                    {draft.logoUrl ? (
                      <img
                        src={draft.logoUrl}
                        alt="Logo du restaurant"
                        className="h-24 w-24 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-sm text-black/45">Aucun logo</span>
                    )}
                  </div>
                </div>
              </Field>
            </div>

            <div className="space-y-5">
              {draft.categories.map((category, categoryIndex) => (
                <section
                  key={category.id}
                  className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="grid flex-1 gap-4">
                      <Field label="Nom de la catégorie">
                        <input
                          value={category.name}
                          onChange={(event) =>
                            updateCategoryField(categoryIndex, "name", event.target.value)
                          }
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                        />
                      </Field>
                      <Field label="Description de catégorie">
                        <input
                          value={category.description}
                          onChange={(event) =>
                            updateCategoryField(
                              categoryIndex,
                              "description",
                              event.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                        />
                      </Field>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addItem(categoryIndex)}
                        className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                      >
                        Ajouter un plat
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCategory(categoryIndex)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {category.items.map((item, itemIndex) => (
                      <article
                        key={item.id}
                        className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4"
                      >
                        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Nom du plat">
                              <input
                                value={item.name}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Prix">
                              <input
                                type="number"
                                value={item.price}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "price",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Happy hour">
                              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.happyHourEnabled)}
                                  onChange={(event) =>
                                    updateItemField(
                                      categoryIndex,
                                      itemIndex,
                                      "happyHourEnabled",
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span className="text-sm text-black/70">
                                  Activer le prix happy hour
                                </span>
                              </label>
                            </Field>
                            <Field label="Prix happy hour">
                              <input
                                type="number"
                                value={item.happyHourPrice ?? ""}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "happyHourPrice",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Image URL">
                              <input
                                value={item.imageUrl}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "imageUrl",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Atribut signature">
                              <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={item.isSignature}
                                  onChange={(event) =>
                                    updateItemField(
                                      categoryIndex,
                                      itemIndex,
                                      "isSignature",
                                      event.target.checked,
                                    )
                                  }
                                />
                              <span className="text-sm text-black/70">
                                  Marquer comme plat signature
                                </span>
                              </label>
                            </Field>
                            <Field label="Ingrédients">
                              <textarea
                                value={joinTags(item.ingredients)}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "ingredients",
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Allergènes">
                              <textarea
                                value={joinTags(item.allergens)}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "allergens",
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                            <Field label="Description">
                              <textarea
                                value={item.description}
                                onChange={(event) =>
                                  updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                <Field label="Interne / note cuisine">
                  <textarea
                    value={item.recipe}
                    onChange={(event) =>
                      updateItemField(
                                    categoryIndex,
                                    itemIndex,
                                    "recipe",
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                              />
                            </Field>
                          </div>

                          <div className="space-y-3">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-44 w-full rounded-[1.5rem] object-cover"
                            />
                            <p className="text-sm text-black/60">
                              Preview: {money(getMenuItemEffectivePrice(item), draft.currency)}
                              {item.happyHourEnabled &&
                              Number.isFinite(item.happyHourPrice) &&
                              Number(item.happyHourPrice) > 0 ? (
                                <span className="ml-2 text-xs text-black/40 line-through">
                                  {money(item.price, draft.currency)}
                                </span>
                              ) : null}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeItem(categoryIndex, itemIndex)}
                              className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                            >
                              Supprimer le plat
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addCategory}
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black"
              >
                Ajouter une catégorie
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer le menu"}
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Linkuri
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-2xl border border-black/8 bg-black/3 p-4">
                <span className="block text-[11px] uppercase tracking-[0.3em] text-black/40">
                    Menu public
                  </span>
                  <Link
                    href={`/r/${slugify(draft.slug || draft.name)}`}
                    className="mt-2 block break-all font-medium text-black underline decoration-black/20 underline-offset-4"
                  >
                    /r/{slugify(draft.slug || draft.name)}
                  </Link>
                </div>
                <div className="rounded-2xl border border-black/8 bg-black/3 p-4">
                <span className="block text-[11px] uppercase tracking-[0.3em] text-black/40">
                    QR dédié
                  </span>
                  <Link
                    href={`/qr/${slugify(draft.slug || draft.name)}`}
                    className="mt-2 block break-all font-medium text-black underline decoration-black/20 underline-offset-4"
                  >
                    /qr/{slugify(draft.slug || draft.name)}
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                    Équipe
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Utilisateurs staff</h3>
                </div>
                <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">
                  {loadingUsers ? "Chargement..." : `${users.length}`}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <Field label="Nom complet">
                  <input
                    value={newStaffUser.name}
                    onChange={(event) =>
                      setNewStaffUser((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    placeholder="Vasile"
                  />
                </Field>
                <Field label="Username">
                  <input
                    value={newStaffUser.username}
                    onChange={(event) =>
                      setNewStaffUser((current) => ({ ...current, username: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    placeholder="vasile"
                  />
                </Field>
                <Field label="Mot de passe temporaire">
                  <input
                    value={newStaffUser.temporaryPassword}
                    onChange={(event) =>
                      setNewStaffUser((current) => ({
                        ...current,
                        temporaryPassword: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    placeholder="Tmp#1234!"
                  />
                </Field>
                <button
                  type="button"
                  onClick={createStaffUser}
                  className="rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white"
                >
                  Créer un staff
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {users.length === 0 ? (
                  <p className="text-sm text-black/55">Aucun utilisateur staff.</p>
                ) : (
                  users.map((user) => (
                    <article
                      key={user.id}
                      className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{user.name}</p>
                          <p className="text-xs text-black/55">@{user.username}</p>
                          <p className="text-xs text-black/55">
                            {user.mustChangePassword ? "Mot de passe temporaire" : "Mot de passe fixé"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                            user.status === "active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {user.status === "active" ? "Active" : "Disabled"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStaffStatus(user)}
                          className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                        >
                          {user.status === "active" ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetStaffPassword(user)}
                          className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                        >
                          Réinitialiser le mot de passe
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <button
                type="button"
                onClick={() => setAuditOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                    Historique
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Audit manager</h3>
                </div>
                <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">
                  {loadingAudit ? "Chargement..." : `${auditEntries.length}`}
                </span>
              </button>

              {auditOpen ? (
                <div className="mt-4 space-y-2">
                  {auditEntries.length === 0 ? (
                    <p className="text-sm text-black/55">Aucune action enregistrée.</p>
                  ) : (
                    auditEntries.slice(0, 12).map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{entry.action}</p>
                            <p className="text-xs text-black/55">
                              {entry.actorRole} · {entry.actorName}
                            </p>
                            <p className="mt-1 text-xs text-black/55">
                              {entry.targetType} · {entry.targetId}
                            </p>
                          </div>
                          <span className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                            {new Intl.DateTimeFormat("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(entry.createdAt))}
                          </span>
                        </div>
                        {entry.details ? (
                          <p className="mt-2 text-sm text-black/65">{entry.details}</p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Résumé
              </p>
              <div className="mt-3 space-y-3 text-sm text-black/70">
                <p>
                  {draft.categories.length} catégories,{" "}
                  {draft.categories.reduce((count, category) => count + category.items.length, 0)}{" "}
                  plats.
                </p>
                <p>
                  {draft.tableCount} tables, {draft.seatsPerTable} places par table,
                  avec réservations et messages clients activés.
                </p>
                <p>
                  Note Google: {draft.googleRating.toFixed(1)} ⭐ • {draft.googleReviewsCount} avis.
                </p>
                <p>
                  Prix en {draft.currency}, images modifiables et allergènes affichés
                  directement sur le menu public.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                    Réservations
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Inbox staff</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {reservationStats.pending} en attente
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {reservationStats.confirmed} confirmées
                  </span>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    {reservationStats.cancelled} annulées
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {reservationStats.noShow} no show
                  </span>
                  <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">
                    {loadingReservations ? "Chargement..." : `${reservations.length}`}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { key: "all", label: "Tous" },
                  { key: "pending", label: "Pending" },
                  { key: "confirmed", label: "Confirmées" },
                  { key: "cancelled", label: "Annulées" },
                  { key: "no_show", label: "No show" },
                  { key: "today", label: "Aujourd'hui" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() =>
                      setReservationFilter(filter.key as typeof reservationFilter)
                    }
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      reservationFilter === filter.key
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black hover:bg-black/3"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {visibleReservations.length === 0 ? (
                  <p className="text-sm text-black/55">
                    Aucune réservation pour le moment.
                  </p>
                ) : (
                  visibleReservations.map((reservation) => {
                    const mailSubject = encodeURIComponent(
                      `Confirmation réservation - ${currentRestaurant?.name ?? draft.name}`,
                    );
                    const mailBody = encodeURIComponent(
                      buildConfirmationMessage(
                        reservation,
                        currentRestaurant?.name ?? draft.name,
                      ),
                    );
                    const mailto = reservation.email
                      ? `mailto:${encodeURIComponent(reservation.email)}?subject=${mailSubject}&body=${mailBody}`
                      : "";
                    const notificationProvider =
                      currentRestaurant?.features.notificationProvider ??
                      draft.features.notificationProvider;
                    const notificationMessage = buildWhatsAppReservationMessage({
                      restaurantName: currentRestaurant?.name ?? draft.name,
                      firstName: reservation.firstName,
                      lastName: reservation.lastName,
                      guestCount: reservation.guestCount,
                      time: reservation.time,
                      dateLabel: formatReservationDateShort(reservation.date),
                    });
                    const notificationUrl = buildNotificationLink({
                      provider: notificationProvider,
                      phoneNumber: currentRestaurant?.whatsappNumber ?? draft.whatsappNumber,
                      message: notificationMessage,
                    });
                    const notificationLabel = buildNotificationLabel(notificationProvider);

                    return (
                      <article
                        key={reservation.id}
                        className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">
                              {reservation.firstName} {reservation.lastName}
                            </p>
                            <p className="text-xs text-black/55">
                              {formatReservationDate(reservation.date)} · {reservation.time}
                            </p>
                            <p className="text-xs text-black/55">
                              {reservation.guestCount} personnes · {reservation.tablesNeeded} table(s)
                            </p>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                                statusMeta(reservation.status).className
                              }`}
                            >
                              {statusMeta(reservation.status).label}
                            </span>
                          </div>
                          <div className="text-right text-xs text-black/55">
                            <p>{reservation.phone}</p>
                            <p>{reservation.email || "—"}</p>
                          </div>
                        </div>

                        {reservation.note ? (
                          <p className="mt-3 rounded-2xl border border-black/8 bg-white p-3 text-sm text-black/70">
                            {reservation.note}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {reservation.status !== "confirmed" ? (
                            <button
                              type="button"
                              onClick={() => changeReservationStatus(reservation.id, "confirmed")}
                              className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                            >
                              Confirmer
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => changeReservationStatus(reservation.id, "cancelled")}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                          >
                            Annuler
                          </button>
                          {reservation.status !== "no_show" ? (
                            <button
                              type="button"
                              onClick={() => changeReservationStatus(reservation.id, "no_show")}
                              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                            >
                              No show
                            </button>
                          ) : null}
                          {mailto ? (
                            <a
                              href={mailto}
                              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                            >
                              Envoyer au client
                            </a>
                          ) : null}
                          {notificationProvider === "twilio" ? (
                            <span className="rounded-full border border-black/10 bg-black/4 px-3 py-2 text-xs font-medium text-black/60">
                              SMS auto via Twilio
                            </span>
                          ) : notificationUrl ? (
                            <a
                              href={notificationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                            >
                              {notificationLabel || "Notification"}
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
        {label}
      </span>
      {children}
    </label>
  );
}
