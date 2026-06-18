import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import type { Order, Table } from "@/lib/types";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  for (const script of ["seed:noir1", "seed:food1"]) {
    execFileSync("npm", ["run", script], {
      stdio: "inherit",
      env: process.env,
    });
  }
});

type CreatedOrder = {
  id: string;
  tableId: string | null;
  kitchenLabel: string;
  staffLabel: string;
};

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

let createdOrder: CreatedOrder | null = null;
let createdReservationName = "";
let createdStaffUsername = "";
let createdRestaurantSlug = "";

async function authenticate(
  page: Page,
  path: string,
  endpoint: string,
  cookieName: string,
  userId: string,
  username: string,
  password: string,
) {
  const response = await page.request.post(endpoint, {
    data: { username, password },
  });
  expect(response.ok(), `Login failed on ${endpoint}`).toBeTruthy();

  await page.context().addCookies([
    {
      name: cookieName,
      value: userId,
      url: baseURL,
    },
  ]);

  await page.goto(path);
}

async function getRestaurantTables(page: Page) {
  const response = await page.request.get("/api/restaurants/bar-1/tables");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { tables: Table[] };
  return payload.tables;
}

async function getOrders(page: Page) {
  const response = await page.request.get("/api/restaurants/bar-1/orders");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { orders: Order[] };
  return payload.orders;
}

test("landing shows the two restaurant demos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("App pour restaurants et bars")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noir 1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Food 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Menu" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "QR" }).first()).toBeVisible();
  const noirRoles = page.locator("details").filter({ has: page.getByText("Accès rapide", { exact: true }).first() }).first();
  await noirRoles.locator("summary").click();
  await expect(page.getByRole("link", { name: "Client" }).first()).toBeVisible();
});

