import { promises as fs } from "node:fs";
import path from "node:path";
import { listRestaurants } from "@/lib/restaurant-store";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";
import { createId, type Restaurant, type Table, type TableZone } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "tables.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type TableRow = {
  id: string;
  restaurant_id: string;
  name: string;
  zone: TableZone;
  seats: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function tableRowToDomain(row: TableRow): Table {
  return normalizeTable({
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    zone: row.zone,
    seats: row.seats,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function tableDomainToRow(table: Table): TableRow {
  return {
    id: table.id,
    restaurant_id: table.restaurantId,
    name: table.name,
    zone: table.zone,
    seats: table.seats,
    active: table.active,
    created_at: table.createdAt,
    updated_at: table.updatedAt,
    deleted_at: table.deletedAt ?? null,
  };
}

function normalizeZone(zone: string | undefined): TableZone {
  if (zone === "terrasse" || zone === "bar" || zone === "private") {
    return zone;
  }

  return "salle";
}

function normalizeTable(table: Table): Table {
  const now = new Date().toISOString();
  return {
    ...table,
    id: table.id?.trim() || createId("table"),
    restaurantId: table.restaurantId?.trim() || "",
    name: table.name?.trim() || `Table ${createId("table").slice(-3)}`,
    zone: normalizeZone(table.zone),
    seats: Number.isFinite(table.seats) && table.seats > 0 ? Math.floor(table.seats) : 4,
    active: table.active !== false,
    createdAt: table.createdAt ?? now,
    updatedAt: now,
    deletedAt: table.deletedAt ?? null,
  };
}

async function ensureStore() {
  if (hasSupabaseConfig()) {
    return;
  }

  try {
    await fs.access(dataFile);
  } catch {
    const restaurants = await listRestaurants();
    const tables = restaurants.flatMap((restaurant) => createTablesForRestaurant(restaurant));
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(tables, null, 2), "utf8");
  }
}

function createTablesForRestaurant(restaurant: Restaurant) {
  const now = new Date().toISOString();
  return Array.from({ length: restaurant.tableCount }, (_, index) => ({
    id: `${restaurant.id}-table-${index + 1}`,
    restaurantId: restaurant.id,
    name: `Table ${index + 1}`,
    zone: "salle" as const,
    seats: restaurant.seatsPerTable,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}

async function readTablesFile() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        return (data as TableRow[]).map(tableRowToDomain);
      }
    }
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  let parsed: Table[] = [];

  try {
    parsed = JSON.parse(raw) as Table[];
  } catch {
    const restaurants = await listRestaurants();
    const seedTables = restaurants.flatMap((restaurant) => createTablesForRestaurant(restaurant));
    if (canPersistDataFiles) {
      await fs.writeFile(dataFile, JSON.stringify(seedTables, null, 2), "utf8");
    }
    return seedTables;
  }

  if (!Array.isArray(parsed)) {
    const restaurants = await listRestaurants();
    const seedTables = restaurants.flatMap((restaurant) => createTablesForRestaurant(restaurant));
    if (canPersistDataFiles) {
      await fs.writeFile(dataFile, JSON.stringify(seedTables, null, 2), "utf8");
    }
    return seedTables;
  }

  const normalized = parsed.map(normalizeTable);
  const restaurants = await listRestaurants();
  const expectedTables = restaurants.flatMap((restaurant) => ensureRestaurantTables(normalized, restaurant));
  const merged = mergeTables(normalized, expectedTables);
  const dirty = JSON.stringify(parsed) !== JSON.stringify(merged);

  if (dirty && canPersistDataFiles) {
    await fs.writeFile(dataFile, JSON.stringify(merged, null, 2), "utf8");
  }

  return merged;
}

function ensureRestaurantTables(existingTables: Table[], restaurant: Restaurant) {
  const restaurantTables = existingTables.filter((table) => table.restaurantId === restaurant.id);
  if (restaurantTables.length >= restaurant.tableCount) {
    return restaurantTables;
  }

  const now = new Date().toISOString();
  const nextTables = [...restaurantTables];
  for (let index = restaurantTables.length; index < restaurant.tableCount; index += 1) {
    nextTables.push({
      id: `${restaurant.id}-table-${index + 1}`,
      restaurantId: restaurant.id,
      name: `Table ${index + 1}`,
      zone: "salle",
      seats: restaurant.seatsPerTable,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  return nextTables;
}

function mergeTables(existing: Table[], expected: Table[]) {
  const byId = new Map(existing.map((table) => [table.id, table] as const));
  for (const table of expected) {
    if (!byId.has(table.id)) {
      byId.set(table.id, table);
    }
  }

  return Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id));
}

async function writeTablesFile(tables: Table[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(tables, null, 2), "utf8");
}

export async function listTables() {
  return readTablesFile();
}

export async function listTablesForRestaurant(restaurantId: string) {
  const tables = await listTables();
  return tables.filter((table) => table.restaurantId === restaurantId && !table.deletedAt);
}

export async function getTableById(tableId: string) {
  const tables = await listTables();
  return tables.find((table) => table.id === tableId && !table.deletedAt) ?? null;
}

export async function updateTable(tableId: string, patch: Partial<Omit<Table, "id" | "createdAt">>) {
  if (hasSupabaseConfig()) {
    const currentTable = await getTableById(tableId);
    if (currentTable) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const nextTable = normalizeTable({
          ...currentTable,
          ...patch,
          updatedAt: new Date().toISOString(),
        });

        const { data, error } = await supabase
          .from("restaurant_tables")
          .update(tableDomainToRow(nextTable))
          .eq("id", tableId)
          .select("*")
          .single();

        if (error) {
          return null;
        }

        return tableRowToDomain(data as TableRow);
      }
    }
  }

  const tables = await listTables();
  const index = tables.findIndex((table) => table.id === tableId);
  if (index === -1) return null;

  const nextTable = normalizeTable({
    ...tables[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const nextTables = [...tables];
  nextTables[index] = nextTable;
  await writeTablesFile(nextTables);
  return nextTable;
}

export async function ensureRestaurantTableSeed(restaurant: Restaurant) {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        const existing = data as TableRow[];
        if (existing.length >= restaurant.tableCount) {
          return existing.map(tableRowToDomain);
        }

        const missingTables = Array.from(
          { length: restaurant.tableCount - existing.length },
          (_, offset) => {
            const index = existing.length + offset + 1;
            const now = new Date().toISOString();
            return tableDomainToRow({
              id: `${restaurant.id}-table-${index}`,
              restaurantId: restaurant.id,
              name: `Table ${index}`,
              zone: "salle",
              seats: restaurant.seatsPerTable,
              active: true,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            });
          },
        );

        if (missingTables.length > 0) {
          await supabase.from("restaurant_tables").upsert(missingTables, { onConflict: "id" });
        }

        const refreshed = await supabase
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });

        if (!refreshed.error && Array.isArray(refreshed.data)) {
          return (refreshed.data as TableRow[]).map(tableRowToDomain);
        }
      }
    }
  }

  const tables = await listTables();
  const restaurantTables = tables.filter((table) => table.restaurantId === restaurant.id && !table.deletedAt);
  if (restaurantTables.length >= restaurant.tableCount) {
    return restaurantTables;
  }

  const now = new Date().toISOString();
  const nextTables = [...tables];
  for (let index = restaurantTables.length; index < restaurant.tableCount; index += 1) {
    nextTables.push({
      id: `${restaurant.id}-table-${index + 1}`,
      restaurantId: restaurant.id,
      name: `Table ${index + 1}`,
      zone: "salle",
      seats: restaurant.seatsPerTable,
      active: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  if (canPersistDataFiles) {
    await writeTablesFile(nextTables);
  }
  return nextTables.filter((table) => table.restaurantId === restaurant.id && !table.deletedAt);
}
