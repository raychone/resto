import { promises as fs } from "node:fs";
import path from "node:path";
import { listRestaurants } from "@/lib/restaurant-store";
import { createId, type Restaurant, type Table, type TableZone } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "tables.json");

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
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Table[];

  if (!Array.isArray(parsed)) {
    const restaurants = await listRestaurants();
    const seedTables = restaurants.flatMap((restaurant) => createTablesForRestaurant(restaurant));
    await fs.writeFile(dataFile, JSON.stringify(seedTables, null, 2), "utf8");
    return seedTables;
  }

  const normalized = parsed.map(normalizeTable);
  const restaurants = await listRestaurants();
  const expectedTables = restaurants.flatMap((restaurant) => ensureRestaurantTables(normalized, restaurant));
  const merged = mergeTables(normalized, expectedTables);
  const dirty = JSON.stringify(parsed) !== JSON.stringify(merged);

  if (dirty) {
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

  await writeTablesFile(nextTables);
  return nextTables.filter((table) => table.restaurantId === restaurant.id && !table.deletedAt);
}
