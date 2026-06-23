import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const outputFile = path.join(rootDir, "supabase", "seed.sql");

const tableConfigs = [
  {
    table: "restaurants",
    file: "restaurants.json",
    columns: [
      "id",
      "slug",
      "name",
      "status",
      "plan",
      "tagline",
      "description",
      "accent",
      "logoUrl",
      "heroImage",
      "address",
      "phone",
      "whatsappNumber",
      "uberEatsUrl",
      "tripAdvisorUrl",
      "googleRating",
      "googleReviewsCount",
      "googleReviewsUrl",
      "openingHours",
      "tableCount",
      "seatsPerTable",
      "weeklyHours",
      "happyHourSchedule",
      "features",
      "currency",
      "categories",
      "translations",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    table: "users",
    file: "users.json",
    columns: [
      "id",
      "restaurantId",
      "role",
      "name",
      "username",
      "passwordHash",
      "temporaryPassword",
      "mustChangePassword",
      "status",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "pinEnabled",
    ],
  },
  {
    table: "customers",
    file: "customers.json",
    columns: [
      "id",
      "restaurantId",
      "userId",
      "isGuest",
      "firstName",
      "lastName",
      "name",
      "email",
      "phone",
      "currentPoints",
      "lifetimePoints",
      "tier",
      "status",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    table: "restaurant_tables",
    file: "tables.json",
    columns: [
      "id",
      "restaurantId",
      "name",
      "zone",
      "seats",
      "active",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    table: "table_sessions",
    file: "table-sessions.json",
    columns: [
      "id",
      "restaurantId",
      "tableId",
      "orderId",
      "status",
      "guestCount",
      "estimatedTotal",
      "paidTotal",
      "note",
      "participants",
      "lastPaymentMethod",
      "lastPaymentAmount",
      "lastPaymentAt",
      "createdAt",
      "updatedAt",
      "closedAt",
      "deletedAt",
    ],
  },
  {
    table: "orders",
    file: "orders.json",
    columns: [
      "id",
      "restaurantId",
      "tableId",
      "tableSessionId",
      "staffUserId",
      "source",
      "status",
      "openedAt",
      "closedAt",
      "archivedAt",
      "note",
      "items",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    table: "payments",
    file: "payments.json",
    columns: [
      "id",
      "orderId",
      "restaurantId",
      "amount",
      "method",
      "status",
      "note",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    table: "reservations",
    file: "reservations.json",
    columns: [
      "id",
      "restaurantSlug",
      "restaurantId",
      "locale",
      "firstName",
      "lastName",
      "name",
      "phone",
      "email",
      "note",
      "date",
      "time",
      "guestCount",
      "tablesNeeded",
      "status",
      "createdAt",
      "confirmedAt",
      "confirmedMessage",
      "deletedAt",
    ],
  },
  {
    table: "messages",
    file: "messages.json",
    columns: [
      "id",
      "restaurantSlug",
      "restaurantId",
      "tableId",
      "tableLabel",
      "locale",
      "name",
      "phone",
      "email",
      "message",
      "status",
      "createdAt",
      "deletedAt",
    ],
  },
  {
    table: "invoices",
    file: "invoices.json",
    columns: [
      "id",
      "restaurantSlug",
      "restaurantName",
      "kind",
      "periodLabel",
      "amount",
      "currency",
      "includeDomain",
      "includeDatabase",
      "includeQrMenu",
      "includeBooking",
      "includeSms",
      "notes",
      "status",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    table: "audit",
    file: "audit.json",
    columns: [
      "id",
      "restaurantSlug",
      "restaurantId",
      "actorRole",
      "actorName",
      "action",
      "targetType",
      "targetId",
      "details",
      "createdAt",
    ],
  },
];

const jsonbColumnsByTable = {
  restaurants: new Set(["weeklyHours", "happyHourSchedule", "features", "categories", "translations"]),
  table_sessions: new Set(["participants"]),
  orders: new Set(["items"]),
};

function camelToSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return String(value);
    }
    return "null";
  }

  if (Array.isArray(value) || typeof value === "object") {
    return `'${sqlEscape(JSON.stringify(value))}'::jsonb`;
  }

  return `'${sqlEscape(value)}'`;
}

function rowToSql(table, row, columns) {
  const jsonbColumns = jsonbColumnsByTable[table] ?? new Set();
  const values = columns.map((column) => {
    const raw = row[column];
    if (jsonbColumns.has(column)) {
      return raw === null || raw === undefined ? "null" : `'${sqlEscape(JSON.stringify(raw))}'::jsonb`;
    }

    return sqlLiteral(raw);
  });

  return `(${values.join(", ")})`;
}

async function main() {
  const statements = [];
  statements.push("-- Generated from local JSON data.");
  statements.push("begin;");
  statements.push(
    "truncate table public.audit, public.invoices, public.payments, public.orders, public.table_sessions, public.restaurant_tables, public.messages, public.reservations, public.customers, public.users, public.restaurants restart identity cascade;",
  );

  for (const config of tableConfigs) {
    const filePath = path.join(dataDir, config.file);
    const raw = await fs.readFile(filePath, "utf8");
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }

    const columns = config.columns.map(camelToSnake);
    const values = rows.map((row) => rowToSql(config.table, row, config.columns));
    statements.push(
      `insert into public.${config.table} (${columns.join(", ")}) values\n  ${values.join(",\n  ")};`,
    );
  }

  statements.push("commit;");
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${statements.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(rootDir, outputFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
