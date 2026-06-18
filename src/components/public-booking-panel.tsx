"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AvailableDay } from "@/lib/booking";
import { countTablesNeeded } from "@/lib/booking";
import type { Locale } from "@/lib/types";

const copy: Record<
  Locale,
  {
    closeButton: string;
    modalTitle: string;
    modalSubtitle: string;
    stepDate: string;
    stepGuests: string;
    stepTime: string;
    stepDetails: string;
    date: string;
    time: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    guests: string;
    message: string;
    bookButton: string;
    successTitle: string;
    success: string;
    error: string;
    sending: string;
    selectDateHint: string;
    selectGuestsHint: string;
    selectTimeHint: string;
    monthLabel: string;
    available: string;
    unavailable: string;
    noSlots: string;
    confirmedNote: string;
    notePlaceholder: string;
    tablesAvailable: string;
    tablesNeeded: string;
  }
> = {
  fr: {
    closeButton: "Fermer",
    modalTitle: "Réserver une table",
    modalSubtitle:
      "Choisissez d’abord une date, puis le nombre de personnes, puis l’heure. La demande part au staff du restaurant.",
    stepDate: "Date",
    stepGuests: "Personnes",
    stepTime: "Heure",
    stepDetails: "Coordonnées",
    date: "Date",
    time: "Heure",
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    email: "E-mail",
    guests: "Nombre de personnes",
    message: "Message pour le staff",
    bookButton: "Confirmer la réservation",
    successTitle: "Demande envoyée",
    success: "Votre demande a bien été transmise au restaurant. Vous recevrez une confirmation dès validation. Pour toute modification, contactez le restaurant.",
    error: "Impossible d'envoyer la réservation.",
    sending: "Envoi...",
    selectDateHint: "Cliquez sur une date disponible.",
    selectGuestsHint: "Choisissez le nombre de personnes avant de voir les horaires.",
    selectTimeHint: "Choisissez une heure disponible pour cette date.",
    monthLabel: "Calendrier",
    available: "disponible",
    unavailable: "indisponible",
    noSlots: "Aucun horaire disponible pour cette date.",
    confirmedNote:
      "Après validation, le client reçoit une confirmation par email ou message avec la possibilité de contacter le restaurant pour toute modification.",
    notePlaceholder:
      "Allergies, événement, terrasse, demande spécifique ou précision utile pour l’équipe.",
    tablesAvailable: "tables disponibles",
    tablesNeeded: "tables nécessaires",
  },
  en: {
    closeButton: "Close",
    modalTitle: "Book a table",
    modalSubtitle:
      "Pick a date first, then the number of guests, then a time. The request goes to the restaurant staff.",
    stepDate: "Date",
    stepGuests: "Guests",
    stepTime: "Time",
    stepDetails: "Details",
    date: "Date",
    time: "Time",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    email: "Email",
    guests: "Number of guests",
    message: "Message for staff",
    bookButton: "Confirm reservation",
    successTitle: "Request sent",
    success: "Your request has been sent to the restaurant. You will receive a confirmation once it is approved. For any changes, please contact the restaurant.",
    error: "Unable to send the reservation.",
    sending: "Sending...",
    selectDateHint: "Click on an available date.",
    selectGuestsHint: "Choose the number of guests before viewing times.",
    selectTimeHint: "Choose an available time for this date.",
    monthLabel: "Calendar",
    available: "available",
    unavailable: "unavailable",
    noSlots: "No available times for this date.",
    confirmedNote:
      "After approval, the client receives a confirmation by email or message with a note to contact the restaurant for any changes.",
    notePlaceholder:
      "Allergies, event, terrace, special request or any detail useful for the team.",
    tablesAvailable: "tables available",
    tablesNeeded: "tables needed",
  },
  it: {
    closeButton: "Chiudi",
    modalTitle: "Prenota un tavolo",
    modalSubtitle:
      "Scegli prima una data, poi il numero di persone, poi l’orario. La richiesta va allo staff del ristorante.",
    stepDate: "Data",
    stepGuests: "Persone",
    stepTime: "Ora",
    stepDetails: "Dati",
    date: "Data",
    time: "Ora",
    firstName: "Nome",
    lastName: "Cognome",
    phone: "Telefono",
    email: "E-mail",
    guests: "Numero di persone",
    message: "Messaggio per lo staff",
    bookButton: "Conferma prenotazione",
    successTitle: "Richiesta inviata",
    success: "La tua richiesta è stata inviata al ristorante. Riceverai una conferma dopo l’approvazione. Per modifiche, contatta il ristorante.",
    error: "Impossibile inviare la prenotazione.",
    sending: "Invio...",
    selectDateHint: "Clicca su una data disponibile.",
    selectGuestsHint: "Scegli il numero di persone prima di vedere gli orari.",
    selectTimeHint: "Scegli un orario disponibile per questa data.",
    monthLabel: "Calendario",
    available: "disponibile",
    unavailable: "non disponibile",
    noSlots: "Nessun orario disponibile per questa data.",
    confirmedNote:
      "Dopo l’approvazione, il cliente riceve una conferma via email o messaggio con l’invito a contattare il ristorante per eventuali modifiche.",
    notePlaceholder:
      "Allergie, evento, terrazza, richiesta speciale o dettaglio utile per il team.",
    tablesAvailable: "tavoli disponibili",
    tablesNeeded: "tavoli necessari",
  },
  es: {
    closeButton: "Cerrar",
    modalTitle: "Reservar una mesa",
    modalSubtitle:
      "Elige primero una fecha, luego el número de personas y después la hora. La solicitud va al personal del restaurante.",
    stepDate: "Fecha",
    stepGuests: "Personas",
    stepTime: "Hora",
    stepDetails: "Datos",
    date: "Fecha",
    time: "Hora",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono",
    email: "Correo",
    guests: "Número de personas",
    message: "Mensaje para el personal",
    bookButton: "Confirmar reserva",
    successTitle: "Solicitud enviada",
    success: "Tu solicitud ha sido enviada al restaurante. Recibirás una confirmación cuando sea aprobada. Para cambios, contacta al restaurante.",
    error: "No se pudo enviar la reserva.",
    sending: "Enviando...",
    selectDateHint: "Haz clic en una fecha disponible.",
    selectGuestsHint: "Elige el número de personas antes de ver los horarios.",
    selectTimeHint: "Elige una hora disponible para esta fecha.",
    monthLabel: "Calendario",
    available: "disponible",
    unavailable: "no disponible",
    noSlots: "No hay horas disponibles para esta fecha.",
    confirmedNote:
      "Tras la aprobación, el cliente recibe una confirmación por email o mensaje con la indicación de contactar al restaurante para cualquier cambio.",
    notePlaceholder:
      "Alergias, evento, terraza, solicitud especial o cualquier detalle útil para el equipo.",
    tablesAvailable: "mesas disponibles",
    tablesNeeded: "mesas necesarias",
  },
};

