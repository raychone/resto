"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearClientCart,
  listClientCartItems,
  removeClientCartItem,
  updateClientCartItemQuantity,
} from "@/lib/client-cart";
import type { ClientCartItem } from "@/lib/client-cart";
import {
  sendBrowserNotification,
} from "@/lib/browser-notifications";
import { PublicMenuCategories } from "@/components/public-menu-categories";
import { useRestaurantRealtime } from "@/components/use-restaurant-realtime";
import { formatLoyaltyPoints, getLoyaltySummary } from "@/lib/loyalty";
import type { TableGroupSummary } from "@/lib/table-group-summary";
import { summarizeTaxBreakdown } from "@/lib/tax";
import type { Customer, Order, Restaurant, Table, TableGroup, TableSession, User } from "@/lib/types";

type Props = {
  restaurant: Restaurant;
  clientUser: User;
  customer: Customer;
  tables: Table[];
  tableSession: TableSession;
  activeOrder: Order | null;
  focusCart?: boolean;
  orderFlowEnabled: boolean;
  theme?: "dark" | "food";
  guestSessionToken?: string | null;
  tableGroup?: TableGroup | null;
  occupiedTableIds?: string[];
};

type ClientTab = "menu" | "cart" | "tracking" | "split" | "profile";

function formatMoney(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR" ? `${formatted}€` : formatted;
}

function getOrderProgress(status?: Order["status"] | null) {
  const orderStatusRank: Record<string, number> = {
    open: 0,
    sent_to_kitchen: 2,
    preparing: 3,
    ready: 4,
    served: 5,
    paid: 5,
    cancelled: -1,
    archived: -1,
  };

  const currentRank = status ? orderStatusRank[status] ?? 0 : 0;
  const steps = [
    { key: "picked_up", label: "Prise en charge", rank: 1 },
    { key: "kitchen", label: "Arrivée en cuisine", rank: 2 },
    { key: "preparing", label: "En préparation", rank: 3 },
    { key: "ready", label: "Prête", rank: 4 },
  ] as const;

  return steps.map((step) => ({
    ...step,
    done: currentRank >= step.rank,
    active: currentRank === step.rank,
  }));
}

