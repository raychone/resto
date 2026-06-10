"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AuditEntry } from "@/lib/audit-store";
import type { Locale, Reservation } from "@/lib/types";
import {
  buildWhatsAppReservationMessage,
  buildWhatsAppUrl,
} from "@/lib/contact-links";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
  whatsappNumber: string;
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

function formatWhatsappDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function statusMeta(status: Reservation["status"]) {
  if (status === "confirmed") {
    return {
      label: "CONFIRMÉE",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "cancelled") {
    return {
      label: "ANNULÉE",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  return {
    label: "EN ATTENTE",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  };
}

function statusRank(status: Reservation["status"]) {
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  return 2;
}

export function StaffClient({ restaurantSlug, restaurantName, whatsappNumber, locale }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reservationFilter, setReservationFilter] = useState<
    "all" | "pending" | "confirmed" | "cancelled" | "today"
  >("all");
  const [auditOpen, setAuditOpen] = useState(false);
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

  const todayKey = new Intl.DateTimeFormat("fr-CA").format(new Date());

  const reservationStats = useMemo(() => {
    const pending = reservations.filter((reservation) => reservation.status === "pending").length;
    const confirmed = reservations.filter((reservation) => reservation.status === "confirmed").length;
    const cancelled = reservations.filter((reservation) => reservation.status === "cancelled").length;
    const today = reservations.filter((reservation) => reservation.date === todayKey).length;
    return { pending, confirmed, cancelled, today };
  }, [reservations, todayKey]);

  const visibleReservations = useMemo(() => {
    const sorted = [...reservations].sort((left, right) => {
      const statusDelta = statusRank(left.status) - statusRank(right.status);
      if (statusDelta !== 0) return statusDelta;
      const dateDelta = left.date.localeCompare(right.date);
      if (dateDelta !== 0) return dateDelta;
      return left.time.localeCompare(right.time);
    });

    if (reservationFilter === "all") return sorted;
    if (reservationFilter === "today") {
      return sorted.filter((reservation) => reservation.date === todayKey);
    }

    return sorted.filter((reservation) => reservation.status === reservationFilter);
  }, [reservations, reservationFilter, todayKey]);

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
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {reservationStats.pending} pending
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {reservationStats.confirmed} confirmées
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {reservationStats.cancelled} annulées
            </span>
            <div className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white">
              {loading ? "Chargement..." : `${reservations.length} réservations`}
            </div>
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

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "Tous" },
              { key: "pending", label: "Pending" },
              { key: "confirmed", label: "Confirmées" },
              { key: "cancelled", label: "Annulées" },
              { key: "today", label: "Aujourd'hui" },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setReservationFilter(filter.key as typeof reservationFilter)}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  reservationFilter === filter.key
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black hover:bg-black/3"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {visibleReservations.map((reservation) => (
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
                    <span
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                        statusMeta(reservation.status).className
                      }`}
                    >
                      {statusMeta(reservation.status).label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status !== "confirmed" ? (
                      <button
                        type="button"
                        onClick={() => mutateReservation(reservation.id, "confirmed")}
                        className="rounded-full border border-black/10 bg-black px-3 py-2 text-xs font-medium text-white"
                      >
                        Confirmer
                      </button>
                    ) : null}
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
                    {whatsappNumber ? (
                      <a
                        href={buildWhatsAppUrl(
                          whatsappNumber,
                          buildWhatsAppReservationMessage({
                            restaurantName,
                            firstName: reservation.firstName,
                            lastName: reservation.lastName,
                            guestCount: reservation.guestCount,
                            time: reservation.time,
                            dateLabel: formatWhatsappDate(reservation.date),
                          }),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-black/10 bg-[#25D366] px-3 py-2 text-xs font-medium text-white"
                      >
                        WhatsApp
                      </a>
                    ) : null}
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
            <button
              type="button"
              onClick={() => setAuditOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                  Historique
                </p>
                <h2 className="text-2xl font-semibold">Audit</h2>
              </div>
              <span className="rounded-full border border-black/10 bg-black/3 px-3 py-1 text-xs font-medium text-black/60">
                {auditOpen ? "Masquer" : "Afficher"}
              </span>
            </button>

            {auditOpen ? (
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
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
