import { promises as fs } from "node:fs";
import path from "node:path";
import { createId, type Customer, type TableSession, type TableSessionParticipant } from "@/lib/types";
import { listRestaurants } from "@/lib/restaurant-store";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { listTablesForRestaurant } from "@/lib/table-store";

const dataDir = path.join(process.cwd(), "data");
const tableSessionsFile = path.join(dataDir, "table-sessions.json");
const canPersistDataFiles = process.env.VERCEL !== "1";

function normalizeParticipant(participant: TableSessionParticipant): TableSessionParticipant {
  return {
    ...participant,
    id: participant.id?.trim() || createId("table-session-participant"),
    customerId: participant.customerId?.trim() || null,
    name: participant.name?.trim() || "Client",
    sharePercent: Number.isFinite(participant.sharePercent) ? Math.max(0, Math.min(100, Number(participant.sharePercent))) : 0,
    settledAmount: Number.isFinite(participant.settledAmount) ? Math.max(0, Number(participant.settledAmount)) : 0,
    note: participant.note?.trim() || "",
  };
}

function normalizeTableSession(session: TableSession): TableSession {
  const now = new Date().toISOString();
  const participants = Array.isArray(session.participants)
    ? session.participants.map(normalizeParticipant)
    : [];
  const estimatedTotal = Number.isFinite(session.estimatedTotal) ? Math.max(0, Number(session.estimatedTotal)) : 0;
  const paidTotal = Number.isFinite(session.paidTotal) ? Math.max(0, Number(session.paidTotal)) : 0;

  return {
    ...session,
    id: session.id?.trim() || createId("table-session"),
    restaurantId: session.restaurantId?.trim() || "",
    tableId: session.tableId?.trim() || null,
    orderId: session.orderId?.trim() || null,
    status: session.status === "closed" || session.status === "archived" ? session.status : "open",
    guestCount: Number.isFinite(session.guestCount) && session.guestCount > 0 ? Math.floor(session.guestCount) : 1,
    estimatedTotal,
    paidTotal,
    note: session.note?.trim() || "",
    participants,
    createdAt: session.createdAt ?? now,
    updatedAt: now,
    closedAt: session.closedAt ?? null,
    deletedAt: session.deletedAt ?? null,
  };
}

async function normalizeTableSessionForRestaurant(session: TableSession) {
  const tables = await listTablesForRestaurant(session.restaurantId);
  const hasMatchingTable = session.tableId ? tables.some((table) => table.id === session.tableId) : false;
  const fallbackTableId = tables[0]?.id ?? null;

  return normalizeTableSession({
    ...session,
    tableId: hasMatchingTable ? session.tableId : fallbackTableId,
  });
}

async function createSeedSessions(): Promise<TableSession[]> {
  const restaurants = await listRestaurants();
  const fallbackRestaurant =
    restaurants.find((restaurant) => restaurant.slug === "bar-1" && !restaurant.deletedAt) ??
    restaurants[0];
  if (!fallbackRestaurant) {
    return [];
  }

  const fallbackTables = await listTablesForRestaurant(fallbackRestaurant.id);
  const now = new Date().toISOString();

  if (fallbackRestaurant.slug === "bar-1" && fallbackTables.length >= 10) {
    return fallbackTables.slice(0, 10).map((table, index) =>
      normalizeTableSession({
        id: `seed-table-session-${index + 1}`,
        restaurantId: fallbackRestaurant.id,
        tableId: table.id,
        orderId: null,
        status: "open",
        guestCount: 1,
        estimatedTotal: 0,
        paidTotal: 0,
        note: `Session démo table ${index + 1}`,
        participants: [
          {
            id: `seed-participant-${index + 1}`,
            customerId: null,
            name: `Client ${index + 1}`,
            sharePercent: 100,
            settledAmount: 0,
            note: "Client démo",
          },
        ],
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        deletedAt: null,
      }),
    );
  }

  const fallbackTableId = fallbackTables[0]?.id ?? null;
  return [
    normalizeTableSession({
      id: "table-session-root",
      restaurantId: fallbackRestaurant.id,
      tableId: fallbackTableId,
      orderId: null,
      status: "open",
      guestCount: 1,
      estimatedTotal: 0,
      paidTotal: 0,
      note: "Session démo pour le split de note.",
      participants: [
        {
          id: "participant-1",
          customerId: null,
          name: "Client 1",
          sharePercent: 100,
          settledAmount: 0,
          note: "Client principal",
        },
      ],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      deletedAt: null,
    }),
  ];
}

