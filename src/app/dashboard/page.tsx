import type { Metadata } from "next";
import Link from "next/link";
import { DashboardClient } from "@/components/dashboard-client";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { getDashboardSessionUser, isDashboardAuthenticated } from "@/lib/auth";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ restaurant?: string }>;
};

export const metadata: Metadata = {
  title: "Tableau de bord",
  description: "Gère les menus par restaurant, les images et les QR codes.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const requestedRestaurantSlug = resolvedSearchParams.restaurant?.trim() || null;
  const requestedRestaurant = requestedRestaurantSlug ? await getRestaurantBySlug(requestedRestaurantSlug) : null;
  const authenticated = await isDashboardAuthenticated();

  if (!authenticated) {
    const isFoodDemo = requestedRestaurantSlug === "food-1";
    return (
      <DashboardLogin
        title="Connexion au tableau de bord manager"
        description="Utilise manager / manager123! pour gérer le contenu, le branding et les menus."
        defaultUsername={isFoodDemo ? "foodmanager" : "manager"}
        defaultPassword="manager123!"
        endpoint="/api/auth/login"
        backAction={{ label: "Accueil", href: "/" }}
        theme={isFoodDemo ? "food" : "dark"}
      />
    );
  }

  const [dashboardUser] = await Promise.all([getDashboardSessionUser(), searchParams]);
  const restaurant = dashboardUser?.restaurantId
    ? await getRestaurantById(dashboardUser.restaurantId)
    : null;

  if (!restaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  if (requestedRestaurantSlug && requestedRestaurantSlug !== restaurant.slug) {
    return (
      <main className={requestedRestaurantSlug === "food-1" ? "food-theme flex min-h-screen w-full items-center justify-center px-4" : "internal-dark flex min-h-screen w-full items-center justify-center px-4"}>
        <section className={requestedRestaurantSlug === "food-1" ? "w-full max-w-md rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-6 text-[#24170f] shadow-[0_24px_90px_rgba(196,30,30,0.12)] backdrop-blur" : "w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171717]/95 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur"}>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Changer de démo</p>
          <h1 className="mt-2 text-3xl font-semibold">Tu es connecté à {restaurant.name}</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Le lien demandé pointe vers {requestedRestaurant?.name ?? requestedRestaurantSlug}. Déconnecte-toi puis rouvre ce lien pour charger la bonne démo.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <DashboardLogoutButton
              endpoint="/api/auth/logout"
              label="Se déconnecter"
              redirectTo={`/dashboard?restaurant=${encodeURIComponent(requestedRestaurantSlug)}`}
            />
            <a
              href={`/dashboard?restaurant=${encodeURIComponent(requestedRestaurantSlug)}`}
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
    <main className={restaurant.slug === "food-1" ? "food-theme min-h-screen w-full" : "internal-dark min-h-screen w-full"}>
      <section className={restaurant.slug === "food-1" ? "border-b border-[#eadfce] bg-[#fffdf8]/96 px-0 py-6 shadow-[0_24px_90px_rgba(196,30,30,0.08)] backdrop-blur" : "border-b border-white/10 bg-[#111111]/95 px-0 py-6 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur"}>
        <div className="flex w-full flex-col gap-4 px-0 sm:px-0 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className={restaurant.slug === "food-1" ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-black/40"}>
              Tableau de bord
            </p>
            <h1 className="font-display text-4xl leading-none sm:text-5xl">
              Contrôle des menus par restaurant
            </h1>
            <p className={restaurant.slug === "food-1" ? "max-w-3xl text-sm leading-6 text-[#6f5b4a]" : "max-w-3xl text-sm leading-6 text-black/65"}>
              Modifie les restaurants, les menus, les ingrédients, les allergènes,
              les prix, les images et les QR codes depuis un seul endroit.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DashboardLogoutButton endpoint="/api/auth/logout" label="Déconnexion" redirectTo="/" />
          <Link
            href={`/r/${resolvedSearchParams.restaurant ?? restaurant.slug}`}
            className={restaurant.slug === "food-1" ? "rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-2 text-sm font-medium text-white" : "rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"}
          >
            Voir le menu public
          </Link>
          </div>
        </div>
      </section>

      <div className="px-0 py-0">
        <DashboardClient
          initialRestaurants={[restaurant]}
          initialSelectedSlug={resolvedSearchParams.restaurant ?? restaurant.slug}
          theme={restaurant.slug === "food-1" ? "food" : "dark"}
        />
      </div>
    </main>
  );
}
