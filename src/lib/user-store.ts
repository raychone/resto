import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { listRestaurants } from "@/lib/restaurant-store";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";
import {
  createId,
  type User,
  type UserRole,
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "users.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type UserRow = {
  id: string;
  restaurant_id: string | null;
  role: UserRole;
  name: string;
  username: string;
  password_hash: string;
  temporary_password: string | null;
  must_change_password: boolean;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  pin_enabled: boolean;
  pin_hash: string | null;
};

function userRowToDomain(row: UserRow): User {
  return normalizeUser({
    id: row.id,
    restaurantId: row.restaurant_id,
    role: row.role,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    temporaryPassword: row.temporary_password ?? undefined,
    mustChangePassword: row.must_change_password,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    pinEnabled: row.pin_enabled,
    pinHash: row.pin_hash ?? undefined,
  });
}

function userDomainToRow(user: User): UserRow {
  return {
    id: user.id,
    restaurant_id: user.restaurantId,
    role: user.role,
    name: user.name,
    username: user.username,
    password_hash: user.passwordHash,
    temporary_password: user.temporaryPassword ?? null,
    must_change_password: user.mustChangePassword,
    status: user.status,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt ?? null,
    pin_enabled: Boolean(user.pinEnabled),
    pin_hash: user.pinHash ?? null,
  };
}

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

type DemoRestaurantUserSet = {
  restaurantSlug: string;
  manager: DemoUserSpec;
  staff: DemoUserSpec[];
  kitchen: DemoUserSpec;
  clients: DemoUserSpec[];
};

type DemoCredentialSpec = {
  spec: DemoUserSpec;
  restaurantSlug: string | null;
};

