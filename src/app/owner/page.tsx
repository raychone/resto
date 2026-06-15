import type { Metadata } from "next";
import { DashboardLogin } from "@/components/dashboard-login";
import { DashboardLogoutButton } from "@/components/dashboard-logout-button";
import { OwnerClient } from "@/components/owner-client";
import { isOwnerAuthenticated } from "@/lib/auth";
import { listInvoices } from "@/lib/billing-store";
import { listAuditEntries } from "@/lib/audit-store";
import { listRestaurants } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner",
  description: "Vue portefeuille, facturation et paramètres globaux.",
};

export default async function OwnerPage() {
  const authenticated = await isOwnerAuthenticated();

  if (!authenticated) {
    return (
      <DashboardLogin
        title="Connexion owner"
        description="Utilise owner / owner123! pour voir les restaurants, les factures et les capacités commerciales."
        defaultUsername="owner"
        defaultPassword="owner123!"
        endpoint="/api/owner-auth/login"
        backAction={{ label: "Accueil", href: "/" }}
      />
    );
  }

  const [restaurants, invoices, auditEntries] = await Promise.all([
    listRestaurants(),
    listInvoices(),
    listAuditEntries(),
  ]);

  return (
    <main className="internal-dark w-full">
      <div className="border-b border-white/10 bg-[#111111]/95 px-3 py-4 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Owner</p>
            <h1 className="text-3xl font-semibold">Portfolio restaurants</h1>
          </div>
          <DashboardLogoutButton endpoint="/api/owner-auth/logout" label="Déconnexion" redirectTo="/" />
        </div>
      </div>

      <OwnerClient
        initialRestaurants={restaurants}
        initialInvoices={invoices}
        initialAuditEntries={auditEntries}
      />
    </main>
  );
}
