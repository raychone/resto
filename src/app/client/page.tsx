import type { Metadata } from "next";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { ClientPortal } from "@/components/client-portal";
import {
  encodePayloadCookieValue,
  getClientGuestSession,
  getClientSessionUser,
  isClientAuthenticated,
} from "@/lib/auth";
import {
  getOrCreateAnonymousCustomerForRestaurant,
  getOrCreateCustomerForUser,
} from "@/lib/customer-store";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";
import { listOrdersForRestaurant } from "@/lib/order-store";
import { getOrCreateTableSessionForCustomer } from "@/lib/table-session-store";
import { listTablesForRestaurant } from "@/lib/table-store";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client",
  description: "Compte client et futur loyalty.",
};

export default async function ClientPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string; google?: string; restaurantSlug?: string; tableId?: string }>;
}) {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : null;
    const authenticated = await isClientAuthenticated();
    const guestSession = authenticated ? null : await getClientGuestSession();
    const clientUser = authenticated ? await getClientSessionUser() : null;
    const sessionRestaurant = clientUser?.restaurantId ? await getRestaurantById(clientUser.restaurantId) : null;
    const requestedTableId = resolvedSearchParams?.tableId?.trim() || null;
    const requestedRestaurantSlug =
      resolvedSearchParams?.restaurantSlug?.trim() ||
      sessionRestaurant?.slug ||
      guestSession?.restaurantSlug ||
      (clientUser?.username?.trim().toLowerCase().startsWith("foodclient") ? "food-1" : "bar-1");
    const requestedRestaurant = await getRestaurantBySlug(requestedRestaurantSlug);
    const requestedTables = requestedRestaurant ? await listTablesForRestaurant(requestedRestaurant.id) : [];

    if (!authenticated) {
    if (guestSession) {
      const guestRestaurant = await getRestaurantById(guestSession.restaurantId);
      if (guestRestaurant && guestRestaurant.slug === requestedRestaurantSlug) {
        const guestSessionToken = encodePayloadCookieValue(guestSession);
        const customer = await getOrCreateAnonymousCustomerForRestaurant(
          guestRestaurant.id,
          guestSession.id,
          guestSession.name,
        );
        const tableSession = await getOrCreateTableSessionForCustomer(
          guestRestaurant.id,
          customer,
          guestSession.tableId ?? requestedTableId,
        );
        const tables = await listTablesForRestaurant(guestRestaurant.id);
        const orders = await listOrdersForRestaurant(guestRestaurant.id);
        const displayLogo = guestRestaurant.logoUrl || (guestRestaurant.slug === "bar-1" ? "/logoNoirBar.png" : "/logoFood.png");
        const activeOrder =
          (tableSession.orderId ? orders.find((order) => order.id === tableSession.orderId) : null) ??
          orders.find(
            (order) =>
              order.status === "open" &&
              order.tableId === tableSession.tableId &&
              !order.deletedAt,
          ) ??
          null;
        const guestUser: User = {
          id: guestSession.id,
          restaurantId: guestRestaurant.id,
          role: "client",
          name: guestSession.name,
          username: `guest-${guestSession.id.slice(-8)}`,
          passwordHash: "",
          mustChangePassword: false,
          status: "active",
          createdAt: guestSession.createdAt,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          pinEnabled: false,
        };

        return (
          <main className={guestRestaurant.slug === "food-1" ? "food-theme min-h-screen w-full" : "internal-dark min-h-screen w-full"}>
            <div className={guestRestaurant.slug === "food-1" ? "border-b border-[#eadfce] bg-[#fffdf8]/96 px-3 py-4 sm:px-4 lg:px-8" : "border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8"}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={displayLogo}
                    alt={guestRestaurant.name}
                    className="h-11 w-11 rounded-2xl object-cover ring-1 ring-black/5"
                  />
                  <div className="min-w-0">
                    <p className={guestRestaurant.slug === "food-1" ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>Client invité</p>
                    <h1 className="truncate text-3xl font-semibold">{guestRestaurant.name}</h1>
                  </div>
                </div>
                <DashboardLogoutButton endpoint="/api/client-auth/logout" label="Déconnexion" />
              </div>
            </div>
            <ClientPortal
              restaurant={guestRestaurant}
              clientUser={guestUser}
              customer={customer}
              tables={tables}
              tableSession={tableSession}
              activeOrder={activeOrder}
              focusCart={resolvedSearchParams?.focus === "cart"}
              orderFlowEnabled={guestRestaurant.features.orderFlowEnabled}
              theme={guestRestaurant.slug === "food-1" ? "food" : "dark"}
              guestSessionToken={guestSessionToken}
            />
          </main>
        );
      }
    }

    const isFoodDemo = requestedRestaurantSlug === "food-1";
    return (
      <main className={isFoodDemo ? "food-theme flex min-h-screen w-full flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6" : "internal-dark flex min-h-screen w-full flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6"}>
        <section className={isFoodDemo ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#171717]/95 p-4 text-[#f5f1ea] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"}>
          <p className={isFoodDemo ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>Accès client</p>
          <h1 className="mt-2 text-3xl font-semibold">Choisis ta table ou connecte-toi</h1>
          <p className={isFoodDemo ? "mt-2 text-sm leading-6 text-[#6f5b4a]" : "mt-2 text-sm leading-6 text-white/65"}>
            {requestedRestaurant?.name ? `Accès à ${requestedRestaurant.name}.` : "Accès client."} Tu peux commander sans compte, puis suivre la note de table.
          </p>
        </section>

        <section className={isFoodDemo ? "rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]" : "rounded-[2rem] border border-white/10 bg-[#171717]/95 p-4 text-[#f5f1ea] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"}>
          <p className={isFoodDemo ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>Commande sans compte</p>
          <form
            action="/api/client-auth/guest/start"
            method="get"
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="restaurantSlug" value={requestedRestaurantSlug} />
            <input
              type="hidden"
              name="returnTo"
              value={`/client?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}&focus=cart`}
            />
            <label className="grid gap-2 sm:col-span-2">
              <span className={isFoodDemo ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
                Nom affiché
              </span>
              <input
                name="name"
                defaultValue="Invité"
                className={isFoodDemo ? "rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]" : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"}
              />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className={isFoodDemo ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
                Table
              </span>
              <select
                name="tableId"
                defaultValue=""
                required={requestedTables.length > 0}
                className={isFoodDemo ? "rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]" : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"}
              >
                <option value="">Choisis une table</option>
                {requestedTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} · {table.seats} places
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={isFoodDemo ? "rounded-full bg-[#c41e1e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#aa1818] sm:col-span-2" : "rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 sm:col-span-2"}
            >
              Commander sans compte
            </button>
          </form>
        </section>

        <DashboardLogin
          title="Connexion client"
          description={`Utilise client / client123! ou ton e-mail pour ouvrir ton compte client${requestedRestaurant?.name ? ` sur ${requestedRestaurant.name}` : ""}.`}
          defaultUsername={isFoodDemo ? "foodclient" : "client"}
          defaultPassword={isFoodDemo ? "client123!" : "client123!"}
          endpoint="/api/client-auth/login"
          backAction={{ label: "Accueil", href: "/" }}
          theme={isFoodDemo ? "food" : "dark"}
          notice={
            resolvedSearchParams?.google === "disabled"
              ? "Google n’est pas encore configuré sur cette instance. Utilise la connexion e-mail ou configure GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET."
              : resolvedSearchParams?.google === "invalid_state"
                ? "Connexion Google interrompue. Recommence depuis le bouton Google."
                : resolvedSearchParams?.google
                  ? "Connexion Google en erreur. Recommence ou utilise la connexion e-mail."
                  : undefined
          }
          oauthAction={{
            label: "Continuer avec Google",
            href: `/api/client-auth/google/start?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}&returnTo=${encodeURIComponent(
              `/client?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}&focus=cart`,
            )}`,
            helperText:
              "Connexion sans mot de passe. Si le compte n'existe pas, il est créé automatiquement.",
          }}
          secondaryAction={{
            label: "Créer un compte client",
            href: `/client/signup?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`,
          }}
        />
      </main>
    );
    }

    if (!clientUser) {
      return <div>Aucun utilisateur client connecté.</div>;
    }

    const restaurant = sessionRestaurant ?? requestedRestaurant;
    if (!restaurant) {
      return <div>Aucun restaurant configuré.</div>;
    }

    if (requestedRestaurantSlug && requestedRestaurantSlug !== restaurant.slug) {
      return (
        <main className="internal-dark flex min-h-screen w-full items-center justify-center px-4">
          <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171717]/95 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Changer de démo</p>
            <h1 className="mt-2 text-3xl font-semibold">Tu es connecté à {restaurant.name}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Le lien demandé pointe vers {requestedRestaurant?.name ?? requestedRestaurantSlug}. Déconnecte-toi puis rouvre ce lien pour charger la bonne démo.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <DashboardLogoutButton
                endpoint="/api/client-auth/logout"
                label="Se déconnecter"
                redirectTo={`/client?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
              />
              <a
                href={`/client?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                Rouvrir Food 1
              </a>
            </div>
          </section>
        </main>
      );
    }

    const customer = await getOrCreateCustomerForUser(clientUser, restaurant.id);
    const tableSession = await getOrCreateTableSessionForCustomer(restaurant.id, customer, requestedTableId);
    const tables = await listTablesForRestaurant(restaurant.id);
    const orders = await listOrdersForRestaurant(restaurant.id);
    const displayLogo = restaurant.logoUrl || (restaurant.slug === "bar-1" ? "/logoNoirBar.png" : "/logoFood.png");
    const activeOrder =
      (tableSession.orderId ? orders.find((order) => order.id === tableSession.orderId) : null) ??
      orders.find(
        (order) =>
          order.status === "open" &&
          order.tableId === tableSession.tableId &&
          !order.deletedAt,
      ) ??
      null;

    return (
      <main className={restaurant.slug === "food-1" ? "food-theme min-h-screen w-full" : "internal-dark min-h-screen w-full"}>
        <div className={restaurant.slug === "food-1" ? "border-b border-[#eadfce] bg-[#fffdf8]/96 px-3 py-4 sm:px-4 lg:px-8" : "border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8"}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={displayLogo}
                alt={restaurant.name}
                className="h-11 w-11 rounded-2xl object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0">
                <p className={restaurant.slug === "food-1" ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>Client</p>
                <h1 className="truncate text-3xl font-semibold">{restaurant.name}</h1>
              </div>
            </div>
            <DashboardLogoutButton endpoint="/api/client-auth/logout" label="Déconnexion" />
          </div>
        </div>
        <ClientPortal
          restaurant={restaurant}
          clientUser={clientUser}
          customer={customer}
          tables={tables}
          tableSession={tableSession}
          activeOrder={activeOrder}
          focusCart={resolvedSearchParams?.focus === "cart"}
          orderFlowEnabled={restaurant.features.orderFlowEnabled}
          theme={restaurant.slug === "food-1" ? "food" : "dark"}
        />
      </main>
    );
  } catch (error) {
    console.error("[client-page]", error);
    return (
      <main className="food-theme flex min-h-screen w-full flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
        <section className="rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-4 text-[#24170f] shadow-[0_20px_60px_rgba(124,77,44,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]">Accès client</p>
          <h1 className="mt-2 text-3xl font-semibold">Le portail a rencontré un problème</h1>
          <p className="mt-2 text-sm leading-6 text-[#6f5b4a]">
            Recharge la page ou reconnecte-toi. Si le problème revient, l’accès client manque probablement encore d’un enregistrement Supabase.
          </p>
        </section>
      </main>
    );
  }
}