const demoManagerUser: DemoUserSpec = {
  id: "manager-root",
  role: "manager",
  name: "Manager",
  username: "manager",
  password: "manager123!",
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

const foodDemoUsers: DemoRestaurantUserSet = {
  restaurantSlug: "food-1",
  manager: {
    id: "food1-manager-root",
    role: "manager",
    name: "Food Manager",
    username: "foodmanager",
    password: "manager123!",
  },
  staff: [
    {
      id: "food1-staff-root",
      role: "staff",
      name: "Food Staff",
      username: "foodstaff",
      password: "pass123!",
    },
  ],
  kitchen: {
    id: "food1-kitchen-root",
    role: "kitchen",
    name: "Food Kitchen",
    username: "foodkitchen",
    password: "kitchen123!",
  },
  clients: [
    {
      id: "food1-client-root",
      role: "client",
      name: "Food Client",
      username: "foodclient",
      password: "client123!",
    },
    {
      id: "food1-client-02",
      role: "client",
      name: "Food Client Two",
      username: "foodclient2",
      password: "foodclient2!",
    },
  ],
};

const demoCredentialSpecs: DemoCredentialSpec[] = [
  { spec: demoManagerUser, restaurantSlug: null },
  ...demoStaffUsers.map((spec) => ({ spec, restaurantSlug: null })),
  { spec: demoKitchenUser, restaurantSlug: null },
  ...demoClientUsers.map((spec) => ({ spec, restaurantSlug: null })),
  { spec: foodDemoUsers.manager, restaurantSlug: "food-1" },
  ...foodDemoUsers.staff.map((spec) => ({ spec, restaurantSlug: "food-1" })),
  { spec: foodDemoUsers.kitchen, restaurantSlug: "food-1" },
  ...foodDemoUsers.clients.map((spec) => ({ spec, restaurantSlug: "food-1" })),
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

function createSeedUsers(restaurantId: string | null, foodRestaurantId: string | null): User[] {
  const now = new Date().toISOString();
  const foodRestaurantUsers = foodRestaurantId
    ? [
        createDemoUser(foodDemoUsers.manager, foodRestaurantId, now),
        ...foodDemoUsers.staff.map((spec) => createDemoUser(spec, foodRestaurantId, now)),
        createDemoUser(foodDemoUsers.kitchen, foodRestaurantId, now),
        ...foodDemoUsers.clients.map((spec) => createDemoUser(spec, foodRestaurantId, now)),
      ]
    : [];

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
    ...foodRestaurantUsers,
  ];
}

function createMissingDemoUsers(
  existingUsers: User[],
  restaurantId: string | null,
  foodRestaurantId: string | null,
): User[] {
  const now = new Date().toISOString();
  const existingByUsername = new Set(existingUsers.map((user) => user.username));
  const demoUsers: User[] = [];

  for (const spec of [demoManagerUser, ...demoStaffUsers, demoKitchenUser, ...demoClientUsers]) {
    if (existingByUsername.has(spec.username)) {
      continue;
    }

    demoUsers.push(createDemoUser(spec, restaurantId, now));
  }

  if (foodRestaurantId) {
    for (const spec of [
      foodDemoUsers.manager,
      ...foodDemoUsers.staff,
      foodDemoUsers.kitchen,
      ...foodDemoUsers.clients,
    ]) {
      if (existingByUsername.has(spec.username)) {
        continue;
      }

      demoUsers.push(createDemoUser(spec, foodRestaurantId, now));
    }
  }

  return demoUsers;
}

function resolveValidRestaurantId(restaurantId: string | null, validRestaurantIds: Set<string>, fallbackRestaurantId: string | null) {
  if (restaurantId && validRestaurantIds.has(restaurantId)) {
    return restaurantId;
  }

  return fallbackRestaurantId;
}

async function normalizeUsersSnapshot(parsed: User[], persist: boolean) {
  const restaurants = await listRestaurants();
  const validRestaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
  const fallbackRestaurantId = getDemoRestaurantId(restaurants);
  const foodRestaurantId = restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null;
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
  const foodDemoUserNames = new Set([
    foodDemoUsers.manager.username,
    ...foodDemoUsers.staff.map((user) => user.username),
    foodDemoUsers.kitchen.username,
    ...foodDemoUsers.clients.map((user) => user.username),
  ]);
  const foodDemoUserIds = new Set([
    foodDemoUsers.manager.id,
    ...foodDemoUsers.staff.map((user) => user.id),
    foodDemoUsers.kitchen.id,
    ...foodDemoUsers.clients.map((user) => user.id),
  ]);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return createSeedUsers(
      restaurants[0]?.id ?? null,
      restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null,
    );
  }

  const normalized: User[] = parsed.map((user): User => {
    const normalizedUser = normalizeUser(user);

    if (foodRestaurantId && (foodDemoUserIds.has(normalizedUser.id) || foodDemoUserNames.has(normalizedUser.username))) {
      const foodSpec =
        [foodDemoUsers.manager, ...foodDemoUsers.staff, foodDemoUsers.kitchen, ...foodDemoUsers.clients].find(
          (spec) => spec.username === normalizedUser.username || spec.id === normalizedUser.id,
        ) ?? null;

      if (foodSpec) {
        return {
          ...normalizedUser,
          id: foodSpec.id,
          role: foodSpec.role,
          name: foodSpec.name,
          username: foodSpec.username,
          restaurantId: foodRestaurantId,
          passwordHash: hashPassword(foodSpec.password),
          temporaryPassword: foodSpec.password,
          mustChangePassword: false,
          status: "active" as const,
        } as User;
      }
    }

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
        } as User;
      }

      return {
        ...normalizedUser,
        restaurantId: resolveValidRestaurantId(
          normalizedUser.restaurantId,
          validRestaurantIds,
          fallbackRestaurantId,
        ),
      } as User;
    }

    return normalizedUser;
  });
  const dirty =
    JSON.stringify(parsed) !== JSON.stringify(normalized) ||
    normalized.some((user) => !user.id || !user.username);

  const demoUsers = createMissingDemoUsers(normalized, fallbackRestaurantId, foodRestaurantId);
  const withDemoUsers = demoUsers.length > 0 ? [...normalized, ...demoUsers] : normalized;
  const finalDirty = dirty || demoUsers.length > 0;

  if (finalDirty && persist && canPersistDataFiles) {
    await writeUsersFile(withDemoUsers);
  }

  return withDemoUsers;
}

