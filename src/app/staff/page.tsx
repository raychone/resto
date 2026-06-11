import type { Metadata } from "next";
import { StaffClient } from "@/components/staff-client";
import { StaffLogin } from "@/components/staff-login";
import { StaffLogoutButton } from "@/components/staff-logout-button";
import { getRestaurantById } from "@/lib/restaurant-store";
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

  return (
    <main>
      <div className="border-b border-black/8 bg-white/80 px-3 py-4 sm:px-4 lg:px-6">
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
      />
    </main>
  );
}
