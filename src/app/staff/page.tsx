import type { Metadata } from "next";
import { StaffClient } from "@/components/staff-client";
import { StaffLogin } from "@/components/staff-login";
import { StaffLogoutButton } from "@/components/staff-logout-button";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";
import { getStaffSessionUser, isStaffAuthenticated } from "@/lib/auth";
import { getActiveTableSessionForRestaurant } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page staff",
  description: "Gère les réservations et l'audit côté restaurant.",
};

type Props = {
  searchParams?: Promise<{ restaurantSlug?: string }>;
};

export default async function StaffPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : null;
  const requestedRestaurantSlug = resolvedSearchParams?.restaurantSlug?.trim() || null;
  const requestedRestaurant = requestedRestaurantSlug ? await getRestaurantBySlug(requestedRestaurantSlug) : null;
  const authenticated = await isStaffAuthenticated();

  if (!authenticated) {
    return <StaffLogin restaurantSlug={requestedRestaurantSlug ?? undefined} restaurantName={requestedRestaurant?.name} />;
  }

  const staffUser = await getStaffSessionUser();
  if (!staffUser) {
    return <div>Aucun utilisateur staff connecté.</div>;
  }

  const restaurant = staffUser?.restaurantId
    ? await getRestaurantById(staffUser.restaurantId)
    : null;

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
              endpoint="/api/staff-auth/logout"
              label="Se déconnecter"
              redirectTo={`/staff?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
            />
            <a
              href={`/staff?restaurantSlug=${encodeURIComponent(requestedRestaurantSlug)}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Rouvrir Food 1
            </a>
          </div>
        </section>
      </main>
    );
  }
  const tableSession = await getActiveTableSessionForRestaurant(restaurant.id);

  return (
    <main className="internal-dark min-h-screen w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
            <h1 className="text-3xl font-semibold">{restaurant.name}</h1>
          </div>
          <StaffLogoutButton label="Déconnexion" />
        </div>
      </div>
      <StaffClient
        restaurant={restaurant}
        staffUserId={staffUser.id}
        locale="fr"
        tableSession={tableSession}
        orderFlowEnabled={restaurant.features.orderFlowEnabled}
      />
    </main>
  );
}
