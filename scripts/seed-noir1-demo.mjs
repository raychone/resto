#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const files = {
  restaurants: path.join(dataDir, "restaurants.json"),
  users: path.join(dataDir, "users.json"),
  customers: path.join(dataDir, "customers.json"),
  tables: path.join(dataDir, "tables.json"),
  orders: path.join(dataDir, "orders.json"),
  payments: path.join(dataDir, "payments.json"),
  reservations: path.join(dataDir, "reservations.json"),
  messages: path.join(dataDir, "messages.json"),
  tableSessions: path.join(dataDir, "table-sessions.json"),
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function flattenMenuItems(restaurant) {
  return restaurant.categories.flatMap((category) => category.items ?? []);
}

function createUser({
  id,
  role,
  name,
  username,
  password,
  restaurantId,
  now,
}) {
  return {
    id,
    restaurantId,
    role,
    name,
    username,
    passwordHash: sha256(password),
    temporaryPassword: password,
    mustChangePassword: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    pinEnabled: false,
  };
}

function createCustomer({
  id,
  restaurantId,
  userId,
  firstName,
  lastName,
  email,
  phone,
  lifetimePoints,
  currentPoints,
  now,
}) {
  return {
    id,
    restaurantId,
    userId,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email,
    phone,
    currentPoints,
    lifetimePoints,
    tier: lifetimePoints >= 2500 ? "platinum" : lifetimePoints >= 1600 ? "gold" : "silver",
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createTable({ restaurantId, index, seats, now }) {
  return {
    id: `${restaurantId}-table-${index}`,
    restaurantId,
    name: `Table ${index}`,
    zone: "salle",
    seats,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createOrder({
  restaurantId,
  tableId,
  tableSessionId,
  staffUserId,
  source,
  status,
  note,
  items,
  now,
}) {
  return {
    id: `${tableId}-order`,
    restaurantId,
    tableId,
    tableSessionId,
    staffUserId,
    source,
    status,
    openedAt: now,
    closedAt: null,
    archivedAt: null,
    note,
    items,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createOrderItem({ orderId, menuItem, quantity, assignedClientId, assignedClientName, now }) {
  return {
    id: `${orderId}-${menuItem.id}`,
    orderId,
    menuItemId: menuItem.id,
    nameSnapshot: menuItem.name,
    priceSnapshot: Number.isFinite(menuItem.happyHourPrice) && menuItem.happyHourEnabled
      ? Number(menuItem.happyHourPrice)
      : Number(menuItem.price),
    quantity,
    note: "",
    assignedClientId,
    assignedClientName,
    createdAt: now,
    deletedAt: null,
  };
}

function createTableSession({
  restaurantId,
  tableId,
  orderId,
  customerId,
  customerName,
  estimatedTotal,
  now,
}) {
  return {
    id: `${tableId}-session`,
    restaurantId,
    tableId,
    orderId,
    status: "open",
    guestCount: 1,
    estimatedTotal,
    paidTotal: 0,
    note: `Session démo pour ${customerName}`,
    participants: [
      {
        id: `${tableId}-participant`,
        customerId,
        name: customerName,
        sharePercent: 100,
        settledAmount: 0,
        note: "Client connecté",
      },
    ],
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    deletedAt: null,
  };
}

function createMessage({
  restaurantId,
  restaurantSlug,
  tableId,
  tableLabel,
  name,
  phone,
  email,
  message,
  locale,
  now,
}) {
  return {
    id: `${tableId}-message`,
    restaurantId,
    restaurantSlug,
    tableId,
    tableLabel,
    createdAt: now,
    status: "new",
    name,
    phone,
    email,
    message,
    locale,
  };
}

async function main() {
  const restaurants = await readJson(files.restaurants, []);
  const bar1 = restaurants.find((restaurant) => restaurant.slug === "bar-1");
  if (!bar1) {
    throw new Error("Restaurant Noir 1 (bar-1) introuvable dans data/restaurants.json");
  }

  const now = new Date().toISOString();
  const menuItems = flattenMenuItems(bar1);
  const menuById = new Map(menuItems.map((item) => [item.id, item]));

  const demoUsers = [
    createUser({
      id: "owner-root",
      role: "owner",
      name: "Owner",
      username: "owner",
      password: "owner123!",
      restaurantId: null,
      now,
    }),
    createUser({
      id: "manager-root",
      role: "manager",
      name: "Manager",
      username: "manager",
      password: "manager123!",
      restaurantId: bar1.id,
      now,
    }),
    createUser({
      id: "staff-root",
      role: "staff",
      name: "Vasile Martin",
      username: "user",
      password: "pass123!",
      restaurantId: bar1.id,
      now,
    }),
    createUser({
      id: "staff-waiter-2",
      role: "staff",
      name: "Nora Simon",
      username: "waiter2",
      password: "waiter2!",
      restaurantId: bar1.id,
      now,
    }),
    createUser({
      id: "staff-waiter-3",
      role: "staff",
      name: "Lina Robert",
      username: "waiter3",
      password: "waiter3!",
      restaurantId: bar1.id,
      now,
    }),
    createUser({
      id: "kitchen-root",
      role: "kitchen",
      name: "Kitchen",
      username: "kitchen",
      password: "kitchen123!",
      restaurantId: bar1.id,
      now,
    }),
  ];

  const clientRoster = [
    { id: "client-root", name: "Camille Martin", username: "client", password: "client123!" },
    { id: "client-02", name: "Lucie Bernard", username: "client2", password: "client2!" },
    { id: "client-03", name: "Yanis Dubois", username: "client3", password: "client3!" },
    { id: "client-04", name: "Sarah Petit", username: "client4", password: "client4!" },
    { id: "client-05", name: "Nicolas Leroy", username: "client5", password: "client5!" },
    { id: "client-06", name: "Emma Laurent", username: "client6", password: "client6!" },
    { id: "client-07", name: "Hugo Moreau", username: "client7", password: "client7!" },
    { id: "client-08", name: "Chloé Garnier", username: "client8", password: "client8!" },
    { id: "client-09", name: "Mehdi Roux", username: "client9", password: "client9!" },
    { id: "client-10", name: "Inès Fontaine", username: "client10", password: "client10!" },
  ];

  const clientUsers = clientRoster.map((client) =>
    createUser({
      id: client.id,
      role: "client",
      name: client.name,
      username: client.username,
      password: client.password,
      restaurantId: bar1.id,
      now,
    }),
  );

  const users = await readJson(files.users, []);
  const demoUserIds = new Set([
    "owner-root",
    "manager-root",
    "staff-root",
    "staff-waiter-2",
    "staff-waiter-3",
    "kitchen-root",
    ...clientRoster.map((client) => client.id),
  ]);
  const demoUsernames = new Set([
    "owner",
    "manager",
    "user",
    "waiter2",
    "waiter3",
    "kitchen",
    ...clientRoster.map((client) => client.username),
  ]);
  const preservedUsers = Array.isArray(users)
    ? users.filter((user) => !demoUserIds.has(user.id) && !demoUsernames.has(user.username) && user.restaurantId !== bar1.id)
    : [];
  await writeJson(files.users, [...preservedUsers, ...demoUsers, ...clientUsers]);

  const customers = await readJson(files.customers, []);
  const preservedCustomers = Array.isArray(customers)
    ? customers.filter((customer) => customer.restaurantId !== bar1.id)
    : [];
  const demoCustomers = clientRoster.map((client, index) =>
    createCustomer({
      id: `${client.id}-customer`,
      restaurantId: bar1.id,
      userId: client.id,
      firstName: client.name.split(" ")[0] || client.name,
      lastName: client.name.split(" ").slice(1).join(" "),
      email: `${client.username}@demo.local`,
      phone: `+33 6 00 00 00 ${String(index + 1).padStart(2, "0")}`,
      lifetimePoints: 1280 + index * 40,
      currentPoints: 180 + index * 10,
      now,
    }),
  );
  await writeJson(files.customers, [...preservedCustomers, ...demoCustomers]);

  const tables = await readJson(files.tables, []);
  const preservedTables = Array.isArray(tables)
    ? tables.filter((table) => table.restaurantId !== bar1.id)
    : [];
  const demoTables = Array.from({ length: 10 }, (_, index) =>
    createTable({
      restaurantId: bar1.id,
      index: index + 1,
      seats: bar1.seatsPerTable,
      now,
    }),
  );
  await writeJson(files.tables, [...preservedTables, ...demoTables]);

  const tableParticipants = demoCustomers.map((customer, index) => ({
    id: `${demoTables[index].id}-participant`,
    customerId: customer.id,
    name: customer.name,
    sharePercent: 100,
    settledAmount: 0,
    note: "Client connecté",
  }));

  const orderDefinitions = [
    {
      source: "qr",
      status: "open",
      staffUserId: null,
      items: [
        { id: "item-hh-krombacher-pint", quantity: 2 },
        { id: "item-hh-ricard-pastis", quantity: 1 },
      ],
      note: "Commande QR",
    },
    {
      source: "qr",
      status: "sent_to_kitchen",
      staffUserId: null,
      items: [
        { id: "item-hh-spritz", quantity: 1 },
        { id: "item-hh-gin-hibiscus", quantity: 1 },
      ],
      note: "Commande QR",
    },
    {
      source: "qr",
      status: "preparing",
      staffUserId: null,
      items: [
        { id: "item-hh-moscow-mule", quantity: 1 },
        { id: "item-hh-london-mule", quantity: 1 },
      ],
      note: "Commande QR",
    },
    {
      source: "qr",
      status: "ready",
      staffUserId: null,
      items: [
        { id: "item-hh-caribbean-mule", quantity: 1 },
        { id: "item-hh-cuba-libre", quantity: 1 },
      ],
      note: "Commande QR",
    },
    {
      source: "table",
      status: "open",
      staffUserId: "staff-root",
      items: [
        { id: "item-hh-jagger-bomb", quantity: 1 },
        { id: "item-hh-gin-fizz", quantity: 1 },
      ],
      note: "Bon serveur",
    },
    {
      source: "table",
      status: "sent_to_kitchen",
      staffUserId: "staff-waiter-2",
      items: [
        { id: "item-hh-tequila-sunrise", quantity: 1 },
        { id: "item-hh-daiquiri", quantity: 1 },
        { id: "item-hh-bloody-mary", quantity: 1 },
      ],
      note: "Bon serveur",
    },
    {
      source: "table",
      status: "preparing",
      staffUserId: "staff-waiter-3",
      items: [
        { id: "item-krombacher-blonde", quantity: 2 },
        { id: "item-grimbergen", quantity: 1 },
      ],
      note: "Bon serveur",
    },
    {
      source: "table",
      status: "ready",
      staffUserId: "staff-root",
      items: [
        { id: "item-pastis-ricard-casanis", quantity: 1 },
        { id: "item-white-martini", quantity: 2 },
      ],
      note: "Bon serveur",
    },
    {
      source: "qr",
      status: "open",
      staffUserId: null,
      items: [
        { id: "item-chamasutra-rouge", quantity: 1 },
        { id: "item-chat-blanc", quantity: 1 },
      ],
      note: "Commande QR",
    },
    {
      source: "qr",
      status: "sent_to_kitchen",
      staffUserId: null,
      items: [
        { id: "item-goudale-zero", quantity: 2 },
        { id: "item-elderflower-mule", quantity: 1 },
      ],
      note: "Commande QR",
    },
  ];

  const orders = await readJson(files.orders, []);
  const preservedOrders = Array.isArray(orders)
    ? orders.filter((order) => order.restaurantId !== bar1.id)
    : [];
  const demoOrders = orderDefinitions.map((definition, index) => {
    const table = demoTables[index];
    const customer = demoCustomers[index];
    const orderId = `${table.id}-order`;
    const items = definition.items.map((itemSpec) => {
      const menuItem = menuById.get(itemSpec.id);
      if (!menuItem) {
        throw new Error(`Menu item introuvable: ${itemSpec.id}`);
      }

      return createOrderItem({
        orderId,
        menuItem,
        quantity: itemSpec.quantity,
        assignedClientId: customer.id,
        assignedClientName: customer.name,
        now,
      });
    });

    return createOrder({
      restaurantId: bar1.id,
      tableId: table.id,
      tableSessionId: `${table.id}-session`,
      staffUserId: definition.staffUserId,
      source: definition.source,
      status: definition.status,
      note: definition.note,
      items,
      now,
    });
  });
  await writeJson(files.orders, [...preservedOrders, ...demoOrders]);

  const sessions = await readJson(files.tableSessions, []);
  const preservedSessions = Array.isArray(sessions)
    ? sessions.filter((session) => session.restaurantId !== bar1.id)
    : [];
  const demoSessions = demoTables.map((table, index) => {
    const order = demoOrders[index];
    const customer = demoCustomers[index];
    const estimatedTotal = order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
    return createTableSession({
      restaurantId: bar1.id,
      tableId: table.id,
      orderId: order.id,
      customerId: customer.id,
      customerName: customer.name,
      estimatedTotal,
      now,
    });
  });
  await writeJson(files.tableSessions, [...preservedSessions, ...demoSessions]);

  const messages = await readJson(files.messages, []);
  const preservedMessages = Array.isArray(messages)
    ? messages.filter((message) => message.restaurantSlug !== bar1.slug)
    : [];
  const demoMessages = [
    createMessage({
      restaurantId: bar1.id,
      restaurantSlug: bar1.slug,
      tableId: demoTables[1].id,
      tableLabel: demoTables[1].name,
      name: demoCustomers[1].name,
      phone: demoCustomers[1].phone,
      email: demoCustomers[1].email,
      message: `Le client ${demoCustomers[1].name} souhaite appeler le serveur depuis ${demoTables[1].name}.`,
      locale: "fr",
      now,
    }),
    createMessage({
      restaurantId: bar1.id,
      restaurantSlug: bar1.slug,
      tableId: demoTables[4].id,
      tableLabel: demoTables[4].name,
      name: demoCustomers[4].name,
      phone: demoCustomers[4].phone,
      email: demoCustomers[4].email,
      message: `Le client ${demoCustomers[4].name} souhaite appeler le serveur depuis ${demoTables[4].name}.`,
      locale: "fr",
      now,
    }),
    createMessage({
      restaurantId: bar1.id,
      restaurantSlug: bar1.slug,
      tableId: demoTables[7].id,
      tableLabel: demoTables[7].name,
      name: demoCustomers[7].name,
      phone: demoCustomers[7].phone,
      email: demoCustomers[7].email,
      message: `Le client ${demoCustomers[7].name} souhaite appeler le serveur depuis ${demoTables[7].name}.`,
      locale: "fr",
      now,
    }),
  ];
  await writeJson(files.messages, [...preservedMessages, ...demoMessages]);

  const reservations = await readJson(files.reservations, []);
  const preservedReservations = Array.isArray(reservations)
    ? reservations.filter((reservation) => reservation.restaurantSlug !== bar1.slug)
    : [];
  await writeJson(files.reservations, preservedReservations);

  const payments = await readJson(files.payments, []);
  const preservedPayments = Array.isArray(payments)
    ? payments.filter((payment) => payment.restaurantId !== bar1.id)
    : [];
  await writeJson(files.payments, preservedPayments);

  console.log("Seed Noir 1 réécrit avec 10 tables occupées, 10 clients, 3 serveurs, 1 cuisine, 1 manager.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
