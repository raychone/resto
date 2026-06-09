import type { Locale, Reservation, Restaurant, WeeklyHour } from "@/lib/types";

export type AvailableSlot = {
  time: string;
  availableTables: number;
  reservedTables: number;
  totalTables: number;
};

export type AvailableDay = {
  date: string;
  label: string;
  isToday: boolean;
  slots: AvailableSlot[];
};

const bookingDurationMinutes = 120;
const slotStepMinutes = 30;

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : locale === "en" ? "en-GB" : locale === "it" ? "it-IT" : "es-ES",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
    },
  ).format(date);
}

function overlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && startB < endA;
}

function getWeekdayKey(date: Date): WeeklyHour["day"] {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()] as WeeklyHour["day"];
}

export function getAvailableDays(
  restaurant: Restaurant,
  reservations: Reservation[],
  options?: {
    locale?: Locale;
    startDate?: Date;
    dayCount?: number;
  },
): AvailableDay[] {
  const locale = options?.locale ?? "fr";
  const startDate = options?.startDate ?? new Date();
  const dayCount = options?.dayCount ?? 14;
  const todayKey = formatDateKey(new Date());

  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(startDate, index);
    const weekDay = getWeekdayKey(date);
    const dayConfig = restaurant.weeklyHours.find((entry) => entry.day === weekDay);
    const dateKey = formatDateKey(date);
    const sameDayReservations = reservations.filter(
      (reservation) =>
        reservation.restaurantSlug === restaurant.slug && reservation.date === dateKey,
    );

    const slots: AvailableSlot[] = [];

    if (dayConfig && !dayConfig.closed) {
      for (const interval of dayConfig.intervals) {
        if (!interval.start || !interval.end) continue;

        const intervalStart = toMinutes(interval.start);
        const intervalEnd = toMinutes(interval.end);

        for (
          let cursor = intervalStart;
          cursor + bookingDurationMinutes <= intervalEnd;
          cursor += slotStepMinutes
        ) {
          const slotStart = cursor;
          const slotEnd = cursor + bookingDurationMinutes;
          const reservedTables = sameDayReservations.reduce((count, reservation) => {
            const reservationStart = toMinutes(reservation.time);
            const reservationEnd = reservationStart + bookingDurationMinutes;
            return overlap(slotStart, slotEnd, reservationStart, reservationEnd)
              ? count + reservation.tablesNeeded
              : count;
          }, 0);

          const availableTables = Math.max(0, restaurant.tableCount - reservedTables);

          slots.push({
            time: toTime(cursor),
            availableTables,
            reservedTables,
            totalTables: restaurant.tableCount,
          });
        }
      }
    }

    return {
      date: dateKey,
      label: formatDayLabel(date, locale),
      isToday: dateKey === todayKey,
      slots,
    };
  });
}

export function countTablesNeeded(guestCount: number, seatsPerTable: number) {
  return Math.max(1, Math.ceil(guestCount / Math.max(1, seatsPerTable)));
}
