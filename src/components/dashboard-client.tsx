"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBlankRestaurant,
  createId,
  getMenuItemEffectivePrice,
  slugify,
  type HappyHourSchedule,
  type Order,
  weeklyDayLabels,
  type Reservation,
  type RestaurantMessage,
  type Restaurant,
  type User,
  type WeeklyHour,
} from "@/lib/types";
import type { AuditEntry } from "@/lib/audit-store";
import { humanizeAuditEntry } from "@/lib/audit-humanize";
import {
  buildNotificationLabel,
  buildNotificationLink,
  buildWhatsAppReservationMessage,
  buildGoogleReviewsUrl,
} from "@/lib/contact-links";
import { countTablesNeeded, getAvailableDays } from "@/lib/booking";
import { useRestaurantRealtime } from "@/components/use-restaurant-realtime";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

type Props = {
  initialRestaurants: Restaurant[];
  initialSelectedSlug?: string;
  allowRestaurantCreate?: boolean;
  theme?: "dark" | "food";
  siteOrigin?: string;
};

type ManagerSection = "dashboard" | "menu" | "reservations" | "settings";
type SettingsPanel = "general" | "opening" | "staff" | "audit" | "links";
type DishEditorState = { categoryIndex: number; itemIndex: number } | null;
type CategoryEditorState = number | null;
type ReservationWizardStep = 1 | 2 | 3 | 4;
type ReservationCountryOption = {
  code: CountryCode;
  label: string;
  dialCode: string;
  displayLabel: string;
};

const preferredReservationCountries: CountryCode[] = ["FR", "BE", "CH", "IT", "ES", "DE", "GB", "PT", "US"];

const reservationCountryLabels =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["fr-FR"], { type: "region" })
    : null;

const reservationPhoneCountries: ReservationCountryOption[] = [...new Set([...preferredReservationCountries, ...getCountries()])]
  .map((code) => {
    const label = reservationCountryLabels?.of(code) ?? code;
    const dialCode = `+${getCountryCallingCode(code)}`;
    return {
      code,
      label,
      dialCode,
      displayLabel: `${label} · ${dialCode}`,
    };
  })
  .sort((left, right) => {
    const leftPriority = preferredReservationCountries.indexOf(left.code);
    const rightPriority = preferredReservationCountries.indexOf(right.code);
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }

    return left.label.localeCompare(right.label, "fr");
  });

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0, 0);
}

function buildCalendarGrid(month: Date) {
  const firstDay = startOfMonth(month);
  const startOffset = firstDay.getDay();
  const firstVisibleDay = new Date(firstDay);
  firstVisibleDay.setDate(firstDay.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisibleDay);
    day.setDate(firstVisibleDay.getDate() + index);
    day.setHours(12, 0, 0, 0);
    return day;
  });
}

function isSameMonth(date: Date, month: Date) {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function formatShortWeekday(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
}

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.replace(/[^\d]/g, "").trim();
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

function formatOpeningDaySummary(day: WeeklyHour) {
  if (day.closed) {
    return "Fermé";
  }

  const intervals = day.intervals
    .filter((interval) => interval.start || interval.end)
    .map((interval) => `${interval.start || "—"} - ${interval.end || "—"}`);

  return intervals.length > 0 ? intervals.join(" / ") : "Créneaux à compléter";
}

function money(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR"
    ? `${formatted}€`
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

function parseMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function getParisTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    day:
      {
        Mon: "mon",
        Tue: "tue",
        Wed: "wed",
        Thu: "thu",
        Fri: "fri",
        Sat: "sat",
        Sun: "sun",
      }[weekday] ?? "mon",
    minutes: hour * 60 + minute,
  } as { day: WeeklyHour["day"]; minutes: number };
}