async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch {
    const restaurants = await listRestaurants();
    const demoRestaurantId = getDemoRestaurantId(restaurants);
    const foodRestaurantId = restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null;
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      dataFile,
      JSON.stringify(createSeedUsers(demoRestaurantId, foodRestaurantId), null, 2),
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
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        if (data.length === 0) {
          const restaurants = await listRestaurants();
          const seedUsers = createSeedUsers(
            getDemoRestaurantId(restaurants),
            restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null,
          );
          const { error: seedError } = await supabase
            .from("users")
            .upsert(seedUsers.map(userDomainToRow), { onConflict: "id" });
          if (!seedError) {
            return normalizeUsersSnapshot(seedUsers, false);
          }
        }
        const rows = data as UserRow[];
        const mapped = rows.map(userRowToDomain);
        return normalizeUsersSnapshot(mapped, false);
      }
    }
  }

  if (!canPersistDataFiles) {
    const restaurants = await listRestaurants();
    const seedUsers = createSeedUsers(
      getDemoRestaurantId(restaurants),
      restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null,
    );
    return normalizeUsersSnapshot(seedUsers, false);
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  let parsed: User[] = [];

  try {
    parsed = JSON.parse(raw) as User[];
  } catch {
    const restaurants = await listRestaurants();
    const seedUsers = createSeedUsers(
      getDemoRestaurantId(restaurants),
      restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null,
    );
    if (canPersistDataFiles) {
      await fs.writeFile(dataFile, JSON.stringify(seedUsers, null, 2), "utf8");
    }
    return seedUsers;
  }

  return normalizeUsersSnapshot(parsed, canPersistDataFiles);
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
  const normalizedUsername = username.trim().toLowerCase();
  const users = await listUsers();
  return (
    users.find((user) => user.username === username && !user.deletedAt) ??
    users.find((user) => user.username.trim().toLowerCase() === normalizedUsername && !user.deletedAt) ??
    null
  );
}

export async function resolveDemoUserByCredentials(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const restaurants = await listRestaurants();
  const demoRestaurantId = getDemoRestaurantId(restaurants);
  const foodRestaurantId = restaurants.find((restaurant) => restaurant.slug === "food-1" && !restaurant.deletedAt)?.id ?? null;

  for (const entry of demoCredentialSpecs) {
    if (entry.spec.username.trim().toLowerCase() !== normalizedUsername || entry.spec.password !== password) {
      continue;
    }

    const restaurantId =
      entry.restaurantSlug === "food-1"
        ? foodRestaurantId
        : entry.restaurantSlug
          ? restaurants.find((restaurant) => restaurant.slug === entry.restaurantSlug && !restaurant.deletedAt)?.id ?? null
          : demoRestaurantId;

    if (entry.spec.role !== "owner" && !restaurantId) {
      continue;
    }

    return normalizeUser(createDemoUser(entry.spec, restaurantId, new Date().toISOString()));
  }

  return null;
}

export async function listUsersForRestaurant(restaurantId: string) {
  const users = await listUsers();
  return users.filter((user) => user.restaurantId === restaurantId && !user.deletedAt);
}

export async function createUser(input: Omit<User, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const user: User = normalizeUser({
    ...input,
    id: createId("user"),
    createdAt: now,
    updatedAt: now,
  });

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("users")
        .insert(userDomainToRow(user))
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const createdUser = userRowToDomain(data as UserRow);
      if (createdUser.restaurantId) {
        publishRestaurantRealtimeEvent({
          type: "users",
          restaurantId: createdUser.restaurantId,
          entityId: createdUser.id,
          action: "created",
        });
      } else {
        publishRestaurantRealtimeEvent({
          type: "users",
          restaurantId: "",
          entityId: createdUser.id,
          action: "created",
        });
      }
      return createdUser;
    }
  }

  const users = await listUsers();
  const nextUsers = [...users, user];
  if (canPersistDataFiles) {
    await writeUsersFile(nextUsers);
  }
  if (user.restaurantId) {
    publishRestaurantRealtimeEvent({
      type: "users",
      restaurantId: user.restaurantId,
      entityId: user.id,
      action: "created",
    });
  } else {
    publishRestaurantRealtimeEvent({
      type: "users",
      restaurantId: "",
      entityId: user.id,
      action: "created",
    });
  }
  return user;
}

export async function updateUser(
  userId: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
) {
  if (hasSupabaseConfig()) {
    const currentUser = await getUserById(userId);
    if (currentUser) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const nextUser = normalizeUser({
          ...currentUser,
          ...patch,
          updatedAt: new Date().toISOString(),
        });
        const { data, error } = await supabase
          .from("users")
          .update(userDomainToRow(nextUser))
          .eq("id", userId)
          .select("*")
          .single();

        if (error) {
          return null;
        }

        const savedUser = userRowToDomain(data as UserRow);
        if (savedUser.restaurantId) {
          publishRestaurantRealtimeEvent({
            type: "users",
            restaurantId: savedUser.restaurantId,
            entityId: savedUser.id,
            action: "updated",
          });
        }
        return savedUser;
      }
    }
  }

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
  if (canPersistDataFiles) {
    await writeUsersFile(nextUsers);
  }
  if (nextUser.restaurantId) {
    publishRestaurantRealtimeEvent({
      type: "users",
      restaurantId: nextUser.restaurantId,
      entityId: nextUser.id,
      action: "updated",
    });
  }
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
