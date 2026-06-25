import { promises as fs } from "node:fs";
import path from "node:path";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";
import { getTableById, listTablesForRestaurant } from "@/lib/table-store";
import { listTableSessionsForRestaurant } from "@/lib/table-session-store";
import { createId, type TableGroup, type TableGroupStatus } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "table-groups.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type TableGroupRow = {
  id: string;
  restaurant_id: string;
  name: string;
  status: TableGroupStatus;
  host_customer_id: string | null;
  primary_table_id: string | null;
  table_ids: string[] | null;
  table_session_ids: string[] | null;
  access_code: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted_at: string | null;
};

function normalizeStringArray(values: string[] | null | undefined) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function generateAccessCode(seed?: string | null) {
  const base = (seed ?? createId("group-code")).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (base || "TABLES").slice(0, 6).padEnd(6, "X");
}

function normalizeTableGroup(group: TableGroup): TableGroup {
  const now = new Date().toISOString();
  return {
    ...group,
    id: group.id?.trim() || createId("table-group"),
    restaurantId: group.restaurantId?.trim() || "",
    name: group.name?.trim() || "Groupe de tables",
    status: group.status === "closed" || group.status === "archived" ? group.status : "open",
    hostCustomerId: group.hostCustomerId?.trim() || null,
    primaryTableId: group.primaryTableId?.trim() || null,
    tableIds: normalizeStringArray(group.tableIds),
    tableSessionIds: normalizeStringArray(group.tableSessionIds),
    accessCode: group.accessCode?.trim().toUpperCase() || generateAccessCode(group.id),
    note: group.note?.trim() || "",
    createdAt: group.createdAt ?? now,
    updatedAt: now,
    closedAt: group.closedAt ?? null,
    deletedAt: group.deletedAt ?? null,
  };
}

function tableGroupRowToDomain(row: TableGroupRow): TableGroup {
  return normalizeTableGroup({
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    status: row.status,
    hostCustomerId: row.host_customer_id,
    primaryTableId: row.primary_table_id,
    tableIds: row.table_ids ?? [],
    tableSessionIds: row.table_session_ids ?? [],
    accessCode: row.access_code ?? generateAccessCode(row.id),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    deletedAt: row.deleted_at,
  });
}

function tableGroupDomainToRow(group: TableGroup): TableGroupRow {
  return {
    id: group.id,
    restaurant_id: group.restaurantId,
    name: group.name,
    status: group.status,
    host_customer_id: group.hostCustomerId ?? null,
    primary_table_id: group.primaryTableId ?? null,
    table_ids: group.tableIds,
    table_session_ids: group.tableSessionIds,
    access_code: group.accessCode,
    note: group.note,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
    closed_at: group.closedAt ?? null,
    deleted_at: group.deletedAt ?? null,
  };
}

async function ensureStore() {
  if (hasSupabaseConfig()) return;
  try {
    await fs.access(dataFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readTableGroupsFile() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("table_groups")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (!error && Array.isArray(data)) {
        return (data as TableGroupRow[]).map(tableGroupRowToDomain);
      }
    }
  }

  if (!canPersistDataFiles) {
    return [] as TableGroup[];
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as TableGroup[];
    return Array.isArray(parsed) ? parsed.map(normalizeTableGroup) : [];
  } catch {
    if (canPersistDataFiles) {
      await fs.writeFile(dataFile, "[]", "utf8");
    }
    return [];
  }
}

async function writeTableGroupsFile(groups: TableGroup[]) {
  if (!canPersistDataFiles) return;
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(groups, null, 2), "utf8");
}

async function sanitizeGroupForRestaurant(group: TableGroup) {
  const [tables, sessions] = await Promise.all([
    listTablesForRestaurant(group.restaurantId),
    listTableSessionsForRestaurant(group.restaurantId),
  ]);
  const tableIds = group.tableIds.filter((tableId) => tables.some((table) => table.id === tableId));
  const tableSessionIds = group.tableSessionIds.filter((sessionId) => sessions.some((session) => session.id === sessionId));
  const primaryTableId = group.primaryTableId && tableIds.includes(group.primaryTableId) ? group.primaryTableId : tableIds[0] ?? null;
  return normalizeTableGroup({
    ...group,
    primaryTableId,
    tableIds,
    tableSessionIds,
  });
}

export async function listTableGroups() {
  return readTableGroupsFile();
}