async function ensureStore() {
  try {
    await fs.access(tableSessionsFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(tableSessionsFile, JSON.stringify(await createSeedSessions(), null, 2), "utf8");
  }
}

async function readTableSessionsFile() {
  await ensureStore();
  const raw = await fs.readFile(tableSessionsFile, "utf8");
  let parsed: TableSession[] = [];

  try {
    parsed = JSON.parse(raw) as TableSession[];
  } catch {
    const seedSessions = await createSeedSessions();
    if (canPersistDataFiles) {
      await fs.writeFile(tableSessionsFile, JSON.stringify(seedSessions, null, 2), "utf8");
    }
    return seedSessions;
  }

  const normalized = Array.isArray(parsed)
    ? await Promise.all(parsed.map((session) => normalizeTableSessionForRestaurant(session)))
    : [];
  if (JSON.stringify(parsed) !== JSON.stringify(normalized) && canPersistDataFiles) {
    await fs.writeFile(tableSessionsFile, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

async function writeTableSessionsFile(sessions: TableSession[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(tableSessionsFile, JSON.stringify(sessions, null, 2), "utf8");
}

export async function listTableSessions() {
  return readTableSessionsFile();
}

export async function listTableSessionsForRestaurant(restaurantId: string) {
  const sessions = await listTableSessions();
  return sessions.filter((session) => session.restaurantId === restaurantId && !session.deletedAt);
}

export async function getActiveTableSessionForRestaurant(restaurantId: string) {
  const sessions = await listTableSessionsForRestaurant(restaurantId);
  return sessions.find((session) => session.status === "open") ?? null;
}

export async function getOrCreateTableSessionForCustomer(
  restaurantId: string,
  customer: Customer,
) {
  const sessions = await listTableSessions();
  const customerSession = sessions.find(
    (session) =>
      session.restaurantId === restaurantId &&
      !session.deletedAt &&
      session.participants.some((participant) => participant.customerId === customer.id),
  );

  if (customerSession) {
    const normalized = await normalizeTableSessionForRestaurant(customerSession);
    if (
      normalized.tableId !== customerSession.tableId ||
      JSON.stringify(normalized.participants) !== JSON.stringify(customerSession.participants)
    ) {
      if (canPersistDataFiles) {
        await updateTableSession(customerSession.id, {
          tableId: normalized.tableId,
          participants: normalized.participants,
        });
      }
      return normalized;
    }

    return customerSession;
  }

  const activeSession = sessions.find(
    (session) => session.restaurantId === restaurantId && session.status === "open" && !session.deletedAt,
  );
  if (activeSession) {
    const normalized = await normalizeTableSessionForRestaurant(activeSession);
    if (normalized.tableId !== activeSession.tableId) {
      if (canPersistDataFiles) {
        await updateTableSession(activeSession.id, { tableId: normalized.tableId });
      }
      return normalized;
    }
    return activeSession;
  }

  const tables = await listTablesForRestaurant(restaurantId);
  const fallbackTableId = tables[0]?.id ?? null;

  const session = normalizeTableSession({
    id: createId("table-session"),
    restaurantId,
    tableId: fallbackTableId,
    orderId: null,
    status: "open",
    guestCount: 1,
    estimatedTotal: 0,
    paidTotal: 0,
    note: "Session client liée au portail.",
    participants: [
      {
        id: createId("participant"),
        customerId: customer.id,
        name: customer.name,
        sharePercent: 100,
        settledAmount: 0,
        note: "Client connecté",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedAt: null,
    deletedAt: null,
  });

  if (canPersistDataFiles) {
    await writeTableSessionsFile([...sessions, session]);
  }
  publishRestaurantRealtimeEvent({
    type: "table_sessions",
    restaurantId,
    entityId: session.id,
    action: "created",
  });
  return session;
}

export async function updateTableSession(sessionId: string, patch: Partial<TableSession>) {
  const sessions = await listTableSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) {
    return null;
  }

  const nextSession = normalizeTableSession({
    ...sessions[index],
    ...patch,
    restaurantId: patch.restaurantId ?? sessions[index].restaurantId,
    tableId: patch.tableId !== undefined ? patch.tableId : sessions[index].tableId,
    orderId: patch.orderId !== undefined ? patch.orderId : sessions[index].orderId,
    status: patch.status ?? sessions[index].status,
    guestCount:
      patch.guestCount !== undefined ? patch.guestCount : sessions[index].guestCount,
    estimatedTotal:
      patch.estimatedTotal !== undefined ? patch.estimatedTotal : sessions[index].estimatedTotal,
    paidTotal: patch.paidTotal !== undefined ? patch.paidTotal : sessions[index].paidTotal,
    note: patch.note !== undefined ? patch.note : sessions[index].note,
    participants: patch.participants ?? sessions[index].participants,
    createdAt: patch.createdAt ?? sessions[index].createdAt,
    updatedAt: new Date().toISOString(),
    closedAt: patch.closedAt !== undefined ? patch.closedAt : sessions[index].closedAt,
    deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : sessions[index].deletedAt,
  });

  const nextSessions = [...sessions];
  nextSessions[index] = nextSession;
  if (canPersistDataFiles) {
    await writeTableSessionsFile(nextSessions);
  }
  publishRestaurantRealtimeEvent({
    type: "table_sessions",
    restaurantId: nextSession.restaurantId,
    entityId: nextSession.id,
    action: "updated",
  });
  return nextSession;
}
