import { promises as fs } from "node:fs";
import path from "node:path";
import { createId, type Customer, type TableSession, type TableSessionParticipant } from "@/lib/types";
import { listRestaurants } from "@/lib/restaurant-store";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { listTablesForRestaurant } from "@/lib/table-store";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

const dataDir = path.join(process.cwd(), "data");
const tableSessionsFile = path.join(dataDir, "table-sessions.json");
const tableSessionsLockFile = path.join(dataDir, "table-sessions.lock");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type TableSessionRow = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_id: string | null;
  status: TableSession["status"];
  guest_count: number;
  estimated_total: number;
  paid_total: number;
  note: string;
  participants: TableSessionParticipant[] | null;
  last_payment_method: TableSession["lastPaymentMethod"] | null;
  last_payment_amount: number | null;
  last_payment_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted_at: string | null;
};

function tableSessionRowToDomain(row: TableSessionRow): TableSession {
  return normalizeTableSession({
    id: row.id,
    restaurantId: row.restaurant_id,
    tableId: row.table_id,
    orderId: row.order_id,
    status: row.status,
    guestCount: row.guest_count,
    estimatedTotal: row.estimated_total,
    paidTotal: row.paid_total,
    note: row.note,
    participants: row.participants ?? [],
    lastPaymentMethod: row.last_payment_method ?? null,
    lastPaymentAmount: row.last_payment_amount ?? 0,
    lastPaymentAt: row.last_payment_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at ?? null,
    deletedAt: row.deleted_at ?? null,
  });
}

function tableSessionDomainToRow(session: TableSession): TableSessionRow {
  return {
    id: session.id,
    restaurant_id: session.restaurantId,
    table_id: session.tableId,
    order_id: session.orderId,
    status: session.status,
    guest_count: session.guestCount,
    estimated_total: session.estimatedTotal,
    paid_total: session.paidTotal,
    note: session.note,
    participants: session.participants,
    last_payment_method: session.lastPaymentMethod ?? null,
    last_payment_amount: session.lastPaymentAmount ?? 0,
    last_payment_at: session.lastPaymentAt ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    closed_at: session.closedAt ?? null,
    deleted_at: session.deletedAt ?? null,
  };
}

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
    lastPaymentMethod:
      session.lastPaymentMethod === "cash" ||
      session.lastPaymentMethod === "card" ||
      session.lastPaymentMethod === "external" ||
      session.lastPaymentMethod === "other"
        ? session.lastPaymentMethod
        : null,
    lastPaymentAmount:
      Number.isFinite(session.lastPaymentAmount) && Number(session.lastPaymentAmount) > 0
        ? Math.max(0, Number(session.lastPaymentAmount))
        : 0,
    lastPaymentAt: session.lastPaymentAt ?? null,
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