test("manager can log in and create a staff user", async ({ page }) => {
  await authenticate(
    page,
    "/dashboard",
    "/api/auth/login",
    "meniu_manager_session",
    "manager-root",
    "manager",
    "manager123!",
  );
  await expect(page.locator("#dashboard-menu").getByRole("link", { name: "Voir le menu public" })).toBeVisible();

  createdStaffUsername = `e2e_staff_${Date.now().toString(36)}`;

  const createResponse = await page.request.post("/api/restaurants/bar-1/users", {
    data: {
      name: "E2E Staff",
      username: createdStaffUsername,
      temporaryPassword: "Tmp#2026!",
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  expect(createResponse.status()).toBe(201);

  const usersResponse = await page.request.get("/api/restaurants/bar-1/users");
  expect(usersResponse.ok()).toBeTruthy();
  const usersPayload = (await usersResponse.json()) as { users: Array<{ username: string }> };
  expect(usersPayload.users.some((user) => user.username === createdStaffUsername)).toBeTruthy();
});

test("client can submit an order from the menu", async ({ page }) => {
  await authenticate(
    page,
    "/client",
    "/api/client-auth/login",
    "meniu_client_session",
    "client-root",
    "client",
    "client123!",
  );
  await expect(page.getByText("Compte client connecté")).toBeVisible();

  const menuSection = page.locator("#client-menu");
  await expect(menuSection).toBeVisible();

  const managerAuthHeaders = {
    cookie: "meniu_manager_session=manager-root",
  };
  const tablesResponse = await page.request.get("/api/restaurants/bar-1/tables", {
    headers: managerAuthHeaders,
  });
  expect(tablesResponse.ok()).toBeTruthy();
  const tablesPayload = (await tablesResponse.json()) as { tables: Table[] };
  const assignedTable = tablesPayload.tables[0];
  expect(assignedTable).toBeTruthy();

  const submitOrderResponse = await page.request.post("/api/restaurants/bar-1/orders", {
    headers: managerAuthHeaders,
    data: {
      tableId: assignedTable.id,
      source: "qr",
      note: "Commande QR",
    },
  });

  expect(submitOrderResponse.ok()).toBeTruthy();
  expect(submitOrderResponse.status()).toBe(201);
  const payload = (await submitOrderResponse.json()) as { order?: Order | null };
  expect(payload.order).toBeTruthy();

  const submitOrderItemResponse = await page.request.post(`/api/restaurants/bar-1/orders/${payload.order!.id}/items`, {
    headers: managerAuthHeaders,
    data: {
      menuItemId: "item-hh-krombacher-pint",
      nameSnapshot: "Krombacher Pint",
      priceSnapshot: 5,
      quantity: 1,
      note: "",
      assignedClientId: null,
      assignedClientName: null,
    },
  });
  expect(submitOrderItemResponse.ok()).toBeTruthy();
  expect(submitOrderItemResponse.status()).toBe(201);

  createdOrder = {
    id: payload.order!.id,
    tableId: assignedTable.id,
    kitchenLabel: `Table ${assignedTable.id.slice(-4)}`,
    staffLabel: assignedTable.name,
  };
});

test("staff validates the order and creates a reservation", async ({ page }) => {
  await expect(createdOrder).not.toBeNull();
  const staffAuthHeaders = {
    cookie: "meniu_staff_session=staff-root",
  };
  await authenticate(
    page,
    "/staff",
    "/api/staff-auth/login",
    "meniu_staff_session",
    "staff-root",
    "user",
    "pass123!",
  );
  await expect(page.getByText("Réservations, bon actif, commandes et encaissement.")).toBeVisible();

  const ordersResponse = await page.request.get("/api/restaurants/bar-1/orders", {
    headers: staffAuthHeaders,
  });
  expect(ordersResponse.ok()).toBeTruthy();
  const ordersPayload = (await ordersResponse.json()) as { orders: Order[] };
  const pendingOrder = ordersPayload.orders.find((order) => order.id === createdOrder!.id);
  expect(pendingOrder).toBeTruthy();

  const confirmOrderResponse = await page.request.patch(`/api/restaurants/bar-1/orders/${createdOrder!.id}`, {
    headers: staffAuthHeaders,
    data: {
      status: "sent_to_kitchen",
    },
  });
  expect(confirmOrderResponse.ok()).toBeTruthy();
  const confirmOrderPayload = (await confirmOrderResponse.json()) as { order?: Order | null };
  expect(confirmOrderPayload.order?.status).toBe("sent_to_kitchen");

  createdReservationName = `Playwright-${Date.now().toString(36)}`;
  const reservationResponse = await page.request.post("/api/restaurants/bar-1/reservations", {
    headers: staffAuthHeaders,
    data: {
      locale: "fr",
      firstName: "Playwright",
      lastName: createdReservationName,
      phone: "0600000000",
      email: "playwright@example.com",
      date: new Date().toISOString().slice(0, 10),
      time: "19:30",
      guestCount: 2,
      note: "Réservation Playwright",
    },
  });
  expect(reservationResponse.ok()).toBeTruthy();
  expect(reservationResponse.status()).toBe(201);
  const reservationPayload = (await reservationResponse.json()) as { reservation?: { name?: string } };
  expect(reservationPayload.reservation?.name).toContain("Playwright");
});

test("kitchen processes the order to ready and served", async ({ page }) => {
  await expect(createdOrder).not.toBeNull();
  const kitchenAuthHeaders = {
    cookie: "meniu_kitchen_session=kitchen-root",
  };
  const clientAuthHeaders = {
    cookie: "meniu_client_session=client-root",
  };
  await authenticate(
    page,
    "/kitchen",
    "/api/kitchen-auth/login",
    "meniu_kitchen_session",
    "kitchen-root",
    "kitchen",
    "kitchen123!",
  );
  await expect(page.getByText("Commandes directes pour la cuisine.")).toBeVisible();

  const clientOrdersResponse = await page.request.get("/api/restaurants/bar-1/client-orders", {
    headers: clientAuthHeaders,
  });
  expect(clientOrdersResponse.ok()).toBeTruthy();
  const clientOrdersPayload = (await clientOrdersResponse.json()) as {
    order?: Order | null;
    tableSession?: { tableId?: string | null } | null;
  };
  const kitchenOrderId = clientOrdersPayload.order?.id;
  expect(kitchenOrderId).toBeTruthy();

  for (const status of ["preparing", "ready", "served"] as const) {
    const updateResponse = await page.request.patch(`/api/restaurants/bar-1/orders/${kitchenOrderId}`, {
      headers: kitchenAuthHeaders,
      data: { status },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updatePayload = (await updateResponse.json()) as { order?: Order | null };
    expect(updatePayload.order?.status).toBe(status);
  }
});

test("client sees the live order status update", async ({ page }) => {
  await expect(createdOrder).not.toBeNull();
  const clientAuthHeaders = {
    cookie: "meniu_client_session=client-root",
  };
  await authenticate(
    page,
    "/client",
    "/api/client-auth/login",
    "meniu_client_session",
    "client-root",
    "client",
    "client123!",
  );
  const clientOrdersResponse = await page.request.get("/api/restaurants/bar-1/client-orders", {
    headers: clientAuthHeaders,
  });
  expect(clientOrdersResponse.ok()).toBeTruthy();
  const clientOrdersPayload = (await clientOrdersResponse.json()) as {
    order?: Order | null;
    tableSession?: { tableId?: string | null } | null;
  };
  expect(clientOrdersPayload.order?.id).toBeTruthy();
  expect(clientOrdersPayload.order?.status).toBe("served");
});

test("owner can trigger a notification test and create a restaurant", async ({ page }) => {
  await authenticate(
    page,
    "/owner",
    "/api/owner-auth/login",
    "meniu_owner_session",
    "owner-root",
    "owner",
    "owner123!",
  );
  await expect(page.getByText("Portfolio restaurants")).toBeVisible();

  const notificationSection = page.locator("#owner-notification-test");
  await notificationSection.getByRole("button", { name: "Tester notification" }).click();
  await expect(notificationSection).toContainText(/composer SMS ouvert|notification envoyée|envoi/);

  createdRestaurantSlug = `pw-e2e-${Date.now().toString(36)}`;
  const restaurantName = `Playwright ${Date.now().toString(36).toUpperCase()}`;
  const ownerAuthHeaders = {
    cookie: "meniu_owner_session=owner-root",
  };
  const createRestaurantResponse = await page.request.post("/api/restaurants", {
    headers: ownerAuthHeaders,
    data: {
      name: restaurantName,
      slug: createdRestaurantSlug,
      initialUsers: [
        {
          role: "manager",
          name: "Manager E2E",
          username: "pw-manager",
          temporaryPassword: "Tmp#2026!",
        },
        {
          role: "staff",
          name: "Staff E2E",
          username: "pw-staff",
          temporaryPassword: "Tmp#2026!",
        },
      ],
    },
  });
  expect(createRestaurantResponse.ok()).toBeTruthy();
  expect(createRestaurantResponse.status()).toBe(201);
  const createdRestaurant = (await createRestaurantResponse.json()) as { name?: string; slug?: string };
  expect(createdRestaurant.name).toBe(restaurantName);
  expect(createdRestaurant.slug).toBe(createdRestaurantSlug);

  const restaurantsResponse = await page.request.get("/api/restaurants", {
    headers: ownerAuthHeaders,
  });
  expect(restaurantsResponse.ok()).toBeTruthy();
  const restaurantsPayload = (await restaurantsResponse.json()) as Array<{ slug: string; name: string }>;
  expect(restaurantsPayload.some((restaurant) => restaurant.slug === createdRestaurantSlug)).toBeTruthy();
});
