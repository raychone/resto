import { promises as fs } from "node:fs";
import path from "node:path";
import {
  countTablesNeeded,
  getAvailableDays,
} from "@/lib/booking";
import { recordAuditEntry, type AuditActorRole } from "@/lib/audit-store";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";
import { createId, type Locale, type Reservation, type Restaurant, type RestaurantMessage } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const reservationsFile = path.join(dataDir, "reservations.json");
const messagesFile = path.join(dataDir, "messages.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type ReservationRow = {
  id: string;
  restaurant_slug: string;
  restaurant_id: string | null;
  locale: Locale;
  first_name: string;
  last_name: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  date: string;
  time: string;
  guest_count: number;
  tables_needed: number;
  status: Reservation["status"];
  created_at: string;
  confirmed_at: string | null;
  confirmed_message: string | null;
  deleted_at: string | null;
};

type MessageRow = {
  id: string;
  restaurant_slug: string;
  restaurant_id: string | null;
  table_id: string | null;
  table_label: string | null;
  locale: Locale;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: RestaurantMessage["status"];
  created_at: string;
  deleted_at: string | null;
};

function reservationRowToDomain(row: ReservationRow): Reservation {
  return normalizeReservation({
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    restaurantId: row.restaurant_id ?? undefined,
    locale: row.locale,
    firstName: row.first_name,
    lastName: row.last_name,
    name: row.name,
    phone: row.phone,
    email: row.email,
    note: row.note,
    date: row.date,
    time: row.time,
    guestCount: Number(row.guest_count ?? 1),
    tablesNeeded: Number(row.tables_needed ?? 1),
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined,
    confirmedMessage: row.confirmed_message ?? undefined,
    deletedAt: row.deleted_at ?? null,
  });
}

function reservationDomainToRow(reservation: Reservation): ReservationRow {
  return {
    id: reservation.id,
    restaurant_slug: reservation.restaurantSlug,
    restaurant_id: reservation.restaurantId ?? null,
    locale: reservation.locale,
    first_name: reservation.firstName.trim(),
    last_name: reservation.lastName.trim(),
    name: reservation.name.trim(),
    phone: reservation.phone.trim(),
    email: reservation.email.trim(),
    note: reservation.note.trim(),
    date: reservation.date,
    time: reservation.time,
    guest_count: reservation.guestCount,
    tables_needed: reservation.tablesNeeded,
    status: reservation.status,
    created_at: reservation.createdAt,
    confirmed_at: reservation.confirmedAt ?? null,
    confirmed_message: reservation.confirmedMessage ?? null,
    deleted_at: reservation.deletedAt ?? null,
  };
}

function messageRowToDomain(row: MessageRow): RestaurantMessage {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    restaurantId: row.restaurant_id ?? undefined,
    tableId: row.table_id ?? null,
    tableLabel: row.table_label ?? null,
    locale: row.locale,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  };
}

function messageDomainToRow(message: RestaurantMessage): MessageRow {
  return {
    id: message.id,
    restaurant_slug: message.restaurantSlug,
    restaurant_id: message.restaurantId ?? null,
    table_id: message.tableId ?? null,
    table_label: message.tableLabel ?? null,
    locale: message.locale,
    name: message.name.trim(),
    phone: message.phone.trim(),
    email: message.email.trim(),
    message: message.message.trim(),
    status: message.status,
    created_at: message.createdAt,
    deleted_at: message.deletedAt ?? null,
  };
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    if (canPersistDataFiles) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8");
    }
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
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []).map((row) => reservationRowToDomain(row as ReservationRow));
    }
  }

  const reservations = await readJsonFile<Reservation[]>(reservationsFile, []);
  return reservations.map(normalizeReservation);
}