async function withFileLock<T>(lockFilePath: string, task: () => Promise<T>): Promise<T> {
  if (!canPersistDataFiles) {
    return task();
  }

  await fs.mkdir(dataDir, { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await fs.open(lockFilePath, "wx");
      try {
        return await task();
      } finally {
        await handle.close();
        await fs.rm(lockFilePath, { force: true });
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - startedAt > 5000) {
        throw new Error(`Timeout while waiting for ${path.basename(lockFilePath)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
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
  if (hasSupabaseConfig()) {
    return;
  }

  try {
    await fs.access(tableSessionsFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(tableSessionsFile, JSON.stringify(await createSeedSessions(), null, 2), "utf8");
  }
}

async function readTableSessionsFile() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("table_sessions")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        return (data as TableSessionRow[]).map(tableSessionRowToDomain);
      }
    }
  }

  if (!canPersistDataFiles) {
    return createSeedSessions();
  }

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

export async function getOpenTableSessionForTable(restaurantId: string, tableId: string) {
  const sessions = await listTableSessionsForRestaurant(restaurantId);
  return (
    sessions.find(
      (session) =>
        session.status === "open" &&
        !session.deletedAt &&
        session.tableId === tableId,
    ) ?? null
  );
}

export async function getActiveTableSessionForRestaurant(restaurantId: string) {
  const sessions = await listTableSessionsForRestaurant(restaurantId);
  return sessions.find((session) => session.status === "open") ?? null;
}

export async function getOrCreateTableSessionForCustomer(
  restaurantId: string,
  customer: Customer,
  tableId?: string | null,
  options?: { allowJoinExistingTableSession?: boolean },
) {
  return withFileLock(tableSessionsLockFile, async () => {
    const allowJoinExistingTableSession = options?.allowJoinExistingTableSession === true;
    if (hasSupabaseConfig()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: existingRows } = await supabase
          .from("table_sessions")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });

        const sessions = Array.isArray(existingRows)
          ? (existingRows as TableSessionRow[]).map(tableSessionRowToDomain)
          : [];
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
            const { data, error } = await supabase
              .from("table_sessions")
              .update(tableSessionDomainToRow(normalized))
              .eq("id", normalized.id)
              .select("*")
              .single();

            if (!error && data) {
              return tableSessionRowToDomain(data as TableSessionRow);
            }
          }

          return customerSession;
        }

        if (tableId && allowJoinExistingTableSession) {
          const selectedSession = sessions.find(
            (session) =>
              session.restaurantId === restaurantId &&
              session.status === "open" &&
              !session.deletedAt &&
              session.tableId === tableId,
          );

          if (selectedSession) {
            const hasCustomer = selectedSession.participants.some((participant) => participant.customerId === customer.id);
            const nextParticipants = hasCustomer
              ? selectedSession.participants
              : [
                  ...selectedSession.participants,
                  {
                    id: createId("participant"),
                    customerId: customer.id,
                    name: customer.name,
                    sharePercent: selectedSession.participants.length > 0
                      ? Math.max(1, Math.floor(100 / (selectedSession.participants.length + 1)))
                      : 100,
                    settledAmount: 0,
                    note: "Client connecté",
                  },
                ];

            const nextSession = normalizeTableSession({
              ...selectedSession,
              guestCount: Math.max(selectedSession.guestCount, nextParticipants.length),
              participants: nextParticipants,
            });

            const { data, error } = await supabase
              .from("table_sessions")
              .update(tableSessionDomainToRow(nextSession))
              .eq("id", nextSession.id)
              .select("*")
              .single();

            if (!error && data) {
              return tableSessionRowToDomain(data as TableSessionRow);
            }
            return nextSession;
          }
        }

        const fallbackTableId = tableId ?? null;
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

        const { data, error } = await supabase
          .from("table_sessions")
          .insert(tableSessionDomainToRow(session))
          .select("*")
          .single();

        if (!error && data) {
          const created = tableSessionRowToDomain(data as TableSessionRow);
          publishRestaurantRealtimeEvent({
            type: "table_sessions",
            restaurantId,
            entityId: created.id,
            action: "created",
          });
          return created;
        }

        return session;
      }
    }

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
        const customerIndex = sessions.findIndex((session) => session.id === customerSession.id);
        if (customerIndex !== -1) {
          const nextSessions = [...sessions];
          nextSessions[customerIndex] = normalized;
          if (canPersistDataFiles) {
            await writeTableSessionsFile(nextSessions);
          }
        }
        return normalized;
      }

      return customerSession;
    }

    if (tableId && allowJoinExistingTableSession) {
      const selectedSession = sessions.find(
        (session) =>
          session.restaurantId === restaurantId &&
          session.status === "open" &&
          !session.deletedAt &&
          session.tableId === tableId,
      );

      if (selectedSession) {
        const hasCustomer = selectedSession.participants.some((participant) => participant.customerId === customer.id);
        const nextParticipants = hasCustomer
          ? selectedSession.participants
          : [
              ...selectedSession.participants,
              {
                id: createId("participant"),
                customerId: customer.id,
                name: customer.name,
                sharePercent: selectedSession.participants.length > 0
                  ? Math.max(1, Math.floor(100 / (selectedSession.participants.length + 1)))
                  : 100,
                settledAmount: 0,
                note: "Client connecté",
              },
            ];

        const nextSession = normalizeTableSession({
          ...selectedSession,
          guestCount: Math.max(selectedSession.guestCount, nextParticipants.length),
          participants: nextParticipants,
        });

        const selectedIndex = sessions.findIndex((session) => session.id === selectedSession.id);
        if (selectedIndex !== -1 && canPersistDataFiles) {
          const nextSessions = [...sessions];
          nextSessions[selectedIndex] = nextSession;
          await writeTableSessionsFile(nextSessions);
        }
        return nextSession;
      }
    }

    const fallbackTableId = tableId ?? null;

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
  });
}

export async function updateTableSession(sessionId: string, patch: Partial<TableSession>) {
  return withFileLock(tableSessionsLockFile, async () => {
    if (hasSupabaseConfig()) {
      const currentSession = (await listTableSessions()).find((session) => session.id === sessionId);
      if (currentSession) {
        const supabase = getSupabaseAdminClient();
        if (supabase) {
          const nextSession = normalizeTableSession({
            ...currentSession,
            ...patch,
            restaurantId: patch.restaurantId ?? currentSession.restaurantId,
            tableId: patch.tableId !== undefined ? patch.tableId : currentSession.tableId,
            orderId: patch.orderId !== undefined ? patch.orderId : currentSession.orderId,
            status: patch.status ?? currentSession.status,
            guestCount:
              patch.guestCount !== undefined ? patch.guestCount : currentSession.guestCount,
            estimatedTotal:
              patch.estimatedTotal !== undefined ? patch.estimatedTotal : currentSession.estimatedTotal,
            paidTotal: patch.paidTotal !== undefined ? patch.paidTotal : currentSession.paidTotal,
            note: patch.note !== undefined ? patch.note : currentSession.note,
            participants: patch.participants ?? currentSession.participants,
            lastPaymentMethod:
              patch.lastPaymentMethod !== undefined ? patch.lastPaymentMethod : currentSession.lastPaymentMethod,
            lastPaymentAmount:
              patch.lastPaymentAmount !== undefined ? patch.lastPaymentAmount : currentSession.lastPaymentAmount,
            lastPaymentAt: patch.lastPaymentAt !== undefined ? patch.lastPaymentAt : currentSession.lastPaymentAt,
            createdAt: patch.createdAt ?? currentSession.createdAt,
            updatedAt: new Date().toISOString(),
            closedAt: patch.closedAt !== undefined ? patch.closedAt : currentSession.closedAt,
            deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : currentSession.deletedAt,
          });

          const { data, error } = await supabase
            .from("table_sessions")
            .update(tableSessionDomainToRow(nextSession))
            .eq("id", sessionId)
            .select("*")
            .single();

          if (!error && data) {
            const saved = tableSessionRowToDomain(data as TableSessionRow);
            publishRestaurantRealtimeEvent({
              type: "table_sessions",
              restaurantId: saved.restaurantId,
              entityId: saved.id,
              action: "updated",
            });
            return saved;
          }
        }
      }
    }

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
      lastPaymentMethod:
        patch.lastPaymentMethod !== undefined ? patch.lastPaymentMethod : sessions[index].lastPaymentMethod,
      lastPaymentAmount:
        patch.lastPaymentAmount !== undefined ? patch.lastPaymentAmount : sessions[index].lastPaymentAmount,
      lastPaymentAt: patch.lastPaymentAt !== undefined ? patch.lastPaymentAt : sessions[index].lastPaymentAt,
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
  });
}
