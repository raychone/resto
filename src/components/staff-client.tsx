"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildNotificationLabel,
  buildNotificationLink,
  buildWhatsAppReservationMessage,
} from "@/lib/contact-links";
import type {
  Locale,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  Reservation,
  Restaurant,
  Table,
} from "@/lib/types";
import { getMenuItemEffectivePrice } from "@/lib/types";

type Props = {
  restaurant: Restaurant;
  staffUserId: string;
  locale: Locale;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatMoney(amount: number, currency: string) {
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
  return order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
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

  return { label: "OUVERT", className: "bg-amber-50 text-amber-800 border-amber-200" };
}

export function StaffClient({ restaurant, staffUserId, locale }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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

  const loadData = useCallback(async () => {
    setLoading(true);

    const [reservationResponse, tablesResponse, ordersResponse] = await Promise.all([
      fetch(`/api/restaurants/${restaurant.slug}/reservations`, { cache: "no-store" }),
      fetch(`/api/restaurants/${restaurant.slug}/tables`, { cache: "no-store" }),
      fetch(`/api/restaurants/${restaurant.slug}/orders`, { cache: "no-store" }),
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
      setOrders(payload.orders);
      setPayments(payload.payments);
    }

    setLoading(false);
  }, [restaurant.slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const todayKey = new Intl.DateTimeFormat("fr-CA").format(new Date());

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
    const byId = orders.find((order) => order.id === selectedTarget);
    if (byId) return byId;

    if (selectedTarget === "takeaway") {
      return (
        orders.find(
          (order) => order.status === "open" && order.source === "takeaway" && !order.deletedAt,
        ) ?? null
      );
    }

    return (
      orders.find(
        (order) =>
          order.status === "open" &&
          order.source === "table" &&
          order.tableId === selectedTarget &&
          !order.deletedAt,
      ) ?? null
    );
  }, [orders, selectedTarget]);

  const currentOrderTotal = useMemo(() => {
    return currentOrder ? orderTotal(currentOrder) : 0;
  }, [currentOrder]);

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

  const menuItems = useMemo(() => {
    return restaurant.categories.flatMap((category) =>
      category.items.map((item) => ({
        ...item,
        categoryName: category.name,
        categoryId: category.id,
      })),
    );
  }, [restaurant.categories]);

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
        phone: form.phone,
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
      setSelectedTarget(existingOrder.id);
      return existingOrder;
    }

    const existing = orders.find(
      (order) =>
        order.status === "open" &&
        (target === "takeaway"
          ? order.source === "takeaway"
          : order.source === "table" && order.tableId === target),
    );

    if (existing) {
      setSelectedTarget(existing.id);
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
    setSelectedTarget(payloadResponse.order.id);
    await loadData();
    return payloadResponse.order;
  }

  async function addItemToOrder(item: {
    id: string;
    name: string;
    price: number;
    displayPrice?: number;
  }) {
    const order = await ensureOrder(selectedTarget);
    if (!order) return;

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
      }),
    });

    if (!response.ok) {
      setNotice("Impossible d'ajouter le plat.");
      return;
    }

    setNotice(`${item.name} ajouté au bon.`);
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

  async function closeCurrentOrder(method: PaymentMethod) {
    if (!currentOrder) return;

    const paymentValue =
      Number(paymentAmount) > 0 ? Number(paymentAmount) : currentRemaining > 0 ? currentRemaining : currentOrderTotal;
    const response = await fetch(
      `/api/restaurants/${restaurant.slug}/orders/${currentOrder.id}/payments`,
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
    await loadData();
  }

  const selectedOrderItems = currentOrder?.items ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6">
      <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
            <h1 className="font-display text-4xl">{restaurant.name}</h1>
            <p className="mt-2 text-sm text-black/60">
              Réservations, bon actif, commandes et encaissement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {reservationStats.pending} pending
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {reservationStats.confirmed} confirmées
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {reservationStats.cancelled} annulées
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {reservationStats.noShow} no show
            </span>
            <div className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white">
              {loading ? "Chargement..." : `${reservations.length} réservations`}
            </div>
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

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <form
            onSubmit={submitReservation}
            className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <h2 className="text-2xl font-semibold">Créer une réservation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Prénom"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Nom"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Téléphone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="E-mail"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Heure"
                type="time"
                value={form.time}
                onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Personnes"
                type="number"
                min={1}
                value={form.guestCount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, guestCount: Number(event.target.value) }))
                }
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>
            <textarea
              placeholder="Message"
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows={4}
              className="mt-3 w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none"
            />
            <button className="mt-3 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">
              Ajouter
            </button>
          </form>

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
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black hover:bg-black/3"
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
                          className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
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
                          className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
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

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Tables & bon</p>
                <h2 className="text-2xl font-semibold">Sélection rapide</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTarget("takeaway")}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    selectedTarget === "takeaway"
                      ? "border-black bg-black text-white"
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

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {currentTables.map((table) => {
                const openOrder = orders.find(
                  (order) => order.status === "open" && order.tableId === table.id,
                );
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => setSelectedTarget(openOrder?.id ?? table.id)}
                    className={`rounded-[1.4rem] border p-4 text-left transition ${
                      selectedTarget === table.id || selectedTarget === openOrder?.id
                        ? "border-transparent bg-black text-white shadow-lg"
                        : "border-black/8 bg-black/2 text-black hover:bg-black/4"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.28em] opacity-70">
                      {table.zone}
                    </span>
                    <span className="mt-2 block text-lg font-semibold">{table.name}</span>
                    <span className="mt-1 block text-sm opacity-80">{table.seats} places</span>
                    <span className="mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] opacity-90">
                      {openOrder ? "Bon ouvert" : "Libre"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Bon courant</p>
                <h3 className="text-2xl font-semibold">{currentTargetLabel}</h3>
                <p className="mt-1 text-sm text-black/60">
                  {currentOrder ? orderStatusMeta(currentOrder.status).label : "Aucun bon ouvert."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentOrder ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentOrderStatus("sent_to_kitchen")}
                      className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                    >
                      En cuisine
                    </button>
                    <button
                      type="button"
                      onClick={() => closeCurrentOrder("cash")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Encaisser cash
                    </button>
                    <button
                      type="button"
                      onClick={() => closeCurrentOrder("card")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Encaisser carte
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentOrderStatus("archived")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Archiver
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void ensureOrder(selectedTarget)}
                    className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                  >
                    Ouvrir le bon
                  </button>
                )}
              </div>
            </div>

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
                          className="flex items-start justify-between gap-3 rounded-2xl border border-black/8 bg-white p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {item.quantity} × {item.nameSnapshot}
                            </p>
                            <p className="text-xs text-black/55">{item.note || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
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
                            <span className="text-sm font-medium">
                              {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                            </span>
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

                <Field label="Note du bon">
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none"
                    placeholder="Ex: client allergique, table tranquille, service rapide..."
                  />
                </Field>

                <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-black/60">Total</p>
                    <p className="text-2xl font-semibold">
                      {formatMoney(currentOrderTotal, restaurant.currency)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-black/60">Déjà payé</p>
                    <p className="text-sm font-medium">
                      {formatMoney(currentPaidTotal, restaurant.currency)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-sm text-black/60">Reste</p>
                    <p className="text-sm font-medium">
                      {formatMoney(currentRemaining, restaurant.currency)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
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
                      placeholder={currentRemaining.toString()}
                      className="w-32 rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void closeCurrentOrder(paymentMethod)}
                      className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                      Encaisser
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
                    Menu {restaurant.name}
                  </p>
                  <div className="mt-3 space-y-3">
                    {menuItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          void addItemToOrder({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            displayPrice: getMenuItemEffectivePrice(item),
                          })
                        }
                        className="flex w-full items-start justify-between gap-3 rounded-2xl border border-black/8 bg-white p-3 text-left transition hover:bg-black/2"
                      >
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-black/55">{item.categoryName}</p>
                          <p className="text-xs text-black/60 line-clamp-2">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-semibold text-white">
                            {formatMoney(getMenuItemEffectivePrice(item), restaurant.currency)}
                          </span>
                          {item.happyHourEnabled &&
                          Number.isFinite(item.happyHourPrice) &&
                          Number(item.happyHourPrice) > 0 ? (
                            <span className="mt-1 block text-[11px] text-black/40 line-through">
                              {formatMoney(item.price, restaurant.currency)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
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
