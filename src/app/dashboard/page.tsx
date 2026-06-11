import type { Metadata } from "next";
import Link from "next/link";
import { DashboardClient } from "@/components/dashboard-client";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { getDashboardSessionUser, isDashboardAuthenticated } from "@/lib/auth";
import { getRestaurantById } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ restaurant?: string }>;
};

export const metadata: Metadata = {
  title: "Tableau de bord",
  description: "Gère les menus par restaurant, les images et les QR codes.",
};

export default async function DashboardPage({ searchParams }: Props) {
  const authenticated = await isDashboardAuthenticated();

  if (!authenticated) {
    return (
      <DashboardLogin
        title="Connexion au tableau de bord manager"
        description="Utilise raych / raychone! pour gérer le contenu, le branding et les menus."
        defaultUsername="raych"
        defaultPassword="raychone!"
        endpoint="/api/auth/login"
      />
    );
  }

  const [dashboardUser, query] = await Promise.all([getDashboardSessionUser(), searchParams]);
  const restaurant = dashboardUser?.restaurantId
    ? await getRestaurantById(dashboardUser.restaurantId)
    : null;

  if (!restaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  return (
    <main className="min-h-screen w-full">
      <section className="border-b border-black/8 bg-white/80 px-0 py-6 shadow-[0_24px_90px_rgba(15,23,42,0.04)] backdrop-blur">
        <div className="flex w-full flex-col gap-4 px-0 sm:px-0 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Tableau de bord
            </p>
            <h1 className="font-display text-4xl leading-none sm:text-5xl">
              Contrôle des menus par restaurant
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-black/65">
              Modifie les restaurants, les menus, les ingrédients, les allergènes,
              les prix, les images et les QR codes depuis un seul endroit.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DashboardLogoutButton endpoint="/api/auth/logout" label="Déconnexion" />
            <Link
              href={`/r/${query.restaurant ?? restaurant.slug}`}
              className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Voir le menu public
            </Link>
          </div>
        </div>
      </section>

      <div className="px-0 py-0">
        <DashboardClient
          initialRestaurants={[restaurant]}
          initialSelectedSlug={query.restaurant ?? restaurant.slug}
        />
      </div>
    </main>
  );
}