function getManagerOpenStatus(restaurant: Restaurant) {
  if (restaurant.status === "closed") {
    return { label: "Fermé", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  const current = getParisTimeParts();
  const currentDay = restaurant.weeklyHours.find((entry) => entry.day === current.day);

  if (!currentDay || currentDay.closed) {
    return { label: "Fermé", className: "border-slate-200 bg-slate-50 text-slate-700" };
  }

  const openNow = currentDay.intervals.some((interval) => {
    if (!interval.start || !interval.end) {
      return false;
    }

    const startMinutes = parseMinutes(interval.start);
    const endMinutes = parseMinutes(interval.end);
    return current.minutes >= startMinutes && current.minutes < endMinutes;
  });

  return openNow
    ? { label: "Ouvert", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    : { label: "Fermé", className: "border-slate-200 bg-slate-50 text-slate-700" };
}

export function DashboardClient({
  initialRestaurants,
  initialSelectedSlug,
  allowRestaurantCreate = false,
  theme = "dark",
  siteOrigin = "",
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<RestaurantMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [reservationFilter, setReservationFilter] = useState<
    "all" | "pending" | "confirmed" | "cancelled" | "no_show" | "today"
  >("all");
  const [auditOpen, setAuditOpen] = useState(false);
  const [managerSection, setManagerSection] = useState<ManagerSection>("dashboard");
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>("general");
  const [openingDayEditorIndex, setOpeningDayEditorIndex] = useState<number | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditorState>(null);
  const [dishEditor, setDishEditor] = useState<DishEditorState>(null);
  const [reservationWizardOpen, setReservationWizardOpen] = useState(false);
  const [reservationWizardStep, setReservationWizardStep] = useState<ReservationWizardStep>(1);
  const [reservationWizardMonth, setReservationWizardMonth] = useState(() => new Date());
  const [reservationWizardDate, setReservationWizardDate] = useState(() => formatTodayKey());
  const [reservationWizardTime, setReservationWizardTime] = useState("");
  const [reservationWizardCountryOpen, setReservationWizardCountryOpen] = useState(false);
  const [reservationWizardCountryQuery, setReservationWizardCountryQuery] = useState("");
  const [reservationWizardPhoneCountry, setReservationWizardPhoneCountry] = useState<CountryCode>("FR");
  const [reservationWizardSubmitting, setReservationWizardSubmitting] = useState(false);
  const [reservationAgendaFocus, setReservationAgendaFocus] = useState<string | null>(null);
  const [reservationWizardForm, setReservationWizardForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    guestCount: 2,
    note: "",
  });
  const [newStaffUser, setNewStaffUser] = useState({
    name: "",
    username: "",
    temporaryPassword: "",
  });

  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.slug === activeSlug) ??
    restaurants[0] ??
    null;
  const publicMenuUrl = `${siteOrigin}/r/${slugify(draft.slug || draft.name)}`;
  const publicQrUrl = `${siteOrigin}/qr/${slugify(draft.slug || draft.name)}`;

  async function copyToClipboard(value: string, label: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setNotice(`Copie indisponible pour ${label}.`);
      return;
    }

    await navigator.clipboard.writeText(value);
    setNotice(`${label} copié.`);
  }

  const todayKey = formatTodayKey();
  const isFoodTheme = theme === "food";
  const bookingModuleEnabled = draft.features.bookingEnabled;
  const kitchenModuleEnabled = draft.features.kitchenWorkflowEnabled;
  const orderModuleEnabled = draft.features.orderFlowEnabled;
  const reviewsModuleEnabled = draft.features.googleReviewsEnabled;
  const notificationsModuleEnabled =
    draft.features.smsAlertsEnabled ||
    draft.features.whatsappAlertsEnabled ||
    draft.features.notificationProvider === "twilio";

  const alertSummary = useMemo(() => {
    const pendingReservations = reservations.filter((reservation) => reservation.status === "pending").length;
    const activeOrders = orders.filter((order) => !["paid", "cancelled", "archived"].includes(order.status)).length;
    const readyOrders = orders.filter((order) => order.status === "ready").length;
    const messagesCount = messages.filter((message) => !message.deletedAt).length;

    return { pendingReservations, activeOrders, readyOrders, messagesCount };
  }, [messages, orders, reservations]);

  const topProducts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        if (item.deletedAt) continue;
        const current = counts.get(item.menuItemId);
        counts.set(item.menuItemId, {
          name: item.nameSnapshot || "Produit",
          count: (current?.count ?? 0) + item.quantity,
        });
      }
    }

    return [...counts.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [orders]);

  const upcomingReservations = useMemo(() => {
    return reservations
      .filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "no_show")
      .sort((left, right) => {
        const dateDelta = left.date.localeCompare(right.date);
        if (dateDelta !== 0) return dateDelta;
        return left.time.localeCompare(right.time);
      })
      .slice(0, 4);
  }, [reservations]);

  const reservationStats = useMemo(() => {
    const pending = reservations.filter((reservation) => reservation.status === "pending").length;
    const confirmed = reservations.filter((reservation) => reservation.status === "confirmed").length;
    const cancelled = reservations.filter((reservation) => reservation.status === "cancelled").length;
    const noShow = reservations.filter((reservation) => reservation.status === "no_show").length;
    const today = reservations.filter((reservation) => reservation.date === todayKey).length;

    return { pending, confirmed, cancelled, noShow, today };
  }, [reservations, todayKey]);

  const reservationAgendaDays = useMemo(() => {
    if (!currentRestaurant) return [];
    return getAvailableDays(currentRestaurant, reservations, {
      locale: "fr",
      startDate: new Date(),
      dayCount: 14,
    });
  }, [currentRestaurant, reservations]);

  const reservationAgendaMap = useMemo(
    () => new Map(reservationAgendaDays.map((day) => [day.date, day] as const)),
    [reservationAgendaDays],
  );

  const reservationWizardSelectedCountry = useMemo(
    () =>
      reservationPhoneCountries.find((entry) => entry.code === reservationWizardPhoneCountry) ??
      reservationPhoneCountries[0],
    [reservationWizardPhoneCountry],
  );

  const reservationWizardVisibleCountries = useMemo(() => {
    const query = reservationWizardCountryQuery.trim().toLowerCase();
    if (!query) return reservationPhoneCountries;
    return reservationPhoneCountries.filter((entry) => {
      return (
        entry.label.toLowerCase().includes(query) ||
        entry.code.toLowerCase().includes(query) ||
        entry.dialCode.toLowerCase().includes(query)
      );
    });
  }, [reservationWizardCountryQuery]);

  const reservationWizardCalendarDays = useMemo(
    () => buildCalendarGrid(reservationWizardMonth),
    [reservationWizardMonth],
  );

  const reservationWizardSelectedDay = useMemo(
    () => reservationAgendaMap.get(reservationWizardDate) ?? null,
    [reservationAgendaMap, reservationWizardDate],
  );

  const reservationWizardTablesNeeded = useMemo(
    () => countTablesNeeded(Math.max(1, Number(reservationWizardForm.guestCount) || 1), draft.seatsPerTable),
    [draft.seatsPerTable, reservationWizardForm.guestCount],
  );

  const reservationWizardAvailableSlots = useMemo(
    () =>
      reservationWizardSelectedDay?.slots.filter((slot) => slot.availableTables >= reservationWizardTablesNeeded) ?? [],
    [reservationWizardSelectedDay, reservationWizardTablesNeeded],
  );

  const reservationWizardSelectedDateLabel =
    reservationWizardSelectedDay?.label ??
    (reservationWizardDate
      ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(
          new Date(`${reservationWizardDate}T12:00:00`),
        )
      : "Choisir une date");

  useEffect(() => {
    if (!reservationWizardOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [reservationWizardOpen]);

  const managerSections = useMemo(
    () =>
      [
        { key: "dashboard", label: "Pilotage" },
        { key: "menu", label: "Menu" },
        bookingModuleEnabled ? { key: "reservations", label: "Reserv." } : null,
        { key: "settings", label: "Régl." },
      ].filter(Boolean) as { key: ManagerSection; label: string }[],
    [bookingModuleEnabled],
  );

  const showMenuPanel = managerSection === "menu";
  const openingDayEditor = openingDayEditorIndex === null ? null : draft.weeklyHours[openingDayEditorIndex] ?? null;

  const visibleReservations = useMemo(() => {
    const sortedByDate = [...reservations].sort((left, right) => {
      const leftStamp = new Date(`${left.date}T${left.time.length === 5 ? `${left.time}:00` : left.time}`).getTime();
      const rightStamp = new Date(`${right.date}T${right.time.length === 5 ? `${right.time}:00` : right.time}`).getTime();

      if (Number.isFinite(leftStamp) && Number.isFinite(rightStamp) && leftStamp !== rightStamp) {
        return leftStamp - rightStamp;
      }

      const dateDelta = left.date.localeCompare(right.date);
      if (dateDelta !== 0) return dateDelta;

      const timeDelta = left.time.localeCompare(right.time);
      if (timeDelta !== 0) return timeDelta;

      return statusRank(left.status) - statusRank(right.status);
    });

    if (reservationFilter === "all") {
      return sortedByDate;
    }

    if (reservationFilter === "today") {
      return sortedByDate.filter((reservation) => reservation.date === todayKey);
    }

    return sortedByDate.filter((reservation) => reservation.status === reservationFilter);
  }, [reservations, reservationFilter, todayKey]);

  const filteredReservations = useMemo(() => {
    const byStatus = visibleReservations;
    if (!reservationAgendaFocus || reservationFilter === "all") {
      return byStatus;
    }

    return byStatus.filter((reservation) => reservation.date === reservationAgendaFocus);
  }, [reservationAgendaFocus, reservationFilter, visibleReservations]);

  const editingDishItem =
    dishEditor ? draft.categories[dishEditor.categoryIndex]?.items[dishEditor.itemIndex] ?? null : null;
  const editingCategory = categoryEditor !== null ? draft.categories[categoryEditor] ?? null : null;
  const editingCategoryIndex = categoryEditor !== null ? categoryEditor : 0;
  const managerOpenStatus = getManagerOpenStatus(draft);
  const managerLogo = draft.logoUrl || (slugify(draft.slug || draft.name) === "bar-1" ? "/logoNoirBar.png" : "/logoFood.png");

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

  async function loadOrders(slug: string) {
    if (!slug) return;
    setLoadingOrders(true);
    const response = await fetch(`/api/restaurants/${slug}/orders`, { cache: "no-store" });

    if (response.ok) {
      const payload = (await response.json()) as { orders: Order[] };
      setOrders(payload.orders);
    }

    setLoadingOrders(false);
  }

  async function loadMessages(slug: string) {
    if (!slug) return;
    setLoadingMessages(true);
    const response = await fetch(`/api/restaurants/${slug}/messages`, { cache: "no-store" });

    if (response.ok) {
      const payload = (await response.json()) as { messages: RestaurantMessage[] };
      setMessages(payload.messages);
    }

    setLoadingMessages(false);
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

  const refreshActiveRestaurant = useCallback(() => {
    if (!activeSlug) return;
    void loadReservations(activeSlug);
    void loadOrders(activeSlug);
    void loadMessages(activeSlug);
    void loadUsers(activeSlug);
    void loadAudit(activeSlug);
  }, [activeSlug]);

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
      refreshActiveRestaurant();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshActiveRestaurant]);

  useEffect(() => {
    if (managerSection === "reservations" && !bookingModuleEnabled) {
      setManagerSection("dashboard");
    }
  }, [bookingModuleEnabled, managerSection]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }, [managerSection]);

  useRestaurantRealtime({
    restaurantSlug: activeSlug,
    enabled: Boolean(activeSlug),
    onEvent: () => {
      refreshActiveRestaurant();
    },
  });

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

  function resetReservationWizard(dateKey?: string) {
    const defaultDate =
      dateKey ??
      reservationAgendaDays.find((day) => day.slots.some((slot) => slot.availableTables >= 1))?.date ??
      formatDateKey(new Date());
    const defaultMonth = new Date(`${defaultDate}T12:00:00`);
    setReservationWizardOpen(false);
    setReservationWizardStep(1);
    setReservationWizardMonth(startOfMonth(defaultMonth));
    setReservationWizardDate(defaultDate);
    setReservationWizardTime("");
    setReservationWizardCountryOpen(false);
    setReservationWizardCountryQuery("");
    setReservationWizardPhoneCountry("FR");
    setReservationWizardSubmitting(false);
    setReservationWizardForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      guestCount: 2,
      note: "",
    });
  }

  function openReservationWizard() {
    const defaultDay =
      reservationAgendaDays.find((day) => day.slots.some((slot) => slot.availableTables >= 1))?.date ??
      formatDateKey(new Date());
    const defaultMonth = new Date(`${defaultDay}T12:00:00`);
    setReservationWizardOpen(true);
    setReservationWizardStep(1);
    setReservationWizardMonth(startOfMonth(defaultMonth));
    setReservationWizardDate(defaultDay);
    setReservationWizardTime("");
    setReservationWizardCountryOpen(false);
    setReservationWizardCountryQuery("");
    setReservationAgendaFocus(defaultDay);
    setReservationWizardPhoneCountry("FR");
    setReservationWizardForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      guestCount: 2,
      note: "",
    });
  }

  function selectReservationDate(dateKey: string) {
    setReservationWizardDate(dateKey);
    setReservationWizardTime("");
    setReservationWizardStep(3);
  }

  function selectReservationTime(time: string) {
    setReservationWizardTime(time);
    setReservationWizardStep(4);
  }

  function buildReservationPhoneValue() {
    const national = normalizePhoneNumber(reservationWizardForm.phone);
    if (!national) return "";
    const normalizedNational = national.startsWith("0") ? national.slice(1) : national;
    return `${reservationWizardSelectedCountry?.dialCode ?? "+33"}${normalizedNational}`;
  }

  async function submitReservationWizard() {
    if (!activeSlug || !currentRestaurant) return;

    const trimmedFirstName = reservationWizardForm.firstName.trim();
    const trimmedLastName = reservationWizardForm.lastName.trim();
    const phoneValue = buildReservationPhoneValue();

    if (!trimmedFirstName || !trimmedLastName || !phoneValue || !reservationWizardDate || !reservationWizardTime) {
      setNotice("Complète les coordonnées, la date et l’heure.");
      return;
    }

    setReservationWizardSubmitting(true);
    const response = await fetch(`/api/restaurants/${activeSlug}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale: "fr",
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: phoneValue,
        email: reservationWizardForm.email.trim(),
        note: reservationWizardForm.note.trim(),
        date: reservationWizardDate,
        time: reservationWizardTime,
        guestCount: Number(reservationWizardForm.guestCount) || 2,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setReservationWizardSubmitting(false);
      setNotice(payload?.error === "selected_slot_unavailable" ? "Créneau indisponible." : "Impossible de créer la réservation.");
      return;
    }

    const payload = (await response.json()) as { reservation?: Reservation };
    const createdDate = payload.reservation?.date ?? reservationWizardDate;
    setReservationFilter("all");
    setReservationAgendaFocus(createdDate);
    await loadReservations(activeSlug);
    setNotice("Réservation créée.");
    setReservationWizardSubmitting(false);
    setReservationWizardOpen(false);
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
      <div className="internal-dark rounded-[2rem] border border-white/10 bg-[#171717]/95 p-8 text-sm text-[#f5f1ea]/80 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
        Chargement du tableau de bord...
      </div>
    );
  }

  return (
    <div className={theme === "food" ? "food-theme mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-2 pb-28 sm:px-4 lg:px-6 xl:grid-cols-[280px_minmax(0,1fr)]" : "internal-dark mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-2 pb-28 sm:px-4 lg:px-6 xl:grid-cols-[280px_minmax(0,1fr)]"}>
      <aside className={isFoodTheme ? "space-y-4 overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-4 shadow-[0_20px_60px_rgba(124,77,44,0.08)] backdrop-blur" : "space-y-4 overflow-hidden rounded-[2rem] border border-white/10 bg-[#171717]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur"}>
        <div className="space-y-2">
          <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
            Restaurants
          </p>
          <div className="flex items-center gap-3">
            <img
              src={managerLogo}
              alt={draft.name}
              className="h-12 w-12 rounded-2xl object-cover ring-1 ring-black/5"
            />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{draft.name}</h2>
              <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-white/55"}>
                Manager dashboard
              </p>
            </div>
          </div>
        </div>

        {allowRestaurantCreate ? (
          <button
            type="button"
            onClick={startNewRestaurant}
            className={isFoodTheme ? "w-full rounded-2xl border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f] transition hover:brightness-[0.99]" : "w-full rounded-2xl border border-white/10 bg-[#0b0b0b] px-4 py-3 text-sm font-medium text-[#f5f1ea] transition hover:opacity-90"}
          >
            Nouveau restaurant
          </button>
        ) : null}

        <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 overflow-x-auto pb-1 xl:grid-flow-row xl:auto-cols-auto xl:overflow-visible xl:pb-0">
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
                className={`w-full min-w-0 rounded-[1.5rem] border p-4 text-left transition ${
                  selected
                    ? isFoodTheme
                      ? "border-[#d9c9b7] bg-white text-[#24170f] shadow-[0_12px_35px_rgba(124,77,44,0.08)]"
                      : "border-transparent text-white shadow-lg"
                    : isFoodTheme
                      ? "border-[#eadfce] bg-[#fffaf6] text-[#24170f] hover:bg-white"
                      : "border-white/10 bg-white/5 text-[#f5f1ea] hover:bg-white/10"
                }`}
                style={
                  selected && !isFoodTheme
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

        <div className={isFoodTheme ? "rounded-[1.5rem] border border-[#eadfce] bg-white p-4 text-sm text-[#6f5b4a]" : "rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-[#f5f1ea]/70"}>
          <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.3em] text-[#f5f1ea]/40"}>État</p>
          <p className="mt-2">{notice ?? "Prêt à éditer."}</p>
        </div>
      </aside>

      <div className="space-y-6">
        <section className={isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-4 shadow-[0_20px_60px_rgba(124,77,44,0.06)] sm:p-5" : "rounded-[2rem] border border-white/10 bg-[#171717]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5"}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={managerLogo}
                alt={draft.name}
                className="h-11 w-11 rounded-2xl object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0">
                <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
                  Manager
                </p>
                <h1 className="truncate font-display text-3xl leading-none sm:text-5xl">{draft.name}</h1>
              </div>
            </div>
            <span className={`hidden rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] sm:inline-flex ${managerOpenStatus.className}`}>
              {managerOpenStatus.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <p className={isFoodTheme ? "max-w-3xl text-sm leading-6 text-[#6f5b4a]" : "max-w-3xl text-sm leading-6 text-black/65"}>
              {managerSection === "dashboard"
                ? "Pilotage clair du restaurant en moins de 30 secondes."
                : managerSection === "menu"
                  ? "Catégories d'abord, plats ensuite, édition en modal quand nécessaire."
                  : managerSection === "reservations"
                    ? "Réservations uniquement, avec filtres et actions rapides."
                    : "Réglages restaurant regroupés sans surcharge visuelle."}
            </p>
            {managerSection === "dashboard" ? (
              <div className="flex flex-wrap gap-3 sm:justify-end">
                <Link href={`/r/${slugify(draft.slug || draft.name)}`} className={isFoodTheme ? "rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-2 text-sm font-medium text-[#1f2b1f]" : "rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"}>Voir menu public</Link>
                <Link href={`/qr/${slugify(draft.slug || draft.name)}`} className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]" : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"}>Voir QR code</Link>
                <Link href={`/staff?restaurantSlug=${encodeURIComponent(slugify(draft.slug || draft.name))}`} className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]" : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"}>Ouvrir l'équipe</Link>
                {kitchenModuleEnabled ? <Link href={`/kitchen?restaurantSlug=${encodeURIComponent(slugify(draft.slug || draft.name))}`} className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]" : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"}>Ouvrir la cuisine</Link> : null}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]" : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5f1ea]"}>
                  {notificationsModuleEnabled ? "Notifications activées" : "Notifications désactivées"}
                </span>
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#6f5b4a]" : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#f5f1ea]/70"}>
                  {notificationsModuleEnabled ? "Notifications browser actives" : "Notifications browser inactives"}
                </span>
              </div>
            )}
          </div>
        </section>

        <nav className={isFoodTheme ? "fixed bottom-3 left-1/2 z-30 w-[min(100%-1rem,52rem)] -translate-x-1/2 rounded-[1.75rem] border border-[#eadfce] bg-[#fffdf8]/96 p-2 shadow-[0_16px_40px_rgba(124,77,44,0.12)] backdrop-blur" : "fixed bottom-3 left-1/2 z-30 w-[min(100%-1rem,52rem)] -translate-x-1/2 rounded-[1.75rem] border border-white/10 bg-[#111111]/90 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur"}>
          <div className="grid grid-cols-4 gap-1.5">
            {managerSections.map((item) => {
              const icon =
                item.key === "dashboard"
                  ? "📊"
                  : item.key === "menu"
                    ? "📋"
                    : item.key === "reservations"
                      ? "📅"
                      : "⚙️";

              return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setManagerSection(item.key);
                  if (item.key === "settings") {
                    setSettingsPanel("general");
                  }
                }}
                className={managerSection === item.key ? isFoodTheme ? "flex h-full flex-col items-center justify-center gap-1 rounded-[1.35rem] border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-2.5 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-[#1f2b1f] sm:text-xs" : "flex h-full flex-col items-center justify-center gap-1 rounded-[1.35rem] border border-white bg-white px-2.5 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-black sm:text-xs" : isFoodTheme ? "flex h-full flex-col items-center justify-center gap-1 rounded-[1.35rem] border border-[#eadfce] bg-white px-2.5 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-[#24170f] transition hover:bg-[#faf7f2] sm:text-xs" : "flex h-full flex-col items-center justify-center gap-1 rounded-[1.35rem] border border-white/10 bg-white/5 px-2.5 py-2.5 text-[10px] font-semibold tracking-[0.12em] text-[#f5f1ea] transition hover:bg-white/10 sm:text-xs"}
              >
                <span className="text-sm leading-none sm:text-base">{icon}</span>
                <span className="text-center leading-none">{item.label}</span>
              </button>
              );
            })}
          </div>
        </nav>

        <div className={`${managerSection === "reservations" ? "" : "hidden "}mx-auto w-full max-w-4xl rounded-[2rem] border border-black/8 bg-white/85 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-4`}>
          <div className="flex flex-col gap-4 border-b border-black/8 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Réservations
              </p>
              <h3 className="mt-2 text-2xl font-semibold">Boîte de réservation</h3>
              <p className="mt-2 text-sm text-black/55">
                Filtre, confirme et contacte les clients sans quitter l’écran.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <button
                type="button"
                onClick={openReservationWizard}
                className={isFoodTheme ? "inline-flex items-center justify-center rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)]" : "inline-flex items-center justify-center rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white"}
              >
                + Réservation
              </button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <span className="rounded-[1.1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                  {reservationStats.pending} en attente
                </span>
                <span className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700">
                  {reservationStats.confirmed} confirmées
                </span>
                <span className="rounded-[1.1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700">
                  {reservationStats.cancelled} annulées
                </span>
                <span className="rounded-[1.1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700">
                  {reservationStats.noShow} no show
                </span>
                <span className="rounded-[1.1rem] border border-black/10 bg-white px-3 py-2 text-center text-xs font-medium text-black/60">
                  {loadingReservations ? "Chargement..." : `${reservations.length}`}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-[1.6rem] border border-[#eadfce] bg-[#fffdf8] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Agenda</p>
                <h4 className="mt-1 text-lg font-semibold text-[#24170f]">Réservations par jour</h4>
              </div>
              <button
                type="button"
                onClick={() => setReservationAgendaFocus(null)}
                className="w-fit rounded-full border border-[#eadfce] bg-white px-4 py-2 text-xs font-medium text-[#24170f]"
              >
                Tous les jours
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {reservationAgendaDays.slice(0, 7).map((day) => {
                const dayReservations = reservations.filter((reservation) => reservation.date === day.date);
                const isSelected = reservationAgendaFocus === day.date;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setReservationAgendaFocus(day.date)}
                    className={`rounded-[1.25rem] border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                        : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.22em] opacity-70">{formatShortWeekday(new Date(`${day.date}T12:00:00`))}</p>
                    <p className="mt-1 text-sm font-semibold">{formatDayNumber(new Date(`${day.date}T12:00:00`))}</p>
                    <p className="mt-2 text-xs opacity-80">
                      {dayReservations.length} réservations
                    </p>
                    <p className="text-xs opacity-70">
                      {day.slots.some((slot) => slot.availableTables > 0)
                        ? `${day.slots.filter((slot) => slot.availableTables > 0).length} créneaux`
                        : "Complet"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 pb-1 pr-1">
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
                onClick={() => setReservationFilter(filter.key as typeof reservationFilter)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition ${
                  reservationFilter === filter.key
                    ? isFoodTheme
                      ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                      : "border-black bg-black text-white"
                    : isFoodTheme
                      ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                      : "border-black/10 bg-white text-black hover:bg-black/3"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {filteredReservations.length === 0 ? (
              <p className="text-sm text-black/55">Aucune réservation pour le moment.</p>
            ) : (
              filteredReservations.map((reservation) => {
                const mailSubject = encodeURIComponent(`Confirmation réservation - ${currentRestaurant?.name ?? draft.name}`);
                const mailBody = encodeURIComponent(buildConfirmationMessage(reservation, currentRestaurant?.name ?? draft.name));
                return (
                  <article
                    key={reservation.id}
                    className="rounded-[1.6rem] border border-[#eadfce] bg-white px-4 py-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-1 text-xs font-medium text-[#24170f]">{reservation.time}</span>
                          <span className="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-xs font-medium text-[#6f5b4a]">{formatReservationDateShort(reservation.date)}</span>
                          <span className="rounded-full border border-[#eadfce] bg-white px-3 py-1 text-xs font-medium text-[#6f5b4a]">{reservation.guestCount} personnes</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusMeta(reservation.status).className}`}>{statusMeta(reservation.status).label}</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-[#24170f]">{reservation.firstName} {reservation.lastName}</h4>
                          <p className="text-sm text-[#6f5b4a]">{reservation.phone}{reservation.email ? ` · ${reservation.email}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => changeReservationStatus(reservation.id, "confirmed")} className="rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-3 py-2 text-xs font-medium text-[#1f2b1f]">Confirmer</button>
                        <button type="button" onClick={() => changeReservationStatus(reservation.id, "cancelled")} className="rounded-full border border-[#f3c7ce] bg-[#fff1f3] px-3 py-2 text-xs font-medium text-[#9d2c41]">Annuler</button>
                        <button type="button" onClick={() => changeReservationStatus(reservation.id, "no_show")} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">No show</button>
                        <a href={`mailto:${reservation.email ?? ""}?subject=${mailSubject}&body=${mailBody}`} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black">Message</a>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {managerSection === "dashboard" ? (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="min-h-[132px] rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-700">Commandes en cours</p>
            <p className="mt-1 text-2xl font-semibold">
              {loadingOrders ? "…" : alertSummary.activeOrders}
            </p>
            <p className="text-sm text-amber-800/80">À suivre maintenant.</p>
          </div>
          <div className="min-h-[132px] rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <p className="text-[11px] uppercase tracking-[0.32em] text-rose-700">Prêtes</p>
            <p className="mt-1 text-2xl font-semibold">{loadingOrders ? "…" : alertSummary.readyOrders}</p>
            <p className="text-sm text-rose-800/80">À servir maintenant.</p>
          </div>
          <div className="min-h-[132px] rounded-[1.5rem] border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
            <p className="text-[11px] uppercase tracking-[0.32em] text-indigo-700">Réservations aujourd&apos;hui</p>
            <p className="mt-1 text-2xl font-semibold">{loadingReservations ? "…" : reservationStats.today}</p>
            <p className="text-sm text-indigo-800/80">Service à organiser.</p>
          </div>
          <div className="min-h-[132px] rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-slate-950">
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-700">Appels serveur</p>
            <p className="mt-1 text-2xl font-semibold">{loadingMessages ? "…" : alertSummary.messagesCount}</p>
            <p className="text-sm text-slate-800/80">Messages et urgences.</p>
          </div>
        </section>
        ) : null}

        {managerSection === "dashboard" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className={isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-white/90 p-5 shadow-[0_20px_60px_rgba(124,77,44,0.05)]" : "rounded-[2rem] border border-white/10 bg-[#171717]/90 p-5"}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
                    Top 5 produits
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Produits qui tournent</h3>
                </div>
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-3 py-1 text-xs font-medium text-[#6f5b4a]" : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#f5f1ea]/70"}>
                  {topProducts.length}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {topProducts.length === 0 ? (
                  <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-[#f5f1ea]/70"}>Aucune vente récente.</p>
                ) : (
                  topProducts.map((product, index) => (
                    <article
                      key={`${product.name}-${index}`}
                      className={isFoodTheme ? "flex items-center justify-between gap-3 rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3" : "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"}
                    >
                      <div>
                        <p className="text-sm font-semibold">{product.name}</p>
                        <p className={isFoodTheme ? "text-xs text-[#6f5b4a]" : "text-xs text-[#f5f1ea]/60"}>
                          Commandes cumulées
                        </p>
                      </div>
                      <p className="text-lg font-semibold">{product.count}</p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className={isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-white/90 p-5 shadow-[0_20px_60px_rgba(124,77,44,0.05)]" : "rounded-[2rem] border border-white/10 bg-[#171717]/90 p-5"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
                    Réservations prochaines
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">À venir</h3>
                </div>
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-3 py-1 text-xs font-medium text-[#6f5b4a]" : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#f5f1ea]/70"}>
                  {upcomingReservations.length}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {upcomingReservations.length === 0 ? (
                  <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-[#f5f1ea]/70"}>Aucune réservation à venir.</p>
                ) : (
                  upcomingReservations.map((reservation) => (
                    <article
                      key={reservation.id}
                      className={isFoodTheme ? "rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3" : "rounded-2xl border border-white/10 bg-white/5 px-4 py-3"}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {reservation.time} — {reservation.firstName} {reservation.lastName}
                          </p>
                          <p className={isFoodTheme ? "text-xs text-[#6f5b4a]" : "text-xs text-[#f5f1ea]/60"}>
                            {reservation.guestCount} personnes · {formatReservationDateShort(reservation.date)}
                          </p>
                        </div>
                        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black">
                          {reservation.status}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section
          id="dashboard-menu"
          className={`${managerSection === "menu" ? "" : "hidden "}scroll-mt-28 rounded-[2rem] border ${isFoodTheme ? "border-[#eadfce] bg-white/85" : "border-white/10 bg-[#171717]/95"} p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur sm:p-8`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
                {showMenuPanel ? "Menu" : "Restaurant"}
              </p>
              <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                {showMenuPanel ? `${draft.categories.length} catégories · ${draft.categories.reduce((count, category) => count + category.items.length, 0)} plats` : draft.name}
              </h2>
                    <p className={isFoodTheme ? "max-w-3xl text-sm leading-6 text-[#6f5b4a]" : "max-w-3xl text-sm leading-6 text-black/65"}>
                    {showMenuPanel
                  ? "Liste d’abord les catégories, puis ouvre uniquement celle que tu veux éditer."
                  : "Branding, liens, QR, horaires et informations générales du restaurant."}
                  </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/r/${slugify(draft.slug || draft.name)}`}
                className={isFoodTheme ? "rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-2 text-sm font-medium text-[#1f2b1f]" : "rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"}
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

          <div className="mt-5 space-y-5">
            <div className="rounded-[2rem] border border-[#eadfce] bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex flex-col gap-4 border-b border-[#eadfce] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Catégories</p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">Catégories d’abord</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">
                    Clique une catégorie pour l’éditer dans une modal. Utilise <strong>+ Produit</strong> pour ajouter vite.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={addCategory}
                    className="rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-medium text-[#24170f]"
                  >
                    + Catégorie
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className={isFoodTheme ? "rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-5 py-3 text-sm font-medium text-[#1f2b1f] disabled:opacity-60" : "rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-60"}
                  >
                    {saving ? "Enregistrement..." : "Enregistrer le menu"}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
                {draft.categories.map((category, categoryIndex) => (
                  <article
                    key={category.id}
                    className="rounded-[1.75rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(124,77,44,0.09)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setCategoryEditor(categoryIndex)}
                        className="block min-w-0 flex-1 text-left"
                      >
                        <h4 className="mt-2 truncate text-xl font-semibold text-[#24170f]">
                          {category.name || "Catégorie"}
                        </h4>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6f5b4a]">
                          {category.description || "Description à compléter"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextItemIndex = category.items.length;
                          addItem(categoryIndex);
                          setDishEditor({ categoryIndex, itemIndex: nextItemIndex });
                        }}
                        className="shrink-0 rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-3 py-2 text-xs font-medium text-[#1f2b1f]"
                      >
                        + Produit
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-[#6f5b4a]">
                      <span className="rounded-full border border-[#eadfce] bg-white px-3 py-2">
                        {category.items.length} plat{category.items.length > 1 ? "s" : ""}
                      </span>
                      <span className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-2 text-[#24170f]">
                        Ouvre la catégorie pour l’éditer
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`${managerSection === "settings" ? "" : "hidden "}space-y-6`}>
          <div className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "general", label: "Général" },
                { key: "opening", label: "Ouverture" },
                { key: "staff", label: "Équipe" },
                { key: "links", label: "Liens" },
                { key: "audit", label: "Audit" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSettingsPanel(item.key as SettingsPanel)}
                  className={settingsPanel === item.key ? isFoodTheme ? "rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[#1f2b1f]" : "rounded-full border border-white bg-white px-4 py-2 text-xs font-semibold tracking-[0.18em] text-black" : isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[#24170f]" : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[#f5f1ea]"}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {settingsPanel === "general" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4 rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] sm:p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Général</p>
                  <h3 className="mt-1 text-xl font-semibold text-[#24170f]">Identité du restaurant</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Nom, slug, slogan et contact principal.</p>
                </div>
                <div className="grid gap-4">
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
                  <Field label="Téléphone">
                    <input
                      value={draft.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-4 rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] sm:p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Profil public</p>
                  <h3 className="mt-1 text-xl font-semibold text-[#24170f]">Adresse et description</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Tout ce qui s’affiche côté client.</p>
                </div>
                <div className="grid gap-4">
                  <Field label="Adresse">
                    <input
                      value={draft.address}
                      onChange={(event) => updateField("address", event.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    />
                  </Field>
                  <Field label="Description du restaurant">
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateField("description", event.target.value)}
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-4 rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] sm:p-5 lg:col-span-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Branding</p>
                  <h3 className="mt-1 text-xl font-semibold text-[#24170f]">Image et identité visuelle</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Couleur, logo, image principale et monnaie.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Image principale">
                    <input
                      value={draft.heroImage}
                      onChange={(event) => updateField("heroImage", event.target.value)}
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
                  <Field label="Monnaie">
                    <input
                      value={draft.currency}
                      readOnly
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    />
                  </Field>
                </div>
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
              </section>
            </div>
          ) : null}

          {settingsPanel === "opening" ? (
            <section className="space-y-4 rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] sm:p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Ouverture</p>
                <h3 className="mt-1 text-xl font-semibold text-[#24170f]">Jours de la semaine</h3>
                <p className="mt-2 text-sm text-[#6f5b4a]">Clique un jour pour l’éditer dans une modal dédiée.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {draft.weeklyHours.map((day, index) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setOpeningDayEditorIndex(index)}
                    className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 text-left shadow-[0_14px_35px_rgba(124,77,44,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(124,77,44,0.08)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">{weeklyDayLabels[day.day]}</p>
                    <p className="mt-3 text-base font-semibold text-[#24170f]">{day.closed ? "Fermé" : "Ouvert"}</p>
                    <p className="mt-2 text-sm text-[#6f5b4a]">{formatOpeningDaySummary(day)}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {settingsPanel === "staff" ? (
            <section id="dashboard-team" className="scroll-mt-28 rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Équipe</p>
                  <h3 className="mt-2 text-2xl font-semibold">Utilisateurs staff</h3>
                </div>
                <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">
                  {loadingUsers ? "Chargement..." : `${users.length}`}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <Field label="Identifiant">
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
                      setNewStaffUser((current) => ({ ...current, temporaryPassword: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25"
                    placeholder="Tmp#1234!"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={createStaffUser}
                className={isFoodTheme ? "mt-4 rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-3 text-sm font-medium text-[#1f2b1f]" : "mt-4 rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white"}
              >
                Créer un membre
              </button>

              <div className="mt-5 space-y-3">
                {users.length === 0 ? (
                  <p className="text-sm text-black/55">Aucun utilisateur staff.</p>
                ) : (
                  users.map((user) => (
                    <article key={user.id} className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{user.name}</p>
                          <p className="text-xs text-black/55">@{user.username}</p>
                          <p className="text-xs text-black/55">
                            {user.mustChangePassword ? "Mot de passe temporaire" : "Mot de passe fixé"}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                          user.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}>
                          {user.status === "active" ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => toggleStaffStatus(user)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black">
                          {user.status === "active" ? "Désactiver" : "Activer"}
                        </button>
                        <button type="button" onClick={() => resetStaffPassword(user)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black">
                          Réinitialiser le mot de passe
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {settingsPanel === "links" ? (
            <section className="space-y-4 rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_16px_40px_rgba(124,77,44,0.06)] sm:p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Liens</p>
                <h3 className="mt-1 text-xl font-semibold text-[#24170f]">URLs publiques et canaux</h3>
                <p className="mt-2 text-sm text-[#6f5b4a]">Liens complets, QR, canaux externes et modules.</p>
              </div>
              <div className="grid gap-4">
                <Field label="Lien Uber Eats">
                  <input value={draft.uberEatsUrl} onChange={(event) => updateField("uberEatsUrl", event.target.value)} placeholder="https://www.ubereats.com/..." className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25" />
                </Field>
                <Field label="Lien TripAdvisor">
                  <input value={draft.tripAdvisorUrl} onChange={(event) => updateField("tripAdvisorUrl", event.target.value)} placeholder="https://www.tripadvisor.com/..." className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25" />
                </Field>
                {siteOrigin ? (
                  <div className="grid gap-3 rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-black/40">Liens directs</p>
                      <h4 className="mt-1 text-base font-semibold text-[#24170f]">Menu public et QR</h4>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-[0.25em] text-black/40">Menu public</span>
                          <button type="button" onClick={() => copyToClipboard(publicMenuUrl, "Lien du menu")} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black/70">Copier</button>
                        </div>
                        <a href={publicMenuUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-[#24170f] underline decoration-black/20 underline-offset-4">{publicMenuUrl}</a>
                      </div>
                      <div className="grid gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-[0.25em] text-black/40">QR code</span>
                          <button type="button" onClick={() => copyToClipboard(publicQrUrl, "Lien du QR")} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black/70">Copier</button>
                        </div>
                        <a href={publicQrUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-[#24170f] underline decoration-black/20 underline-offset-4">{publicQrUrl}</a>
                      </div>
                    </div>
                  </div>
                ) : null}
                <Field label="Monnaie">
                  <input value={draft.currency} readOnly className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25" />
                </Field>
                {orderModuleEnabled ? (
                  <>
                    <Field label="Nombre de tables">
                      <input type="number" min={1} value={draft.tableCount} onChange={(event) => updateField("tableCount", Number(event.target.value) as Restaurant["tableCount"])} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25" />
                    </Field>
                    <Field label="Places par table">
                      <input type="number" min={1} value={draft.seatsPerTable} onChange={(event) => updateField("seatsPerTable", Number(event.target.value) as Restaurant["seatsPerTable"])} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none ring-0 transition focus:border-black/25" />
                    </Field>
                  </>
                ) : null}
                <Field label="Options commerciales">
                  <div className="grid gap-3 rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                    {bookingModuleEnabled ? (
                      <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                        <span>Réservation en ligne</span>
                        <input type="checkbox" checked={draft.features.bookingEnabled} onChange={(event) => updateFeatureField("bookingEnabled", event.target.checked)} />
                      </label>
                    ) : null}
                    <label className="grid gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                      <span>QR code destination</span>
                      <select value={draft.features.qrMode} onChange={(event) => updateFeatureField("qrMode", event.target.value as Restaurant["features"]["qrMode"])} className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none">
                        <option value="pdf">PDF A3</option>
                        <option value="menu">Menu web</option>
                        <option value="off">Désactivé</option>
                      </select>
                    </label>
                    {notificationsModuleEnabled ? (
                      <>
                        <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                          <span>Alertes WhatsApp</span>
                          <input type="checkbox" checked={draft.features.whatsappAlertsEnabled} onChange={(event) => updateFeatureField("whatsappAlertsEnabled", event.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                          <span>Alertes SMS</span>
                          <input type="checkbox" checked={draft.features.smsAlertsEnabled} onChange={(event) => updateFeatureField("smsAlertsEnabled", event.target.checked)} />
                        </label>
                      </>
                    ) : null}
                    {reviewsModuleEnabled ? (
                      <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm">
                        <span>Avis Google visibles</span>
                        <input type="checkbox" checked={draft.features.googleReviewsEnabled} onChange={(event) => updateFeatureField("googleReviewsEnabled", event.target.checked)} />
                      </label>
                    ) : null}
                  </div>
                </Field>
              </div>
            </section>
          ) : null}

          {settingsPanel === "audit" ? (
            <section id="dashboard-audit-history" className="scroll-mt-28 rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
              <button type="button" onClick={() => setAuditOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Historique</p>
                  <h3 className="mt-2 text-2xl font-semibold">Audit manager</h3>
                </div>
                <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">{loadingAudit ? "Chargement..." : `${auditEntries.length}`}</span>
              </button>
              {auditOpen ? (
                <div className="mt-4 space-y-2">
                  {auditEntries.length === 0 ? (
                    <p className="text-sm text-black/55">Aucune action enregistrée.</p>
                  ) : (
                    auditEntries.slice(0, 12).map((entry) => {
                      const humanized = humanizeAuditEntry(entry);

                      return (
                        <article key={entry.id} className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{humanized.title}</p>
                              <p className="text-xs text-black/55">
                                {entry.actorRole} · {entry.actorName}
                              </p>
                              <p className="mt-1 text-xs text-black/55">{humanized.subtitle}</p>
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
                          {humanized.details ? <p className="mt-2 text-sm text-black/65">{humanized.details}</p> : null}
                        </article>
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
        {reservationWizardOpen ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-2 py-2 backdrop-blur-sm sm:px-4">
            <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] shadow-[0_30px_110px_rgba(15,23,42,0.22)] sm:max-h-[calc(100dvh-2rem)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#eadfce] p-4 sm:p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">+ Réservation</p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">Nouvelle réservation</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">
                    Étape {reservationWizardStep} sur 4. Utilise Next pour avancer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetReservationWizard()}
                  className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                >
                  Fermer
                </button>
              </div>

              <div className="border-b border-[#eadfce] px-4 py-3 sm:px-5">
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((stepNumber) => (
                    <button
                      key={stepNumber}
                      type="button"
                      onClick={() => setReservationWizardStep(stepNumber as ReservationWizardStep)}
                      className={`flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition ${
                        reservationWizardStep === stepNumber
                          ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                          : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                      }`}
                    >
                      {stepNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {reservationWizardStep === 1 ? (
                  <section className="space-y-4">
                    <div className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Client</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input
                          placeholder="Prénom"
                          value={reservationWizardForm.firstName}
                          onChange={(event) =>
                            setReservationWizardForm((current) => ({ ...current, firstName: event.target.value }))
                          }
                          className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                        />
                        <input
                          placeholder="Nom"
                          value={reservationWizardForm.lastName}
                          onChange={(event) =>
                            setReservationWizardForm((current) => ({ ...current, lastName: event.target.value }))
                          }
                          className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                        />
                        <div className="relative rounded-2xl border border-[#eadfce] bg-[#fffdf8] sm:col-span-2">
                          <div className="flex flex-col gap-0 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => setReservationWizardCountryOpen((current) => !current)}
                              className="flex min-w-[9rem] items-center justify-between gap-2 border-b border-[#eadfce] bg-white px-3 py-3 text-left text-sm text-[#24170f] outline-none transition hover:bg-[#faf7f2] sm:border-b-0 sm:border-r"
                            >
                              <span className="truncate">
                                {reservationWizardSelectedCountry?.code} {reservationWizardSelectedCountry?.dialCode}
                              </span>
                              <span className="text-xs text-[#a38d7c]">▾</span>
                            </button>
                            <input
                              placeholder="Téléphone"
                              value={reservationWizardForm.phone}
                              onChange={(event) =>
                                setReservationWizardForm((current) => ({ ...current, phone: event.target.value }))
                              }
                              className="min-w-0 flex-1 bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                            />
                          </div>
                          {reservationWizardCountryOpen ? (
                            <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-[1.3rem] border border-[#eadfce] bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                              <input
                                value={reservationWizardCountryQuery}
                                onChange={(event) => setReservationWizardCountryQuery(event.target.value)}
                                placeholder="Rechercher un pays ou un indicatif"
                                className="w-full rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-sm text-[#24170f] outline-none"
                              />
                              <div className="mt-3 grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                {reservationWizardVisibleCountries.map((entry) => (
                                  <button
                                    key={entry.code}
                                    type="button"
                                    onClick={() => {
                                      setReservationWizardPhoneCountry(entry.code);
                                      setReservationWizardCountryOpen(false);
                                      setReservationWizardCountryQuery("");
                                    }}
                                    className={`rounded-[1.1rem] border px-3 py-3 text-left text-sm transition ${
                                      reservationWizardPhoneCountry === entry.code
                                        ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                                        : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                                    }`}
                                  >
                                    <p className="font-medium">{entry.label}</p>
                                    <p className="text-xs opacity-70">{entry.dialCode}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <input
                          placeholder="E-mail"
                          type="email"
                          value={reservationWizardForm.email}
                          onChange={(event) =>
                            setReservationWizardForm((current) => ({ ...current, email: event.target.value }))
                          }
                          className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none sm:col-span-2"
                        />
                        <textarea
                          placeholder="Allergies, terrasse, anniversaire, service rapide..."
                          value={reservationWizardForm.note}
                          onChange={(event) =>
                            setReservationWizardForm((current) => ({ ...current, note: event.target.value }))
                          }
                          rows={4}
                          className="w-full rounded-[1.5rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none sm:col-span-2"
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Personnes</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setReservationWizardForm((current) => ({ ...current, guestCount: Math.max(1, current.guestCount - 1) }))}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]"
                        >
                          ‹
                        </button>
                        <div className="text-center">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Personnes</p>
                          <p className="mt-2 text-4xl font-semibold text-[#24170f]">{reservationWizardForm.guestCount}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReservationWizardForm((current) => ({ ...current, guestCount: current.guestCount + 1 }))}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}

                {reservationWizardStep === 2 ? (
                  <section className="space-y-4">
                    <div className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Date</p>
                          <h4 className="mt-1 text-xl font-semibold text-[#24170f]">{formatMonthLabel(reservationWizardMonth)}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReservationWizardMonth((current) => addMonths(current, -1))}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={() => setReservationWizardMonth((current) => addMonths(current, 1))}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
                        {["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."].map((label) => (
                          <div key={label} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a38d7c] sm:text-[11px]">
                            {label}
                          </div>
                        ))}
                        {reservationWizardCalendarDays.map((day) => {
                          const dayKey = formatDateKey(day);
                          const dayInfo = reservationAgendaMap.get(dayKey) ?? null;
                          const isSelected = reservationWizardDate === dayKey;
                          const isCurrent = isSameMonth(day, reservationWizardMonth);
                          const hasSlots = !!dayInfo && dayInfo.slots.some((slot) => slot.availableTables >= reservationWizardTablesNeeded);
                          return (
                            <button
                              key={dayKey}
                              type="button"
                              onClick={() => isCurrent && dayInfo ? selectReservationDate(dayKey) : undefined}
                              disabled={!isCurrent || !dayInfo}
                              className={`relative flex min-h-[4rem] flex-col overflow-hidden rounded-2xl border p-1.5 text-left transition sm:min-h-[5rem] sm:p-2 ${
                                isSelected
                                  ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_30px_rgba(118,162,104,0.14)]"
                                  : !isCurrent || !dayInfo
                                    ? "border-[#eadfce] bg-[#f7f2ea] text-[#c8b7a6]"
                                    : hasSlots
                                      ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                                      : "border-[#eadfce] bg-[#f7f2ea] text-[#b8a492]"
                              }`}
                            >
                              <span className="text-[10px] uppercase tracking-[0.16em] opacity-70 sm:text-[11px]">{formatShortWeekday(day)}</span>
                              <span className="mt-1 text-base font-semibold leading-none sm:text-xl">{formatDayNumber(day)}</span>
                              <span className="mt-auto flex items-center gap-1 text-[10px] leading-none sm:text-[11px]">
                                <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-white" : hasSlots ? "bg-emerald-500" : "bg-[#d8cabc]"}`} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ) : null}

                {reservationWizardStep === 3 ? (
                  <section className="space-y-4">
                    <div className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Heure</p>
                          <h4 className="mt-1 text-xl font-semibold text-[#24170f]">{reservationWizardTime || "Choisir une heure"}</h4>
                        </div>
                        <span className="rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-xs font-medium text-[#24170f]">
                          {reservationWizardTablesNeeded} table(s)
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[#6f5b4a]">
                        {reservationWizardAvailableSlots.length > 0
                          ? `${reservationWizardAvailableSlots.length} créneau(x) disponible(s).`
                          : "Aucun créneau disponible pour cette configuration."}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {reservationWizardAvailableSlots.length === 0 ? (
                          <p className="col-span-3 rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-4 text-sm text-[#6f5b4a]">
                            Choisis une autre date.
                          </p>
                        ) : (
                          reservationWizardAvailableSlots.map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => selectReservationTime(slot.time)}
                              className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                                reservationWizardTime === slot.time
                                  ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)]"
                                  : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                              }`}
                            >
                              <p className="text-lg font-semibold">{slot.time}</p>
                              <p className={`mt-1 text-xs ${reservationWizardTime === slot.time ? "text-[#355533]" : "text-[#6f5b4a]"}`}>
                                {slot.availableTables} table(s) libres
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {reservationWizardStep === 4 ? (
                  <section className="space-y-4">
                    <div className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Résumé</p>
                      <div className="mt-4 space-y-3 rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-4 text-sm text-[#6f5b4a]">
                        <div className="flex items-center justify-between gap-3">
                          <span>Client</span>
                          <span className="font-medium text-[#24170f]">
                            {reservationWizardForm.firstName.trim() || "—"} {reservationWizardForm.lastName.trim() || ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Date</span>
                          <span className="font-medium text-[#24170f]">{reservationWizardSelectedDateLabel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Heure</span>
                          <span className="font-medium text-[#24170f]">{reservationWizardTime || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Persons</span>
                          <span className="font-medium text-[#24170f]">{reservationWizardForm.guestCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Tables libres</span>
                          <span className="font-medium text-[#24170f]">
                            {reservationWizardSelectedDay?.slots.find((slot) => slot.time === reservationWizardTime)?.availableTables ?? "—"}
                          </span>
                        </div>
                      </div>
                      <textarea
                        value={reservationWizardForm.note}
                        onChange={(event) =>
                          setReservationWizardForm((current) => ({ ...current, note: event.target.value }))
                        }
                        placeholder="Note de réservation"
                        rows={3}
                        className="mt-4 w-full rounded-[1.25rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                      />
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="border-t border-[#eadfce] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setReservationWizardStep((current) => Math.max(1, current - 1) as ReservationWizardStep)}
                    disabled={reservationWizardStep === 1}
                    className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f] disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#a38d7c]">1 2 3 4</p>
                  {reservationWizardStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => setReservationWizardStep((current) => Math.min(4, current + 1) as ReservationWizardStep)}
                      disabled={
                        reservationWizardStep === 1
                          ? !reservationWizardForm.firstName.trim() ||
                            !reservationWizardForm.lastName.trim() ||
                            !reservationWizardForm.phone.trim()
                          : reservationWizardStep === 2
                            ? !reservationWizardDate
                            : reservationWizardStep === 3
                              ? !reservationWizardTime
                              : false
                      }
                      className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-medium text-[#1f2b1f] disabled:opacity-40"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitReservationWizard}
                      disabled={reservationWizardSubmitting}
                      className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-medium text-[#1f2b1f] disabled:opacity-50"
                    >
                      {reservationWizardSubmitting ? "Création..." : "Créer la réservation"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {openingDayEditor && openingDayEditorIndex !== null ? (
          <div className="fixed inset-0 z-[88] flex items-center justify-center bg-black/45 px-2 py-2 backdrop-blur-sm sm:px-4">
            <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] shadow-[0_30px_110px_rgba(15,23,42,0.22)] sm:max-h-[calc(100dvh-2rem)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#eadfce] p-4 sm:p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Ouverture</p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">
                    {weeklyDayLabels[openingDayEditor.day]}
                  </h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Configure ce jour dans sa propre modal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpeningDayEditorIndex(null)}
                  className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                >
                  Fermer
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4">
                  <label className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-[#eadfce] bg-white px-4 py-3 text-sm">
                    <span>Jour fermé</span>
                    <input
                      type="checkbox"
                      checked={openingDayEditor.closed}
                      onChange={(event) =>
                        updateWeeklyHourField(openingDayEditorIndex, (current) => ({
                          ...current,
                          closed: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-3">
                    {[0, 1].map((slotIndex) => {
                      const interval = openingDayEditor.intervals[slotIndex];
                      const isEnabled = !openingDayEditor.closed;

                      return (
                        <div
                          key={slotIndex}
                          className="rounded-[1.5rem] border border-[#eadfce] bg-[#fffdf8] p-4"
                        >
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">
                            Créneau {slotIndex + 1}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm text-[#24170f]">
                              <span className="text-[11px] uppercase tracking-[0.25em] text-[#a38d7c]">De</span>
                              <input
                                type="time"
                                value={interval?.start ?? ""}
                                onChange={(event) =>
                                  updateWeeklyIntervalField(
                                    openingDayEditorIndex,
                                    slotIndex,
                                    "start",
                                    event.target.value,
                                  )
                                }
                                disabled={!isEnabled}
                                className="rounded-2xl border border-[#eadfce] bg-white px-4 py-3 outline-none disabled:opacity-50"
                              />
                            </label>
                            <label className="grid gap-2 text-sm text-[#24170f]">
                              <span className="text-[11px] uppercase tracking-[0.25em] text-[#a38d7c]">À</span>
                              <input
                                type="time"
                                value={interval?.end ?? ""}
                                onChange={(event) =>
                                  updateWeeklyIntervalField(
                                    openingDayEditorIndex,
                                    slotIndex,
                                    "end",
                                    event.target.value,
                                  )
                                }
                                disabled={!isEnabled}
                                className="rounded-2xl border border-[#eadfce] bg-white px-4 py-3 outline-none disabled:opacity-50"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {editingCategory ? (
          <div className="fixed inset-0 z-[89] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
            <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-5 shadow-[0_30px_90px_rgba(124,77,44,0.18)] sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-[#eadfce] pb-4">
                <div>
                  <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">
                    {editingCategory.name || "Nouvelle catégorie"}
                  </h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">
                    Édite la catégorie ici, puis ouvre les produits dans une modal séparée.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryEditor(null)}
                  className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_240px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nom de la catégorie">
                    <input
                      value={editingCategory.name}
                      onChange={(event) =>
                        updateCategoryField(editingCategoryIndex, "name", event.target.value)
                      }
                      className="w-full rounded-2xl border border-[#eadfce] bg-white px-4 py-3 outline-none ring-0 transition focus:border-[#b8d6b2]"
                    />
                  </Field>
                  <Field label="Description de la catégorie">
                    <textarea
                      value={editingCategory.description}
                      onChange={(event) =>
                        updateCategoryField(editingCategoryIndex, "description", event.target.value)
                      }
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-[#eadfce] bg-white px-4 py-3 outline-none transition focus:border-[#b8d6b2]"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Aperçu">
                      <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 text-sm text-[#6f5b4a]">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">
                          {editingCategory.items.length} plat{editingCategory.items.length > 1 ? "s" : ""}
                        </p>
                        <p className="mt-2">
                          Clique sur <strong>+ Produit</strong> pour ajouter rapidement un plat à cette catégorie.
                        </p>
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextItemIndex = editingCategory.items.length;
                      addItem(editingCategoryIndex);
                      setDishEditor({ categoryIndex: editingCategoryIndex, itemIndex: nextItemIndex });
                    }}
                    className="w-full rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-3 text-sm font-medium text-[#1f2b1f]"
                  >
                    + Produit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeCategory(editingCategoryIndex);
                      setCategoryEditor(null);
                    }}
                    className="w-full rounded-full border border-[#eadfce] bg-white px-4 py-3 text-sm font-medium text-[#24170f]"
                  >
                    Supprimer la catégorie
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-[1.7rem] border border-[#eadfce] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Produits</p>
                    <h4 className="mt-1 text-lg font-semibold text-[#24170f]">Édition des plats</h4>
                  </div>
                  <span className="rounded-full border border-[#eadfce] bg-[#fffdf8] px-3 py-2 text-xs font-medium text-[#24170f]">
                    {editingCategory.items.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {editingCategory.items.length === 0 ? (
                    <p className="text-sm text-[#6f5b4a]">Aucun plat dans cette catégorie pour le moment.</p>
                  ) : (
                    editingCategory.items.map((item, itemIndex) => (
                      <article
                        key={item.id}
                        className="rounded-[1.35rem] border border-[#eadfce] bg-[#faf7f2] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">
                              {item.isSignature ? "Signature" : "Plat"}
                            </p>
                            <h5 className="mt-1 truncate text-base font-semibold text-[#24170f]">{item.name}</h5>
                            <p className="mt-1 line-clamp-2 text-sm text-[#6f5b4a]">
                              {item.description || "Plat à éditer"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-semibold text-[#24170f]">
                              {money(getMenuItemEffectivePrice(item), draft.currency)}
                            </p>
                            <p className="mt-1 text-xs text-[#a38d7c]">
                              {item.ingredients.length} ingr. · {item.allergens.length} allerg.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDishEditor({ categoryIndex: editingCategoryIndex, itemIndex })}
                            className="rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-2 text-sm font-medium text-[#1f2b1f]"
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(editingCategoryIndex, itemIndex)}
                            className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                          >
                            Supprimer
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {dishEditor && editingDishItem ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
            <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-5 shadow-[0_30px_90px_rgba(124,77,44,0.18)] sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-[#eadfce] pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Plat</p>
                  <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">{editingDishItem.name || "Nouveau plat"}</h3>
                  <p className="mt-2 text-sm text-[#6f5b4a]">Édition isolée pour gagner de la place sur mobile.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishEditor(null)}
                  className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nom du plat">
                    <input
                      value={editingDishItem.name}
                      onChange={(event) =>
                        updateItemField(dishEditor.categoryIndex, dishEditor.itemIndex, "name", event.target.value)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </Field>
                  <Field label="Prix">
                    <input
                      type="number"
                      value={editingDishItem.price}
                      onChange={(event) =>
                        updateItemField(dishEditor.categoryIndex, dishEditor.itemIndex, "price", event.target.value)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </Field>
                  <Field label="Prix promotionnel">
                    <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(editingDishItem.happyHourEnabled)}
                        onChange={(event) =>
                          updateItemField(
                            dishEditor.categoryIndex,
                            dishEditor.itemIndex,
                            "happyHourEnabled",
                            event.target.checked,
                          )
                        }
                      />
                      <span className="text-sm text-black/70">Activer le prix happy hour</span>
                    </label>
                  </Field>
                  <Field label="Prix happy hour">
                    <input
                      type="number"
                      value={editingDishItem.happyHourPrice ?? ""}
                      onChange={(event) =>
                        updateItemField(
                          dishEditor.categoryIndex,
                          dishEditor.itemIndex,
                          "happyHourPrice",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </Field>
                  <Field label="URL de l'image">
                    <input
                      value={editingDishItem.imageUrl}
                      onChange={(event) =>
                        updateItemField(dishEditor.categoryIndex, dishEditor.itemIndex, "imageUrl", event.target.value)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </Field>
                  <Field label="Attribut signature">
                    <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={editingDishItem.isSignature}
                        onChange={(event) =>
                          updateItemField(
                            dishEditor.categoryIndex,
                            dishEditor.itemIndex,
                            "isSignature",
                            event.target.checked,
                          )
                        }
                      />
                      <span className="text-sm text-black/70">Marquer comme plat signature</span>
                    </label>
                  </Field>
                  <Field label="Ingrédients">
                    <textarea
                      value={joinTags(editingDishItem.ingredients)}
                      onChange={(event) =>
                        updateItemField(
                          dishEditor.categoryIndex,
                          dishEditor.itemIndex,
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
                      value={joinTags(editingDishItem.allergens)}
                      onChange={(event) =>
                        updateItemField(
                          dishEditor.categoryIndex,
                          dishEditor.itemIndex,
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
                      value={editingDishItem.description}
                      onChange={(event) =>
                        updateItemField(
                          dishEditor.categoryIndex,
                          dishEditor.itemIndex,
                          "description",
                          event.target.value,
                        )
                      }
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25 md:col-span-2"
                    />
                  </Field>
                  <Field label="Interne / note cuisine">
                    <textarea
                      value={editingDishItem.recipe}
                      onChange={(event) =>
                        updateItemField(
                          dishEditor.categoryIndex,
                          dishEditor.itemIndex,
                          "recipe",
                          event.target.value,
                        )
                      }
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25 md:col-span-2"
                    />
                  </Field>
                </div>

                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[1.5rem] border border-[#eadfce] bg-white">
                    <img
                      src={editingDishItem.imageUrl}
                      alt={editingDishItem.name}
                      className="h-52 w-full object-cover"
                    />
                  </div>
                  <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4 text-sm text-[#6f5b4a]">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Aperçu</p>
                    <p className="mt-2 text-2xl font-semibold text-[#24170f]">
                      {money(getMenuItemEffectivePrice(editingDishItem), draft.currency)}
                    </p>
                    {editingDishItem.happyHourEnabled &&
                    Number.isFinite(editingDishItem.happyHourPrice) &&
                    Number(editingDishItem.happyHourPrice) > 0 ? (
                      <p className="mt-1 text-xs text-[#7f6c5a] line-through">
                        {money(editingDishItem.price, draft.currency)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDishEditor(null)}
                      className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f]"
                    >
                      Terminer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeItem(dishEditor.categoryIndex, dishEditor.itemIndex);
                        setDishEditor(null);
                      }}
                      className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black"
                    >
                      Supprimer le plat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
