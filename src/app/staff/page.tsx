import type { Metadata } from "next";
import { StaffClient } from "@/components/staff-client";
import { StaffLogin } from "@/components/staff-login";
import { StaffLogoutButton } from "@/components/staff-logout-button";
import { getRestaurantById, getRestaurantBySlug } from "@/lib/restaurant-store";
import { getStaffSessionUser, isStaffAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page staff",
  description: "Gère les réservations et l'audit côté restaurant.",
};

export default async function StaffPage() {
  const authenticated = await isStaffAuthenticated();

  if (!authenticated) {
    return <StaffLogin />;
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

  const noirOneRestaurant =
    restaurant.slug === "bar-1" ? restaurant : await getRestaurantBySlug("bar-1");

  if (!noirOneRestaurant) {
    return <div>Aucun restaurant configuré.</div>;
  }

  return (
    <main className="internal-dark min-h-screen w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
            <h1 className="text-3xl font-semibold">{noirOneRestaurant.name}</h1>
          </div>
          <StaffLogoutButton label="Déconnexion" />
        </div>
      </div>
      <StaffClient
        restaurant={noirOneRestaurant}
        staffUserId={staffUser.id}
        locale="fr"
      />
    </main>
  );
}