export async function listMessages() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []).map((row) => messageRowToDomain(row as MessageRow));
    }
  }

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

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase.from("reservations").insert(reservationDomainToRow(reservation));
      if (error) {
        throw error;
      }
    }
  } else {
    const nextReservations = [...reservations, reservation];
    await writeJsonFile(reservationsFile, nextReservations);
  }
  publishRestaurantRealtimeEvent({
    type: "reservations",
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    entityId: reservation.id,
    action: "created",
    details: `${reservation.firstName} ${reservation.lastName} · ${reservation.date} ${reservation.time}`,
  });
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

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const patch: Partial<ReservationRow> = {
        status,
        confirmed_at: nextReservation.confirmedAt ?? null,
      };
      const { error } = await supabase
        .from("reservations")
        .update(patch)
        .eq("restaurant_slug", restaurantSlug)
        .eq("id", reservationId);
      if (error) {
        throw error;
      }
    }
  } else {
    const nextReservations = [...reservations];
    nextReservations[index] = nextReservation;
    await writeJsonFile(reservationsFile, nextReservations);
  }
  publishRestaurantRealtimeEvent({
    type: "reservations",
    restaurantId: current.restaurantId ?? "",
    restaurantSlug,
    entityId: reservationId,
    action: `status_${status}`,
  });
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

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase
        .from("reservations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("restaurant_slug", restaurantSlug)
        .eq("id", reservationId);
      if (error) {
        throw error;
      }
    }
  } else {
    const nextReservations = reservations.filter((entry) => entry.id !== reservationId);
    await writeJsonFile(reservationsFile, nextReservations);
  }
  publishRestaurantRealtimeEvent({
    type: "reservations",
    restaurantId: reservation.restaurantId ?? "",
    restaurantSlug,
    entityId: reservationId,
    action: "deleted",
  });
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
    tableId: input.tableId ?? null,
    tableLabel: input.tableLabel ?? null,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
    locale: input.locale,
  };

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase.from("messages").insert(messageDomainToRow(message));
      if (error) {
        throw error;
      }
    }
  } else {
    const nextMessages = [...messages, message];
    await writeJsonFile(messagesFile, nextMessages);
  }
  publishRestaurantRealtimeEvent({
    type: "messages",
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    entityId: message.id,
    action: "created",
  });
  return message;
}

export async function updateMessageStatus(
  restaurantSlug: string,
  options: {
    ids?: string[];
    tableId?: string;
    status: RestaurantMessage["status"];
  },
) {
  const messages = await listMessages();
  const matchedMessage = messages.find((message) => {
    if (message.restaurantSlug !== restaurantSlug) {
      return false;
    }

    const matchesId = options.ids?.includes(message.id) ?? false;
    const matchesTable = options.tableId ? message.tableId === options.tableId : false;
    return matchesId || matchesTable;
  });
  const nextMessages = messages.map((message) => {
    if (message.restaurantSlug !== restaurantSlug) {
      return message;
    }

    const matchesId = options.ids?.includes(message.id);
    const matchesTable = options.tableId ? message.tableId === options.tableId : false;
    if (!matchesId && !matchesTable) {
      return message;
    }

    return {
      ...message,
      status: options.status,
    };
  });

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      for (const message of nextMessages) {
        if (message.restaurantSlug !== restaurantSlug) {
          continue;
        }

        const matchesId = options.ids?.includes(message.id);
        const matchesTable = options.tableId ? message.tableId === options.tableId : false;
        if (!matchesId && !matchesTable) {
          continue;
        }

        const { error } = await supabase
          .from("messages")
          .update({ status: options.status })
          .eq("id", message.id)
          .eq("restaurant_slug", restaurantSlug);
        if (error) {
          throw error;
        }
      }
    }
  } else {
    await writeJsonFile(messagesFile, nextMessages);
  }
  if (matchedMessage) {
    publishRestaurantRealtimeEvent({
      type: "messages",
      restaurantId: matchedMessage.restaurantId ?? "",
      restaurantSlug,
      entityId: options.ids?.[0] ?? options.tableId ?? matchedMessage.id,
      action: `status_${options.status}`,
    });
  }
  return nextMessages.filter((message) => message.restaurantSlug === restaurantSlug);
}