type Props = {
  restaurantSlug: string;
  locale: Locale;
  seatsPerTable: number;
  initialAvailability: AvailableDay[];
};

type PhoneCountryCode = "FR" | "BE" | "IT" | "ES" | "CH";

const phoneCountries: Record<PhoneCountryCode, { label: string; dialCode: string }> = {
  FR: { label: "FR", dialCode: "+33" },
  BE: { label: "BE", dialCode: "+32" },
  IT: { label: "IT", dialCode: "+39" },
  ES: { label: "ES", dialCode: "+34" },
  CH: { label: "CH", dialCode: "+41" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0, 0);
}

function addDays(date: Date, offset: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + offset);
  return nextDate;
}

function buildCalendarGrid(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate);
  const leadingDays = firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, -leadingDays);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatMonthLabel(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : locale === "it" ? "it-IT" : "es-ES",
    { month: "long", year: "numeric" },
  ).format(date);
}

function formatShortWeekday(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : locale === "it" ? "it-IT" : "es-ES",
    { weekday: "short" },
  )
    .format(date)
    .replace(".", "");
}

function formatDayNumber(date: Date) {
  return String(date.getDate());
}

export function PublicBookingPanel({
  restaurantSlug,
  locale,
  seatsPerTable,
  initialAvailability,
}: Props) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState(initialAvailability);
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>("FR");
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    note: "",
  });
  const [bookingState, setBookingState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );

  const availabilityMap = useMemo(
    () => new Map(availability.map((day) => [day.date, day])),
    [availability],
  );
  const calendarDays = useMemo(() => buildCalendarGrid(displayMonth), [displayMonth]);
  const selectedDay = selectedDate ? availabilityMap.get(selectedDate) ?? null : null;
  const tablesNeeded = countTablesNeeded(guestCount, seatsPerTable);
  const selectedSlot =
    selectedDay?.slots.find(
      (slot) => slot.time === selectedTime && slot.availableTables >= tablesNeeded,
    ) ?? null;
  const currentStep = !selectedDate ? 1 : !selectedTime ? 2 : !isFormComplete(form) ? 3 : 4;
  const selectedPhonePrefix = phoneCountries[phoneCountry];
  const selectedDateLabel =
    selectedDay?.label ??
    (selectedDate
      ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : locale === "it" ? "it-IT" : "es-ES", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }).format(new Date(`${selectedDate}T12:00:00`))
      : "—");

  const refreshAvailability = useCallback(async (monthDate: Date) => {
    const response = await fetch(
      `/api/restaurants/${restaurantSlug}/availability?from=${encodeURIComponent(formatDateKey(monthDate))}&days=42&lang=${locale}`,
      { cache: "no-store" },
    );
    if (!response.ok) return;
    const payload = (await response.json()) as { availability: AvailableDay[] };
    setAvailability(payload.availability);
  }, [locale, restaurantSlug]);

  function goToMonth(offset: number) {
    setDisplayMonth((current) => addMonths(current, offset));
    setSelectedDate("");
    setSelectedTime("");
    setBookingState("idle");
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedTime("");
    setBookingState("idle");
    setPickerMode(null);
  }

  function selectTime(time: string) {
    setSelectedTime(time);
    setBookingState("idle");
    setPickerMode(null);
  }

  function formatPhoneNumber(phoneNumber: string) {
    return phoneNumber.replace(/[^\d]/g, "").trim();
  }

  function buildPhoneValue() {
    const national = formatPhoneNumber(form.phone);
    if (!national) return "";
    const normalizedNational = national.startsWith("0") ? national.slice(1) : national;
    return `${selectedPhonePrefix.dialCode}${normalizedNational}`;
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDate || !selectedSlot || !isFormComplete(form)) return;

    setBookingState("saving");
    const response = await fetch(`/api/restaurants/${restaurantSlug}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: buildPhoneValue(),
        email: form.email,
        note: form.note,
        date: selectedDate,
        time: selectedSlot.time,
        guestCount: Number(guestCount),
      }),
    });

    if (!response.ok) {
      setBookingState("error");
      return;
    }

    setBookingState("done");
    setForm({ firstName: "", lastName: "", phone: "", email: "", note: "" });
    await refreshAvailability(displayMonth);
  }

  useEffect(() => {
    function openBookingModal() {
      setOpen(true);
    }

    window.addEventListener("open-booking-modal", openBookingModal);
    return () => window.removeEventListener("open-booking-modal", openBookingModal);
  }, []);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      void refreshAvailability(displayMonth);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, displayMonth, refreshAvailability]);

  useEffect(() => {
    if (!open && !pickerMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, pickerMode]);

  const monthHeader = formatMonthLabel(displayMonth, locale);
  const dayHeaders =
    locale === "fr"
      ? ["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."]
      : locale === "en"
        ? ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
        : locale === "it"
          ? ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"]
          : ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const availableTimeSlots = selectedDay?.slots.filter(
    (slot) => slot.availableTables >= tablesNeeded,
  );

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45 p-2 sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.28)]">
            <div className="flex h-full w-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-black/8 px-4 py-4 sm:px-6">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                    {text.monthLabel} • {monthHeader}
                  </p>
                  <h2 className="text-2xl font-semibold sm:text-3xl">{text.modalTitle}</h2>
                  <p className="max-w-3xl text-sm leading-6 text-black/60">
                    {text.modalSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  {text.closeButton}
                </button>
              </div>

              <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[1.12fr_0.88fr]">
                <div className="space-y-4">
                  <StepHeader
                    currentStep={currentStep}
                  />

                  <section className="rounded-[1.75rem] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                          {text.stepDate}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">{monthHeader}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToMonth(-1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-xl text-black transition hover:bg-black/3"
                          aria-label="Previous month"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => goToMonth(1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-xl text-black transition hover:bg-black/3"
                          aria-label="Next month"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
                      {dayHeaders.map((label) => (
                        <div
                          key={label}
                          className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 sm:text-[11px]"
                        >
                          {label}
                        </div>
                      ))}

                      {calendarDays.map((day) => {
                        const dayKey = formatDateKey(day);
                        const dayInfo = availabilityMap.get(dayKey) ?? null;
                        const isSelected = selectedDate === dayKey;
                        const isCurrent = isSameMonth(day, displayMonth);
                        const hasSlots =
                          !!dayInfo && dayInfo.slots.some((slot) => slot.availableTables >= tablesNeeded);
                        const totalSlots = dayInfo?.slots.length ?? 0;
                        const busyPercent =
                          dayInfo && totalSlots > 0
                            ? Math.round(
                                (dayInfo.slots.filter(
                                  (slot) => slot.availableTables < tablesNeeded,
                                ).length /
                                  totalSlots) *
                                  100,
                              )
                            : 0;
                        const intensity = Math.max(0.08, Math.min(0.38, busyPercent / 280));

                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => isCurrent && dayInfo ? selectDate(dayKey) : undefined}
                            disabled={!isCurrent || !dayInfo}
                            className={`relative flex min-h-[4rem] flex-col overflow-hidden rounded-2xl border p-1.5 text-left transition sm:min-h-[5rem] sm:p-2 ${
                              isSelected
                                ? "border-black bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                                : !isCurrent || !dayInfo
                                  ? "border-black/5 bg-black/2 text-black/20"
                                  : hasSlots
                                    ? "border-black/10 bg-white text-black hover:bg-black/3"
                                    : "border-black/5 bg-black/2 text-black/30"
                            }`}
                            style={
                              !isSelected && isCurrent && dayInfo
                                ? {
                                    backgroundImage: `linear-gradient(180deg, rgba(239,68,68,${intensity}), rgba(255,255,255,0.96))`,
                                  }
                                : undefined
                            }
                          >
                            <span className="text-[10px] uppercase tracking-[0.16em] opacity-70 sm:text-[11px]">
                              {formatShortWeekday(day, locale)}
                            </span>
                            <span className="mt-1 text-base font-semibold leading-none sm:text-xl">
                              {formatDayNumber(day)}
                            </span>
                            <span className="mt-auto flex items-center gap-1 text-[10px] leading-none sm:text-[11px]">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isSelected
                                    ? "bg-white"
                                    : hasSlots
                                      ? "bg-emerald-500"
                                      : "bg-black/20"
                                }`}
                              />
                            </span>
                            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-black/5">
                              <span
                                className={`block h-full rounded-full ${
                                  busyPercent >= 75
                                    ? "bg-rose-500"
                                    : busyPercent >= 45
                                      ? "bg-amber-400"
                                      : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.max(8, 100 - busyPercent)}%` }}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-sm text-black/55">{text.selectDateHint}</p>
                  </section>

                  <section
                    className={`rounded-[1.75rem] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5 ${
                      selectedDate ? "border-black/8 bg-white" : "border-black/5 bg-black/2"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                          {text.stepDate}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">{selectedDateLabel}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerMode("date")}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-black/3"
                      >
                        <span aria-hidden>🗓️</span>
                        Choisir une date
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-black/55">{text.selectDateHint}</p>
                  </section>

                  <section
                    className={`rounded-[1.75rem] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5 ${
                      selectedDate ? "border-black/8 bg-white" : "border-black/5 bg-black/2"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                          {text.stepGuests}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">
                          Persons {guestCount}
                        </h3>
                      </div>
                      <p className="text-sm text-black/55">{text.selectGuestsHint}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border border-black/8 bg-white px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setGuestCount((value) => Math.max(1, value - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-xl transition hover:bg-black/3 disabled:opacity-30"
                        disabled={!selectedDate || guestCount <= 1}
                        aria-label="Decrease guests"
                      >
                        ‹
                      </button>
                      <div className="text-center">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-black/35">
                          {text.guests}
                        </p>
                        <p className="text-3xl font-semibold leading-none">{guestCount}</p>
                        <p className="mt-1 text-sm text-black/55">{tablesNeeded} {text.tablesNeeded}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGuestCount((value) => value + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-xl transition hover:bg-black/3 disabled:opacity-30"
                        disabled={!selectedDate}
                        aria-label="Increase guests"
                      >
                        ›
                      </button>
                    </div>
                  </section>

                  <section
                    className={`rounded-[1.75rem] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5 ${
                      selectedDate ? "border-black/8 bg-white" : "border-black/5 bg-black/2"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                          {text.stepTime}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">
                          {selectedTime || selectedDay?.label || text.noSlots}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerMode("time")}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-black/3"
                        disabled={!selectedDate}
                      >
                        <span aria-hidden>🕒</span>
                        Choisir une heure
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-black/55">{text.selectTimeHint}</p>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-[1.75rem] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                      {text.stepDetails}
                    </p>
                    <div className="mt-3 space-y-3 rounded-[1.25rem] border border-black/8 bg-black/2 p-4 text-sm text-black/70">
                      <div className="flex items-center justify-between gap-3">
                        <span>{text.date}</span>
                        <span className="font-medium text-black">
                          {selectedDay?.label ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{text.guests}</span>
                        <span className="font-medium text-black">{guestCount}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{text.time}</span>
                        <span className="font-medium text-black">
                          {selectedSlot?.time ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{text.tablesAvailable}</span>
                        <span className="font-medium text-black">
                          {selectedSlot ? selectedSlot.availableTables : "—"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-black/60">{text.confirmedNote}</p>
                  </section>

                  <form
                    onSubmit={submitReservation}
                    className={`rounded-[1.75rem] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-5 ${
                      selectedSlot && isFormComplete(form)
                        ? "border-black/8 bg-white"
                        : "border-black/5 bg-black/2"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
                        {text.stepDetails}
                      </p>
                      <h3 className="text-xl font-semibold">{text.modalTitle}</h3>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field
                        label={text.firstName}
                        value={form.firstName}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, firstName: value }))
                        }
                        disabled={!selectedSlot}
                        required
                      />
                      <Field
                        label={text.lastName}
                        value={form.lastName}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, lastName: value }))
                        }
                        disabled={!selectedSlot}
                        required
                      />
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                          {text.phone}
                        </span>
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                          <select
                            value={phoneCountry}
                            onChange={(event) => setPhoneCountry(event.target.value as PhoneCountryCode)}
                            disabled={!selectedSlot}
                            className="rounded-[1.3rem] border border-black/10 bg-white px-3 py-3 text-sm text-black outline-none disabled:cursor-not-allowed disabled:bg-black/2"
                          >
                            {Object.entries(phoneCountries).map(([code, entry]) => (
                              <option key={code} value={code}>
                                {entry.dialCode}
                              </option>
                            ))}
                          </select>
                          <input
                            value={form.phone}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, phone: event.target.value }))
                            }
                            disabled={!selectedSlot}
                            required
                            inputMode="tel"
                            placeholder={phoneCountry === "FR" ? "6 12 34 56 78" : ""}
                            className="rounded-[1.3rem] border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none disabled:cursor-not-allowed disabled:bg-black/2"
                          />
                        </div>
                      </label>
                      <Field
                        label={text.email}
                        value={form.email}
                        onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                        disabled={!selectedSlot}
                        required
                        type="email"
                      />
                    </div>

                    <label className="mt-3 grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
                        {text.message}
                      </span>
                      <textarea
                        value={form.note}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, note: event.target.value }))
                        }
                        rows={4}
                        disabled={!selectedSlot}
                        placeholder={text.notePlaceholder}
                        className="rounded-[1.5rem] border border-black/10 bg-white px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-black/2"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={!selectedSlot || !isFormComplete(form) || bookingState === "saving"}
                      className="mt-4 w-full rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {bookingState === "saving" ? text.sending : text.bookButton}
                    </button>

                    {bookingState === "done" ? (
                      <div className="mt-4 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                          {text.successTitle}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-emerald-900/85">
                          {text.success}
                        </p>
                      </div>
                    ) : bookingState === "error" ? (
                      <p className="mt-3 text-sm text-red-600">{text.error}</p>
                    ) : null}
                  </form>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {open && pickerMode ? (
        <div className="fixed inset-0 z-[60] bg-black/35 p-2 sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
            <div className="w-full overflow-hidden rounded-[2rem] border border-black/8 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-black/8 px-4 py-4 sm:px-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-black/35">
                    {pickerMode === "date" ? text.stepDate : text.stepTime}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {pickerMode === "date" ? text.monthLabel : selectedDay?.label ?? text.noSlots}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerMode(null)}
                  className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  {text.closeButton}
                </button>
              </div>

              <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-4 sm:p-6">
                {pickerMode === "date" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black"
                      >
                        ‹
                      </button>
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/45">
                        {monthHeader}
                      </p>
                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black"
                      >
                        ›
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {dayHeaders.map((label) => (
                        <div
                          key={label}
                          className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 sm:text-[11px]"
                        >
                          {label}
                        </div>
                      ))}
                      {calendarDays.map((day) => {
                        const dayKey = formatDateKey(day);
                        const dayInfo = availabilityMap.get(dayKey) ?? null;
                        const isCurrent = isSameMonth(day, displayMonth);
                        const hasSlots =
                          !!dayInfo && dayInfo.slots.some((slot) => slot.availableTables >= tablesNeeded);
                        const isSelected = selectedDate === dayKey;

                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => isCurrent && dayInfo ? selectDate(dayKey) : undefined}
                            disabled={!isCurrent || !dayInfo}
                            className={`min-h-[4.3rem] rounded-2xl border p-2 text-left transition ${
                              isSelected
                                ? "border-black bg-black text-white"
                                : !isCurrent || !dayInfo
                                  ? "border-black/5 bg-black/2 text-black/20"
                                  : hasSlots
                                    ? "border-black/10 bg-white text-black hover:bg-black/3"
                                    : "border-black/5 bg-black/2 text-black/30"
                            }`}
                          >
                            <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">
                              {formatShortWeekday(day, locale)}
                            </p>
                            <p className="mt-1 text-lg font-semibold leading-none">
                              {formatDayNumber(day)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[1.5rem] border border-black/8 bg-black/2 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-black/35">
                            {text.date}
                          </p>
                          <p className="mt-1 text-base font-semibold text-black">{selectedDateLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPickerMode("date")}
                          className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black"
                        >
                          {text.stepDate}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDate ? (
                        availableTimeSlots?.length ? (
                          availableTimeSlots.map((slot) => {
                            const isSelected = selectedTime === slot.time;
                            return (
                              <button
                                key={`${selectedDate}-${slot.time}`}
                                type="button"
                                onClick={() => selectTime(slot.time)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                  isSelected
                                    ? "border-black bg-black text-white"
                                    : "border-black/10 bg-white text-black hover:bg-black/3"
                                }`}
                              >
                                {slot.time}
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-sm text-black/45">{text.noSlots}</p>
                        )
                      ) : (
                        <p className="text-sm text-black/45">{text.selectDateHint}</p>
                      )}
                    </div>
                    <p className="text-sm text-black/55">{text.selectTimeHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function isFormComplete(form: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  note: string;
}) {
  return Boolean(form.firstName.trim() && form.lastName.trim() && form.phone.trim() && form.email.trim());
}

function StepHeader({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-[1.5rem] border border-black/8 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.04)] sm:p-4">
      {[1, 2, 3, 4].map((step) => {
        const isActive = currentStep >= step;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                isActive ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/35"
              }`}
            >
              {step}
            </div>
            <div className={`h-[2px] flex-1 rounded-full ${isActive ? "bg-black" : "bg-black/10"}`} />
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required?: boolean;
  type?: "text" | "email";
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-black/2"
      />
    </label>
  );
}
