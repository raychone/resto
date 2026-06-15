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
  searchParams?: Promise<{ focus?: string; google?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : null;
  const authenticated = await isClientAuthenticated();

  if (!authenticated) {
    return (
      <DashboardLogin
        title="Connexion client"
        description="Utilise client / client123! ou ton e-mail pour ouvrir ton compte client."
        defaultUsername="client"
        defaultPassword="client123!"
        endpoint="/api/client-auth/login"
        backAction={{ label: "Accueil", href: "/" }}
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
          href: `/api/client-auth/google/start?restaurantSlug=bar-1&returnTo=${encodeURIComponent(
            "/client?focus=cart",
          )}`,
          helperText:
            "Connexion sans mot de passe. Si le compte n'existe pas, il est créé automatiquement.",
        }}
        secondaryAction={{
          label: "Créer un compte client",
          href: "/client/signup",
        }}
      />
    );
  }

  const clientUser = await getClientSessionUser();
  if (!clientUser) {
    return <div>Aucun utilisateur client connecté.</div>;
  }

  const restaurant = clientUser.restaurantId ? await getRestaurantById(clientUser.restaurantId) : null;
  if (!restaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  const noirOneRestaurant =
    restaurant.slug === "bar-1" ? restaurant : await getRestaurantBySlug("bar-1");

  if (!noirOneRestaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  const customer = await getOrCreateCustomerForUser(clientUser, noirOneRestaurant.id);
  const tableSession = await getOrCreateTableSessionForCustomer(noirOneRestaurant.id, customer);
  const tables = await listTablesForRestaurant(noirOneRestaurant.id);
  const orders = await listOrdersForRestaurant(noirOneRestaurant.id);
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
    <main className="internal-dark min-h-screen w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Client</p>
            <h1 className="text-3xl font-semibold">{noirOneRestaurant.name}</h1>
          </div>
          <DashboardLogoutButton endpoint="/api/client-auth/logout" label="Déconnexion" />
        </div>
      </div>
      <ClientPortal
        restaurant={noirOneRestaurant}
        clientUser={clientUser}
        customer={customer}
        tables={tables}
        tableSession={tableSession}
        activeOrder={activeOrder}
        focusCart={resolvedSearchParams?.focus === "cart"}
        orderFlowEnabled={noirOneRestaurant.features.orderFlowEnabled}
      />
    </main>
  );
}
