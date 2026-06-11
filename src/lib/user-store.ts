import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { listRestaurants } from "@/lib/restaurant-store";
import {
  createId,
  type User,
  type UserRole,
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "users.json");

function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSeedUsers(restaurantId: string | null): User[] {
  const now = new Date().toISOString();

  return [
    {
      id: "owner-root",
      restaurantId: null,
      role: "owner",
      name: "Owner",
      username: "owner",
      passwordHash: hashPassword("owner123!"),
      temporaryPassword: "owner123!",
      mustChangePassword: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: "manager-root",
      restaurantId,
      role: "manager",
      name: "Raych",
      username: "raych",
      passwordHash: hashPassword("raychone!"),
      temporaryPassword: "raychone!",
      mustChangePassword: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: "staff-root",
      restaurantId,
      role: "staff",
      name: "User",
      username: "user",
      passwordHash: hashPassword("pass123!"),
      temporaryPassword: "pass123!",
      mustChangePassword: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ];
}

function resolveValidRestaurantId(restaurantId: string | null, validRestaurantIds: Set<string>, fallbackRestaurantId: string | null) {
  if (restaurantId && validRestaurantIds.has(restaurantId)) {
    return restaurantId;
  }

  return fallbackRestaurantId;
}

async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch {
    const restaurants = await listRestaurants();
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      dataFile,
      JSON.stringify(createSeedUsers(restaurants[0]?.id ?? null), null, 2),
      "utf8",
    );
  }
}

function normalizeUser(user: User): User {
  const now = new Date().toISOString();

  return {
    ...user,
    id: user.id?.trim() || createId("user"),
    restaurantId: user.restaurantId ?? null,
    role:
      user.role === "owner" || user.role === "manager" || user.role === "staff"
        ? user.role
        : "staff",
    name: user.name?.trim() || user.username || "Utilisateur",
    username: user.username?.trim() || `user-${createId("login").slice(-4)}`,
    passwordHash: user.passwordHash?.trim() || hashPassword(user.temporaryPassword ?? ""),
    temporaryPassword: user.temporaryPassword?.trim() || undefined,
    mustChangePassword: Boolean(user.mustChangePassword),
    status: user.status === "disabled" ? "disabled" : "active",
    createdAt: user.createdAt ?? now,
    updatedAt: now,
    deletedAt: user.deletedAt ?? null,
    pinEnabled: Boolean(user.pinEnabled),
    pinHash: user.pinHash?.trim() || undefined,
  };
}

async function readUsersFile() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as User[];
  const restaurants = await listRestaurants();
  const validRestaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
  const fallbackRestaurantId = restaurants[0]?.id ?? null;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    const seedUsers = createSeedUsers(restaurants[0]?.id ?? null);
    await fs.writeFile(dataFile, JSON.stringify(seedUsers, null, 2), "utf8");
    return seedUsers;
  }

  const normalized = parsed.map((user) => {
    const normalizedUser = normalizeUser(user);

    if ((normalizedUser.role === "manager" || normalizedUser.role === "staff")) {
      return {
        ...normalizedUser,
        restaurantId: resolveValidRestaurantId(
          normalizedUser.restaurantId,
          validRestaurantIds,
          fallbackRestaurantId,
        ),
      };
    }

    return normalizedUser;
  });
  const dirty =
    JSON.stringify(parsed) !== JSON.stringify(normalized) ||
    normalized.some((user) => !user.id || !user.username);

  if (dirty) {
    await fs.writeFile(dataFile, JSON.stringify(normalized, null, 2), "utf8");
  }

  return normalized;
}

async function writeUsersFile(users: User[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(users, null, 2), "utf8");
}

export function verifyPassword(plainText: string, passwordHash: string) {
  return hashPassword(plainText) === passwordHash;
}

export function hashUserPassword(plainText: string) {
  return hashPassword(plainText);
}

export async function listUsers() {
  return readUsersFile();
}

export async function getUserById(userId: string) {
  const users = await listUsers();
  return users.find((user) => user.id === userId && !user.deletedAt) ?? null;
}

export async function getUserByUsername(username: string) {
  const users = await listUsers();
  return users.find((user) => user.username === username && !user.deletedAt) ?? null;
}

export async function listUsersForRestaurant(restaurantId: string) {
  const users = await listUsers();
  return users.filter((user) => user.restaurantId === restaurantId && !user.deletedAt);
}

export async function createUser(input: Omit<User, "id" | "createdAt" | "updatedAt">) {
  const users = await listUsers();
  const now = new Date().toISOString();
  const user: User = normalizeUser({
    ...input,
    id: createId("user"),
    createdAt: now,
    updatedAt: now,
  });

  const nextUsers = [...users, user];
  await writeUsersFile(nextUsers);
  return user;
}

export async function updateUser(
  userId: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
) {
  const users = await listUsers();
  const index = users.findIndex((entry) => entry.id === userId);

  if (index === -1) {
    return null;
  }

  const nextUser = normalizeUser({
    ...users[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const nextUsers = [...users];
  nextUsers[index] = nextUser;
  await writeUsersFile(nextUsers);
  return nextUser;
}

export async function setUserPassword(
  userId: string,
  password: string,
  options?: { mustChangePassword?: boolean; temporaryPassword?: string },
) {
  return updateUser(userId, {
    passwordHash: hashPassword(password),
    temporaryPassword: options?.temporaryPassword,
    mustChangePassword: options?.mustChangePassword ?? false,
  });
}

export async function disableUser(userId: string) {
  return updateUser(userId, { status: "disabled" });
}

export async function enableUser(userId: string) {
  return updateUser(userId, { status: "active" });
}

export function isUserActive(user: User | null | undefined) {
  return Boolean(user && user.status === "active" && !user.deletedAt);
}

export function isUserRole(user: User | null | undefined, role: UserRole) {
  return Boolean(user && user.role === role && !user.deletedAt);
}
