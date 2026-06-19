"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AuditEntry } from "@/lib/audit-store";
import { humanizeAuditEntry } from "@/lib/audit-humanize";
import { type Invoice, type InvoiceStatus } from "@/lib/billing-store";
import type { Restaurant } from "@/lib/types";

type Props = {
  initialRestaurants: Restaurant[];
  initialInvoices: Invoice[];
  initialAuditEntries: AuditEntry[];
};

type InvoiceDraft = {
  restaurantSlug: string;
  kind: "setup" | "maintenance";
  periodLabel: string;
  amount: number;
  currency: string;
  includeDomain: boolean;
  includeDatabase: boolean;
  includeQrMenu: boolean;
  includeBooking: boolean;
  includeSms: boolean;
  notes: string;
};

type RestaurantDraft = {
  name: string;
  slug: string;
  uberEatsUrl: string;
  tripAdvisorUrl: string;
  managerName: string;
  managerUsername: string;
  managerPassword: string;
  staffName: string;
  staffUsername: string;
  staffPassword: string;
};

const invoiceCoverageFields = [
  { key: "includeDomain", label: "Domaine" },
  { key: "includeDatabase", label: "Base de données" },
  { key: "includeQrMenu", label: "QR menu" },
  { key: "includeBooking", label: "Réservations" },
  { key: "includeSms", label: "SMS" },
] as const;

