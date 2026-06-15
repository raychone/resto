import { promises as fs } from "node:fs";
import path from "node:path";
import { createId, type Customer, type User } from "@/lib/types";
import { getLoyaltySummary } from "@/lib/loyalty";
import { listRestaurants } from "@/lib/restaurant-store";
import { listUsers } from "@/lib/user-store";

const dataDir = path.join(process.cwd(), "data");
const customersFile = path.join(dataDir, "customers.json");

function normalizeCustomer(customer: Customer): Customer {
  const now = new Date().toISOString();
  const lifetimePoints = Number.isFinite(customer.lifetimePoints) ? Math.max(0, Math.floor(customer.lifetimePoints)) : 0;
  const currentPoints = Number.isFinite(customer.currentPoints) ? Math.max(0, Math.floor(customer.currentPoints)) : 0;
  const summary = getLoyaltySummary(lifetimePoints);

  return {
    ...customer,
    id: customer.id?.trim() || createId("customer"),
    restaurantId: customer.restaurantId?.trim() || "",
    userId: customer.userId?.trim() || null,
    firstName: customer.firstName?.trim() || "Client",
    lastName: customer.lastName?.trim() || "",
    name: customer.name?.trim() || `${customer.firstName ?? "Client"} ${customer.lastName ?? ""}`.trim(),
    email: customer.email?.trim() || "",
    phone: customer.phone?.trim() || "",
    currentPoints,
    lifetimePoints,
    tier: summary.tier,
    status: customer.status === "disabled" ? "disabled" : "active",
    createdAt: customer.createdAt ?? now,
    updatedAt: now,
    deletedAt: customer.deletedAt ?? null,
  };
}

async function createSeedCustomers(): Promise<Customer[]> {
  const [restaurants, users] = await Promise.all([listRestaurants(), listUsers()]);
  const activeClients = users.filter((user) => user.role === "client" && !user.deletedAt);
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const seed: Customer[] = [];

  for (const clientUser of activeClients) {
    const restaurant = clientUser.restaurantId ? restaurantById.get(clientUser.restaurantId) : restaurants[0];
    if (!restaurant) {
      continue;
    }

    const nameParts = clientUser.name.split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ");
    const lifetimePoints = 1280;
    const currentPoints = 180;

    seed.push(
      normalizeCustomer({
        id: `${clientUser.id}-customer`,
        restaurantId: restaurant.id,
        userId: clientUser.id,
        firstName,
        lastName,
        name: clientUser.name,
        email: `${clientUser.username}@demo.local`,
        phone: "+33 6 00 00 00 00",
        currentPoints,
        lifetimePoints,
        tier: getLoyaltySummary(lifetimePoints).tier,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }),
    );
  }

  if (seed.length > 0) {
    return seed;
  }

  const fallbackRestaurant = restaurants[0];
  if (!fallbackRestaurant) {
    return [];
  }

  const lifetimePoints = 1280;
  return [
    normalizeCustomer({
      id: "customer-root",
      restaurantId: fallbackRestaurant.id,
      userId: null,
      firstName: "Jean",
      lastName: "Dupont",
      name: "Jean Dupont",
      email: "client@example.com",
      phone: "+33 6 00 00 00 00",
      currentPoints: 180,
      lifetimePoints,
      tier: getLoyaltySummary(lifetimePoints).tier,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    }),
  ];
}

async function ensureStore() {
  try {
    await fs.access(customersFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(customersFile, JSON.stringify(await createSeedCustomers(), null, 2), "utf8");
  }
}

async function readCustomersFile() {
  await ensureStore();
  const raw = await fs.readFile(customersFile, "utf8");
  const parsed = JSON.parse(raw) as Customer[];
  const normalized = Array.isArray(parsed) ? parsed.map(normalizeCustomer) : [];
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await fs.writeFile(customersFile, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

async function writeCustomersFile(customers: Customer[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(customersFile, JSON.stringify(customers, null, 2), "utf8");
}

export async function listCustomers() {
  return readCustomersFile();
}

export async function listCustomersForRestaurant(restaurantId: string) {
  const customers = await listCustomers();
  return customers.filter((customer) => customer.restaurantId === restaurantId && !customer.deletedAt);
}

export async function getCustomerById(customerId: string) {
  const customers = await listCustomers();
  return customers.find((customer) => customer.id === customerId && !customer.deletedAt) ?? null;
}

export async function getCustomerByUserId(userId: string) {
  const customers = await listCustomers();
  return customers.find((customer) => customer.userId === userId && !customer.deletedAt) ?? null;
}

export async function getOrCreateCustomerForUser(user: User, restaurantId: string) {
  const existing = await getCustomerByUserId(user.id);
  if (existing) {
    return existing;
  }

  const customer = normalizeCustomer({
    id: createId("customer"),
    restaurantId,
    userId: user.id,
    firstName: user.name.split(" ")[0] || user.name,
    lastName: user.name.split(" ").slice(1).join(" "),
    name: user.name,
    email: `${user.username}@demo.local`,
    phone: "+33 6 00 00 00 00",
    currentPoints: 180,
    lifetimePoints: 1280,
    tier: getLoyaltySummary(1280).tier,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  });

  const customers = await listCustomers();
  await writeCustomersFile([...customers, customer]);
  return customer;
}

export async function updateCustomer(customerId: string, patch: Partial<Customer>) {
  const customers = await listCustomers();
  const index = customers.findIndex((customer) => customer.id === customerId);
  if (index === -1) {
    return null;
  }

  const nextCustomer = normalizeCustomer({
    ...customers[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const nextCustomers = [...customers];
  nextCustomers[index] = nextCustomer;
  await writeCustomersFile(nextCustomers);
  return nextCustomer;
}
