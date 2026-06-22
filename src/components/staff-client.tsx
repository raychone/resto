"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildNotificationLabel,
  buildNotificationLink,
  buildWhatsAppReservationMessage,
} from "@/lib/contact-links";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import {
  browserNotificationsSupported,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from "@/lib/browser-notifications";
import { PublicMenuCategories } from "@/components/public-menu-categories";
import { useRestaurantRealtime } from "@/components/use-restaurant-realtime";
import { createId } from "@/lib/types";
import { summarizeTaxBreakdown } from "@/lib/tax";
import { countTablesNeeded } from "@/lib/booking";
import type {
  TableSession,
  Locale,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  Reservation,
  Restaurant,
  RestaurantMessage,
  Table,
  TableSessionParticipant,
} from "@/lib/types";
import type { AvailableDay } from "@/lib/booking";
import { getMenuItemEffectivePrice } from "@/lib/types";

type Props = {
  restaurant: Restaurant;
  staffUserId: string;
  locale: Locale;
  tableSession: TableSession | null;
  orderFlowEnabled: boolean;
  theme?: "dark" | "food";
  initialSelectedTableId?: string | null;
  initialReservations: Reservation[];
  initialTables: Table[];
  initialOrders: Order[];
  initialPayments: Payment[];
  initialMessages: RestaurantMessage[];
  initialTableModalView?: "bon" | "payment" | "menu";
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatMoney(amount: number, currency: string) {
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
type PhoneCountryCode = CountryCode;

type PhoneCountryOption = {
  code: PhoneCountryCode;
  label: string;
  dialCode: string;
  displayLabel: string;
};

const phoneCountryLabels =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["fr-FR"], { type: "region" })
    : null;

const preferredPhoneCountries: PhoneCountryCode[] = ["FR", "BE", "CH", "IT", "ES", "DE", "GB", "PT", "US"];

const phoneCountries: PhoneCountryOption[] = [...new Set([...preferredPhoneCountries, ...getCountries()])]
  .map((code) => {
    const label = phoneCountryLabels?.of(code) ?? code;
    const dialCode = `+${getCountryCallingCode(code)}`;
    return {
      code,
      label,
      dialCode,
      displayLabel: `${label} · ${dialCode}`,
    };
  })
  .sort((left, right) => {
    const leftPriority = preferredPhoneCountries.indexOf(left.code);
    const rightPriority = preferredPhoneCountries.indexOf(right.code);
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }
    return left.label.localeCompare(right.label, "fr");
  });

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

function reservationStatusMeta(status: Reservation["status"]) {
  if (status === "confirmed") {
    return { label: "CONFIRMÉE", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (status === "cancelled") {
    return { label: "ANNULÉE", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  if (status === "no_show") {
    return { label: "NO SHOW", className: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  return { label: "EN ATTENTE", className: "bg-amber-50 text-amber-800 border-amber-200" };
}

function reservationStatusRank(status: Reservation["status"]) {
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  if (status === "cancelled") return 2;
  return 3;
}

function orderTotal(order: Order) {
  return summarizeTaxBreakdown(order.items).total;
}

function paymentsForOrder(payments: Payment[], orderId: string) {
  return payments.filter((payment) => payment.orderId === orderId && !payment.deletedAt);
}

function paidTotalForOrder(payments: Payment[], orderId: string) {
  return paymentsForOrder(payments, orderId).reduce((sum, payment) => sum + payment.amount, 0);
}

function orderStatusMeta(status: Order["status"]) {
  if (status === "paid") {
    return { label: "PAYÉ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (status === "cancelled") {
    return { label: "ANNULÉ", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  if (status === "archived") {
    return { label: "ARCHIVÉ", className: "bg-black/5 text-black/60 border-black/10" };
  }

  if (status === "sent_to_kitchen") {
    return { label: "EN CUISINE", className: "bg-sky-50 text-sky-700 border-sky-200" };
  }

  if (status === "preparing") {
    return { label: "EN PREPARATION", className: "bg-cyan-50 text-cyan-700 border-cyan-200" };
  }

  if (status === "ready") {
    return { label: "PRÊT", className: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  }

  if (status === "served") {
    return { label: "SERVI", className: "bg-lime-50 text-lime-700 border-lime-200" };
  }

  return { label: "OUVERT", className: "bg-amber-50 text-amber-800 border-amber-200" };
}

function isActiveOrder(order: Order) {
  return !["paid", "cancelled", "archived"].includes(order.status);
}

export function StaffClient({
  restaurant,
  staffUserId,
  locale,
  tableSession,
  orderFlowEnabled,
  theme = "dark",
  initialSelectedTableId = null,
  initialReservations,
  initialTables,
  initialOrders,
  initialPayments,
  initialMessages,
  initialTableModalView = "bon",
}: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [messages, setMessages] = useState<RestaurantMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reservationFilter, setReservationFilter] = useState<
    "all" | "pending" | "confirmed" | "cancelled" | "no_show" | "today"
  >("all");
  const [selectedTarget, setSelectedTarget] = useState<string>("takeaway");
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>("unsupported");
  const [optimisticReadWaiterCallTables, setOptimisticReadWaiterCallTables] = useState<Set<string>>(
    () => new Set(),
  );
  const previousOrdersRef = useRef<Map<string, Order["status"]>>(new Map());
  const initializedOrdersRef = useRef(false);
  const tableBonsRef = useRef<HTMLDivElement | null>(null);
  const tableQrRef = useRef<HTMLDivElement | null>(null);
  const tableCallsRef = useRef<HTMLDivElement | null>(null);
  const [manualSelectedClientId, setManualSelectedClientId] = useState<string>("shared");
  const [splitDraft, setSplitDraft] = useState<TableSession | null>(() => tableSession);
  const [staffTab, setStaffTab] = useState<"reservations" | "tables" | "menu">(
    orderFlowEnabled ? "tables" : "reservations",
  );
  const [staffQuickNav, setStaffQuickNav] = useState<"reservations" | "alerts" | "tables" | "bon" | "menu">(
    orderFlowEnabled ? "tables" : "reservations",
  );
  const [selectedTableModalId, setSelectedTableModalId] = useState<string | null>(initialSelectedTableId);
  const [selectedTableModalView, setSelectedTableModalView] = useState<"bon" | "payment" | "menu">(
    initialTableModalView,
  );
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const isFoodTheme = theme === "food";
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    guestCount: 2,
    note: "",
  });
  const [bookingAvailability, setBookingAvailability] = useState<AvailableDay[]>([]);
  const [bookingDisplayMonth, setBookingDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [bookingPhoneCountry, setBookingPhoneCountry] = useState<PhoneCountryCode>("FR");
  const [bookingPickerMode, setBookingPickerMode] = useState<"date" | "time" | "country" | null>(null);
  const [bookingCountryQuery, setBookingCountryQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reservationResponse, tablesResponse, ordersResponse, messagesResponse] = await Promise.all([
        fetch(`/api/restaurants/${restaurant.slug}/reservations`, { cache: "no-store" }),
        fetch(`/api/restaurants/${restaurant.slug}/tables`, { cache: "no-store" }),
        fetch(`/api/restaurants/${restaurant.slug}/orders`, { cache: "no-store" }),
        fetch(`/api/restaurants/${restaurant.slug}/messages`, { cache: "no-store" }),
      ]);

      if (reservationResponse.ok) {
        const payload = (await reservationResponse.json()) as { reservations: Reservation[] };
        setReservations(payload.reservations);
      }

      if (tablesResponse.ok) {
        const payload = (await tablesResponse.json()) as { tables: Table[] };
        setTables(payload.tables);
      }

      if (ordersResponse.ok) {
        const payload = (await ordersResponse.json()) as { orders: Order[]; payments: Payment[] };
        if (initializedOrdersRef.current) {
          const previousOrders = previousOrdersRef.current;
          const nextOrders = new Map(payload.orders.map((order) => [order.id, order.status] as const));
          const newOrders = payload.orders.filter((order) => !previousOrders.has(order.id));
          const updatedOrders = payload.orders.filter((order) => previousOrders.get(order.id) !== order.status);

          if (newOrders.some((order) => order.status === "sent_to_kitchen" || order.status === "open")) {
            pushToast("Nouvelle commande reçue.");
            sendBrowserNotification(
              `${restaurant.name} — nouvelle commande`,
              "Une nouvelle commande attend la validation du serveur.",
            );
          }

          if (updatedOrders.some((order) => order.status === "ready")) {
            pushToast("Une commande est prête en cuisine.");
            sendBrowserNotification(`${restaurant.name} — commande prête`, "Une commande est prête pour le service.");
          }

          previousOrdersRef.current = nextOrders;
        } else {
          previousOrdersRef.current = new Map(payload.orders.map((order) => [order.id, order.status] as const));
          initializedOrdersRef.current = true;
        }
        setOrders(payload.orders);
        setPayments(payload.payments);
      }

      if (messagesResponse.ok) {
        const payload = (await messagesResponse.json()) as { messages: RestaurantMessage[] };
        setMessages(payload.messages);
      }
    } catch {
      setNotice("Synchronisation temporairement indisponible.");
    } finally {
      setLoading(false);
    }
  }, [restaurant.name, restaurant.slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  useEffect(() => {
    if (!browserNotificationsSupported()) return;
    setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    if (!orderFlowEnabled) return;

    const supportsRealtime = typeof window !== "undefined" && "EventSource" in window;
    const intervalId = supportsRealtime
      ? null
      : window.setInterval(() => {
          void loadData();
        }, 500);

    const refreshOnFocus = () => {
      void loadData();
    };

    const refreshOnVisibility = () => {
      if (!document.hidden) {
        void loadData();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [loadData, orderFlowEnabled]);

  useRestaurantRealtime({
    restaurantSlug: restaurant.slug,
    enabled: orderFlowEnabled,
    onEvent: () => {
      void loadData();
    },
  });

  useEffect(() => {
    const availableTabs: Array<"reservations" | "tables" | "menu"> = [];
    if (restaurant.features.bookingEnabled) {
      availableTabs.push("reservations");
    }
    availableTabs.push("tables");
    if (orderFlowEnabled) {
      availableTabs.push("menu");
    }

    if (!availableTabs.includes(staffTab)) {
      setStaffTab(availableTabs[0] ?? "tables");
    }
  }, [orderFlowEnabled, restaurant.features.bookingEnabled, staffTab]);

  async function enableNotifications() {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      sendBrowserNotification(restaurant.name, "Les notifications staff sont activées.");
    }
  }

  const todayKey = new Intl.DateTimeFormat("fr-CA").format(new Date());

  const reservationStats = useMemo(() => {
    const pending = reservations.filter((reservation) => reservation.status === "pending").length;
    const confirmed = reservations.filter((reservation) => reservation.status === "confirmed").length;
    const cancelled = reservations.filter((reservation) => reservation.status === "cancelled").length;
    const noShow = reservations.filter((reservation) => reservation.status === "no_show").length;
    const today = reservations.filter((reservation) => reservation.date === todayKey).length;
    return { pending, confirmed, cancelled, noShow, today };
  }, [reservations, todayKey]);

  const bookingAvailabilityMap = useMemo(
    () => new Map(bookingAvailability.map((day) => [day.date, day] as const)),
    [bookingAvailability],
  );

  const bookingCalendarDays = useMemo(() => buildCalendarGrid(bookingDisplayMonth), [bookingDisplayMonth]);
  const bookingSelectedDay = useMemo(
    () => (form.date ? bookingAvailabilityMap.get(form.date) ?? null : null),
    [bookingAvailabilityMap, form.date],
  );
  const bookingTablesNeeded = useMemo(
    () => countTablesNeeded(Math.max(1, Number(form.guestCount) || 1), restaurant.seatsPerTable),
    [form.guestCount, restaurant.seatsPerTable],
  );
  const bookingAvailableSlots = useMemo(
    () => bookingSelectedDay?.slots.filter((slot) => slot.availableTables >= bookingTablesNeeded) ?? [],
    [bookingSelectedDay, bookingTablesNeeded],
  );
  const bookingSelectedDateLabel = bookingSelectedDay?.label ?? (form.date ? formatDate(form.date) : "Choisir une date");
  const bookingSelectedCountry = useMemo(
    () => phoneCountries.find((entry) => entry.code === bookingPhoneCountry) ?? phoneCountries[0],
    [bookingPhoneCountry],
  );
  const bookingVisibleCountries = useMemo(() => {
    const query = bookingCountryQuery.trim().toLowerCase();
    if (!query) return phoneCountries;
    return phoneCountries.filter((entry) => {
      return (
        entry.label.toLowerCase().includes(query) ||
        entry.code.toLowerCase().includes(query) ||
        entry.dialCode.toLowerCase().includes(query)
      );
    });
  }, [bookingCountryQuery]);

  const refreshBookingAvailability = useCallback(async (monthDate: Date) => {
    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/availability?from=${encodeURIComponent(formatDateKey(monthDate))}&days=42&lang=${locale}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const payload = (await response.json()) as { availability: AvailableDay[] };
    setBookingAvailability(payload.availability);
  }, [locale, restaurant.slug]);

  function selectBookingDate(dateKey: string) {
    setForm((current) => ({ ...current, date: dateKey, time: "" }));
    setBookingPickerMode(null);
  }

  function selectBookingTime(time: string) {
    setForm((current) => ({ ...current, time }));
    setBookingPickerMode(null);
  }

  function buildBookingPhoneValue() {
    const national = normalizePhoneNumber(form.phone);
    if (!national) return "";
    const normalizedNational = national.startsWith("0") ? national.slice(1) : national;
    return `${bookingSelectedCountry?.dialCode ?? "+33"}${normalizedNational}`;
  }

  const visibleReservations = useMemo(() => {
    const sorted = [...reservations].sort((left, right) => {
      const statusDelta = reservationStatusRank(left.status) - reservationStatusRank(right.status);
      if (statusDelta !== 0) return statusDelta;

      const dateDelta = left.date.localeCompare(right.date);
      if (dateDelta !== 0) return dateDelta;

      return left.time.localeCompare(right.time);
    });

    if (reservationFilter === "all") return sorted;
    if (reservationFilter === "today") {
      return sorted.filter((reservation) => reservation.date === todayKey);
    }

    return sorted.filter((reservation) => reservation.status === reservationFilter);
  }, [reservations, reservationFilter, todayKey]);

  const currentTables = useMemo(() => {
    return [...tables].filter((table) => table.active && !table.deletedAt);
  }, [tables]);

  const currentOrder = useMemo(() => {
    const matchesSelectedTarget = (order: Order) => {
      if (selectedTarget === "takeaway") {
        return order.source === "takeaway";
      }

      return (
        (order.source === "table" || order.source === "qr") &&
        order.tableId === selectedTarget
      );
    };

    const byId = orders.find((order) => order.id === selectedTarget);
    if (byId) return byId;

    if (selectedTarget === "takeaway") {
      const takeawayOrders = orders
        .filter((order) => isActiveOrder(order) && order.source === "takeaway" && !order.deletedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return takeawayOrders.find((order) => order.status === "open") ?? takeawayOrders[0] ?? null;
    }

    const matchingOrders = orders
      .filter((order) => isActiveOrder(order) && matchesSelectedTarget(order) && !order.deletedAt)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return matchingOrders.find((order) => order.status === "open") ?? matchingOrders[0] ?? null;
  }, [orders, selectedTarget]);

  const currentOrderTotal = useMemo(() => {
    return currentOrder ? orderTotal(currentOrder) : 0;
  }, [currentOrder]);
  const bookingEnabled = restaurant.features.bookingEnabled;

  const pendingClientOrders = useMemo(
    () =>
      [...orders]
        .filter(
          (order) =>
            order.source === "qr" &&
            order.status === "open" &&
            order.restaurantId === restaurant.id &&
            !order.deletedAt,
        )
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt)),
    [orders, restaurant.id],
  );
  const pendingClientOrdersByTable = useMemo(() => {
    return pendingClientOrders.reduce<Record<string, number>>((accumulator, order) => {
      const key = order.tableId ?? "takeaway";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [pendingClientOrders]);

  const waiterCallsByTable = useMemo(() => {
    return currentTables.reduce<Record<string, number>>((accumulator, table) => {
      const count = messages.filter((message) => {
        if (message.status !== "new") return false;
        if (message.tableId) {
          return message.tableId === table.id;
        }
        const haystack = `${message.name} ${message.message}`.toLowerCase();
        return haystack.includes(table.name.toLowerCase());
      }).length;

      const optimisticCount = optimisticReadWaiterCallTables.has(table.id) ? 0 : count;

      if (optimisticCount > 0) {
        accumulator[table.id] = optimisticCount;
      }
      return accumulator;
    }, {});
  }, [currentTables, messages, optimisticReadWaiterCallTables]);

  const alertSummary = useMemo(() => {
    const qrOrders = Object.values(pendingClientOrdersByTable).reduce((sum, value) => sum + value, 0);
    const waiterCalls = Object.values(waiterCallsByTable).reduce((sum, value) => sum + value, 0);
    const readyOrders = orders.filter((order) => order.status === "ready").length;
    return { qrOrders, waiterCalls, readyOrders };
  }, [orders, pendingClientOrdersByTable, waiterCallsByTable]);

  const firstTableWithWaiterCall = useMemo(() => {
    return currentTables.find((table) => (waiterCallsByTable[table.id] ?? 0) > 0) ?? null;
  }, [currentTables, waiterCallsByTable]);

  const firstTableWithQrOrder = useMemo(() => {
    return currentTables.find((table) => (pendingClientOrdersByTable[table.id] ?? 0) > 0) ?? null;
  }, [currentTables, pendingClientOrdersByTable]);

  const firstReadyOrder = useMemo(
    () => orders.find((order) => order.restaurantId === restaurant.id && order.status === "ready" && !order.deletedAt) ?? null,
    [orders, restaurant.id],
  );

  const currentPaidTotal = useMemo(() => {
    return currentOrder ? paidTotalForOrder(payments, currentOrder.id) : 0;
  }, [currentOrder, payments]);

  const currentRemaining = Math.max(0, currentOrderTotal - currentPaidTotal);

  function pushToast(message: string, type: "success" | "error" = "success") {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }

    setToast({ type, message });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2800);
  }

  const currentTargetLabel = useMemo(() => {
    if (selectedTarget === "takeaway") {
      return "À emporter";
    }

    const selectedOrder = orders.find((order) => order.id === selectedTarget);
    if (selectedOrder?.tableId) {
      return currentTables.find((table) => table.id === selectedOrder.tableId)?.name ?? "Table";
    }

    return currentTables.find((table) => table.id === selectedTarget)?.name ?? "Table";
  }, [currentTables, orders, selectedTarget]);

  const currentTargetTable = useMemo(() => {
    if (selectedTarget === "takeaway") {
      return null;
    }

    const selectedOrder = orders.find((order) => order.id === selectedTarget);
    if (selectedOrder?.tableId) {
      return currentTables.find((table) => table.id === selectedOrder.tableId) ?? null;
    }

    return currentTables.find((table) => table.id === selectedTarget) ?? null;
  }, [currentTables, orders, selectedTarget]);

  const selectedTableModal = useMemo(() => {
    if (!selectedTableModalId) return null;
    return currentTables.find((table) => table.id === selectedTableModalId) ?? null;
  }, [currentTables, selectedTableModalId]);

  const selectedTableModalOpenOrder = useMemo(() => {
    if (!selectedTableModal) return null;

    const tableOrders = orders
      .filter((order) => {
        if (!isActiveOrder(order)) return false;
        return (order.source === "table" || order.source === "qr") && order.tableId === selectedTableModal.id;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const selectedOrderById = tableOrders.find((order) => order.id === selectedTarget) ?? null;
    if (selectedOrderById) return selectedOrderById;

    return (
      tableOrders.find((order) => order.status === "open") ??
      tableOrders.find((order) => order.status === "ready") ??
      tableOrders.find((order) => order.status === "preparing") ??
      tableOrders.find((order) => order.status === "sent_to_kitchen") ??
      tableOrders[0] ??
      null
    );
  }, [orders, selectedTableModal, selectedTarget]);

  const selectedTableModalTaxSummary = useMemo(() => {
    if (!selectedTableModalOpenOrder) return null;
    return summarizeTaxBreakdown(selectedTableModalOpenOrder.items);
  }, [selectedTableModalOpenOrder]);
  const selectedTableModalPayments = useMemo(
    () =>
      selectedTableModalOpenOrder
        ? payments.filter((payment) => payment.orderId === selectedTableModalOpenOrder.id && !payment.deletedAt)
        : [],
    [payments, selectedTableModalOpenOrder],
  );

  const selectedTableModalOrders = useMemo(() => {
    if (!selectedTableModal) return [];

    return orders
      .filter((order) => {
        if (!isActiveOrder(order)) return false;
        return (order.source === "table" || order.source === "qr") && order.tableId === selectedTableModal.id;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [orders, selectedTableModal]);

  useEffect(() => {
    if (selectedTableModalOpenOrder) {
      setOrderNote(selectedTableModalOpenOrder.note ?? "");
      return;
    }

    if (!selectedTableModalId && currentOrder) {
      setOrderNote(currentOrder.note ?? "");
    }
  }, [currentOrder?.id, selectedTableModalId, selectedTableModalOpenOrder?.id]);

  useEffect(() => {
    if (!selectedTableModalId) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTableModalId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTableModalId]);

  useEffect(() => {
    if (selectedTableModalId && !currentTables.some((table) => table.id === selectedTableModalId)) {
      setSelectedTableModalId(null);
    }
  }, [currentTables, selectedTableModalId]);

  useEffect(() => {
    if (!selectedTableModalId) return;
    if (selectedTarget === selectedTableModalId) return;
    setSelectedTarget(selectedTableModalId);
  }, [selectedTableModalId, selectedTarget]);

  function jumpTo(id: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function jumpToTableModalSection(section: "bons" | "qr" | "calls") {
    const targetRef =
      section === "bons" ? tableBonsRef : section === "qr" ? tableQrRef : tableCallsRef;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function navigateStaff(tab: "reservations" | "tables" | "menu", target: string, quickNav: typeof staffQuickNav) {
    setStaffTab(tab);
    setStaffQuickNav(quickNav);
    setPendingScrollTarget(target);
  }

  async function patchTableSession(patch: Partial<{
    guestCount: number;
    note: string;
    participants: TableSessionParticipant[];
    tableId: string | null;
  }>) {
    if (!tableSession) return false;

    const response = await fetch(`/api/restaurants/${restaurant.slug}/table-sessions/${tableSession.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      setNotice("Impossible de modifier la table.");
      pushToast("Impossible de modifier la table.", "error");
      return false;
    }

    const payload = (await response.json()) as { tableSession: TableSession };
    setSplitDraft(payload.tableSession);
    await loadData();
    return true;
  }

  async function markWaiterCallsReadForTable(tableId: string) {
    if (!tableId) return;

    setOptimisticReadWaiterCallTables((previous) => {
      const next = new Set(previous);
      next.add(tableId);
      return next;
    });

    const response = await fetch(`/api/restaurants/${restaurant.slug}/messages`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tableId,
        status: "read",
      }),
    });

    if (response.ok) {
      await loadData();
    } else {
      setOptimisticReadWaiterCallTables((previous) => {
        const next = new Set(previous);
        next.delete(tableId);
        return next;
      });
      return;
    }

    setOptimisticReadWaiterCallTables((previous) => {
      const next = new Set(previous);
      next.delete(tableId);
      return next;
    });
  }

  useEffect(() => {
    const target = pendingScrollTarget;
    if (!target) return;

    const raf = window.requestAnimationFrame(() => {
      const secondRaf = window.requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setPendingScrollTarget(null);
      });

      return () => window.cancelAnimationFrame(secondRaf);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [pendingScrollTarget, staffTab, selectedTarget, orderFlowEnabled]);

  useEffect(() => {
    if (!selectedTarget || selectedTarget === "takeaway") {
      return;
    }

    if (selectedTarget.startsWith("order-")) {
      return;
    }

    const selectedTable = currentTables.find((table) => table.id === selectedTarget);
    if (!selectedTable) {
      return;
    }

    if ((waiterCallsByTable[selectedTable.id] ?? 0) > 0) {
      void markWaiterCallsReadForTable(selectedTable.id);
    }
  }, [currentTables, selectedTarget, waiterCallsByTable]);

  useEffect(() => {
    if (bookingEnabled && staffTab === "reservations") {
      void refreshBookingAvailability(bookingDisplayMonth);
    }
  }, [bookingDisplayMonth, bookingEnabled, refreshBookingAvailability, staffTab]);

  useEffect(() => {
    if (!bookingPickerMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [bookingPickerMode]);

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/restaurants/${restaurant.slug}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: buildBookingPhoneValue(),
        email: form.email,
        note: form.note,
        date: form.date,
        time: form.time,
        guestCount: Number(form.guestCount),
      }),
    });

    if (!response.ok) {
      setNotice("Impossible de créer la réservation.");
      pushToast("Impossible de créer la réservation.", "error");
      return;
    }

    setForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      date: "",
      time: "",
      guestCount: 2,
      note: "",
    });
    setBookingPhoneCountry("FR");
    setBookingCountryQuery("");
    setBookingPickerMode(null);
    setNotice("Réservation créée.");
    pushToast("Réservation créée.");
    await loadData();
  }

  async function mutateReservation(
    reservationId: string,
    action: "confirmed" | "cancelled" | "no_show" | "delete",
  ) {
    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/reservations/${reservationId}`,
      {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: action === "delete" ? undefined : JSON.stringify({ status: action }),
      },
    );

    if (!response.ok) {
      setNotice("Action impossible.");
      pushToast("Action impossible.", "error");
      return;
    }

    setNotice(action === "delete" ? "Réservation supprimée." : "Réservation mise à jour.");
    pushToast(action === "delete" ? "Réservation supprimée." : "Réservation mise à jour.");
    await loadData();
  }

  async function ensureOrder(target: string) {
    const existingOrder = orders.find((order) => order.id === target);
    if (existingOrder && existingOrder.status === "open") {
      setSelectedTarget(existingOrder.tableId ?? "takeaway");
      return existingOrder;
    }

    const existing = orders.find(
      (order) =>
        order.status === "open" &&
        (target === "takeaway"
          ? order.source === "takeaway"
          : (order.source === "table" || order.source === "qr") && order.tableId === target),
    );

    if (existing) {
      setSelectedTarget(existing.tableId ?? "takeaway");
      return existing;
    }

    const payload = {
      source: target === "takeaway" ? ("takeaway" as const) : ("table" as const),
      tableId: target === "takeaway" ? null : target,
      staffUserId,
      note: orderNote,
    };

    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setNotice("Impossible d'ouvrir le bon.");
      return null;
    }

    const payloadResponse = (await response.json()) as { order: Order };
    setSelectedTarget(payloadResponse.order.tableId ?? "takeaway");
    await loadData();
    return payloadResponse.order;
  }

  async function addItemToOrder(
    item: {
      id: string;
      name: string;
      price: number;
      displayPrice?: number;
    },
    categoryName?: string,
    orderOverrideId?: string,
  ) {
    const order = orderOverrideId ? orders.find((existingOrder) => existingOrder.id === orderOverrideId) ?? null : await ensureOrder(selectedTarget);
    if (!order) return;

    const assignedParticipant =
      effectiveSelectedClientId !== "shared"
        ? tableSession?.participants.find((participant) => participant.id === effectiveSelectedClientId) ?? null
        : null;

    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders/${order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        menuItemId: item.id,
        nameSnapshot: item.name,
        priceSnapshot: item.displayPrice ?? item.price,
        quantity: 1,
        note: "",
        assignedClientId: assignedParticipant?.id ?? null,
        assignedClientName: assignedParticipant?.name ?? null,
        categoryName,
      }),
    });

    if (!response.ok) {
      setNotice("Impossible d'ajouter le plat.");
      return;
    }

    setNotice(`${item.name} ajouté au bon.`);
    await loadData();
  }

  async function addItemToTableRound(item: {
    id: string;
    name: string;
    price: number;
    displayPrice?: number;
  }, categoryName?: string) {
    if (!selectedTableModal) {
      await addItemToOrder(item, categoryName);
      return;
    }

    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setNotice("Impossible de charger les bons.");
      return;
    }

    const payload = (await response.json()) as { orders: Order[] };
    const latestTableOrders = payload.orders
      .filter((order) => isActiveOrder(order) && (order.source === "table" || order.source === "qr") && order.tableId === selectedTableModal.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const latestOpenOrder = latestTableOrders.find((order) => order.status === "open") ?? null;

    if (latestOpenOrder) {
      setSelectedTarget(latestOpenOrder.id);
      const itemResponse = await fetch(`/api/restaurants/${restaurant.slug}/orders/${latestOpenOrder.id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          menuItemId: item.id,
          nameSnapshot: item.name,
          priceSnapshot: item.displayPrice ?? item.price,
          quantity: 1,
          note: "",
          assignedClientId: null,
          assignedClientName: null,
          categoryName,
        }),
      });

      if (!itemResponse.ok) {
        setNotice("Impossible d'ajouter le plat.");
        return;
      }

      setNotice(`${item.name} ajouté au bon.`);
      await loadData();
      return;
    }

    const createResponse = await fetch(`/api/restaurants/${restaurant.slug}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tableId: selectedTableModal.id,
        source: "table",
        staffUserId,
        note: orderNote,
      }),
    });

    if (!createResponse.ok) {
      setNotice("Impossible d'ouvrir un nouveau bon.");
      return;
    }

    const createdPayload = (await createResponse.json()) as { order: Order };
    const itemResponse = await fetch(`/api/restaurants/${restaurant.slug}/orders/${createdPayload.order.id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
          menuItemId: item.id,
          nameSnapshot: item.name,
          priceSnapshot: item.displayPrice ?? item.price,
          quantity: 1,
          note: "",
          assignedClientId: null,
          assignedClientName: null,
          categoryName,
        }),
      });

    if (!itemResponse.ok) {
      setNotice("Impossible d'ajouter le plat.");
      return;
    }

    setSelectedTarget(createdPayload.order.id);
    setNotice(`${item.name} ajouté au bon.`);
    await loadData();
  }

  async function assignItemToClient(itemId: string, clientId: string) {
    if (!currentOrder) return;

    const assignedParticipant =
      clientId !== "shared"
        ? tableSession?.participants.find((participant) => participant.id === clientId) ?? null
        : null;

    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/orders/${currentOrder.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedClientId: assignedParticipant?.id ?? null,
          assignedClientName: assignedParticipant?.name ?? null,
        }),
      },
    );

    if (!response.ok) {
      setNotice("Impossible d'assigner le plat.");
      pushToast("Impossible d'assigner le plat.", "error");
      return;
    }

    setNotice("Client du plat mis à jour.");
    pushToast("Client du plat mis à jour.");
    await loadData();
  }

  async function removeItemFromOrder(itemId: string) {
    if (!currentOrder) return;

    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/orders/${currentOrder.id}/items?itemId=${itemId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      setNotice("Impossible de supprimer le plat.");
      return;
    }

    setNotice("Plat retiré du bon.");
    await loadData();
  }

  async function changeItemQuantity(itemId: string, quantity: number) {
    if (!currentOrder) return;

    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/orders/${currentOrder.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      },
    );

    if (!response.ok) {
      setNotice("Impossible de modifier la quantité.");
      return;
    }

    await loadData();
  }

  async function setCurrentOrderStatus(status: Order["status"]) {
    if (!currentOrder) return;

    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders/${currentOrder.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setNotice("Impossible de modifier le bon.");
      pushToast("Impossible de modifier le bon.", "error");
      return;
    }

    setNotice(
      status === "sent_to_kitchen"
        ? "Bon envoyé en cuisine."
        : status === "archived"
          ? "Bon archivé."
          : status === "paid"
            ? "Bon encaissé."
            : "Bon mis à jour.",
    );
    pushToast(
      status === "sent_to_kitchen"
        ? "Bon envoyé en cuisine."
        : status === "archived"
          ? "Bon archivé."
          : status === "paid"
            ? "Bon encaissé."
            : "Bon mis à jour.",
    );
    await loadData();
  }

  async function updateOrderStatus(orderId: string, status: Order["status"]) {
    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setNotice("Impossible de modifier le bon.");
      pushToast("Impossible de modifier le bon.", "error");
      return false;
    }

    await loadData();
    return true;
  }

  async function saveOrderNote(orderId: string, note: string) {
    const response = await fetch(`/api/restaurants/${restaurant.slug}/orders/${orderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      setNotice("Impossible de modifier la note.");
      pushToast("Impossible de modifier la note.", "error");
      return false;
    }

    setNotice("Note du bon mise à jour.");
    pushToast("Note du bon mise à jour.");
    await loadData();
    return true;
  }

  async function closeOrderById(orderId: string, method: PaymentMethod) {
    const targetOrder = orders.find((order) => order.id === orderId) ?? null;
    if (!targetOrder) return;

    const targetOrderTotal = orderTotal(targetOrder);
    const targetPaidTotal = paidTotalForOrder(payments, targetOrder.id);
    const targetRemaining = Math.max(0, targetOrderTotal - targetPaidTotal);
    const paymentValue =
      Number(paymentAmount) > 0 ? Number(paymentAmount) : targetRemaining > 0 ? targetRemaining : targetOrderTotal;
    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/orders/${targetOrder.id}/payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentValue,
          method,
          note: `Paiement ${method}`,
        }),
      },
    );

    if (!response.ok) {
      setNotice("Impossible d'encaisser le bon.");
      pushToast("Impossible d'encaisser le bon.", "error");
      return;
    }

    const payload = (await response.json()) as {
      summary?: {
        targetLabel?: string;
        methodLabel?: string;
        amount?: number;
        paidTotal?: number;
        remaining?: number;
      };
    };
    const label = payload.summary?.targetLabel ?? currentTargetLabel;
    const amount =
      payload.summary?.amount ??
      paymentValue;
    const methodLabel = payload.summary?.methodLabel ?? method;
    const remaining = payload.summary?.remaining ?? 0;

    setNotice(
      remaining > 0
        ? `${label} encaissé partiellement — ${formatMoney(amount, restaurant.currency)} en ${methodLabel}, reste ${formatMoney(remaining, restaurant.currency)}.`
        : `${label} encaissé — ${formatMoney(amount, restaurant.currency)} en ${methodLabel}.`,
    );
    pushToast(
      remaining > 0
        ? `${label} encaissé partiellement`
        : `${label} encaissé`,
    );
    setPaymentAmount("");
    await loadData();
  }

  const selectedOrderItems = useMemo(() => currentOrder?.items ?? [], [currentOrder]);
  const currentParticipants = useMemo(
    () => splitDraft?.participants ?? tableSession?.participants ?? [],
    [splitDraft, tableSession],
  );
  const effectiveSelectedClientId =
    selectedTarget === "takeaway"
      ? "shared"
      : manualSelectedClientId !== "shared" &&
          currentParticipants.some((participant) => participant.id === manualSelectedClientId)
        ? manualSelectedClientId
        : currentParticipants[0]?.id ?? "shared";
  const orderSplitSummary = useMemo(() => {
    const sharedTotal = selectedOrderItems
      .filter((item) => !item.assignedClientId)
      .reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);

    return currentParticipants.map((participant) => {
      const total = selectedOrderItems
        .filter((item) => item.assignedClientId === participant.id)
        .reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);

      return {
        id: participant.id,
        name: participant.name,
        total,
      };
    }).concat([
      {
        id: "shared",
        name: "Partagé",
        total: sharedTotal,
      },
    ]);
  }, [currentParticipants, selectedOrderItems]);

  function updateSplitParticipant(
    participantId: string,
    patch: Partial<{
      name: string;
      sharePercent: number;
      settledAmount: number;
      note: string;
      customerId: string | null;
    }>,
  ) {
    setSplitDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        participants: current.participants.map((participant) =>
          participant.id === participantId ? { ...participant, ...patch } : participant,
        ),
      };
    });
  }

  function addSplitParticipant() {
    setSplitDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        guestCount: Math.max(1, current.participants.length + 1),
        participants: [
          ...current.participants,
          {
            id: createId("participant"),
            customerId: null,
            name: `Invité ${current.participants.length + 1}`,
            sharePercent: 0,
            settledAmount: 0,
            note: "",
          },
        ],
      };
    });
  }

  function removeSplitParticipant(participantId: string) {
    setSplitDraft((current) => {
      if (!current) return current;

      const nextParticipants = current.participants.filter((participant) => participant.id !== participantId);
      return {
        ...current,
        guestCount: Math.max(1, nextParticipants.length),
        participants: nextParticipants,
      };
    });
  }

  async function saveSplitDraft() {
    if (!tableSession || !splitDraft) return;
    const saved = await patchTableSession({
      guestCount: splitDraft.guestCount,
      tableId: splitDraft.tableId ?? null,
      note: splitDraft.note ?? "",
      participants: splitDraft.participants,
    });

    if (!saved) {
      return;
    }

    setNotice("Répartition enregistrée.");
    pushToast("Répartition enregistrée.");
  }

  return (
    <main className={theme === "food" ? "food-theme mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 pb-32 sm:px-4 lg:px-6 lg:pb-28" : "internal-dark mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 pb-32 sm:px-4 lg:px-6 lg:pb-28"}>
      <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
            <h1 className="font-display text-4xl">{restaurant.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {orderFlowEnabled ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5"
              >
                {notificationPermission === "granted"
                  ? "Notifications activées"
                  : "Activer notifications"}
              </button>
            ) : null}
            {orderFlowEnabled ? (
              <span className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-black/65">
                {notificationPermission === "granted"
                  ? "Notifications browser actives"
                  : notificationPermission === "denied"
                    ? "Notifications bloquées"
                    : "Notifications disponibles"}
              </span>
            ) : null}
          </div>
        </div>
        {notice ? <p className="mt-3 text-sm text-black/60">{notice}</p> : null}
      </section>

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-[1.4rem] border px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em]">
            {toast.type === "success" ? "Succès" : "Erreur"}
          </p>
          <p className="mt-1 text-sm leading-6">{toast.message}</p>
        </div>
      ) : null}

      {orderFlowEnabled ? (
        <section id="staff-alerts" className="mt-4 grid grid-cols-3 gap-2 scroll-mt-28 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              if (firstTableWithQrOrder) {
                setSelectedTarget(firstTableWithQrOrder.id);
                navigateStaff("tables", "staff-bon", "alerts");
              }
            }}
            className="min-h-[8.5rem] rounded-[1.2rem] border border-amber-200 bg-amber-50 p-2 text-left text-amber-950 transition hover:bg-amber-100 sm:p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700 sm:text-[11px] sm:tracking-[0.32em]">Alertes QR</p>
            <p className="mt-1 text-xl font-semibold sm:text-2xl">{alertSummary.qrOrders}</p>
            <p className="hidden text-sm text-amber-800/80 sm:block">Commandes clientes à valider.</p>
            {firstTableWithQrOrder ? (
              <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-900 sm:text-xs sm:tracking-[0.22em]">
                {firstTableWithQrOrder.name}
              </p>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              if (firstTableWithWaiterCall) {
                setSelectedTarget(firstTableWithWaiterCall.id);
                void markWaiterCallsReadForTable(firstTableWithWaiterCall.id);
                navigateStaff("tables", "staff-bon", "alerts");
              }
            }}
            className="min-h-[8.5rem] rounded-[1.2rem] border border-rose-200 bg-rose-50 p-2 text-left text-rose-950 transition hover:bg-rose-100 sm:p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-rose-700 sm:text-[11px] sm:tracking-[0.32em]">Appels serveur</p>
            <p className="mt-1 text-xl font-semibold sm:text-2xl">{alertSummary.waiterCalls}</p>
            <p className="hidden text-sm text-rose-800/80 sm:block">Messages en attente sur les tables.</p>
            {firstTableWithWaiterCall ? (
              <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-900 sm:text-xs sm:tracking-[0.22em]">
                {firstTableWithWaiterCall.name}
              </p>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              if (firstReadyOrder?.tableId) {
                setSelectedTarget(firstReadyOrder.tableId);
                navigateStaff("tables", "staff-bon", "tables");
              }
            }}
            className="min-h-[8.5rem] rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-2 text-left text-emerald-950 transition hover:bg-emerald-100 sm:p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700 sm:text-[11px] sm:tracking-[0.32em]">Prêtes</p>
            <p className="mt-1 text-xl font-semibold sm:text-2xl">{alertSummary.readyOrders}</p>
            <p className="hidden text-sm text-emerald-800/80 sm:block">À servir rapidement.</p>
            {firstReadyOrder ? (
              <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-900 sm:text-xs sm:tracking-[0.22em]">
                {currentTables.find((table) => table.id === firstReadyOrder.tableId)?.name ?? "Table"}
              </p>
            ) : null}
          </button>
        </section>
      ) : null}

      {orderFlowEnabled ? (
        <section className="mt-3 grid gap-3 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-3 text-amber-950 shadow-[0_8px_24px_rgba(217,119,6,0.08)] sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-700 sm:text-[11px]">Commandes QR</p>
                <p className="mt-1 text-sm font-medium text-amber-950">Commandes anonymes en attente de validation.</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                {alertSummary.qrOrders}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {pendingClientOrders.slice(0, 4).length === 0 ? (
                <p className="rounded-2xl border border-amber-200 bg-white/80 px-3 py-3 text-sm text-amber-800/70">
                  Aucune commande QR en attente.
                </p>
              ) : (
                pendingClientOrders.slice(0, 4).map((order) => {
                  const tableName = currentTables.find((table) => table.id === order.tableId)?.name ?? "Table";
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        if (order.tableId) {
                          setSelectedTarget(order.tableId);
                          navigateStaff("tables", "staff-bon", "alerts");
                        }
                      }}
                      className="w-full rounded-[1.1rem] border border-amber-200 bg-white px-3 py-3 text-left text-amber-950 transition hover:bg-amber-100"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{tableName}</p>
                          <p className="mt-1 text-xs text-amber-800/70">
                            {order.items.length} article{order.items.length > 1 ? "s" : ""} · {formatMoney(orderTotal(order), restaurant.currency)}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          Ouvrir
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-3 text-rose-950 shadow-[0_8px_24px_rgba(244,63,94,0.08)] sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-rose-700 sm:text-[11px]">Appels serveur</p>
                <p className="mt-1 text-sm font-medium text-rose-950">Demandes client à traiter rapidement.</p>
              </div>
              <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-800">
                {alertSummary.waiterCalls}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {messages.filter((message) => message.status === "new").slice(0, 4).length === 0 ? (
                <p className="rounded-2xl border border-rose-200 bg-white/80 px-3 py-3 text-sm text-rose-800/70">
                  Aucun appel serveur en attente.
                </p>
              ) : (
                messages
                  .filter((message) => message.status === "new")
                  .slice(0, 4)
                  .map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => {
                        if (message.tableId) {
                          setSelectedTarget(message.tableId);
                          navigateStaff("tables", "staff-bon", "alerts");
                        }
                      }}
                      className="w-full rounded-[1.1rem] border border-rose-200 bg-white px-3 py-3 text-left text-rose-950 transition hover:bg-rose-100"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{message.tableLabel ?? "Table"}</p>
                          <p className="mt-1 text-xs text-rose-800/70">{message.name}</p>
                        </div>
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                          Ouvrir
                        </span>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </article>
        </section>
      ) : null}

      {orderFlowEnabled ? (
        <div
          className={`fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[46rem] -translate-x-1/2 rounded-[1.75rem] border px-2 py-2 shadow-[0_16px_45px_rgba(0,0,0,0.38)] backdrop-blur ${
            isFoodTheme
              ? "border-[#eadfce] bg-[#fffdf8]/96"
              : "border-black/10 bg-[#0f0f0f]/96"
          }`}
        >
          <div className={`grid gap-1 ${bookingEnabled ? "grid-cols-4" : "grid-cols-3"}`}>
            {bookingEnabled ? (
              <button
                type="button"
                onClick={() => {
                  navigateStaff("reservations", "staff-reservations", "reservations");
                }}
                className={`flex flex-col items-center justify-center rounded-[1.2rem] border px-2 py-2 text-[11px] font-medium transition ${
                  staffQuickNav === "reservations"
                    ? isFoodTheme
                      ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                      : "border-white bg-white text-black"
                    : isFoodTheme
                      ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                      : "border-white/8 bg-white/5 text-white/78 hover:bg-white/10"
                }`}
              >
                <span className="text-base leading-none">📅</span>
                <span className="mt-1">Réserv.</span>
              </button>
            ) : null}
              <button
                type="button"
                onClick={() => {
                  navigateStaff(staffTab, "staff-alerts", "alerts");
                }}
                className={`flex flex-col items-center justify-center rounded-[1.2rem] border px-2 py-2 text-[11px] font-medium transition ${
                staffQuickNav === "alerts"
                  ? isFoodTheme
                    ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                    : "border-white bg-white text-black"
                  : isFoodTheme
                    ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                    : "border-white/8 bg-white/5 text-white/78 hover:bg-white/10"
                }`}
              >
              <span className="text-base leading-none">⚠️</span>
              <span className="mt-1">Alertes</span>
            </button>
              <button
                type="button"
                onClick={() => {
                  navigateStaff("tables", "staff-bon", "tables");
                }}
                className={`flex flex-col items-center justify-center rounded-[1.2rem] border px-2 py-2 text-[11px] font-medium transition ${
                staffQuickNav === "tables"
                  ? isFoodTheme
                    ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                    : "border-white bg-white text-black"
                  : isFoodTheme
                    ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                    : "border-white/8 bg-white/5 text-white/78 hover:bg-white/10"
                }`}
              >
              <span className="text-base leading-none">🪑</span>
              <span className="mt-1">Tables</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigateStaff("menu", "staff-menu", "menu");
              }}
              className={`flex flex-col items-center justify-center rounded-[1.2rem] border px-2 py-2 text-[11px] font-medium transition ${
                staffQuickNav === "menu"
                  ? isFoodTheme
                    ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                    : "border-white bg-white text-black"
                  : isFoodTheme
                    ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                    : "border-white/8 bg-white/5 text-white/78 hover:bg-white/10"
                }`}
            >
              <span className="text-base leading-none">📖</span>
              <span className="mt-1">Menu</span>
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        {bookingEnabled && staffTab === "reservations" ? (
        <div id="staff-reservations" className="space-y-4 xl:col-span-2 scroll-mt-28">
          <form
            onSubmit={submitReservation}
            className="rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Réservation</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#24170f]">Créer une réservation</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f5b4a]">
                  Même logique que côté client: date, personnes, heure, puis coordonnées. La disponibilité est partagée avec le flux public.
                </p>
              </div>
              <div className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7f6c5a]">
                {formatMonthLabel(bookingDisplayMonth)}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                <section className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Date</p>
                      <h3 className="mt-1 text-xl font-semibold text-[#24170f]">{bookingSelectedDateLabel}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingPickerMode("date")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f] transition hover:bg-white"
                    >
                      <span aria-hidden>🗓️</span>
                      Choisir
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#6f5b4a]">Sélection via calendrier, sans champ date natif.</p>
                </section>

                <section className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Personnes</p>
                      <h3 className="mt-1 text-xl font-semibold text-[#24170f]">Persons {form.guestCount}</h3>
                    </div>
                    <p className="text-sm text-[#6f5b4a]">{bookingTablesNeeded} table(s) nécessaires</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.3rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, guestCount: Math.max(1, current.guestCount - 1), time: "" }))}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f] transition hover:bg-[#faf7f2]"
                    >
                      ‹
                    </button>
                    <div className="text-center">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#a38d7c]">Guests</p>
                      <p className="text-3xl font-semibold leading-none text-[#24170f]">{form.guestCount}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, guestCount: current.guestCount + 1, time: "" }))}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f] transition hover:bg-[#faf7f2]"
                    >
                      ›
                    </button>
                  </div>
                </section>

                <section className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Heure</p>
                      <h3 className="mt-1 text-xl font-semibold text-[#24170f]">{form.time || 'Choisir une heure'}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingPickerMode("time")}
                      disabled={!form.date}
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-2 text-sm font-medium text-[#24170f] transition hover:bg-white disabled:opacity-40"
                    >
                      <span aria-hidden>🕒</span>
                      Slots
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#6f5b4a]">
                    {bookingAvailableSlots.length > 0
                      ? `${bookingAvailableSlots.length} créneau(x) disponible(s) pour ${bookingTablesNeeded} table(s).`
                      : form.date
                        ? 'Aucun créneau disponible pour cette configuration.'
                        : 'Choisir d’abord une date.'}
                  </p>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Coordonnées</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder="Prénom"
                      value={form.firstName}
                      onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                      className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                    />
                    <input
                      placeholder="Nom"
                      value={form.lastName}
                      onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                      className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                    />
                    <div className="flex overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffdf8] sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => setBookingPickerMode("country")}
                        className="flex min-w-[8.75rem] items-center justify-between gap-2 border-r border-[#eadfce] bg-white px-3 py-3 text-left text-sm text-[#24170f] outline-none transition hover:bg-[#faf7f2]"
                      >
                        <span className="truncate">{bookingSelectedCountry?.code} {bookingSelectedCountry?.dialCode}</span>
                        <span className="text-xs text-[#a38d7c]">▾</span>
                      </button>
                      <input
                        placeholder="Téléphone"
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        className="min-w-0 flex-1 bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                      />
                    </div>
                    <input
                      placeholder="E-mail"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none sm:col-span-2"
                    />
                  </div>
                  <textarea
                    placeholder="Allergies, terrasse, anniversaire, service rapide..."
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    rows={4}
                    className="mt-3 w-full rounded-[1.5rem] border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none"
                  />
                </section>

                <section className="rounded-[1.6rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_35px_rgba(124,77,44,0.05)]">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Résumé</p>
                  <div className="mt-3 space-y-3 rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-4 text-sm text-[#6f5b4a]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Date</span>
                      <span className="font-medium text-[#24170f]">{bookingSelectedDateLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Heure</span>
                      <span className="font-medium text-[#24170f]">{form.time || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Persons</span>
                      <span className="font-medium text-[#24170f]">{form.guestCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Tables libres</span>
                      <span className="font-medium text-[#24170f]">
                        {bookingSelectedDay?.slots.find((slot) => slot.time === form.time)?.availableTables ?? '—'}
                      </span>
                    </div>
                  </div>
                  <button className="mt-4 rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-5 py-3 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)]">
                    Ajouter
                  </button>
                </section>
              </div>
            </div>
          </form>

          {bookingPickerMode ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
              <div className="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 shadow-[0_30px_110px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-2rem)] sm:p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[#eadfce] pb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">{bookingPickerMode === 'date' ? 'Calendrier' : bookingPickerMode === 'time' ? 'Créneaux' : 'Indicatif'}</p>
                    <h3 className="mt-1 text-2xl font-semibold text-[#24170f]">
                      {bookingPickerMode === 'date' ? formatMonthLabel(bookingDisplayMonth) : bookingPickerMode === 'time' ? bookingSelectedDateLabel : 'Choisir un pays'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookingPickerMode(null)}
                    className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
                  >
                    Fermer
                  </button>
                </div>

                <div className="mt-4 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1">
                {bookingPickerMode === 'date' ? (
                  <div>
                    <div className="mb-3 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setBookingDisplayMonth((current) => addMonths(current, -1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]">‹</button>
                      <button type="button" onClick={() => setBookingDisplayMonth((current) => addMonths(current, 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl text-[#24170f]">›</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {['DIM.','LUN.','MAR.','MER.','JEU.','VEN.','SAM.'].map((label) => (
                        <div key={label} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a38d7c] sm:text-[11px]">{label}</div>
                      ))}
                      {bookingCalendarDays.map((day) => {
                        const dayKey = formatDateKey(day);
                        const dayInfo = bookingAvailabilityMap.get(dayKey) ?? null;
                        const isSelected = form.date === dayKey;
                        const isCurrent = isSameMonth(day, bookingDisplayMonth);
                        const hasSlots = !!dayInfo && dayInfo.slots.some((slot) => slot.availableTables >= bookingTablesNeeded);
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => isCurrent && dayInfo ? selectBookingDate(dayKey) : undefined}
                            disabled={!isCurrent || !dayInfo}
                            className={`relative flex min-h-[4rem] flex-col overflow-hidden rounded-2xl border p-1.5 text-left transition sm:min-h-[5rem] sm:p-2 ${
                              isSelected
                                ? 'border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_30px_rgba(118,162,104,0.14)]'
                                : !isCurrent || !dayInfo
                                  ? 'border-[#eadfce] bg-[#f7f2ea] text-[#c8b7a6]'
                                  : hasSlots
                                    ? 'border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]'
                                    : 'border-[#eadfce] bg-[#f7f2ea] text-[#b8a492]'
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-[0.16em] opacity-70 sm:text-[11px]">{formatShortWeekday(day)}</span>
                            <span className="mt-1 text-base font-semibold leading-none sm:text-xl">{formatDayNumber(day)}</span>
                            <span className="mt-auto flex items-center gap-1 text-[10px] leading-none sm:text-[11px]">
                              <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white' : hasSlots ? 'bg-emerald-500' : 'bg-[#d8cabc]'}`} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : bookingPickerMode === 'time' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {bookingAvailableSlots.length === 0 ? (
                      <p className="col-span-3 rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-4 text-sm text-[#6f5b4a]">
                        Aucun créneau disponible pour cette configuration.
                      </p>
                    ) : (
                      bookingAvailableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => selectBookingTime(slot.time)}
                          className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                            form.time === slot.time
                              ? 'border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)]'
                              : 'border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]'
                          }`}
                        >
                          <p className="text-lg font-semibold">{slot.time}</p>
                          <p className={`mt-1 text-xs ${form.time === slot.time ? 'text-[#355533]' : 'text-[#6f5b4a]'}`}>
                            {slot.availableTables} table(s) libres
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      value={bookingCountryQuery}
                      onChange={(event) => setBookingCountryQuery(event.target.value)}
                      placeholder="Rechercher un pays ou un indicatif"
                      className="w-full rounded-[1.25rem] border border-[#eadfce] bg-white px-4 py-3 text-sm text-[#24170f] outline-none"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {bookingVisibleCountries.map((entry) => (
                        <button
                          key={entry.code}
                          type="button"
                          onClick={() => {
                            setBookingPhoneCountry(entry.code);
                            setBookingPickerMode(null);
                            setBookingCountryQuery("");
                          }}
                          className={`rounded-[1.15rem] border px-4 py-3 text-left transition ${
                            bookingPhoneCountry === entry.code
                              ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)]"
                              : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                          }`}
                        >
                          <p className="text-sm font-semibold">{entry.label}</p>
                          <p className={`mt-1 text-xs ${bookingPhoneCountry === entry.code ? "text-[#355533]" : "text-[#7f6c5a]"}`}>
                            {entry.code} · {entry.dialCode}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2"> 
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
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  reservationFilter === filter.key
                    ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                    : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {visibleReservations.map((reservation) => {
              const notificationProvider = restaurant.features.notificationProvider;
              const notificationMessage = buildWhatsAppReservationMessage({
                restaurantName: restaurant.name,
                firstName: reservation.firstName,
                lastName: reservation.lastName,
                guestCount: reservation.guestCount,
                time: reservation.time,
                dateLabel: new Intl.DateTimeFormat("fr-FR", {
                  day: "2-digit",
                  month: "long",
                }).format(new Date(`${reservation.date}T12:00:00`)),
              });
              const notificationUrl = buildNotificationLink({
                provider: notificationProvider,
                phoneNumber: restaurant.whatsappNumber,
                message: notificationMessage,
              });
              const notificationLabel = buildNotificationLabel(notificationProvider);

              return (
                <article
                  key={reservation.id}
                  className="rounded-[1.5rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold">
                        {reservation.firstName} {reservation.lastName}
                      </p>
                      <p className="text-sm text-black/60">
                        {formatDate(reservation.date)} • {reservation.time} • {reservation.guestCount} pers.
                      </p>
                      <p className="mt-1 text-sm text-black/60">
                        {reservation.phone} • {reservation.email || "—"}
                      </p>
                      <p className="mt-2 text-sm text-black/70">{reservation.note || "—"}</p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                          reservationStatusMeta(reservation.status).className
                        }`}
                      >
                        {reservationStatusMeta(reservation.status).label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reservation.status !== "confirmed" ? (
                        <button
                          type="button"
                          onClick={() => mutateReservation(reservation.id, "confirmed")}
                          className="rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-3 py-2 text-xs font-medium text-[#1f2b1f]"
                        >
                          Confirmer
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => mutateReservation(reservation.id, "cancelled")}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => mutateReservation(reservation.id, "no_show")}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                      >
                        No show
                      </button>
                      <button
                        type="button"
                        onClick={() => mutateReservation(reservation.id, "delete")}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                      >
                        Supprimer
                      </button>
                      <a
                        href={`mailto:${encodeURIComponent(reservation.email)}?subject=Réservation&body=${encodeURIComponent(
                          `Bonjour ${reservation.firstName} ${reservation.lastName},\n\nVotre réservation a été prise en compte.\n`,
                        )}`}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                      >
                        Email
                      </a>
                      {notificationProvider === "twilio" ? (
                        <span className="rounded-full border border-black/10 bg-black/4 px-3 py-2 text-xs font-medium text-black/60">
                          SMS auto via Twilio
                        </span>
                      ) : notificationUrl ? (
                        <a
                          href={notificationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-3 py-2 text-xs font-medium text-[#1f2b1f]"
                        >
                          {notificationLabel || "Notification"}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        ) : null}

        {staffTab === "tables" ? (
          <div className="space-y-4 xl:col-span-2">
            <section
              id="staff-tables"
              className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] scroll-mt-28"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Commandes client</p>
                  <h2 className="text-xl font-semibold sm:text-2xl">À valider au service</h2>
                  <p className="mt-1 text-sm text-black/60">
                    Le serveur confirme physiquement la commande avant l’envoi en cuisine.
                  </p>
                </div>
                <span className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                  {pendingClientOrders.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {pendingClientOrders.length === 0 ? (
                  <p className="rounded-2xl border border-black/8 bg-black/2 p-4 text-sm text-black/55">
                    Aucune commande en attente.
                  </p>
                ) : (
                  pendingClientOrders.map((order) => {
                    const total = order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
                    return (
                      <article key={order.id} className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                              {order.tableId
                                ? currentTables.find((table) => table.id === order.tableId)?.name ?? "Table"
                                : "Table"}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold">Commande QR</h3>
                            <p className="text-sm text-black/60">{order.items.length} articles</p>
                          </div>
                          <p className="text-sm font-semibold text-black">
                            {formatMoney(total, restaurant.currency)}
                          </p>
                        </div>
                        <div className="mt-3 rounded-2xl border border-black/8 bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Détail</p>
                          <div className="mt-2 space-y-1.5">
                            {order.items.slice(0, 4).map((item) => (
                              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-black">
                                    {item.quantity} × {item.nameSnapshot}
                                  </p>
                                  <p className="truncate text-xs text-black/55">
                                    {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                                    {item.note ? ` · ${item.note}` : ""}
                                  </p>
                                </div>
                                <p className="shrink-0 font-semibold text-black/80">
                                  {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                                </p>
                              </div>
                            ))}
                            {order.items.length > 4 ? (
                              <p className="text-xs text-black/45">+ {order.items.length - 4} autres articles</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void updateOrderStatus(order.id, "sent_to_kitchen")}
                            className={isFoodTheme ? "rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-3 py-2 text-xs font-medium text-[#1f2b1f]" : "rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"}
                          >
                            Confirmer et envoyer
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateOrderStatus(order.id, "cancelled")}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                          >
                            Refuser
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {orderFlowEnabled ? (
              <section
                id="staff-bon"
                className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] scroll-mt-28"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Tables & bon</p>
                    <h2 className="text-xl font-semibold sm:text-2xl">Sélection rapide</h2>
                    <p className="mt-1 text-sm text-black/55">
                      Bon ciblé: <span className="font-semibold text-black">{currentTargetLabel}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setStaffTab("menu")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-black/3"
                    >
                      Menu
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTarget("takeaway")}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                        selectedTarget === "takeaway"
                          ? isFoodTheme
                            ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                            : "border-black bg-black text-white"
                          : isFoodTheme
                            ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                            : "border-black/10 bg-white text-black hover:bg-black/3"
                      }`}
                    >
                      À emporter
                    </button>
                    <button
                      type="button"
                      onClick={() => loadData()}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Rafraîchir
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                  {currentTables.map((table) => {
                    const openOrder = orders.find((order) => {
                      if (!isActiveOrder(order)) return false;
                      return (order.source === "table" || order.source === "qr") && order.tableId === table.id;
                    });
                    const tableAlerts =
                      (pendingClientOrdersByTable[table.id] ?? 0) + (waiterCallsByTable[table.id] ?? 0);
                    const tableModalHref = `/staff?restaurantSlug=${encodeURIComponent(restaurant.slug)}&table=${encodeURIComponent(table.id)}`;
                    return (
                      <a
                        key={table.id}
                        href={tableModalHref}
                        data-testid={`staff-table-card-${table.id}`}
                        onClick={() => {
                          setSelectedTableModalId(table.id);
                          setSelectedTableModalView("bon");
                          setSelectedTarget(table.id);
                          if ((waiterCallsByTable[table.id] ?? 0) > 0) {
                            void markWaiterCallsReadForTable(table.id);
                          }
                        }}
                        className={`min-h-[7rem] rounded-[1.15rem] border p-2.5 text-left transition sm:p-3 ${
                          selectedTarget === table.id || selectedTarget === openOrder?.id
                            ? isFoodTheme
                              ? "border-[#f0cbc8] bg-[#fff3f0] text-[#24170f] shadow-[0_12px_30px_rgba(196,30,30,0.08)]"
                              : "border-transparent bg-black text-white shadow-lg"
                            : tableAlerts > 0
                              ? isFoodTheme
                                ? "border-[#f0cbc8] bg-[#fffaf7] text-[#24170f] hover:bg-[#fff3f0]"
                                : "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100"
                              : isFoodTheme
                                ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                                : "border-black/8 bg-black/2 text-black hover:bg-black/4"
                        }`}
                      >
                        <span className={`block text-[9px] uppercase tracking-[0.26em] sm:text-[10px] ${isFoodTheme ? "text-[#a38d7c]" : "opacity-70"}`}>
                          {table.zone}
                        </span>
                        <span className={`mt-1 block text-sm font-semibold sm:text-base ${isFoodTheme ? "text-[#24170f]" : ""}`}>{table.name}</span>
                        <span className={`mt-1 block text-[11px] sm:text-xs ${isFoodTheme ? "text-[#7f6c5a]" : "opacity-80"}`}>{table.seats} places</span>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            title={openOrder ? "Ouvert" : "Libre"}
                            aria-label={openOrder ? "Ouvert" : "Libre"}
                            className={`h-2.5 w-2.5 rounded-full border ${
                              openOrder
                                ? isFoodTheme
                                  ? "border-[#24170f] bg-[#24170f]"
                                  : "border-white bg-white"
                                : isFoodTheme
                                  ? "border-[#eadfce] bg-[#eadfce]"
                                  : "border-black/20 bg-white"
                            }`}
                          />
                          {openOrder ? (
                            <span
                              title={orderStatusMeta(openOrder.status).label}
                              aria-label={orderStatusMeta(openOrder.status).label}
                              className={`h-2.5 w-2.5 rounded-full border ${
                                isFoodTheme ? "border-[#c41e1e] bg-[#c41e1e]" : orderStatusMeta(openOrder.status).className
                              }`}
                            />
                          ) : null}
                          {tableAlerts > 0 ? (
                            <span
                              title={`${tableAlerts} alerte${tableAlerts > 1 ? "s" : ""}`}
                              aria-label={`${tableAlerts} alerte${tableAlerts > 1 ? "s" : ""}`}
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[9px] font-semibold leading-none text-white shadow-[0_8px_20px_rgba(244,63,94,0.25)]"
                            >
                              {tableAlerts}
                            </span>
                          ) : null}
                          {pendingClientOrdersByTable[table.id] ? (
                            <span
                              title={`${pendingClientOrdersByTable[table.id]} commande QR`}
                              aria-label={`${pendingClientOrdersByTable[table.id]} commande QR`}
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[9px] font-semibold leading-none text-amber-900"
                            >
                              {pendingClientOrdersByTable[table.id]}
                            </span>
                          ) : null}
                        </div>
                      </a>
                    );
                  })}
                </div>

                {selectedTableModal ? (
                  <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:py-4">
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={`Table ${selectedTableModal.name}`}
                      data-testid="staff-table-modal"
                      className="relative w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[1.8rem] border border-[#eadfce] bg-[#fffdf8] shadow-[0_30px_110px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-2rem)]"
                    >
                      <a
                        href={`/staff?restaurantSlug=${encodeURIComponent(restaurant.slug)}`}
                        className="absolute right-4 top-4 z-10 rounded-full border border-[#eadfce] bg-white px-3 py-2 text-sm font-semibold text-[#24170f] shadow-sm"
                        aria-label="Fermer"
                        onClick={() => setSelectedTableModalId(null)}
                      >
                        ×
                      </a>
                      <div className="grid max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto lg:grid-cols-[1.08fr_0.92fr]">
                        <div className="space-y-4 p-4 text-[#24170f] sm:p-6">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">
                              Table
                            </p>
                            <h3 className="mt-2 text-3xl font-semibold text-[#24170f]">{selectedTableModal.name}</h3>
                            <p className="mt-2 text-sm text-[#7f6c5a]">
                              {selectedTableModal.zone} · {selectedTableModal.seats} places
                            </p>
                          </div>

                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {[
                              {
                                label: "Alertes",
                                value:
                                  (pendingClientOrdersByTable[selectedTableModal.id] ?? 0) +
                                  (waiterCallsByTable[selectedTableModal.id] ?? 0),
                              },
                              {
                                label: "QR",
                                value: pendingClientOrdersByTable[selectedTableModal.id] ?? 0,
                              },
                              {
                                label: "Appels",
                                value: waiterCallsByTable[selectedTableModal.id] ?? 0,
                              },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() =>
                                  jumpToTableModalSection(
                                    item.label === "QR" ? "qr" : item.label === "Appels" ? "calls" : "bons",
                                  )
                                }
                                className="min-w-[6rem] flex-1 rounded-[1.25rem] border border-[#eadfce] bg-white px-3 py-3 text-center transition hover:bg-[#faf7f2]"
                              >
                                <p className="text-[10px] uppercase tracking-[0.28em] text-[#a38d7c]">{item.label}</p>
                                <p className="mt-2 text-lg font-semibold text-[#24170f]">{item.value}</p>
                              </button>
                            ))}
                          </div>

                          <div className="space-y-3">
                          {selectedTableModalOpenOrder ? (
                            <div className="rounded-[1.5rem] border border-[#eadfce] bg-gradient-to-br from-[#fff7f2] via-[#fffaf8] to-[#fff0e7] p-3 shadow-[0_10px_30px_rgba(124,77,44,0.06)] sm:p-4">
                              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Bon du jour</p>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {[
                                  {
                                    label: "Total",
                                    value: formatMoney(orderTotal(selectedTableModalOpenOrder), restaurant.currency),
                                  },
                                  {
                                    label: "Déjà payé",
                                    value: formatMoney(
                                      paidTotalForOrder(payments, selectedTableModalOpenOrder.id),
                                      restaurant.currency,
                                    ),
                                  },
                                  {
                                    label: "Reste",
                                    value: formatMoney(
                                      Math.max(
                                        0,
                                        orderTotal(selectedTableModalOpenOrder) -
                                          paidTotalForOrder(payments, selectedTableModalOpenOrder.id),
                                      ),
                                      restaurant.currency,
                                    ),
                                  },
                                ].map((entry) => (
                                  <div
                                    key={entry.label}
                                    className="rounded-[1.1rem] border border-[#eadfce] bg-white/85 px-3 py-2 text-left text-[#24170f] shadow-[0_6px_16px_rgba(124,77,44,0.05)]"
                                  >
                                    <p className="text-[9px] uppercase tracking-[0.24em] text-[#a38d7c]">
                                      {entry.label}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">{entry.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {selectedTableModalOpenOrder ? (
                            <div ref={tableBonsRef} className="rounded-[1.5rem] border border-[#eadfce] bg-white/82 p-3 shadow-[0_8px_18px_rgba(124,77,44,0.05)]">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">
                                    Bon actif
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-[#6f5b4a]">
                                    {orderStatusMeta(selectedTableModalOpenOrder.status).label}
                                  </p>
                                </div>
                                <span className="rounded-full border border-[#eadfce] bg-[#fffdf8] px-3 py-2 text-xs font-semibold text-[#24170f]">
                                  {selectedTableModalOpenOrder.items.length} article{selectedTableModalOpenOrder.items.length > 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="mt-3 space-y-2">
                                {selectedTableModalOpenOrder.items.length === 0 ? (
                                  <p className="rounded-[1.1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3 text-sm text-[#7f6c5a]">
                                    Aucun article sur ce bon pour le moment.
                                  </p>
                                ) : (
                                  selectedTableModalOpenOrder.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-start justify-between gap-3 rounded-[1.1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3 text-sm"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium text-[#24170f]">
                                          {item.quantity} × {item.nameSnapshot}
                                        </p>
                                        <p className="mt-1 text-xs text-[#7f6c5a]">
                                          {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                                          {item.note ? ` · ${item.note}` : ""}
                                        </p>
                                      </div>
                                      <p className="shrink-0 font-semibold text-[#24170f]">
                                        {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : null}

                          {selectedTableModalOpenOrder ? (
                            <div className="rounded-[1.5rem] border border-[#eadfce] bg-white/80 p-3 shadow-[0_8px_18px_rgba(124,77,44,0.05)]">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">
                                    Note du bon
                                  </p>
                                  <p className="mt-1 text-xs text-[#6f5b4a]">
                                    Note interne, allergies ou précisions pour le service.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void saveOrderNote(selectedTableModalOpenOrder.id, orderNote)}
                                  className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-3 py-2 text-xs font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)] transition hover:brightness-95"
                                >
                                  Sauver la note
                                </button>
                              </div>
                              <textarea
                                value={orderNote}
                                onChange={(event) => setOrderNote(event.target.value)}
                                rows={3}
                                className="mt-3 w-full rounded-[1.1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3 text-sm text-[#24170f] outline-none"
                                placeholder="Ex: client allergique, table tranquille, service rapide..."
                              />
                            </div>
                          ) : null}

                            {selectedTableModalOrders.length > 1 ? (
                              <div className="mt-3 rounded-[1.35rem] border border-[#eadfce] bg-white/75 p-3">
                                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">
                                  Bons de la table
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {selectedTableModalOrders.map((order, index) => (
                                    <button
                                      key={order.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedTarget(order.id);
                                        setSelectedTableModalView("bon");
                                      }}
                                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                        order.id === selectedTableModalOpenOrder?.id
                                          ? "border-[#1f2b1f] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f]"
                                          : "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                                      }`}
                                    >
                                      Bon {index + 1} · {orderStatusMeta(order.status).label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {selectedTableModalView === "bon" ? (
                            <>
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTarget(selectedTableModal.id);
                                    setSelectedTableModalView("menu");
                                    navigateStaff("menu", "staff-menu", "menu");
                                  }}
                                  className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)] transition hover:brightness-95"
                                >
                                  Ouvrir le menu
                                </button>
                                {selectedTableModalOpenOrder?.status === "open" ? (
                                  <button
                                    type="button"
                                    onClick={() => void updateOrderStatus(selectedTableModalOpenOrder.id, "sent_to_kitchen")}
                                    className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)] transition hover:brightness-95"
                                  >
                                    En cuisine
                                  </button>
                                ) : null}
                              </div>

                              {selectedTableModalOpenOrder ? (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-[#eadfce] bg-white/75 p-3 shadow-[0_8px_18px_rgba(124,77,44,0.05)]">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Actions rapides</p>
                                    <p className="mt-1 text-xs text-[#6f5b4a]">Passe en paiement après le service.</p>
                                  </div>
                                {selectedTableModalOpenOrder.status === "ready" || selectedTableModalOpenOrder.status === "served" ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (selectedTableModalOpenOrder.status === "ready") {
                                        const ok = await updateOrderStatus(selectedTableModalOpenOrder.id, "served");
                                        if (ok) {
                                          setSelectedTableModalView("payment");
                                        }
                                      } else {
                                        setSelectedTableModalView("payment");
                                      }
                                    }}
                                    className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)] transition hover:brightness-95"
                                  >
                                    Encaisser
                                  </button>
                                ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : null}

                          {selectedTableModalView === "payment" && selectedTableModalOpenOrder ? (
                            <div className="rounded-[1.35rem] border border-[#eadfce] bg-white/90 p-3 shadow-[0_8px_18px_rgba(124,77,44,0.05)]">
                              <div className="flex flex-col gap-3 border-b border-[#eadfce] pb-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Paiement</p>
                                  <h4 className="mt-1 text-lg font-semibold text-[#24170f]">Encaisser le bon</h4>
                                  <p className="mt-1 text-xs text-[#6f5b4a]">
                                    Paiement cash, carte ou partiel. Le bon reste ouvert tant que le restant n’est pas à 0.
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={`/staff?restaurantSlug=${encodeURIComponent(restaurant.slug)}&table=${encodeURIComponent(selectedTableModal.id)}`}
                                    className="rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-medium text-[#24170f] shadow-[0_6px_14px_rgba(124,77,44,0.04)] transition hover:bg-[#faf7f2]"
                                  >
                                    Revenir au bon
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => void closeOrderById(selectedTableModalOpenOrder.id, paymentMethod)}
                                    className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-medium text-[#1f2b1f] shadow-[0_10px_24px_rgba(127,170,118,0.16)] transition hover:brightness-95"
                                  >
                                    {Math.max(
                                      0,
                                      (selectedTableModalTaxSummary?.total ?? orderTotal(selectedTableModalOpenOrder)) -
                                        paidTotalForOrder(payments, selectedTableModalOpenOrder.id) -
                                        (Number(paymentAmount) > 0 ? Number(paymentAmount) : Math.max(
                                          0,
                                          (selectedTableModalTaxSummary?.total ?? orderTotal(selectedTableModalOpenOrder)) -
                                            paidTotalForOrder(payments, selectedTableModalOpenOrder.id),
                                        )),
                                    ) > 0
                                      ? "Enregistrer paiement"
                                      : "Encaisser et clôturer"}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                <div className="rounded-2xl border border-[#eadfce] bg-[#faf7f2] px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Sous-total</p>
                                  <p className="mt-1 text-sm font-semibold text-[#24170f]">
                                    {formatMoney(selectedTableModalTaxSummary?.subtotal ?? orderTotal(selectedTableModalOpenOrder), restaurant.currency)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[#eadfce] bg-[#faf7f2] px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">TVA nourriture</p>
                                  <p className="mt-1 text-sm font-semibold text-[#24170f]">
                                    {formatMoney(selectedTableModalTaxSummary?.foodTax ?? 0, restaurant.currency)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[#eadfce] bg-[#faf7f2] px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">TVA boissons</p>
                                  <p className="mt-1 text-sm font-semibold text-[#24170f]">
                                    {formatMoney(selectedTableModalTaxSummary?.drinkTax ?? 0, restaurant.currency)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[#eadfce] bg-[#faf7f2] px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Reste</p>
                                  <p className="mt-1 text-sm font-semibold text-[#24170f]">
                                    {formatMoney(
                                      Math.max(
                                        0,
                                        (selectedTableModalTaxSummary?.total ?? orderTotal(selectedTableModalOpenOrder)) -
                                          paidTotalForOrder(payments, selectedTableModalOpenOrder.id),
                                      ),
                                      restaurant.currency,
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <select
                                  value={paymentMethod}
                                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                                  className="rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs text-[#24170f]"
                                >
                                  <option value="cash">Cash</option>
                                  <option value="card">Carte</option>
                                  <option value="external">Externe</option>
                                  <option value="other">Autre</option>
                                </select>
                                <input
                                  value={paymentAmount}
                                  onChange={(event) => setPaymentAmount(event.target.value)}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder={Math.max(
                                    0,
                                    (selectedTableModalTaxSummary?.total ?? orderTotal(selectedTableModalOpenOrder)) -
                                      paidTotalForOrder(payments, selectedTableModalOpenOrder.id),
                                  ).toString()}
                                  className="w-28 rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs text-[#24170f]"
                                />
                                <span className="text-[11px] text-[#7f6c5a]">
                                  Méthode mémorisée pour le ticket et la facture.
                                </span>
                              </div>

                              <div className="mt-3 rounded-[1.25rem] border border-[#eadfce] bg-[#fbf7f1] p-3">
                                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Paiements enregistrés</p>
                                <div className="mt-2 space-y-2">
                                  {selectedTableModalPayments.length === 0 ? (
                                    <p className="rounded-2xl border border-[#eadfce] bg-white px-3 py-2 text-xs text-[#7f6c5a]">
                                      Aucun paiement pour ce bon.
                                    </p>
                                  ) : (
                                    selectedTableModalPayments.map((payment) => (
                                      <div
                                        key={payment.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadfce] bg-white px-3 py-2 text-xs text-[#24170f]"
                                      >
                                        <div>
                                          <p className="font-medium">
                                            {payment.method === "card"
                                              ? "Carte"
                                              : payment.method === "external"
                                                ? "Externe"
                                                : payment.method === "other"
                                                  ? "Autre"
                                                  : "Cash"}
                                          </p>
                                          <p className="text-[#7f6c5a]">
                                            {new Date(payment.createdAt).toLocaleTimeString("fr-FR", {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </p>
                                        </div>
                                        <p className="font-semibold">{formatMoney(payment.amount, restaurant.currency)}</p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4 rounded-[1.35rem] border border-[#eadfce] bg-white/85 p-3 shadow-[0_8px_18px_rgba(124,77,44,0.05)]">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Menu</p>
                                <p className="mt-1 text-xs text-[#6f5b4a]">
                                  Ajoute des plats directement à la table sélectionnée.
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <PublicMenuCategories
                                categories={restaurant.categories}
                                locale={locale}
                                accent={restaurant.accent}
                                restaurantSlug={restaurant.slug}
                                orderFlowEnabled={selectedTableModal !== null}
                                theme={theme === "food" ? "food" : "dark"}
                                actionLabel="Ajouter à la table"
                                showItemModal={false}
                                compact
                                testIdPrefix="staff-table-menu"
                                onItemAction={(item, categoryName) =>
                                  void addItemToTableRound({
                                    id: item.id,
                                    name: item.name,
                                    price: item.price,
                                    displayPrice: getMenuItemEffectivePrice(item),
                                  }, categoryName)
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-[#eadfce] bg-[#fffdf8] p-4 sm:p-6 lg:border-l lg:border-t-0">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]">Alertes détaillées</p>
                          <div className="mt-3 space-y-3">
                            {(() => {
                              const tablePendingOrders = pendingClientOrders.filter(
                                (order) => order.tableId === selectedTableModal.id,
                              );
                              const tableCalls = messages.filter((message) => {
                                if (message.status !== "new") return false;
                                if (message.tableId) return message.tableId === selectedTableModal.id;
                                const haystack = `${message.name} ${message.message}`.toLowerCase();
                                return haystack.includes(selectedTableModal.name.toLowerCase());
                              });

                              return (
                                <>
                                  {tablePendingOrders.length === 0 && tableCalls.length === 0 ? (
                                    <p className="rounded-2xl border border-[#eadfce] bg-[#faf7f2] p-4 text-sm text-[#7f6c5a]">
                                      Aucune alerte pour cette table.
                                    </p>
                                  ) : null}

                                  {tablePendingOrders.map((order) => (
                                    <article ref={tableQrRef} key={order.id} className="rounded-[1.25rem] border border-[#eadfce] bg-white p-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Commande QR</p>
                                          <h4 className="mt-1 text-base font-semibold text-[#24170f]">
                                            {order.items.length} articles
                                          </h4>
                                        </div>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {order.items.slice(0, 4).map((item) => (
                                          <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                            <div className="min-w-0">
                                              <p className="truncate font-medium text-[#24170f]">
                                                {item.quantity} × {item.nameSnapshot}
                                              </p>
                                              <p className="truncate text-xs text-[#7f6c5a]">
                                                {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                                                {item.note ? ` · ${item.note}` : ""}
                                              </p>
                                            </div>
                                            <p className="shrink-0 font-semibold text-[#24170f]/80">
                                              {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </article>
                                  ))}

                                  {tableCalls.map((message) => (
                                    <article ref={tableCallsRef} key={message.id} className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
                                      <p className="text-[11px] uppercase tracking-[0.28em] text-rose-700">Appel de table</p>
                                      <h4 className="mt-1 text-base font-semibold text-rose-950">{message.name}</h4>
                                      <p className="mt-2 text-sm leading-6 text-rose-900/80">{message.message}</p>
                                      <p className="mt-3 text-xs text-rose-800/60">{formatDateTime(message.createdAt)}</p>
                                    </article>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isFoodTheme && selectedTarget !== "takeaway" ? (
                  <div className="mt-4 rounded-[1.5rem] border border-black/8 bg-white/95 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.04)]">
                    <details open className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-black/35">
                            Réglages de table
                          </p>
                          <p className="mt-1 text-sm text-black/60">
                            Gestion rapide de la table et de la session active.
                          </p>
                        </div>
                        <span className="rounded-full border border-black/10 bg-black/4 px-3 py-1 text-[11px] font-medium text-black/70 transition group-open:bg-black group-open:text-white">
                          Avancé
                        </span>
                      </summary>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label className="grid gap-1.5">
                          <span className="text-[11px] uppercase tracking-[0.26em] text-black/40">
                            Table active
                          </span>
                          <select
                            value={splitDraft?.tableId ?? currentOrder?.tableId ?? selectedTarget}
                            onChange={async (event) => {
                              const nextTableId = event.target.value === "takeaway" ? null : event.target.value;
                              const base = splitDraft ?? tableSession;
                              if (!base) return;

                              await patchTableSession({
                                tableId: nextTableId,
                                guestCount: base.guestCount,
                                note: base.note ?? "",
                                participants: base.participants,
                              });
                              setSelectedTarget(nextTableId ?? "takeaway");
                              setStaffQuickNav("tables");
                              setPendingScrollTarget("staff-bon");
                            }}
                            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                          >
                            {selectedTarget === "takeaway" ? <option value="takeaway">À emporter</option> : null}
                            {currentTables.map((table) => (
                              <option key={table.id} value={table.id}>
                                {table.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[11px] uppercase tracking-[0.26em] text-black/40">
                            Couverts
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={splitDraft?.guestCount ?? tableSession?.guestCount ?? 1}
                            onChange={async (event) => {
                              const nextGuestCount = Math.max(1, Number(event.target.value || 1));
                              const base = splitDraft ?? tableSession;
                              if (!base) return;
                              setSplitDraft({
                                ...base,
                                guestCount: nextGuestCount,
                              });
                            }}
                            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                          />
                        </label>
                        <label className="grid gap-1.5 md:col-span-2">
                          <span className="text-[11px] uppercase tracking-[0.26em] text-black/40">
                            Note de table
                          </span>
                          <input
                            value={splitDraft?.note ?? tableSession?.note ?? ""}
                            onChange={(event) => {
                              const base = splitDraft ?? tableSession;
                              if (!base) return;
                              setSplitDraft({
                                ...base,
                                note: event.target.value,
                              });
                            }}
                            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                            placeholder="Ex: table proche terrasse, service lent, VIP..."
                          />
                        </label>
                        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTarget(currentTargetTable?.id ?? selectedTarget);
                              setStaffQuickNav("bon");
                              setPendingScrollTarget("staff-bon");
                            }}
                            className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                          >
                            Aller au bon courant
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveSplitDraft()}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                          >
                            Sauver réglages
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-3">
                    <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Articles</p>
                      <div className="mt-3 space-y-2">
                        {selectedOrderItems.length === 0 ? (
                          <p className="text-sm text-black/55">Aucun article pour le moment.</p>
                        ) : (
                          selectedOrderItems.map((item: OrderItem) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-white p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">
                                    {item.quantity} × {item.nameSnapshot}
                                  </p>
                                  <p className="text-xs text-black/55">{item.note || "—"}</p>
                                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-black/40">
                                    {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                                  </p>
                                </div>
                                <span className="text-sm font-medium">
                                  {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center rounded-full border border-black/10 bg-black/2">
                                  <button
                                    type="button"
                                    onClick={() => void changeItemQuantity(item.id, item.quantity - 1)}
                                    className="px-3 py-1 text-xs font-medium text-black"
                                  >
                                    −
                                  </button>
                                  <span className="border-x border-black/10 px-3 py-1 text-xs font-semibold">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void changeItemQuantity(item.id, item.quantity + 1)}
                                    className="px-3 py-1 text-xs font-medium text-black"
                                  >
                                    +
                                  </button>
                                </div>
                                {currentParticipants.length > 0 && selectedTarget !== "takeaway" ? (
                                  <select
                                    value={item.assignedClientId ?? "shared"}
                                    onChange={(event) =>
                                      void assignItemToClient(item.id, event.target.value)
                                    }
                                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black"
                                  >
                                    <option value="shared">Partagé</option>
                                    {currentParticipants.map((participant) => (
                                      <option key={participant.id} value={participant.id}>
                                        {participant.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => removeItemFromOrder(item.id)}
                                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black"
                                >
                                  Retirer
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {currentOrder && currentParticipants.length > 0 && selectedTarget !== "takeaway" ? (
                      <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                          Répartition actuelle
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {orderSplitSummary.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-black/8 bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
                                {entry.name}
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                {formatMoney(entry.total, restaurant.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-2xl border border-black/8 bg-white p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                                Réglage de table
                              </p>
                              <p className="mt-1 text-sm text-black/60">
                                Ajuste les parts, les montants réglés et les notes de service.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={addSplitParticipant}
                                className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                              >
                                Ajouter un invité
                              </button>
                              <button
                                type="button"
                                onClick={() => setSplitDraft(tableSession)}
                                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                              >
                                Réinitialiser
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <label className="grid gap-2">
                              <span className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                                Table active
                              </span>
                              <select
                                value={splitDraft?.tableId ?? currentOrder?.tableId ?? "takeaway"}
                                onChange={async (event) => {
                                  const nextTableId = event.target.value === "takeaway" ? null : event.target.value;
                                  if (!tableSession) return;
                                  const response = await fetch(
                                    `/api/restaurants/${restaurant.slug}/table-sessions/${tableSession.id}`,
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ tableId: nextTableId }),
                                    },
                                  );

                                  if (response.ok) {
                                    const payload = (await response.json()) as { tableSession: TableSession };
                                    setSplitDraft(payload.tableSession);
                                    setNotice("Table mise à jour.");
                                    pushToast("Table mise à jour.");
                                    await loadData();
                                  } else {
                                    setNotice("Impossible de modifier la table.");
                                    pushToast("Impossible de modifier la table.", "error");
                                  }
                                }}
                                className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                              >
                                <option value="takeaway">À emporter</option>
                                {currentTables.map((table) => (
                                  <option key={table.id} value={table.id}>
                                    {table.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-4 space-y-3">
                            {currentParticipants.map((participant) => (
                              <div key={participant.id} className="rounded-2xl border border-black/8 bg-black/2 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold">{participant.name}</p>
                                  <button
                                    type="button"
                                    onClick={() => removeSplitParticipant(participant.id)}
                                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                  <input
                                    value={participant.name}
                                    onChange={(event) =>
                                      updateSplitParticipant(participant.id, { name: event.target.value })
                                    }
                                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="Nom"
                                  />
                                  <input
                                    value={participant.sharePercent}
                                    onChange={(event) =>
                                      updateSplitParticipant(participant.id, {
                                        sharePercent: Number(event.target.value),
                                      })
                                    }
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="%"
                                  />
                                  <input
                                    value={participant.settledAmount}
                                    onChange={(event) =>
                                      updateSplitParticipant(participant.id, {
                                        settledAmount: Number(event.target.value),
                                      })
                                    }
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="Montant réglé"
                                  />
                                  <input
                                    value={participant.note || ""}
                                    onChange={(event) =>
                                      updateSplitParticipant(participant.id, { note: event.target.value })
                                    }
                                    className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="Note"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void saveSplitDraft()}
                              className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                            >
                              Enregistrer la répartition
                            </button>
                          </div>
                              </div>
                            </div>
                          ) : null}

                          <Field label="Note du bon">
                            <textarea
                        value={orderNote}
                        onChange={(event) => setOrderNote(event.target.value)}
                        rows={3}
                        className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none"
                        placeholder="Ex: client allergique, table tranquille, service rapide..."
                      />
                    </Field>

                    {selectedTarget !== "takeaway" && currentParticipants.length > 0 ? (
                      <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                            Client du prochain plat
                          </p>
                          <span className="text-xs text-black/50">Partagé si vide</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setManualSelectedClientId("shared")}
                            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                              effectiveSelectedClientId === "shared"
                                ? "border-black bg-black text-white"
                                : "border-black/10 bg-white text-black hover:bg-black/3"
                            }`}
                          >
                            Partagé
                          </button>
                          {currentParticipants.map((participant) => (
                            <button
                              key={participant.id}
                              type="button"
                              onClick={() => setManualSelectedClientId(participant.id)}
                              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                effectiveSelectedClientId === participant.id
                                  ? "border-black bg-black text-white"
                                  : "border-black/10 bg-white text-black hover:bg-black/3"
                              }`}
                            >
                              {participant.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-black/60">Total</p>
                        <p className="text-2xl font-semibold">
                          {formatMoney(currentOrderTotal, restaurant.currency)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm text-black/60">Déjà payé</p>
                        <p className="text-sm font-medium">{formatMoney(currentPaidTotal, restaurant.currency)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm text-black/60">Reste</p>
                        <p className="text-sm font-medium">{formatMoney(currentRemaining, restaurant.currency)}</p>
                      </div>
                      <p className="mt-4 text-xs text-black/50">
                        Encaissement disponible uniquement dans le modal de la table.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Module commande</p>
                <h3 className="mt-2 text-xl font-semibold">Flux désactivé</h3>
                <p className="mt-2 text-sm text-black/60">
                  Le restaurant a désactivé le module de commande. Les réservations et les messages restent
                  disponibles.
                </p>
              </section>
            )}
          </div>
        ) : null}

        {staffTab === "menu" && orderFlowEnabled ? (
          <div className="xl:col-span-2">
            <section
              id="staff-menu"
              className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] scroll-mt-28"
            >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Menu</p>
                    <h3 className="text-lg font-semibold sm:text-xl">Ajouter au bon</h3>
                    <p className="mt-1 text-sm text-black/55">
                      Ouvre un plat pour voir le détail, puis ajoute-le à{" "}
                      <span className="font-semibold text-black">{currentTargetLabel}</span>.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigateStaff("tables", "staff-bon", "tables");
                      }}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Choisir une table
                    </button>
                    <span className="rounded-full border border-black/8 bg-black/3 px-3 py-2 text-xs text-black/60">
                      Mode client par défaut
                    </span>
                  </div>
                </div>
              <div className="mt-4">
                <PublicMenuCategories
                  categories={restaurant.categories}
                  locale={locale}
                  accent={restaurant.accent}
                  restaurantSlug={restaurant.slug}
                  orderFlowEnabled={Boolean(selectedTableModal)}
                  theme={theme === "food" ? "food" : "dark"}
                  actionLabel={selectedTableModal ? "Ajouter à la table" : "Voir le plat"}
                  showItemModal={!selectedTableModal}
                  compact
                  testIdPrefix="staff-main-menu"
                  onItemAction={(item, categoryName) => {
                    if (!selectedTableModal) return;
                    void addItemToTableRound({
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      displayPrice: getMenuItemEffectivePrice(item),
                    }, categoryName);
                  }}
                />
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
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
