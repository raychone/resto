"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AuditEntry } from "@/lib/audit-store";
import type { Locale, Reservation } from "@/lib/types";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
  locale: Locale;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function StaffClient({ restaurantSlug, restaurantName, locale }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    guestCount: 2,
    note: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [reservationResponse, auditResponse] = await Promise.all([
      fetch(`/api/restaurants/${restaurantSlug}/reservations`, { cache: "no-store" }),
      fetch(`/api/restaurants/${restaurantSlug}/audit`, { cache: "no-store" }),
    ]);

    if (reservationResponse.ok) {
      const payload = (await reservationResponse.json()) as { reservations: Reservation[] };
      setReservations(payload.reservations);
    }

    if (auditResponse.ok) {
      const payload = (await auditResponse.json()) as { auditEntries: AuditEntry[] };
      setAuditEntries(payload.auditEntries);
    }

    setLoading(false);
  }, [restaurantSlug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/restaurants/${restaurantSlug}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        note: form.note,
        date: form.date,
        time: form.time,
        guestCount: Number(form.guestCount),
      }),
    });

    if (!response.ok) {
      setNotice("Impossible de créer la réservation.");
      return;
    }

    setForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      date: "",
      time: "",
      guestCount: 2,
      note: "",
    });
    setNotice("Réservation créée.");
    await loadData();
  }

  async function mutateReservation(
    reservationId: string,
    action: "confirmed" | "cancelled" | "delete",
  ) {
    const response = await fetch(
      `/api/restaurants/${restaurantSlug}/reservations/${reservationId}`,
      {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: action === "delete" ? undefined : JSON.stringify({ status: action }),
      },
    );

    if (!response.ok) {
      setNotice("Action impossible.");
      return;
    }

    setNotice(action === "delete" ? "Réservation supprimée." : "Réservation mise à jour.");
    await loadData();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6">
      <section className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">Staff</p>
            <h1 className="font-display text-4xl">{restaurantName}</h1>
            <p className="mt-2 text-sm text-black/60">
              Gestion des réservations, confirmations, suppressions et audit.
            </p>
          </div>
          <div className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white">
            {loading ? "Chargement..." : `${reservations.length} réservations`}
          </div>
        </div>
        {notice ? <p className="mt-3 text-sm text-black/60">{notice}</p> : null}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <form
            onSubmit={submitReservation}
            className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <h2 className="text-2xl font-semibold">Créer une réservation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Prénom"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Nom"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Téléphone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="E-mail"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Heure"
                type="time"
                value={form.time}
                onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
              <input
                placeholder="Personnes"
                type="number"
                min={1}
                value={form.guestCount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, guestCount: Number(event.target.value) }))
                }
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>
            <textarea
              placeholder="Message"
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows={4}
              className="mt-3 w-full rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none"
            />
            <button className="mt-3 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">
              Ajouter
            </button>
          </form>

          <div className="grid gap-3">
            {reservations.map((reservation) => (
              <article
                key={reservation.id}
                className="rounded-[1.5rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {reservation.firstName} {reservation.lastName}
                    </p>
                    <p className="text-sm text-black/60">
                      {formatDate(reservation.date)} • {reservation.time} • {reservation.guestCount} pers.
                    </p>
                    <p className="mt-1 text-sm text-black/60">
                      {reservation.phone} • {reservation.email || "—"}
                    </p>
                    <p className="mt-2 text-sm text-black/70">{reservation.note || "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => mutateReservation(reservation.id, "confirmed")}
                      className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => mutateReservation(reservation.id, "cancelled")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => mutateReservation(reservation.id, "delete")}
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-black/40">
                  {reservation.status}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-black/8 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold">Audit</h2>
            <div className="mt-4 space-y-3">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-black/8 bg-black/2 p-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-black/40">
                    {entry.actorRole} • {entry.actorName}
                  </p>
                  <p className="mt-1 text-sm font-medium">{entry.action}</p>
                  <p className="text-xs text-black/55">{entry.details ?? ""}</p>
                  <p className="text-xs text-black/40">{new Date(entry.createdAt).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
