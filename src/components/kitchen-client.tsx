"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Order, OrderItem, Restaurant } from "@/lib/types";
import {
  browserNotificationsSupported,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from "@/lib/browser-notifications";
import { useRestaurantRealtime } from "@/components/use-restaurant-realtime";

type Props = {
  restaurant: Restaurant;
  kitchenUserId: string;
  orderFlowEnabled: boolean;
  theme?: "dark" | "food";
};

function formatMoney(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR" ? `${formatted}€` : formatted;
}

function isKitchenVisibleOrder(order: Order) {
  return !["open", "paid", "cancelled", "archived"].includes(order.status);
}

function orderStatusLabel(status: Order["status"]) {
  if (status === "ready") return "PRÊT";
  if (status === "preparing") return "EN PREPARATION";
  if (status === "served") return "SERVI";
  if (status === "sent_to_kitchen") return "EN CUISINE";
  return "OUVERT";
}

export function KitchenClient({ restaurant, kitchenUserId, orderFlowEnabled, theme = "dark" }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [changingOrderId, setChangingOrderId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>("unsupported");
  const previousOrdersRef = useRef<Map<string, Order["status"]>>(new Map());
  const [initializedOrders, setInitializedOrders] = useState(false);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const loadOrders = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    setLoading(true);
    try {
      const response = await fetch(`/api/restaurants/${restaurant.slug}/orders?scope=kitchen`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { orders: Order[] };
        if (initializedOrders) {
          const previousOrders = previousOrdersRef.current;
          const nextOrders = new Map(payload.orders.map((order) => [order.id, order.status] as const));
          const newOrders = payload.orders.filter((order) => !previousOrders.has(order.id));
          const readyOrders = payload.orders.filter((order) => previousOrders.get(order.id) !== order.status);

          if (newOrders.some((order) => order.status === "sent_to_kitchen" || order.status === "preparing")) {
            setNotice("Nouvelle commande en cuisine.");
            sendBrowserNotification(
              `${restaurant.name} — nouvelle commande`,
              "Une nouvelle commande a été envoyée à la cuisine.",
            );
          }

          if (readyOrders.some((order) => order.status === "ready")) {
            setNotice("Commande prête pour le serveur.");
            sendBrowserNotification(`${restaurant.name} — commande prête`, "Le serveur peut livrer la commande.");
          }

          previousOrdersRef.current = nextOrders;
        } else {
          previousOrdersRef.current = new Map(payload.orders.map((order) => [order.id, order.status] as const));
          setInitializedOrders(true);
        }
        setOrders(payload.orders);
      }
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void loadOrders();
      }
    }
  }, [initializedOrders, restaurant.name, restaurant.slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOrders]);

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
          if (!document.hidden) {
            void loadOrders();
          }
        }, 500);

    const refreshOnFocus = () => {
      void loadOrders();
    };

    const refreshOnVisibility = () => {
      if (!document.hidden) {
        void loadOrders();
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
  }, [loadOrders, orderFlowEnabled]);

  useRestaurantRealtime({
    restaurantSlug: restaurant.slug,
    enabled: orderFlowEnabled,
    onEvent: (event) => {
      if (event.type === "orders" || event.type === "table_sessions") {
        void loadOrders();
      }
    },
  });

  async function enableNotifications() {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      sendBrowserNotification(restaurant.name, "Les notifications cuisine sont activées.");
    }
  }

  const visibleOrders = useMemo(
    () =>
      [...orders]
        .filter((order) => isKitchenVisibleOrder(order))
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt)),
    [orders],
  );

  async function changeStatus(orderId: string, status: Order["status"]) {
    if (changingOrderId) {
      return;
    }
    setChangingOrderId(orderId);
    try {
      const response = await fetch(`/api/restaurants/${restaurant.slug}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, kitchenUserId }),
      });

      if (!response.ok) {
        setNotice("Impossible de modifier le statut.");
        return;
      }

      setNotice(
        status === "preparing"
          ? "Bon pris en préparation."
          : status === "ready"
            ? "Bon prêt pour le service."
            : status === "served"
              ? "Bon servi au serveur."
              : "Statut mis à jour.",
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 60);
    } catch {
      setNotice("Impossible de modifier le statut.");
    } finally {
      setChangingOrderId(null);
    }
  }

  const groupedOrders = useMemo(() => {
    function groupByTable(orders: Order[]) {
      const groups = new Map<
        string,
        {
          key: string;
          label: string;
          orders: Order[];
        }
      >();

      for (const order of orders) {
        const key = order.tableId ?? order.id;
        const label =
          order.source === "takeaway"
            ? "À emporter"
            : order.tableId
              ? `Table ${order.tableId.slice(-4)}`
              : `Bon ${order.id.slice(-4)}`;

        const current = groups.get(key);
        if (current) {
          current.orders.push(order);
          continue;
        }

        groups.set(key, {
          key,
          label,
          orders: [order],
        });
      }

      return [...groups.values()]
        .map((group) => ({
          ...group,
          orders: [...group.orders].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        }))
        .sort((left, right) => left.orders[0]?.createdAt.localeCompare(right.orders[0]?.createdAt));
    }

    return {
      waiting: groupByTable(visibleOrders.filter((order) => order.status === "sent_to_kitchen")),
      preparing: groupByTable(visibleOrders.filter((order) => order.status === "preparing")),
      ready: groupByTable(visibleOrders.filter((order) => order.status === "ready")),
    };
  }, [visibleOrders]);

  return (
    <main
      translate="no"
      className={`${theme === "food" ? "food-theme mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6" : "internal-dark mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6"} notranslate`}
    >
      <section className="rounded-[2rem] border border-white/10 bg-[#171717] p-4 text-[#f5f1ea] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Kitchen</p>
            <h1 className="font-display text-4xl">{restaurant.name}</h1>
            <p className="mt-2 text-sm text-white/65">Commandes directes pour la cuisine.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80">
              {groupedOrders.waiting.length} à prendre
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80">
              {groupedOrders.preparing.length} en préparation
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80">
              {groupedOrders.ready.length} prêts
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80">
              {loading ? "Chargement..." : `${orders.length} commandes`}
            </span>
            {orderFlowEnabled ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80 transition hover:bg-white/10"
              >
                {notificationPermission === "granted"
                  ? "Notifications activées"
                  : "Activer notifications"}
              </button>
            ) : null}
            {orderFlowEnabled ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/60">
                {notificationPermission === "granted"
                  ? "Notifications actives"
                  : notificationPermission === "denied"
                    ? "Notifications bloquées"
                    : "Notifications disponibles"}
              </span>
            ) : null}
          </div>
        </div>
        {notice ? <p className="mt-3 text-sm text-white/65">{notice}</p> : null}
      </section>

      <section translate="no" className="notranslate mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-[11px] uppercase tracking-[0.32em] text-amber-700">À prendre</p>
          <p className="mt-1 text-2xl font-semibold">{groupedOrders.waiting.length}</p>
          <p className="text-sm text-amber-800/80">Commandes en attente.</p>
        </div>
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <p className="text-[11px] uppercase tracking-[0.32em] text-sky-700">En préparation</p>
          <p className="mt-1 text-2xl font-semibold">{groupedOrders.preparing.length}</p>
          <p className="text-sm text-sky-800/80">En cours en cuisine.</p>
        </div>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-700">Prêts</p>
          <p className="mt-1 text-2xl font-semibold">{groupedOrders.ready.length}</p>
          <p className="text-sm text-emerald-800/80">À servir au serveur.</p>
        </div>
      </section>

      <nav translate="no" className="notranslate sticky top-3 z-20 mt-4 rounded-[1.25rem] border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {[
            { href: "#kitchen-summary", label: "Résumé" },
            { href: "#kitchen-queue", label: "Queue" },
            { href: "#kitchen-ready", label: "Prêts" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {!orderFlowEnabled ? (
        <section id="kitchen-summary" className="mt-6 rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Cuisine</p>
          <h2 className="mt-1 text-2xl font-semibold">Module désactivé</h2>
          <p className="mt-2 text-sm text-white/65">
            Ce restaurant n’autorise pas encore le flux commande / cuisine / service.
          </p>
        </section>
      ) : (
      <section translate="no" id="kitchen-queue" className="notranslate mt-6 grid gap-4 xl:grid-cols-3">
        {[
          { title: "À prendre", orders: groupedOrders.waiting, accent: "amber" },
          { title: "En préparation", orders: groupedOrders.preparing, accent: "sky" },
          { title: "Prêts", orders: groupedOrders.ready, accent: "emerald" },
        ].map((column) => (
          <div
            key={column.title}
            id={column.title === "Prêts" ? "kitchen-ready" : undefined}
            className="space-y-3 rounded-[2rem] border border-white/10 bg-[#141414] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#f5f1ea]">{column.title}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                {column.orders.length}
              </span>
            </div>
            <div className="space-y-3">
              {column.orders.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  Aucune commande.
                </p>
              ) : (
                column.orders.map((group) => {
                  return (
                    <article key={group.key} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                      <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">
                              {group.label}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold">
                              {group.orders.length > 1 ? `${group.orders.length} tickets` : orderStatusLabel(group.orders[0].status)}
                            </h3>
                            <p className="text-sm text-white/60">{group.orders.length} bon{group.orders.length > 1 ? "s" : ""}</p>
                          </div>
                          <p className="text-sm font-semibold text-[#f5f1ea]">
                            {formatMoney(
                              group.orders.reduce(
                                (sum, order) =>
                                  sum + order.items.reduce((orderSum, item) => orderSum + item.priceSnapshot * item.quantity, 0),
                                0,
                              ),
                              restaurant.currency,
                            )}
                          </p>
                      </div>

                      <div className="mt-3 space-y-3">
                        {group.orders.map((order, orderIndex) => {
                          const total = order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);

                          return (
                            <div key={order.id} className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                                    Bon {orderIndex + 1}
                                  </p>
                                  <h4 className="mt-1 text-sm font-semibold text-[#f5f1ea]">
                                    {orderStatusLabel(order.status)}
                                  </h4>
                                  <p className="text-xs text-white/60">{order.items.length} articles</p>
                                </div>
                                <p className="text-sm font-semibold text-[#f5f1ea]">
                                  {formatMoney(total, restaurant.currency)}
                                </p>
                              </div>
                              <div className="mt-3 space-y-2">
                                {order.items.map((item: OrderItem) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                                  >
                                    <div>
                                      <p className="font-medium text-[#f5f1ea]">
                                        {item.quantity} × {item.nameSnapshot}
                                      </p>
                                      <p className="text-xs text-white/55">{item.note || "—"}</p>
                                      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/35">
                                        {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                                      </p>
                                    </div>
                                    <span className="text-white/80">
                                      {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {group.orders.some((order) => order.status === "sent_to_kitchen" || order.status === "open") ? (
                          <button
                            type="button"
                            disabled={Boolean(changingOrderId)}
                            onClick={() => void changeStatus(group.orders[0].id, "preparing")}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {changingOrderId === group.orders[0].id ? "..." : "Commencer"}
                          </button>
                        ) : null}
                        {group.orders.some((order) => order.status === "preparing") ? (
                          <button
                            type="button"
                            disabled={Boolean(changingOrderId)}
                            onClick={() => void changeStatus(group.orders.find((order) => order.status === "preparing")?.id ?? group.orders[0].id, "ready")}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {changingOrderId === (group.orders.find((order) => order.status === "preparing")?.id ?? group.orders[0].id) ? "..." : "Marquer prêt"}
                          </button>
                        ) : null}
                        {group.orders.some((order) => order.status === "ready") ? (
                          <button
                            type="button"
                            disabled={Boolean(changingOrderId)}
                            onClick={() => void changeStatus(group.orders.find((order) => order.status === "ready")?.id ?? group.orders[0].id, "served")}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {changingOrderId === (group.orders.find((order) => order.status === "ready")?.id ?? group.orders[0].id) ? "..." : "Servi au serveur"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </section>
      )}
    </main>
  );
}
