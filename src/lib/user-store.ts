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

function getDemoRestaurantId(restaurants: Awaited<ReturnType<typeof listRestaurants>>) {
  const noirOne = restaurants.find((restaurant) => restaurant.slug === "bar-1" && !restaurant.deletedAt);
  return noirOne?.id ?? restaurants.find((restaurant) => !restaurant.deletedAt)?.id ?? null;
}

type DemoUserSpec = {
  id: string;
  role: UserRole;
  name: string;
  username: string;
  password: string;
};

const demoManagerUser: DemoUserSpec = {
  id: "manager-root",
  role: "manager",
  name: "Raych",
  username: "raych",
  password: "raychone!",
};

const demoStaffUsers: DemoUserSpec[] = [
  {
    id: "staff-root",
    role: "staff",
    name: "Vasile Martin",
    username: "user",
    password: "pass123!",
  },
  {
    id: "staff-waiter-2",
    role: "staff",
    name: "Nora Simon",
    username: "waiter2",
    password: "waiter2!",
  },
  {
    id: "staff-waiter-3",
    role: "staff",
    name: "Lina Robert",
    username: "waiter3",
    password: "waiter3!",
  },
];

const demoKitchenUser: DemoUserSpec = {
  id: "kitchen-root",
  role: "kitchen",
  name: "Kitchen",
  username: "kitchen",
  password: "kitchen123!",
};

const demoClientUsers: DemoUserSpec[] = [
  {
    id: "client-root",
    role: "client",
    name: "Camille Martin",
    username: "client",
    password: "client123!",
  },
  {
    id: "client-02",
    role: "client",
    name: "Lucie Bernard",
    username: "client2",
    password: "client2!",
  },
  {
    id: "client-03",
    role: "client",
    name: "Yanis Dubois",
    username: "client3",
    password: "client3!",
  },
  {
    id: "client-04",
    role: "client",
    name: "Sarah Petit",
    username: "client4",
    password: "client4!",
  },
  {
    id: "client-05",
    role: "client",
    name: "Nicolas Leroy",
    username: "client5",
    password: "client5!",
  },
  {
    id: "client-06",
    role: "client",
    name: "Emma Laurent",
    username: "client6",
    password: "client6!",
  },
  {
    id: "client-07",
    role: "client",
    name: "Hugo Moreau",
    username: "client7",
    password: "client7!",
  },
  {
    id: "client-08",
    role: "client",
    name: "Chloé Garnier",
    username: "client8",
    password: "client8!",
  },
  {
    id: "client-09",
    role: "client",
    name: "Mehdi Roux",
    username: "client9",
    password: "client9!",
  },
  {
    id: "client-10",
    role: "client",
    name: "Inès Fontaine",
    username: "client10",
    password: "client10!",
  },
];

function createDemoUser(spec: DemoUserSpec, restaurantId: string | null, now: string): User {
  return {
    id: spec.id,
    restaurantId: spec.role === "manager" || spec.role === "staff" || spec.role === "kitchen" || spec.role === "client"
      ? restaurantId
      : null,
    role: spec.role,
    name: spec.name,
    username: spec.username,
    passwordHash: hashPassword(spec.password),
    temporaryPassword: spec.password,
    mustChangePassword: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    pinEnabled: false,
  };
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
      pinEnabled: false,
    },
    createDemoUser(demoManagerUser, restaurantId, now),
    ...demoStaffUsers.map((spec) => createDemoUser(spec, restaurantId, now)),
    createDemoUser(demoKitchenUser, restaurantId, now),
    ...demoClientUsers.map((spec) => createDemoUser(spec, restaurantId, now)),
  ];
}

function createMissingDemoUsers(existingUsers: User[], restaurantId: string | null): User[] {
  const now = new Date().toISOString();
  const existingByUsername = new Set(existingUsers.map((user) => user.username));
  const demoUsers: User[] = [];

  for (const spec of [demoManagerUser, ...demoStaffUsers, demoKitchenUser, ...demoClientUsers]) {
    if (existingByUsername.has(spec.username)) {
      continue;
    }

    demoUsers.push(createDemoUser(spec, restaurantId, now));
  }

  return demoUsers;
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
    const demoRestaurantId = getDemoRestaurantId(restaurants);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      dataFile,
      JSON.stringify(createSeedUsers(demoRestaurantId), null, 2),
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
      user.role === "owner" ||
      user.role === "manager" ||
      user.role === "staff" ||
      user.role === "kitchen" ||
      user.role === "client"
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
  let parsed: User[] = [];

  try {
    parsed = JSON.parse(raw) as User[];
  } catch {
    const restaurants = await listRestaurants();
    const seedUsers = createSeedUsers(getDemoRestaurantId(restaurants));
    await fs.writeFile(dataFile, JSON.stringify(seedUsers, null, 2), "utf8");
    return seedUsers;
  }

  const restaurants = await listRestaurants();
  const validRestaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
  const fallbackRestaurantId = getDemoRestaurantId(restaurants);
  const demoUserNames = new Set([
    "owner",
    demoManagerUser.username,
    ...demoStaffUsers.map((user) => user.username),
    demoKitchenUser.username,
    ...demoClientUsers.map((user) => user.username),
  ]);
  const demoUserIds = new Set([
    "owner-root",
    demoManagerUser.id,
    ...demoStaffUsers.map((user) => user.id),
    demoKitchenUser.id,
    ...demoClientUsers.map((user) => user.id),
  ]);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    const seedUsers = createSeedUsers(restaurants[0]?.id ?? null);
    await fs.writeFile(dataFile, JSON.stringify(seedUsers, null, 2), "utf8");
    return seedUsers;
  }

  const normalized = parsed.map((user) => {
    const normalizedUser = normalizeUser(user);

    if (
      normalizedUser.role === "manager" ||
      normalizedUser.role === "staff" ||
      normalizedUser.role === "kitchen" ||
      normalizedUser.role === "client"
    ) {
      if (demoUserIds.has(normalizedUser.id) || demoUserNames.has(normalizedUser.username)) {
        return {
          ...normalizedUser,
          restaurantId: fallbackRestaurantId,
        };
      }

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

  const demoUsers = createMissingDemoUsers(normalized, fallbackRestaurantId);
  const withDemoUsers = demoUsers.length > 0 ? [...normalized, ...demoUsers] : normalized;
  const finalDirty = dirty || demoUsers.length > 0;

  if (finalDirty) {
    await fs.writeFile(dataFile, JSON.stringify(withDemoUsers, null, 2), "utf8");
  }

  return withDemoUsers;
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
