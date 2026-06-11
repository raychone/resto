import { promises as fs } from "node:fs";
import path from "node:path";
import {
  countTablesNeeded,
  getAvailableDays,
} from "@/lib/booking";
import { recordAuditEntry, type AuditActorRole } from "@/lib/audit-store";
import { createId, type Locale, type Reservation, type Restaurant, type RestaurantMessage } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const reservationsFile = path.join(dataDir, "reservations.json");
const messagesFile = path.join(dataDir, "messages.json");

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function writeJsonFile(file: string, value: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function normalizeReservation(reservation: Reservation): Reservation {
  if (reservation.firstName && reservation.lastName && reservation.name) {
    return reservation;
  }

  const name = reservation.name?.trim() || `${reservation.firstName ?? ""} ${reservation.lastName ?? ""}`.trim();
  const [firstName, ...rest] = name.split(" ");

  return {
    ...reservation,
    firstName: reservation.firstName?.trim() || firstName || "",
    lastName:
      reservation.lastName?.trim() || rest.join(" ").trim() || "",
    name,
  };
}

export async function listReservations() {
  const reservations = await readJsonFile<Reservation[]>(reservationsFile, []);
  return reservations.map(normalizeReservation);
}

export async function listMessages() {
  return readJsonFile<RestaurantMessage[]>(messagesFile, []);
}

export async function getReservationsForRestaurant(restaurantSlug: string) {
  const reservations = await listReservations();
  return reservations.filter((reservation) => reservation.restaurantSlug === restaurantSlug);
}

export async function getMessagesForRestaurant(restaurantSlug: string) {
  const messages = await listMessages();
  return messages.filter((message) => message.restaurantSlug === restaurantSlug);
}

export async function getAvailabilityForRestaurant(
  restaurant: Restaurant,
  options?: { locale?: Locale; startDate?: Date; dayCount?: number },
) {
  const reservations = await getReservationsForRestaurant(restaurant.slug);
  return getAvailableDays(restaurant, reservations, options);
}

export async function createReservation(
  restaurant: Restaurant,
  input: Omit<
    Reservation,
    "id" | "tablesNeeded" | "status" | "createdAt" | "restaurantSlug"
  > & {
    date: string;
    time: string;
    guestCount: number;
    actorRole?: AuditActorRole;
    actorName?: string;
  },
) {
  const reservations = await listReservations();
  const tablesNeeded = countTablesNeeded(input.guestCount, restaurant.seatsPerTable);
  const availableDays = getAvailableDays(restaurant, reservations, {
    locale: input.locale,
    startDate: new Date(`${input.date}T00:00:00`),
    dayCount: 1,
  });
  const day = availableDays[0];
  const slot = day?.slots.find((entry) => entry.time === input.time);

  if (!slot || slot.availableTables < tablesNeeded) {
    return { error: "selected_slot_unavailable" as const };
  }

  const reservation: Reservation = {
    id: createId("reservation"),
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    tablesNeeded,
    status: "pending",
    createdAt: new Date().toISOString(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    note: input.note.trim(),
    locale: input.locale,
    date: input.date,
    time: input.time,
    guestCount: input.guestCount,
  };

  const nextReservations = [...reservations, reservation];
  await writeJsonFile(reservationsFile, nextReservations);
  await recordAuditEntry({
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    actorRole: input.actorRole ?? "client",
    actorName: input.actorName ?? "client",
    action: "reservation_created",
    targetType: "reservation",
    targetId: reservation.id,
    details: `${reservation.firstName} ${reservation.lastName} · ${reservation.date} ${reservation.time}`,
  });
  return { reservation };
}

export async function updateReservationStatus(
  restaurantSlug: string,
  reservationId: string,
  status: "confirmed" | "cancelled" | "no_show",
  actor: { role: AuditActorRole; name: string },
) {
  const reservations = await listReservations();
  const index = reservations.findIndex(
    (reservation) =>
      reservation.restaurantSlug === restaurantSlug && reservation.id === reservationId,
  );

  if (index === -1) {
    return null;
  }

  const current = reservations[index];
  const nextReservation: Reservation = {
    ...current,
    status,
    confirmedAt: status === "confirmed" ? new Date().toISOString() : current.confirmedAt,
  };

  const nextReservations = [...reservations];
  nextReservations[index] = nextReservation;
  await writeJsonFile(reservationsFile, nextReservations);
  await recordAuditEntry({
    restaurantId: current.restaurantId,
    restaurantSlug,
    actorRole: actor.role,
    actorName: actor.name,
    action: `reservation_${status}`,
    targetType: "reservation",
    targetId: reservationId,
  });
  return nextReservation;
}

export async function deleteReservation(
  restaurantSlug: string,
  reservationId: string,
  actor: { role: AuditActorRole; name: string },
) {
  const reservations = await listReservations();
  const reservation = reservations.find(
    (entry) => entry.restaurantSlug === restaurantSlug && entry.id === reservationId,
  );

  if (!reservation) {
    return null;
  }

  const nextReservations = reservations.filter((entry) => entry.id !== reservationId);
  await writeJsonFile(reservationsFile, nextReservations);
  await recordAuditEntry({
    restaurantId: reservation.restaurantId,
    restaurantSlug,
    actorRole: actor.role,
    actorName: actor.name,
    action: "reservation_deleted",
    targetType: "reservation",
    targetId: reservationId,
  });
  return reservation;
}

export async function createStaffReservation(
  restaurant: Restaurant,
  input: Omit<
    Reservation,
    "id" | "tablesNeeded" | "status" | "createdAt" | "restaurantSlug"
  > & {
    date: string;
    time: string;
    guestCount: number;
    actor: { role: AuditActorRole; name: string };
  },
) {
  return createReservation(restaurant, {
    ...input,
    actorRole: input.actor.role,
    actorName: input.actor.name,
  });
}

export async function createMessage(
  restaurant: Restaurant,
  input: Omit<RestaurantMessage, "id" | "createdAt" | "restaurantSlug" | "status"> & {
    message: string;
  },
) {
  const messages = await listMessages();
  const message: RestaurantMessage = {
    id: createId("message"),
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    createdAt: new Date().toISOString(),
    status: "new",
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
    locale: input.locale,
  };

  const nextMessages = [...messages, message];
  await writeJsonFile(messagesFile, nextMessages);
  return message;
}