function money(value: number, currency: string) {
  const rounded = Math.round(value * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return currency === "EUR"
    ? `${formatted}€`
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(rounded);
}

function summarizeInvoiceCoverage(invoice: Pick<Invoice, "includeDomain" | "includeDatabase" | "includeQrMenu" | "includeBooking" | "includeSms">) {
  return [
    invoice.includeDomain ? "domaine" : null,
    invoice.includeDatabase ? "base de données" : null,
    invoice.includeQrMenu ? "QR" : null,
    invoice.includeBooking ? "réservations" : null,
    invoice.includeSms ? "SMS" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function statusMeta(status: InvoiceStatus) {
  if (status === "paid") {
    return { label: "Payée", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (status === "sent") {
    return { label: "Envoyée", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  if (status === "cancelled") {
    return { label: "Annulée", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  return { label: "Brouillon", className: "bg-amber-50 text-amber-800 border-amber-200" };
}

export function OwnerClient({ initialRestaurants, initialInvoices, initialAuditEntries }: Props) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [auditEntries] = useState(initialAuditEntries);
  const [savingRestaurantSlug, setSavingRestaurantSlug] = useState<string | null>(null);
  const [testingNotificationSlug, setTestingNotificationSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceStatus | "all">("all");
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft>(() => ({
    restaurantSlug: initialRestaurants[0]?.slug ?? "",
    kind: "setup",
    periodLabel: "Installation initiale",
    amount: 990,
    currency: "EUR",
    includeDomain: true,
    includeDatabase: true,
    includeQrMenu: true,
    includeBooking: true,
    includeSms: false,
    notes: "",
  }));
  const [restaurantDraft, setRestaurantDraft] = useState<RestaurantDraft>(() => ({
    name: "Nouveau restaurant",
    slug: "",
    uberEatsUrl: "",
    tripAdvisorUrl: "",
    managerName: "Manager",
    managerUsername: "",
    managerPassword: "",
    staffName: "Staff",
    staffUsername: "",
    staffPassword: "",
  }));
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  const selectedRestaurant = useMemo(
    () => restaurants.find((entry) => entry.slug === draft.restaurantSlug) ?? restaurants[0],
    [draft.restaurantSlug, restaurants],
  );

  const totals = useMemo(() => {
    const activeRestaurants = restaurants.filter((entry) => entry.features.qrMode !== "off").length;
    const bookingOn = restaurants.filter((entry) => entry.features.bookingEnabled).length;
    return {
      restaurants: restaurants.length,
      activeRestaurants,
      bookingOn,
      smsOn: restaurants.filter((entry) => entry.features.smsAlertsEnabled).length,
      invoices: invoices.length,
      revenue: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    };
  }, [restaurants, invoices]);

  const sortedInvoices = useMemo(
    () =>
      [...invoices].sort((left, right) => {
        const rank = (status: InvoiceStatus) =>
          status === "draft" ? 0 : status === "sent" ? 1 : status === "paid" ? 2 : 3;
        return rank(left.status) - rank(right.status) || right.createdAt.localeCompare(left.createdAt);
      }),
    [invoices],
  );

  const invoiceStats = useMemo(() => {
    const draftCount = invoices.filter((invoice) => invoice.status === "draft").length;
    const sentCount = invoices.filter((invoice) => invoice.status === "sent").length;
    const paidCount = invoices.filter((invoice) => invoice.status === "paid").length;
    const cancelledCount = invoices.filter((invoice) => invoice.status === "cancelled").length;
    return { draftCount, sentCount, paidCount, cancelledCount };
  }, [invoices]);

  const billingSummary = useMemo(() => {
    const setupInvoices = invoices.filter((invoice) => invoice.kind === "setup");
    const maintenanceInvoices = invoices.filter((invoice) => invoice.kind === "maintenance");
    const setupRevenue = setupInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const maintenanceRevenue = maintenanceInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const coverageCounts = {
      domain: invoices.filter((invoice) => invoice.includeDomain).length,
      database: invoices.filter((invoice) => invoice.includeDatabase).length,
      qrMenu: invoices.filter((invoice) => invoice.includeQrMenu).length,
      booking: invoices.filter((invoice) => invoice.includeBooking).length,
      sms: invoices.filter((invoice) => invoice.includeSms).length,
    };

    const topCoverage = [
      coverageCounts.domain > 0 ? `Domaine (${coverageCounts.domain})` : null,
      coverageCounts.database > 0 ? `DB (${coverageCounts.database})` : null,
      coverageCounts.qrMenu > 0 ? `QR (${coverageCounts.qrMenu})` : null,
      coverageCounts.booking > 0 ? `Booking (${coverageCounts.booking})` : null,
      coverageCounts.sms > 0 ? `SMS (${coverageCounts.sms})` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      setupInvoices: setupInvoices.length,
      maintenanceInvoices: maintenanceInvoices.length,
      setupRevenue,
      maintenanceRevenue,
      coverageCounts,
      topCoverage: topCoverage || "Aucune couverture",
    };
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    if (invoiceFilter === "all") {
      return sortedInvoices;
    }

    return sortedInvoices.filter((invoice) => invoice.status === invoiceFilter);
  }, [invoiceFilter, sortedInvoices]);

  function applyInvoicePreset(preset: "starter" | "pro" | "premium") {
    if (preset === "starter") {
      setDraft((current) => ({
        ...current,
        kind: "setup",
        periodLabel: "Pack Starter",
        amount: 490,
        includeDomain: true,
        includeDatabase: true,
        includeQrMenu: true,
        includeBooking: false,
        includeSms: false,
        notes: "Pack d'entrée pour restaurant solo ou petite équipe.",
      }));
      return;
    }

    if (preset === "pro") {
      setDraft((current) => ({
        ...current,
        kind: "setup",
        periodLabel: "Pack Pro",
        amount: 990,
        includeDomain: true,
        includeDatabase: true,
        includeQrMenu: true,
        includeBooking: true,
        includeSms: false,
        notes: "Pack optimisé pour réservation et menu QR.",
      }));
      return;
    }

    setDraft((current) => ({
      ...current,
      kind: "setup",
      periodLabel: "Pack Premium",
      amount: 1490,
      includeDomain: true,
      includeDatabase: true,
      includeQrMenu: true,
      includeBooking: true,
      includeSms: true,
      notes: "Pack complet avec réservation, QR, SMS et support renforcé.",
    }));
  }

  async function updateRestaurantSettings(
    restaurantSlug: string,
    patch: Partial<Pick<Restaurant, "plan" | "status">>,
  ) {
    const restaurant = restaurants.find((entry) => entry.slug === restaurantSlug);
    if (!restaurant) {
      setMessage("Restaurant introuvable.");
      return;
    }

    setSavingRestaurantSlug(restaurantSlug);
    setMessage(null);

    const response = await fetch(`/api/restaurants/${restaurantSlug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...restaurant, ...patch }),
    });

    if (!response.ok) {
      setSavingRestaurantSlug(null);
      setMessage("Impossible de mettre à jour le restaurant.");
      return;
    }

    const nextRestaurant = (await response.json()) as Restaurant;
    setRestaurants((current) =>
      current.map((entry) => (entry.id === nextRestaurant.id ? nextRestaurant : entry)),
    );
    setSavingRestaurantSlug(null);
    setMessage("Paramètres du restaurant enregistrés.");
  }

  async function updateRestaurantFeatures(
    restaurantSlug: string,
    patch: Partial<
      Pick<
        Restaurant["features"],
        | "orderFlowEnabled"
        | "clientLoginEnabled"
        | "waiterValidationEnabled"
        | "kitchenWorkflowEnabled"
        | "servedConfirmationEnabled"
        | "bookingEnabled"
        | "qrMode"
        | "notificationProvider"
        | "whatsappAlertsEnabled"
        | "smsAlertsEnabled"
        | "googleReviewsEnabled"
      >
    >,
  ) {
    const restaurant = restaurants.find((entry) => entry.slug === restaurantSlug);
    if (!restaurant) {
      setMessage("Restaurant introuvable.");
      return;
    }

    setSavingRestaurantSlug(restaurantSlug);
    setMessage(null);

    const response = await fetch(`/api/restaurants/${restaurantSlug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...restaurant,
        features: {
          ...restaurant.features,
          ...patch,
        },
      }),
    });

    if (!response.ok) {
      setSavingRestaurantSlug(null);
      setMessage("Impossible de mettre à jour les modules du restaurant.");
      return;
    }

    const nextRestaurant = (await response.json()) as Restaurant;
    setRestaurants((current) =>
      current.map((entry) => (entry.id === nextRestaurant.id ? nextRestaurant : entry)),
    );
    setSavingRestaurantSlug(null);
    setMessage("Modules du restaurant enregistrés.");
  }

  async function updateRestaurantLinks(
    restaurantSlug: string,
    patch: Partial<Pick<Restaurant, "uberEatsUrl" | "tripAdvisorUrl">>,
  ) {
    const restaurant = restaurants.find((entry) => entry.slug === restaurantSlug);
    if (!restaurant) {
      setMessage("Restaurant introuvable.");
      return;
    }

    setSavingRestaurantSlug(restaurantSlug);
    setMessage(null);

    const response = await fetch(`/api/restaurants/${restaurantSlug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...restaurant, ...patch }),
    });

    if (!response.ok) {
      setSavingRestaurantSlug(null);
      setMessage("Impossible de mettre à jour les liens du restaurant.");
      return;
    }

    const nextRestaurant = (await response.json()) as Restaurant;
    setRestaurants((current) =>
      current.map((entry) => (entry.id === nextRestaurant.id ? nextRestaurant : entry)),
    );
    setSavingRestaurantSlug(null);
    setMessage("Liens du restaurant enregistrés.");
  }

  async function testRestaurantNotification(restaurantSlug: string) {
    const restaurant = restaurants.find((entry) => entry.slug === restaurantSlug);
    if (!restaurant) {
      setMessage("Restaurant introuvable.");
      return;
    }

    setTestingNotificationSlug(restaurantSlug);
    setMessage(null);

    const response = await fetch(`/api/restaurants/${restaurantSlug}/notifications/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: restaurant.features.notificationProvider,
        locale: "fr",
        firstName: "Jean",
        lastName: "Dupont",
        phone: restaurant.phone,
        email: "client@example.com",
        note: "Réservation de test depuis le panneau owner",
        date: new Date().toISOString().slice(0, 10),
        time: "19:30",
        guestCount: 2,
      }),
    });

    if (!response.ok) {
      setTestingNotificationSlug(null);
      setMessage("Impossible d'envoyer le test de notification.");
      return;
    }

    const payload = (await response.json()) as {
      provider: string;
      sent: boolean;
      details?: string;
      composerUrl?: string;
    };

    if (payload.composerUrl) {
      window.open(payload.composerUrl, "_blank", "noopener,noreferrer");
    }

    const label =
      payload.provider === "android"
        ? "composer SMS ouvert"
        : payload.sent
          ? "notification envoyée"
          : payload.details ?? "test terminé";
    setMessage(`${restaurant.name} — ${label}.`);
    setTestingNotificationSlug(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const restaurant = restaurants.find((entry) => entry.slug === draft.restaurantSlug);
    if (!restaurant) {
      setSaving(false);
      setMessage("Restaurant introuvable.");
      return;
    }

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        restaurantName: restaurant.name,
      }),
    });

    if (!response.ok) {
      setSaving(false);
      setMessage("Impossible de créer la facture.");
      return;
    }

    const invoice = (await response.json()) as Invoice;
    setInvoices((current) => [invoice, ...current]);
    setSaving(false);
    setMessage("Facture créée.");
  }

  async function createRestaurantBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingRestaurant(true);
    setMessage(null);

    const response = await fetch("/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: restaurantDraft.name,
        slug: restaurantDraft.slug,
        uberEatsUrl: restaurantDraft.uberEatsUrl,
        tripAdvisorUrl: restaurantDraft.tripAdvisorUrl,
        initialUsers: [
          restaurantDraft.managerUsername && restaurantDraft.managerPassword
            ? {
                role: "manager" as const,
                name: restaurantDraft.managerName,
                username: restaurantDraft.managerUsername,
                temporaryPassword: restaurantDraft.managerPassword,
              }
            : null,
          restaurantDraft.staffUsername && restaurantDraft.staffPassword
            ? {
                role: "staff" as const,
                name: restaurantDraft.staffName,
                username: restaurantDraft.staffUsername,
                temporaryPassword: restaurantDraft.staffPassword,
              }
            : null,
        ].filter(Boolean),
      }),
    });

    if (!response.ok) {
      setCreatingRestaurant(false);
      setMessage("Impossible de créer le restaurant.");
      return;
    }

    const restaurant = (await response.json()) as Restaurant;
    setRestaurants((current) => [restaurant, ...current]);
    setRestaurantDraft((current) => ({
      ...current,
      name: "Nouveau restaurant",
      slug: "",
      uberEatsUrl: "",
      tripAdvisorUrl: "",
      managerName: "Manager",
      managerUsername: "",
      managerPassword: "",
      staffName: "Staff",
      staffUsername: "",
      staffPassword: "",
    }));
    setCreatingRestaurant(false);
    setMessage("Restaurant créé.");
  }

  async function updateInvoice(invoiceId: string, patch: Partial<Pick<Invoice, "status" | "notes">>) {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) return;

    const next = (await response.json()) as Invoice;
    setInvoices((current) => current.map((invoice) => (invoice.id === next.id ? next : invoice)));
  }

  async function removeInvoice(invoiceId: string) {
    const response = await fetch(`/api/invoices/${invoiceId}`, {
      method: "DELETE",
    });

    if (!response.ok) return;
    setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));
  }

  return (
    <main className="internal-dark min-h-screen w-full px-3 py-4 sm:px-4 lg:px-8">
      <section className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Owner</p>
            <h1 className="font-display text-4xl leading-none sm:text-5xl">
              Portefeuille restaurants
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">
              Vue d&apos;ensemble, capacité commerciale, et facturation initiale / maintenance.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Restaurants" value={totals.restaurants} />
            <Metric label="Réservations actives" value={totals.bookingOn} />
            <Metric label="QR actifs" value={totals.activeRestaurants} />
            <Metric label="SMS actifs" value={totals.smsOn} />
            <Metric label="CA facturé" value={money(totals.revenue, "EUR")} />
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-black/8 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Onboarding notifications
              </p>
              <h2 className="mt-1 text-xl font-semibold">Configurer et tester en un seul écran</h2>
              <p className="mt-1 text-sm leading-6 text-black/60">
                Si tu veux onboarder un restaurant rapidement, suis simplement les 3 étapes
                ci-dessous. Tu peux ensuite lancer un test instantané sans quitter cette page.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="#owner-capabilities"
                className="rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white"
              >
                Aller aux modules
              </a>
              <a
                href="#owner-notification-test"
                className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black"
              >
                Aller au test
              </a>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              {
                step: "1",
                title: "Choisis le restaurant",
                text: selectedRestaurant
                  ? `Actuellement: ${selectedRestaurant.name}`
                  : "Sélectionne une fiche restaurant dans la liste.",
              },
              {
                step: "2",
                title: "Vérifie le provider",
                text: selectedRestaurant
                  ? `Provider: ${selectedRestaurant.features.notificationProvider}`
                  : "Android SMS, Twilio ou WhatsApp Business selon le cas.",
              },
              {
                step: "3",
                title: "Lance le test",
                text: "Le bouton ci-dessous ouvre le composer ou envoie le message automatique selon le provider.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-[1.2rem] border border-black/8 bg-black/2 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">{item.step}</p>
                <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-black/60">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <nav className="sticky top-3 z-20 rounded-[1.75rem] border border-black/8 bg-white/90 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {[
              { href: "#owner-capabilities", label: "Modules" },
              { href: "#owner-notification-test", label: "Test" },
              { href: "#owner-billing", label: "Factures" },
              { href: "#owner-history", label: "Audit" },
              { href: "#owner-create", label: "Créer" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-black/10 bg-black/3 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-black/6"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div
          id="owner-notification-test"
          className="mt-5 rounded-[1.5rem] border border-black/8 bg-black/2 p-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Test rapide des notifications
              </p>
              <h2 className="mt-1 text-xl font-semibold">Vérifie le provider en 30 secondes</h2>
              <p className="mt-1 text-sm leading-6 text-black/60">
                Choisis un restaurant, puis lance un test. Si le provider est Android, l&apos;app
                ouvre directement le composer SMS. Si le provider est Twilio ou WhatsApp Business,
                le serveur tente l&apos;envoi automatique.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={draft.restaurantSlug}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, restaurantSlug: event.target.value }))
                }
                className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.slug} value={restaurant.slug}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => testRestaurantNotification(draft.restaurantSlug)}
                disabled={testingNotificationSlug === draft.restaurantSlug}
                className="rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {testingNotificationSlug === draft.restaurantSlug ? "Test..." : "Tester notification"}
              </button>
            </div>
          </div>
          {message ? <p className="mt-3 text-sm text-black/70">{message}</p> : null}
        </div>

        <form
          id="owner-create"
          onSubmit={createRestaurantBundle}
          className="mt-5 rounded-[1.5rem] border border-black/8 bg-white p-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                Nouveau restaurant
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Créer un restaurant avec manager et staff
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/60">
                Tu peux créer le restaurant et ses premiers comptes en une seule fois. Les mots
                de passe sont temporaires et devront être changés au premier login.
              </p>
            </div>

            <button
              type="submit"
              disabled={creatingRestaurant}
              className="rounded-full border border-black/10 bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {creatingRestaurant ? "Création..." : "Créer le restaurant"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                Nom du restaurant
              </span>
              <input
                value={restaurantDraft.name}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                Slug public
              </span>
              <input
                value={restaurantDraft.slug}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="ex: bar-1"
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                Lien Uber Eats
              </span>
              <input
                value={restaurantDraft.uberEatsUrl}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({ ...current, uberEatsUrl: event.target.value }))
                }
                placeholder="https://www.ubereats.com/..."
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                Lien TripAdvisor
              </span>
              <input
                value={restaurantDraft.tripAdvisorUrl}
                onChange={(event) =>
                  setRestaurantDraft((current) => ({
                    ...current,
                    tripAdvisorUrl: event.target.value,
                  }))
                }
                placeholder="https://www.tripadvisor.com/..."
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.25rem] border border-black/8 bg-black/2 p-4">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Manager</p>
              <div className="mt-3 grid gap-3">
                <input
                  value={restaurantDraft.managerName}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      managerName: event.target.value,
                    }))
                  }
                  placeholder="Nom"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                />
                <input
                  value={restaurantDraft.managerUsername}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      managerUsername: event.target.value,
                    }))
                  }
                  placeholder="Username"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                />
                <div className="relative">
                  <input
                    value={restaurantDraft.managerPassword}
                    onChange={(event) =>
                      setRestaurantDraft((current) => ({
                        ...current,
                        managerPassword: event.target.value,
                      }))
                    }
                    placeholder="Mot de passe temporaire"
                    type={showManagerPassword ? "text" : "password"}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 pr-12 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowManagerPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-black/45"
                    aria-label={showManagerPassword ? "Masquer le mot de passe manager" : "Afficher le mot de passe manager"}
                  >
                    {showManagerPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-black/8 bg-black/2 p-4">
              <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
              <div className="mt-3 grid gap-3">
                <input
                  value={restaurantDraft.staffName}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      staffName: event.target.value,
                    }))
                  }
                  placeholder="Nom"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                />
                <input
                  value={restaurantDraft.staffUsername}
                  onChange={(event) =>
                    setRestaurantDraft((current) => ({
                      ...current,
                      staffUsername: event.target.value,
                    }))
                  }
                  placeholder="Username"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                />
                <div className="relative">
                  <input
                    value={restaurantDraft.staffPassword}
                    onChange={(event) =>
                      setRestaurantDraft((current) => ({
                        ...current,
                        staffPassword: event.target.value,
                      }))
                    }
                    placeholder="Mot de passe temporaire"
                    type={showStaffPassword ? "text" : "password"}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 pr-12 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-black/45"
                    aria-label={showStaffPassword ? "Masquer le mot de passe staff" : "Afficher le mot de passe staff"}
                  >
                    {showStaffPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <div
            id="owner-capabilities"
            className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Capabilities
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.slug}
                  className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{restaurant.name}</h2>
                      <p className="text-sm text-black/55">{restaurant.slug}</p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{
                        backgroundColor: `${restaurant.accent}18`,
                        color: restaurant.accent,
                      }}
                    >
                      {restaurant.features.qrMode.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    <Badge active={restaurant.features.orderFlowEnabled}>Order flow</Badge>
                    <Badge active={restaurant.features.bookingEnabled}>Booking</Badge>
                    <Badge active={restaurant.features.whatsappAlertsEnabled}>WhatsApp</Badge>
                    <Badge active={restaurant.features.smsAlertsEnabled}>SMS</Badge>
                    <Badge active={restaurant.features.googleReviewsEnabled}>Reviews</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                        Plan
                      </span>
                      <select
                        value={restaurant.plan}
                        onChange={(event) =>
                          setRestaurants((current) =>
                            current.map((entry) =>
                              entry.id === restaurant.id
                                ? { ...entry, plan: event.target.value as Restaurant["plan"] }
                                : entry,
                            ),
                          )
                        }
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                        Statut
                      </span>
                      <select
                        value={restaurant.status}
                        onChange={(event) =>
                          setRestaurants((current) =>
                            current.map((entry) =>
                              entry.id === restaurant.id
                                ? {
                                    ...entry,
                                    status: event.target.value as Restaurant["status"],
                                  }
                                : entry,
                            ),
                          )
                        }
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                      >
                        <option value="lead">Lead</option>
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-black/8 bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                      Modules
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                          QR mode
                        </span>
                        <select
                          value={restaurant.features.qrMode}
                          onChange={(event) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        qrMode: event.target.value as Restaurant["features"]["qrMode"],
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                        >
                          <option value="pdf">PDF</option>
                          <option value="menu">Menu web</option>
                          <option value="off">Off</option>
                        </select>
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                          Notification
                        </span>
                        <select
                          value={restaurant.features.notificationProvider}
                          onChange={(event) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        notificationProvider: event.target.value as Restaurant["features"]["notificationProvider"],
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                        >
                          <option value="android">Android SMS</option>
                          <option value="whatsapp_business">WhatsApp Business</option>
                          <option value="twilio">Twilio</option>
                          <option value="off">Off</option>
                        </select>
                      </label>

                      <div className="grid gap-2">
                        <FeatureToggle
                          label="Order flow"
                          active={restaurant.features.orderFlowEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        orderFlowEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Client login"
                          active={restaurant.features.clientLoginEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        clientLoginEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Waiter validation"
                          active={restaurant.features.waiterValidationEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        waiterValidationEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Kitchen workflow"
                          active={restaurant.features.kitchenWorkflowEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        kitchenWorkflowEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Served confirmation"
                          active={restaurant.features.servedConfirmationEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        servedConfirmationEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Booking"
                          active={restaurant.features.bookingEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        bookingEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="WhatsApp"
                          active={restaurant.features.whatsappAlertsEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        whatsappAlertsEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="SMS"
                          active={restaurant.features.smsAlertsEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        smsAlertsEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <FeatureToggle
                          label="Google Reviews"
                          active={restaurant.features.googleReviewsEnabled}
                          onChange={(checked) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? {
                                      ...entry,
                                      features: {
                                        ...entry.features,
                                        googleReviewsEnabled: checked,
                                      },
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateRestaurantFeatures(restaurant.slug, {
                            orderFlowEnabled: restaurant.features.orderFlowEnabled,
                            clientLoginEnabled: restaurant.features.clientLoginEnabled,
                            waiterValidationEnabled: restaurant.features.waiterValidationEnabled,
                            kitchenWorkflowEnabled: restaurant.features.kitchenWorkflowEnabled,
                            servedConfirmationEnabled: restaurant.features.servedConfirmationEnabled,
                            bookingEnabled: restaurant.features.bookingEnabled,
                            qrMode: restaurant.features.qrMode,
                            notificationProvider: restaurant.features.notificationProvider,
                            whatsappAlertsEnabled: restaurant.features.whatsappAlertsEnabled,
                            smsAlertsEnabled: restaurant.features.smsAlertsEnabled,
                            googleReviewsEnabled: restaurant.features.googleReviewsEnabled,
                          })
                        }
                        disabled={savingRestaurantSlug === restaurant.slug}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        {savingRestaurantSlug === restaurant.slug ? "Enregistrement..." : "Sauver les modules"}
                      </button>
                      <button
                        type="button"
                        onClick={() => testRestaurantNotification(restaurant.slug)}
                        disabled={testingNotificationSlug === restaurant.slug}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        {testingNotificationSlug === restaurant.slug ? "Test..." : "Tester notification"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                          Lien Uber Eats
                        </span>
                        <input
                          value={restaurant.uberEatsUrl}
                          onChange={(event) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? { ...entry, uberEatsUrl: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="https://www.ubereats.com/..."
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-black/45">
                          Lien TripAdvisor
                        </span>
                        <input
                          value={restaurant.tripAdvisorUrl}
                          onChange={(event) =>
                            setRestaurants((current) =>
                              current.map((entry) =>
                                entry.id === restaurant.id
                                  ? { ...entry, tripAdvisorUrl: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="https://www.tripadvisor.com/..."
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateRestaurantLinks(restaurant.slug, {
                            uberEatsUrl: restaurant.uberEatsUrl,
                            tripAdvisorUrl: restaurant.tripAdvisorUrl,
                          })
                        }
                        disabled={savingRestaurantSlug === restaurant.slug}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        {savingRestaurantSlug === restaurant.slug
                          ? "Enregistrement..."
                          : "Sauver les liens"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateRestaurantSettings(restaurant.slug, {
                        plan: restaurant.plan,
                        status: restaurant.status,
                      })}
                      disabled={savingRestaurantSlug === restaurant.slug}
                      className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingRestaurantSlug === restaurant.slug ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="owner-billing"
            className="scroll-mt-28 rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Factures
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Setup" value={`${billingSummary.setupInvoices} / ${money(billingSummary.setupRevenue, "EUR")}`} />
              <Metric label="Maintenance" value={`${billingSummary.maintenanceInvoices} / ${money(billingSummary.maintenanceRevenue, "EUR")}`} />
              <Metric label="Couverture principale" value={billingSummary.topCoverage} />
              <Metric label="Factures totales" value={invoices.length} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {invoiceStats.draftCount} brouillons
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {invoiceStats.sentCount} envoyées
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {invoiceStats.paidCount} payées
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                {invoiceStats.cancelledCount} annulées
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { key: "all", label: "Toutes" },
                { key: "draft", label: "Brouillons" },
                { key: "sent", label: "Envoyées" },
                { key: "paid", label: "Payées" },
                { key: "cancelled", label: "Annulées" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setInvoiceFilter(filter.key as InvoiceStatus | "all")}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    invoiceFilter === filter.key
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black hover:bg-black/3"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {visibleInvoices.map((invoice) => {
                const meta = statusMeta(invoice.status);

                return (
                  <article
                    key={invoice.id}
                    className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-black/40">
                          {invoice.restaurantName} · {invoice.kind}
                        </p>
                        <h3 className="text-lg font-semibold">{invoice.periodLabel}</h3>
                        <p className="text-sm text-black/60">{invoice.notes || "—"}</p>
                        <p className="text-sm text-black/55">
                          {summarizeInvoiceCoverage(invoice)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${meta.className}`}>
                          {meta.label}
                        </span>
                        <p className="text-xl font-semibold">
                          {money(invoice.amount, invoice.currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateInvoice(invoice.id, { status: "sent" })}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
                      >
                        Envoyer
                      </button>
                      <button
                        type="button"
                        onClick={() => updateInvoice(invoice.id, { status: "paid" })}
                        className="rounded-full border border-black/10 bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        Payée
                      </button>
                      <button
                        type="button"
                        onClick={() => updateInvoice(invoice.id, { status: "cancelled" })}
                        className="rounded-full border border-black/10 bg-rose-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInvoice(invoice.id)}
                        className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div
            id="owner-history"
            className="scroll-mt-28 rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Historique global
            </p>
            <div className="mt-4 space-y-3">
              {auditEntries.length === 0 ? (
                <p className="text-sm text-black/55">Aucun log pour le moment.</p>
              ) : (
                auditEntries.slice(0, 12).map((entry) => {
                  const humanized = humanizeAuditEntry(entry);

                  return (
                    <article key={entry.id} className="rounded-[1.4rem] border border-black/8 bg-black/2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{humanized.title}</p>
                          <p className="text-xs text-black/55">
                            {entry.restaurantSlug} · {entry.actorRole} · {entry.actorName}
                          </p>
                          {humanized.subtitle ? <p className="mt-1 text-xs text-black/55">{humanized.subtitle}</p> : null}
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(entry.createdAt))}
                        </span>
                      </div>
                      {humanized.details ? <p className="mt-2 text-sm text-black/65">{humanized.details}</p> : null}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <form
            id="owner-create"
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Nouvelle facture
            </p>
            <p className="mt-2 text-sm text-black/55">
              {selectedRestaurant ? `Restaurant sélectionné: ${selectedRestaurant.name}` : null}
            </p>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Presets
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyInvoicePreset("starter")}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium"
                  >
                    Starter
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInvoicePreset("pro")}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium"
                  >
                    Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => applyInvoicePreset("premium")}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium"
                  >
                    Premium
                  </button>
                </div>
              </div>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Restaurant
                </span>
                <select
                  value={draft.restaurantSlug}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      restaurantSlug: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                >
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.slug} value={restaurant.slug}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Type
                </span>
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as "setup" | "maintenance",
                    }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                >
                  <option value="setup">Setup</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Période
                </span>
                <input
                  value={draft.periodLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, periodLabel: event.target.value }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Montant
                </span>
                <input
                  type="number"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>

              <div className="grid gap-2 rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                {invoiceCoverageFields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{field.label}</span>
                    <input
                      type="checkbox"
                      checked={draft[field.key]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field.key]: event.target.checked,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-black/45">Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={4}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                />
              </label>

              {message ? <p className="text-sm text-black/60">{message}</p> : null}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Création..." : "Créer la facture"}
              </button>
            </div>
          </form>

          <div className="rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
              Couverture
            </p>
            <p className="mt-3 text-sm leading-6 text-black/65">
              Domain + DB + QR + booking + SMS peuvent être inclus ou exclus par restaurant
              lors d&apos;une nouvelle installation ou d&apos;une maintenance.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
      <p className="text-[11px] uppercase tracking-[0.25em] text-black/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Badge({ active, children }: { active: boolean; children: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/10 bg-white text-black/45"
      }`}
    >
      {children}
    </span>
  );
}

function FeatureToggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-black/2 px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={active}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-black/20"
      />
    </label>
  );
}
