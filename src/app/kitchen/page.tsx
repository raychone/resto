import type { Metadata } from "next";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { KitchenClient } from "@/components/kitchen-client";
import { getKitchenSessionUser, isKitchenAuthenticated } from "@/lib/auth";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen",
  description: "Flux cuisine pour les commandes.",
};

export default async function KitchenPage() {
  const authenticated = await isKitchenAuthenticated();

  if (!authenticated) {
    return (
      <DashboardLogin
        title="Connexion cuisine"
        description="Utilise kitchen / kitchen123! pour voir les commandes à préparer."
        defaultUsername="kitchen"
        defaultPassword="kitchen123!"
        endpoint="/api/kitchen-auth/login"
        backAction={{ label: "Accueil", href: "/" }}
      />
    );
  }

  const kitchenUser = await getKitchenSessionUser();
  if (!kitchenUser) {
    return <div>Aucun utilisateur cuisine connecté.</div>;
  }

  const restaurant = kitchenUser.restaurantId ? await getRestaurantById(kitchenUser.restaurantId) : null;

  if (!restaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  const noirOneRestaurant =
    restaurant.slug === "bar-1" ? restaurant : await getRestaurantBySlug("bar-1");

  if (!noirOneRestaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  return (
    <main className="internal-dark min-h-screen w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Kitchen</p>
            <h1 className="text-3xl font-semibold">{noirOneRestaurant.name}</h1>
          </div>
          <DashboardLogoutButton endpoint="/api/kitchen-auth/logout" label="Déconnexion" redirectTo="/" />
        </div>
      </div>
      <KitchenClient
        restaurant={noirOneRestaurant}
        kitchenUserId={kitchenUser.id}
        orderFlowEnabled={noirOneRestaurant.features.orderFlowEnabled}
      />
    </main>
  );
}
