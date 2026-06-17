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

type Props = {
  searchParams?: Promise<{ restaurantSlug?: string }>;
};

export default async function KitchenPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : null;
  const requestedRestaurantSlug = query?.restaurantSlug?.trim() || null;
  const requestedRestaurant = requestedRestaurantSlug ? await getRestaurantBySlug(requestedRestaurantSlug) : null;
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
              endpoint="/api/kitchen-auth/logout"
              label="Se déconnecter"
              redirectTo={`/kitchen?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
            />
            <a
              href={`/kitchen?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Rouvrir Food 1
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="internal-dark min-h-screen w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Kitchen</p>
            <h1 className="text-3xl font-semibold">{restaurant.name}</h1>
          </div>
          <DashboardLogoutButton endpoint="/api/kitchen-auth/logout" label="Déconnexion" redirectTo="/" />
        </div>
      </div>
      <KitchenClient
        restaurant={restaurant}
        kitchenUserId={kitchenUser.id}
        orderFlowEnabled={restaurant.features.orderFlowEnabled}
      />
    </main>
  );
}