export function ClientPortal({
  restaurant,
  clientUser,
  customer,
  tables,
  tableSession,
  activeOrder,
  focusCart = false,
  orderFlowEnabled,
  theme = "dark",
  guestSessionToken = null,
  tableGroup = null,
  occupiedTableIds = [],
}: Props) {
  const isFoodTheme = theme === "food";
  const [isMounted, setIsMounted] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterNotice, setWaiterNotice] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<ClientCartItem[]>([]);
  const [sendingCart, setSendingCart] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<Order | null>(activeOrder);
  const [liveTableSession, setLiveTableSession] = useState<TableSession>(tableSession);
  const [liveTableGroup, setLiveTableGroup] = useState<TableGroup | null>(tableGroup);
  const [pendingTableId, setPendingTableId] = useState(tableSession.tableId ?? "");
  const [tableNotice, setTableNotice] = useState<string | null>(null);
  const [joinAccessCode, setJoinAccessCode] = useState(tableGroup?.accessCode ?? "");
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [groupSummary, setGroupSummary] = useState<TableGroupSummary | null>(null);
  const [activeTab, setActiveTab] = useState<ClientTab>(focusCart ? "cart" : "menu");
  const [serviceAdvancedOpen, setServiceAdvancedOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const cartSectionRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const previousOrderStatusRef = useRef<Order["status"] | null>(activeOrder?.status ?? null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const loyalty = getLoyaltySummary(customer.lifetimePoints);
  const remainingToNextTier = loyalty.pointsToNext;
  const liveOrderItems = liveOrder?.items.filter((item) => !item.deletedAt) ?? [];
  const liveTaxSummary = useMemo(() => summarizeTaxBreakdown(liveOrderItems), [liveOrderItems]);
  const liveOrderTotal = liveTaxSummary.total;
  const livePaidTotal = liveTableSession.paidTotal;
  const liveRemaining = Math.max(0, liveOrderTotal - livePaidTotal);
  const equalShare =
    liveTableSession.guestCount > 0
      ? (liveOrder ? liveOrderTotal : liveTableSession.estimatedTotal) / liveTableSession.guestCount
      : 0;
  const splitTotal = liveTableSession.participants.reduce((sum, participant) => sum + participant.settledAmount, 0);
  const remaining = Math.max(0, (liveOrder ? liveOrderTotal : liveTableSession.estimatedTotal) - splitTotal);
  const tableLabel =
    tables.find((table) => table.id === liveTableSession.tableId)?.name ?? liveTableSession.tableId ?? "Table";
  const myItems =
    liveOrder?.items.filter((item) => item.assignedClientId === customer.id && !item.deletedAt) ?? [];
  const myItemsTotal = myItems.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
  const livePaymentLabel =
    liveTableSession.lastPaymentMethod === "card"
      ? "Carte"
      : liveTableSession.lastPaymentMethod === "external"
        ? "Externe"
        : liveTableSession.lastPaymentMethod === "other"
          ? "Autre"
          : liveTableSession.lastPaymentMethod === "cash"
            ? "Cash"
    : "";

  const selectedTableId = liveTableSession.tableId ?? "";
  const tableLocked = Boolean(selectedTableId);
  const groupTableLabels = liveTableGroup
    ? liveTableGroup.tableIds
        .map((tableId) => tables.find((table) => table.id === tableId)?.name ?? tableId)
        .join(", ")
    : "";
  const occupiedTableIdSet = useMemo(() => new Set(occupiedTableIds), [occupiedTableIds]);

  function jumpTo(id: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function withGuestToken(pathname: string) {
    if (!guestSessionToken) {
      return pathname;
    }

    const separator = pathname.includes("?") ? "&" : "?";
    return `${pathname}${separator}guestToken=${encodeURIComponent(guestSessionToken)}`;
  }

  const activeOrderLabel =
    liveOrder?.status === "sent_to_kitchen"
      ? "La commande a été prise en charge et est arrivée en cuisine."
      : liveOrder?.status === "preparing"
        ? "La cuisine prépare la commande."
        : liveOrder?.status === "ready"
          ? "La commande est prête à être servie."
          : liveOrder?.status === "served"
            ? "La commande a été servie."
            : liveOrder?.status === "paid"
              ? "La commande a été réglée."
              : liveOrder?.status === "cancelled"
                ? "La commande a été annulée."
                : liveOrder
                  ? "La commande attend la prise en charge par le serveur."
                  : "";
  const orderProgress = getOrderProgress(liveOrder?.status ?? null);
  const currentStatusLabel =
    liveOrder?.status === "sent_to_kitchen"
      ? "Arrivée en cuisine"
      : liveOrder?.status === "preparing"
        ? "En préparation"
        : liveOrder?.status === "ready"
          ? "Prête à servir"
          : liveOrder?.status === "served"
            ? "Servie"
            : liveOrder?.status === "paid"
              ? "Réglée"
              : liveOrder?.status === "cancelled"
                ? "Annulée"
                : liveOrder
                  ? "En attente du serveur"
                  : "Aucune commande active";
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );
  const cartSummary = isMounted
    ? `${cartItems.length} article${cartItems.length > 1 ? "s" : ""} · ${formatMoney(cartTotal, restaurant.currency)}`
    : "Panier";
  const isGuestCustomer = Boolean(customer.isGuest);

  const refreshCart = useCallback(() => {
    setCartItems(listClientCartItems(restaurant.slug));
  }, [restaurant.name, restaurant.slug]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    const onStorage = () => refreshCart();
    const onCartChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ restaurantSlug?: string }>;
      if (customEvent.detail?.restaurantSlug && customEvent.detail.restaurantSlug !== restaurant.slug) {
        return;
      }
      refreshCart();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    window.addEventListener("meniu:client-cart-changed", onCartChange as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
      window.removeEventListener("meniu:client-cart-changed", onCartChange as EventListener);
    };
  }, [refreshCart]);

  useEffect(() => {
    setIsMounted(true);
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, []);

  useEffect(() => {
    const syncOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    setLiveTableSession(tableSession);
  }, [tableSession]);

  useEffect(() => {
    setLiveTableGroup(tableGroup);
    setJoinAccessCode(tableGroup?.accessCode ?? "");
  }, [tableGroup]);

  const refreshGroupSummary = useCallback(async (groupId: string) => {
    try {
      const response = await fetch(
        withGuestToken(`/api/restaurants/${restaurant.slug}/table-groups/${groupId}/summary`),
        {
          cache: "no-store",
          credentials: "include",
        },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { summary?: TableGroupSummary | null };
      setGroupSummary(payload.summary ?? null);
    } catch {
      // ignore summary refresh failure
    }
  }, [guestSessionToken, restaurant.slug]);

  useEffect(() => {
    setPendingTableId(tableSession.tableId ?? "");
  }, [tableSession.tableId]);

  useEffect(() => {
    if (!liveTableGroup?.id) {
      setGroupSummary(null);
      return;
    }
    void refreshGroupSummary(liveTableGroup.id);
  }, [liveTableGroup?.id, refreshGroupSummary]);

  useEffect(() => {
    if (!focusCart || !cartSectionRef.current) return;
    setActiveTab("cart");
    cartSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusCart]);

  const refreshLiveOrder = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const response = await fetch(withGuestToken(`/api/restaurants/${restaurant.slug}/client-orders`), {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        order: Order | null;
        tableSession?: TableSession | null;
      };

      const nextOrder = payload.order ?? null;
      if (payload.tableSession) {
        setLiveTableSession(payload.tableSession);
      }
      if (liveTableGroup?.id) {
        void refreshGroupSummary(liveTableGroup.id);
      }
      const previousStatus = previousOrderStatusRef.current;
      const nextStatus = nextOrder?.status ?? null;

      if (nextStatus && nextStatus !== previousStatus) {
        previousOrderStatusRef.current = nextStatus;
        setLiveOrder(nextOrder);
        if (nextStatus === "sent_to_kitchen") {
          setClientNotice("La commande a été validée par le serveur et envoyée en cuisine.");
          sendBrowserNotification(`${restaurant.name} — commande validée`, "La commande a été envoyée en cuisine.");
        } else if (nextStatus === "ready") {
          setClientNotice("La commande est prête. Le serveur peut la livrer.");
          sendBrowserNotification(`${restaurant.name} — commande prête`, "Le serveur peut livrer la commande à la table.");
        } else if (nextStatus === "served") {
          setClientNotice("La commande a été servie à la table.");
          sendBrowserNotification(`${restaurant.name} — commande servie`, "La commande est arrivée à la table.");
        } else if (nextStatus === "paid") {
          setClientNotice("La commande a été réglée.");
          sendBrowserNotification(`${restaurant.name} — commande réglée`, "La commande a été encaissée.");
        }
      } else {
        setLiveOrder(nextOrder);
      }
    } catch {
      // silent polling fallback
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshLiveOrder();
      }
    }
  }, [guestSessionToken, liveTableGroup?.id, refreshGroupSummary, restaurant.name, restaurant.slug]);

  useEffect(() => {
    if (!orderFlowEnabled) return;

    let cancelled = false;
    let visibilityListener: (() => void) | null = null;

    void refreshLiveOrder();
    const supportsRealtime = typeof window !== "undefined" && "EventSource" in window;
    const interval = supportsRealtime
      ? null
      : window.setInterval(() => {
          if (!document.hidden) {
            void refreshLiveOrder();
          }
        }, 500);

    visibilityListener = () => {
      if (!document.hidden) {
        void refreshLiveOrder();
      }
    };

    const onFocus = () => {
      if (!cancelled) {
        void refreshLiveOrder();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", visibilityListener);

    return () => {
      cancelled = true;
      if (interval) {
        window.clearInterval(interval);
      }
      window.removeEventListener("focus", onFocus);
      if (visibilityListener) {
        document.removeEventListener("visibilitychange", visibilityListener);
      }
    };
  }, [orderFlowEnabled, refreshLiveOrder]);

  useRestaurantRealtime({
    restaurantSlug: restaurant.slug,
    enabled: orderFlowEnabled,
    guestSessionToken,
    onEvent: (event) => {
      if (event.type === "orders" || event.type === "table_sessions" || event.type === "messages") {
        void refreshLiveOrder();
      }
    },
  });

  function changeTable(nextTableId: string) {
    if (tableLocked) {
      setTableNotice("La table est verrouillée. Seul le staff peut déplacer la note vers une autre table.");
      return;
    }
    if (occupiedTableIdSet.has(nextTableId)) {
      setTableNotice("Cette table est déjà occupée. Utilise le code d’accès si tu rejoins une session existante.");
      return;
    }
    setPendingTableId(nextTableId);
    setTableNotice(null);
  }

  function confirmPendingTable() {
    if (tableLocked || !pendingTableId || pendingTableId === selectedTableId) {
      return;
    }
    if (occupiedTableIdSet.has(pendingTableId)) {
      setTableNotice("Cette table est déjà occupée. Rejoins la session avec le code d’accès du groupe.");
      return;
    }

    const params = new URLSearchParams();
    params.set("restaurantSlug", restaurant.slug);
    params.set("tableId", pendingTableId);
    if (focusCart || activeTab === "cart") {
      params.set("focus", "cart");
    }
    const nextTableLabel =
      tables.find((table) => table.id === pendingTableId)?.name ?? "la table sélectionnée";
    setTableNotice(`Table prête à être confirmée: ${nextTableLabel}.`);
    router.replace(`/client?${params.toString()}`);
  }

  async function joinTableGroup() {
    if (!isOnline) {
      setJoinNotice("Connexion indisponible. Réessaie quand le réseau revient.");
      return;
    }
    if (!joinAccessCode.trim()) {
      setJoinNotice("Saisis le code d’accès du groupe.");
      return;
    }

    setJoiningGroup(true);
    setJoinNotice(null);
    try {
      const response = await fetch(withGuestToken(`/api/restaurants/${restaurant.slug}/table-groups/join`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode: joinAccessCode.trim().toUpperCase(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        tableGroup?: TableGroup;
        tableSession?: TableSession;
      };

      if (!response.ok || !payload.tableGroup || !payload.tableSession) {
        setJoinNotice(payload.error || "Impossible de rejoindre la session de groupe.");
        return;
      }

      setLiveTableGroup(payload.tableGroup);
      setLiveTableSession(payload.tableSession);
      setPendingTableId(payload.tableSession.tableId ?? "");
      setTableNotice("Session de groupe rejointe. La table est désormais gérée via le code d’accès.");
      setJoinNotice(`Groupe rejoint: ${payload.tableGroup.name}.`);
      void refreshGroupSummary(payload.tableGroup.id);

      const params = new URLSearchParams();
      params.set("restaurantSlug", restaurant.slug);
      if (payload.tableSession.tableId) {
        params.set("tableId", payload.tableSession.tableId);
      }
      if (focusCart || activeTab === "cart") {
        params.set("focus", "cart");
      }
      router.replace(`/client?${params.toString()}`);
    } catch {
      setJoinNotice("Impossible de rejoindre la session de groupe.");
    } finally {
      setJoiningGroup(false);
    }
  }

  async function submitCart() {
    if (!cartItems.length) return;
    if (!isOnline) {
      setCartNotice("Connexion indisponible. La commande n’a pas été envoyée.");
      return;
    }

    setSendingCart(true);
    setCartNotice(null);

    const response = await fetch(withGuestToken(`/api/restaurants/${restaurant.slug}/client-orders`), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: `Commande client ${clientUser.name}`,
        items: cartItems,
        tableId: selectedTableId || pendingTableId || liveTableSession.tableId || null,
      }),
    });

    if (!response.ok) {
      let errorMessage = "Impossible d'envoyer la commande.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload?.error) {
          errorMessage = `${errorMessage} (${payload.error})`;
        }
      } catch {}
      setCartNotice(errorMessage);
      setSendingCart(false);
      return;
    }

    const payload = (await response.json()) as { order?: Order | null; tableSession?: TableSession | null };
    if (payload.order) {
      setLiveOrder(payload.order);
      previousOrderStatusRef.current = payload.order.status;
    }
    setActiveTab("tracking");

    clearClientCart(restaurant.slug);
    refreshCart();
    setCartNotice("Commande envoyée au serveur. Elle attend la validation du serveur.");
    setClientNotice("Le serveur viendra confirmer la commande à la table.");
    setSendingCart(false);
  }

  async function callServer() {
    if (!isOnline) {
      setWaiterNotice("Connexion indisponible. Impossible d’appeler le serveur.");
      return;
    }
    setCallingWaiter(true);
    try {
      const response = await fetch(withGuestToken(`/api/restaurants/${restaurant.slug}/messages`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: "fr",
          name: clientUser.name || customer.name || "Client",
          phone: customer.phone || "",
          email: customer.email || "",
          message: `Appel serveur depuis ${tableLabel}`,
          tableId: liveTableSession.tableId ?? null,
          tableLabel,
        }),
      });

      if (!response.ok) {
        setWaiterNotice("Impossible d'appeler le serveur.");
        return;
      }

      setWaiterNotice(`Le serveur viendra à ${tableLabel}.`);
      sendBrowserNotification(`${restaurant.name} — serveur appelé`, `Le serveur viendra à ${tableLabel}.`);
    } finally {
      setCallingWaiter(false);
    }
  }

  return (
    <main className={theme === "food" ? "food-theme mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 pb-32 sm:px-4 lg:px-6 lg:pb-28" : "internal-dark mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 pb-32 sm:px-4 lg:px-6 lg:pb-28"}>
      {!isOnline ? (
        <div className={isFoodTheme ? "mb-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" : "mb-3 rounded-[1.25rem] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"}>
          Connexion hors ligne. Les actions de service et d’envoi sont temporairement bloquées.
        </div>
      ) : null}
      <section className={isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#171717] p-4 text-[#f5f1ea] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"}>
        <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>Client</p>
        <h1 className="mt-1 text-4xl font-semibold">{clientUser.name}</h1>
        <p className={isFoodTheme ? "mt-2 text-sm text-[#6f5b4a]" : "mt-2 text-sm text-white/65"}>
          Compte client connecté à {restaurant.name}. Ce portail sert de base pour le login client,
          le loyalty et le split de note.
        </p>
        <div className="mt-4 grid gap-2 sm:max-w-md">
          <div className={isFoodTheme ? "rounded-2xl border border-[#eadfce] bg-[#faf7f2] p-3 text-sm text-[#6f5b4a]" : "rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/70"}>
            <p className="font-medium text-inherit">
              Table actuelle: {tableLabel}
            </p>
            {liveTableGroup ? (
              <p className="mt-1 text-inherit">
                Groupe actif: {liveTableGroup.name}{liveTableGroup.accessCode ? ` · code ${liveTableGroup.accessCode}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void callServer()}
            disabled={callingWaiter || !isOnline}
            className={isFoodTheme ? "rounded-full border border-[#b8d6b2] bg-[#e7f6e1] px-4 py-2 text-sm font-medium text-[#1f2b1f] transition disabled:opacity-60" : "rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black transition disabled:opacity-60"}
          >
            {callingWaiter ? "Demande envoyée..." : "Appeler le serveur"}
          </button>
        </div>
        {waiterNotice ? <p className={isFoodTheme ? "mt-3 text-sm text-[#6f5b4a]" : "mt-3 text-sm text-white/65"}>{waiterNotice}</p> : null}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div
          id="client-profile"
          className={`${isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]"} xl:col-span-2 ${
            activeTab === "profile" ? "" : "hidden"
          }`}
        >
          <h2 className="text-2xl font-semibold">Mon profil</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <p>
              <span className="font-semibold text-white">Identifiant:</span>{" "}
              {isGuestCustomer ? "Compte invité" : clientUser.username}
            </p>
            <p>
              <span className="font-semibold text-white">Restaurant:</span> {restaurant.name}
            </p>
            <p>
              <span className="font-semibold text-white">Statut:</span>{" "}
              {isGuestCustomer ? "Commande anonyme" : "Compte actif"}
            </p>
          </div>
        </div>

        <div
          id="client-loyalty"
          className={`${isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]"} ${
            activeTab === "profile" ? "" : "hidden"
          }`}
        >
          <h2 className="text-2xl font-semibold">Loyalty</h2>
          {isGuestCustomer ? (
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-white/65">
              <p className="font-medium text-white">Mode invité actif</p>
              <p className="mt-2 leading-6">
                Pas de points de fidélité ni d’abonnement. La note reste suivie par table et par
                personne.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Tier</p>
                  <p className="mt-1 text-2xl font-semibold">{loyalty.tierLabel}</p>
                </div>
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#24170f]" : "rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"}>
                  {formatLoyaltyPoints(customer.currentPoints)}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-white/55">
                  <span>Points de vie</span>
                  <span>{formatLoyaltyPoints(customer.lifetimePoints)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-white transition-all"
                    style={{ width: `${Math.max(8, loyalty.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-white/65">
                  {remainingToNextTier > 0
                    ? `${remainingToNextTier} points avant ${loyalty.nextTier?.toUpperCase()}`
                    : "Niveau maximum atteint."}
                </p>
              </div>
            </div>
          )}
        </div>

        {orderFlowEnabled ? (
          <div
            id="client-menu"
          className={`${isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]"} xl:col-span-2 ${
            activeTab === "menu" ? "" : "hidden"
          }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Menu</h2>
                <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-white/60"}>
                  Sélectionne un produit, ajoute-le au panier et envoie-le au serveur.
                </p>
              </div>
              <div className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-2 text-xs font-semibold text-[#24170f] sm:text-sm" : "rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white sm:text-sm"}>
                {cartSummary}
              </div>
            </div>
            <div className="mt-4">
              <PublicMenuCategories
                categories={restaurant.categories}
                locale="fr"
                accent={restaurant.accent}
                restaurantSlug={restaurant.slug}
                orderFlowEnabled={orderFlowEnabled}
                theme={theme === "food" ? "food" : "dark"}
                actionLabel="Ajouter au panier"
              />
            </div>
          </div>
        ) : null}

        <div
          ref={cartSectionRef}
          id="client-cart"
          className={`${isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]"} xl:col-span-2 ${
            activeTab === "cart" || activeTab === "tracking" ? "" : "hidden"
          }`}
        >
          {activeTab === "tracking" ? (
            <div
              id="client-tracking"
              className={isFoodTheme ? "mb-4 rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4 text-[#24170f]" : "mb-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4"}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.3em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.3em] text-white/40"}>Service</p>
                  <h2 className="mt-1 text-xl font-semibold">Service</h2>
                </div>
                <span className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#24170f]" : "rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"}>
                  {currentStatusLabel}
                </span>
              </div>
              <p className={isFoodTheme ? "mt-3 text-sm text-[#6f5b4a]" : "mt-3 text-sm text-white/65"}>
                {liveOrder ? activeOrderLabel : "Le suivi du service apparaîtra ici dès qu'une commande sera envoyée."}
              </p>
              <div className={isFoodTheme ? "mt-4 rounded-[1.25rem] border border-[#eadfce] bg-white p-3" : "mt-4 rounded-[1.25rem] border border-white/10 bg-black/20 p-3"}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.28em] text-white/35"}>Étape actuelle</p>
                    <p className={isFoodTheme ? "mt-1 text-base font-semibold text-[#24170f]" : "mt-1 text-base font-semibold text-white"}>{currentStatusLabel}</p>
                  </div>
                  <div className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6f5b4a]" : "rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80"}>
                    {tableLabel}
                  </div>
                </div>
              </div>
              {liveOrder ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {orderProgress.map((step) => (
                  <div
                    key={step.key}
                    className={`rounded-2xl border p-3 text-sm transition ${
                      isFoodTheme
                        ? step.done
                          ? step.active
                            ? "border-[#d7ccb9] bg-white text-[#24170f] shadow-[0_12px_30px_rgba(124,77,44,0.08)]"
                            : "border-[#b8d6b2] bg-[#e7f6e1] text-[#1f2b1f]"
                          : "border-[#eadfce] bg-[#faf7f2] text-[#a38d7c]"
                        : step.done
                          ? step.active
                            ? "border-white/20 bg-white text-black shadow-lg"
                            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-black/20 text-white/50"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] opacity-70">
                      {step.label}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {step.done ? (step.active ? "● En cours" : "✓ Terminé") : "En attente"}
                    </p>
                  </div>
                ))}
              </div>
              ) : null}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setServiceAdvancedOpen((current) => !current)}
                  className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-semibold text-[#24170f]" : "rounded-full border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white"}
                >
                  {serviceAdvancedOpen ? "Masquer les options avancées" : "Options avancées"}
                </button>
              </div>
              {serviceAdvancedOpen ? (
                <div className={isFoodTheme ? "mt-4 grid gap-4 rounded-[1.5rem] border border-[#eadfce] bg-white p-4 text-[#24170f]" : "mt-4 grid gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-white"}>
                  {tables.length > 0 ? (
                    <div className="grid gap-2 sm:max-w-md">
                      <label className="grid gap-2">
                        <span className={isFoodTheme ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
                          Table
                        </span>
                        <select
                          value={pendingTableId}
                          onChange={(event) => changeTable(event.target.value)}
                          disabled={tableLocked || !isOnline}
                          className={isFoodTheme ? "rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e] disabled:cursor-not-allowed disabled:bg-[#faf7f2] disabled:text-[#9a8574]" : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"}
                        >
                          {tables.map((table) => (
                            <option key={table.id} value={table.id} disabled={occupiedTableIdSet.has(table.id) && table.id !== selectedTableId}>
                              {table.name} · {table.seats} places{occupiedTableIdSet.has(table.id) && table.id !== selectedTableId ? " · occupée" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={confirmPendingTable}
                          disabled={!isOnline || tableLocked || !pendingTableId || pendingTableId === selectedTableId}
                          className={isFoodTheme ? "rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-semibold text-[#1f2b1f] transition disabled:cursor-not-allowed disabled:opacity-45" : "rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-45"}
                        >
                          Confirmer la table
                        </button>
                        {pendingTableId && pendingTableId !== selectedTableId ? (
                          <span className={isFoodTheme ? "text-xs text-[#6f5b4a]" : "text-xs text-white/60"}>
                            Changement en attente de confirmation.
                          </span>
                        ) : null}
                      </div>
                      {tableLocked ? (
                        <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-white/65"}>
                          Table confirmée. Si le client change de place, le staff doit déplacer la note sur la nouvelle table.
                        </p>
                      ) : null}
                      {tableNotice ? (
                        <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-white/65"}>{tableNotice}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:max-w-md">
                    <label className="grid gap-2">
                      <span className={isFoodTheme ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
                        Code d’accès groupe
                      </span>
                      <input
                        value={joinAccessCode}
                        onChange={(event) => setJoinAccessCode(event.target.value.toUpperCase())}
                        placeholder="Ex: TABLES"
                        className={isFoodTheme ? "rounded-2xl border border-[#eadfce] bg-[#fffdf8] px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]" : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void joinTableGroup()}
                        disabled={!isOnline || joiningGroup || !joinAccessCode.trim()}
                        className={isFoodTheme ? "rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-semibold text-[#1f2b1f] transition disabled:cursor-not-allowed disabled:opacity-45" : "rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-45"}
                      >
                        {joiningGroup ? "Connexion..." : "Rejoindre le groupe"}
                      </button>
                    </div>
                    {joinNotice ? (
                      <p className={isFoodTheme ? "text-sm text-[#6f5b4a]" : "text-sm text-white/65"}>{joinNotice}</p>
                    ) : null}
                    {liveTableGroup ? (
                      <div className={isFoodTheme ? "rounded-2xl border border-[#eadfce] bg-[#faf7f2] p-3 text-sm text-[#6f5b4a]" : "rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/70"}>
                        <p className="font-medium text-inherit">
                          Groupe actif: {liveTableGroup.name}{liveTableGroup.accessCode ? ` · code ${liveTableGroup.accessCode}` : ""}
                        </p>
                        <p className="mt-1 text-inherit">
                          Tables liées: {groupTableLabels || "Aucune table liée."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {liveOrder ? (
              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Note de table</p>
                    <p className="mt-1 text-sm text-white/60">
                      Ce que le serveur ajoute apparaît ici en temps réel, avec les taxes et le total restant à payer.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white">
                    {liveOrderItems.length} article{liveOrderItems.length > 1 ? "s" : ""} ·{" "}
                    {formatMoney(liveTaxSummary.total, restaurant.currency)}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {liveOrderItems.length === 0 ? (
                    <p className="text-sm text-white/55">Aucun article sur la note pour le moment.</p>
                  ) : (
                    liveOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {item.quantity} × {item.nameSnapshot}
                          </p>
                          <p className="text-xs text-white/50">
                            {item.assignedClientName ? `Client: ${item.assignedClientName}` : "Partagé"}
                            {item.note ? ` · ${item.note}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-white">
                          {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Sous-total</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatMoney(liveTaxSummary.subtotal, restaurant.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">TVA</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatMoney(liveTaxSummary.taxTotal, restaurant.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Déjà payé</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatMoney(livePaidTotal, restaurant.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Reste à payer</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatMoney(liveRemaining, restaurant.currency)}
                    </p>
                  </div>
                </div>
                {liveTableSession.status === "closed" || liveOrder?.status === "paid" ? (
                  <div className="mt-4 rounded-[1.25rem] border border-emerald-400/25 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-100/70">Note réglée</p>
                    <p className="mt-1 text-sm text-emerald-50">
                      {livePaymentLabel
                        ? `Paiement enregistré en ${livePaymentLabel}.`
                        : "Paiement enregistré."}
                    </p>
                    <p className="mt-2 text-sm text-emerald-50/80">
                      {formatMoney(livePaidTotal, restaurant.currency)} encaissés · {formatMoney(liveTaxSummary.total, restaurant.currency)} TTC.
                    </p>
                  </div>
                ) : null}
              </div>
              ) : null}
            </div>
          ) : null}
          {activeTab === "tracking" ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <div className={isFoodTheme ? "rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-3" : "rounded-[1.25rem] border border-white/10 bg-white/5 p-3"}>
                <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.28em] text-white/40"}>Table</p>
                <p className={isFoodTheme ? "mt-1 text-lg font-semibold text-[#24170f]" : "mt-1 text-lg font-semibold text-white"}>{tableLabel}</p>
              </div>
              <div className={isFoodTheme ? "rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-3" : "rounded-[1.25rem] border border-white/10 bg-white/5 p-3"}>
                <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.28em] text-white/40"}>Statut</p>
                <p className={isFoodTheme ? "mt-1 text-base font-semibold text-[#24170f]" : "mt-1 text-base font-semibold text-white"}>{currentStatusLabel}</p>
              </div>
              <div className={isFoodTheme ? "rounded-[1.25rem] border border-[#eadfce] bg-[#faf7f2] p-3" : "rounded-[1.25rem] border border-white/10 bg-white/5 p-3"}>
                <p className={isFoodTheme ? "text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.28em] text-white/40"}>Reste</p>
                <p className={isFoodTheme ? "mt-1 text-lg font-semibold text-[#24170f]" : "mt-1 text-lg font-semibold text-white"}>
                  {formatMoney(liveRemaining, restaurant.currency)}
                </p>
              </div>
            </div>
          ) : null}
          {orderFlowEnabled ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Mon panier</h2>
                  <p className="text-sm text-white/60">
                    Ajoute des produits depuis le menu, puis confirme le panier sans quitter le flux.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white sm:text-sm">
                  {cartSummary}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-white/60">Ton panier est vide pour le moment.</p>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={`${item.menuItemId}-${item.note ?? ""}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="text-xs text-white/50">{item.categoryName || "—"}</p>
                          <p className="mt-1 text-sm text-white/70">{formatMoney(item.price, restaurant.currency)} / unité</p>
                        </div>
                        <p className="font-semibold text-white">
                          {formatMoney(item.price * item.quantity, restaurant.currency)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-full border border-white/10 bg-black/20">
                          <button
                            type="button"
                            onClick={() => {
                              const nextQuantity = item.quantity - 1;
                              updateClientCartItemQuantity(restaurant.slug, item.menuItemId, nextQuantity);
                              refreshCart();
                            }}
                            className="px-3 py-1 text-xs font-medium text-white"
                          >
                            −
                          </button>
                          <span className="border-x border-white/10 px-3 py-1 text-xs font-semibold text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateClientCartItemQuantity(restaurant.slug, item.menuItemId, item.quantity + 1);
                              refreshCart();
                            }}
                            className="px-3 py-1 text-xs font-medium text-white"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeClientCartItem(restaurant.slug, item.menuItemId);
                            refreshCart();
                          }}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submitCart()}
                  disabled={!isOnline || sendingCart || cartItems.length === 0}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
                >
                  {sendingCart ? "Envoi..." : "Confirmer la commande"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearClientCart(restaurant.slug);
                    refreshCart();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
                >
                  Vider le panier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientNotice("Le serveur viendra confirmer la commande à la table.");
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
                >
                  Appeler le serveur
                </button>
              </div>
              {liveTableSession.status === "closed" || liveOrder?.status === "paid" ? (
                <div className="mt-4 rounded-[1.25rem] border border-emerald-400/25 bg-emerald-500/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-100/70">Note réglée</p>
                  <p className="mt-1 text-sm text-emerald-50">
                    Le paiement a été enregistré et la note est clôturée.
                  </p>
                </div>
              ) : null}
              {cartNotice ? <p className="mt-3 text-sm text-white/65">{cartNotice}</p> : null}
              {clientNotice ? <p className="mt-2 text-sm text-white/65">{clientNotice}</p> : null}
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Commande</p>
              <h2 className="mt-2 text-2xl font-semibold">Module désactivé</h2>
              <p className="mt-2 text-sm text-white/65">
                Le restaurant n’autorise pas encore la prise de commande via le panier.
              </p>
            </div>
          )}
        </div>

        <div
          id="client-split"
          className={`${isFoodTheme ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#141414] p-4 text-[#f5f1ea]"} ${
            activeTab === "split" ? "" : "hidden"
          }`}
        >
          <h2 className="text-xl font-semibold">Split de note</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Table</p>
                  <p className="mt-1 text-xl font-semibold">{tableLabel}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                  {liveTableSession.status.toUpperCase()}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Total table</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatMoney(liveOrder ? liveOrderTotal : liveTableSession.estimatedTotal, restaurant.currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Déjà payé</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatMoney(livePaidTotal, restaurant.currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Reste</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatMoney(liveOrder ? liveRemaining : remaining, restaurant.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Partage estimé</p>
                <p className="mt-1 text-sm text-white/65">
                  Si la note est partagée à parts égales, cela représente environ{" "}
                  <span className="font-semibold text-white">
                    {formatMoney(equalShare, restaurant.currency)}
                  </span>{" "}
                  par invité.
                </p>
              </div>
            </div>

            {liveTableGroup && groupSummary ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Groupe</p>
                    <h3 className="mt-1 text-xl font-semibold">{liveTableGroup.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                    {groupTableLabels || "Aucune table liée"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Total groupe</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatMoney(groupSummary.total, restaurant.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Déjà payé</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatMoney(groupSummary.paid, restaurant.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Reste</p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatMoney(groupSummary.remaining, restaurant.currency)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Par table</p>
                    <div className="mt-2 space-y-2">
                      {groupSummary.perTable.map((entry) => (
                        <div
                          key={entry.tableId}
                          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">{entry.label}</p>
                            <p className="text-sm font-semibold text-white">
                              {formatMoney(entry.total, restaurant.currency)}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white/55">
                            <span>Payé {formatMoney(entry.paid, restaurant.currency)}</span>
                            <span>Reste {formatMoney(entry.remaining, restaurant.currency)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Par personne</p>
                    <div className="mt-2 space-y-2">
                      {groupSummary.perParticipant.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
                          Aucun participant enregistré dans le groupe pour le moment.
                        </div>
                      ) : (
                        groupSummary.perParticipant.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-white">{entry.name}</p>
                              <p className="text-sm font-semibold text-white">
                                {formatMoney(entry.total, restaurant.currency)}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white/55">
                              <span>Payé {formatMoney(entry.paid, restaurant.currency)}</span>
                              <span>Reste {formatMoney(entry.remaining, restaurant.currency)}</span>
                            </div>
                            <p className="mt-1 text-xs text-white/55">
                              Tables: {entry.tables.join(" · ") || "Aucune"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Mes articles</p>
              <div className="mt-3 space-y-2">
                {myItems.length === 0 ? (
                  <p className="text-sm text-white/60">Aucun article attribué pour le moment.</p>
                ) : (
                  myItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {item.quantity} × {item.nameSnapshot}
                        </p>
                        <p className="text-xs text-white/50">{item.note || "—"}</p>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-sm text-white/65">Mon total</p>
                <p className="text-lg font-semibold text-white">
                  {formatMoney(myItemsTotal, restaurant.currency)}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Participants</p>
              <div className="mt-3 space-y-2">
                {liveTableSession.participants.map((participant) => {
                  const shareAmount =
                    ((liveOrder ? liveOrderTotal : liveTableSession.estimatedTotal) * participant.sharePercent) / 100;
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-white">{participant.name}</p>
                        <p className="text-xs text-white/50">
                          {participant.sharePercent}% · {participant.note || "Partage standard"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {formatMoney(shareAmount, restaurant.currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={isFoodTheme ? "fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[46rem] -translate-x-1/2 rounded-[1.75rem] border border-[#eadfce] bg-[#fffdf8]/96 px-2 py-2 shadow-[0_16px_45px_rgba(124,77,44,0.18)] backdrop-blur" : "fixed bottom-3 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[46rem] -translate-x-1/2 rounded-[1.75rem] border border-white/10 bg-[#090909]/96 px-2 py-2 shadow-[0_16px_45px_rgba(0,0,0,0.38)] backdrop-blur"}>
        <div className="grid grid-cols-5 gap-1">
          {[
            { key: "menu", label: "Menu", icon: "📖", target: "client-menu" },
            { key: "cart", label: "Panier", icon: "🛒", target: "client-cart" },
            { key: "tracking", label: "Service", icon: "🍽️", target: "client-tracking" },
            { key: "split", label: "Note", icon: "🧾", target: "client-split" },
            { key: "profile", label: "Profil", icon: "👤", target: "client-profile" },
          ].map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key as ClientTab);
                  jumpTo(item.target);
                }}
                className={`flex flex-col items-center justify-center rounded-[1.2rem] border px-2 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? isFoodTheme
                      ? "border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] text-[#1f2b1f] shadow-[0_10px_25px_rgba(127,170,118,0.14)]"
                      : "border-white bg-white text-black shadow-[0_10px_25px_rgba(255,255,255,0.08)]"
                    : isFoodTheme
                      ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]"
                      : "border-white/8 bg-white/6 text-white/82 hover:bg-white/12"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
