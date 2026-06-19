import type { Metadata } from "next";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { ClientPortal } from "@/components/client-portal";
import { getClientSessionUser, isClientAuthenticated } from "@/lib/auth";
import { getOrCreateCustomerForUser } from "@/lib/customer-store";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";
import { listOrdersForRestaurant } from "@/lib/order-store";
import { getOrCreateTableSessionForCustomer } from "@/lib/table-session-store";
import { listTablesForRestaurant } from "@/lib/table-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client",
  description: "Compte client et futur loyalty.",
};

export default async function ClientPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string; google?: string; restaurantSlug?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : null;
  const authenticated = await isClientAuthenticated();
  const clientUser = authenticated ? await getClientSessionUser() : null;
  const sessionRestaurant = clientUser?.restaurantId ? await getRestaurantById(clientUser.restaurantId) : null;
  const requestedRestaurantSlug = resolvedSearchParams?.restaurantSlug?.trim() || sessionRestaurant?.slug || "bar-1";
  const requestedRestaurant = await getRestaurantBySlug(requestedRestaurantSlug);

  if (!authenticated) {
    const isFoodDemo = requestedRestaurantSlug === "food-1";
    return (
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
    );
  }

  if (!clientUser) {
    return <div>Aucun utilisateur client connecté.</div>;
  }

  const restaurant = sessionRestaurant;
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
  const tableSession = await getOrCreateTableSessionForCustomer(restaurant.id, customer);
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
}