export async function listTableGroupsForRestaurant(restaurantId: string) {
  const groups = await listTableGroups();
  return groups.filter((group) => group.restaurantId === restaurantId && !group.deletedAt);
}

export async function getTableGroupById(groupId: string) {
  const groups = await listTableGroups();
  return groups.find((group) => group.id === groupId && !group.deletedAt) ?? null;
}

export async function getTableGroupByAccessCode(restaurantId: string, accessCode: string) {
  const normalizedCode = accessCode.trim().toUpperCase();
  if (!normalizedCode) return null;
  const groups = await listTableGroupsForRestaurant(restaurantId);
  return (
    groups.find(
      (group) => !group.deletedAt && group.status === "open" && group.accessCode.trim().toUpperCase() === normalizedCode,
    ) ?? null
  );
}

export async function findOpenTableGroupForTableOrSession(
  restaurantId: string,
  tableId?: string | null,
  tableSessionId?: string | null,
) {
  const groups = await listTableGroupsForRestaurant(restaurantId);
  return (
    groups.find(
      (group) =>
        !group.deletedAt &&
        group.status === "open" &&
        ((tableId ? group.tableIds.includes(tableId) : false) ||
          (tableSessionId ? group.tableSessionIds.includes(tableSessionId) : false)),
    ) ?? null
  );
}

export async function createTableGroup(input: Omit<TableGroup, "id" | "createdAt" | "updatedAt">) {
  const base = normalizeTableGroup({
    ...input,
    id: createId("table-group"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const nextGroup = await sanitizeGroupForRestaurant(base);

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("table_groups")
        .insert(tableGroupDomainToRow(nextGroup))
        .select("*")
        .single();
      if (!error && data) {
        const created = tableGroupRowToDomain(data as TableGroupRow);
        void publishRestaurantRealtimeEvent({
          type: "table_sessions",
          restaurantId: created.restaurantId,
          entityId: created.id,
          action: "table_group_updated",
          details: created.status,
        });
        return created;
      }
    }
  }

  const groups = await readTableGroupsFile();
  const nextGroups = [...groups, nextGroup];
  await writeTableGroupsFile(nextGroups);
  return nextGroup;
}

export async function updateTableGroup(groupId: string, patch: Partial<Omit<TableGroup, "id" | "restaurantId" | "createdAt">>) {
  const existing = await getTableGroupById(groupId);
  if (!existing) return null;

  const candidate = await sanitizeGroupForRestaurant(
    normalizeTableGroup({
      ...existing,
      name: patch.name ?? existing.name,
      status: patch.status ?? existing.status,
      hostCustomerId: patch.hostCustomerId !== undefined ? patch.hostCustomerId : existing.hostCustomerId,
      primaryTableId: patch.primaryTableId !== undefined ? patch.primaryTableId : existing.primaryTableId,
      tableIds: patch.tableIds ?? existing.tableIds,
      tableSessionIds: patch.tableSessionIds ?? existing.tableSessionIds,
      note: patch.note ?? existing.note,
      closedAt: patch.closedAt !== undefined ? patch.closedAt : existing.closedAt,
      deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : existing.deletedAt,
      updatedAt: new Date().toISOString(),
    }),
  );

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("table_groups")
        .update(tableGroupDomainToRow(candidate))
        .eq("id", groupId)
        .select("*")
        .single();
      if (!error && data) {
        const updated = tableGroupRowToDomain(data as TableGroupRow);
        void publishRestaurantRealtimeEvent({
          type: "table_sessions",
          restaurantId: updated.restaurantId,
          entityId: updated.id,
          action: "table_group_updated",
          details: updated.status,
        });
        return updated;
      }
    }
  }

  const groups = await readTableGroupsFile();
  const index = groups.findIndex((group) => group.id === groupId);
  if (index === -1) return null;
  groups[index] = candidate;
  await writeTableGroupsFile(groups);
  return candidate;
}

export async function addTableToGroup(groupId: string, tableId: string, tableSessionId?: string | null) {
  const group = await getTableGroupById(groupId);
  if (!group) return null;
  const table = await getTableById(tableId);
  if (!table || table.restaurantId !== group.restaurantId) return null;
  return updateTableGroup(groupId, {
    primaryTableId: group.primaryTableId ?? tableId,
    tableIds: [...group.tableIds, tableId],
    tableSessionIds: tableSessionId ? [...group.tableSessionIds, tableSessionId] : group.tableSessionIds,
  });
}
