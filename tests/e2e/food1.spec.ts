import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { Order } from "@/lib/types";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  for (const script of ["seed:noir1", "seed:food1"]) {
    execFileSync("npm", ["run", script], {
      stdio: "inherit",
      env: process.env,
    });
  }
});

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

async function authenticateContext(
  context: BrowserContext,
  endpoint: string,
  cookieName: string,
  userId: string,
  username: string,
  password: string,
) {
  const response = await context.request.post(endpoint, {
    data: { username, password },
  });
  expect(response.ok(), `Login failed on ${endpoint}`).toBeTruthy();
  await context.addCookies([
    {
      name: cookieName,
      value: userId,
      url: baseURL,
    },
  ]);
}

async function openAuthenticatedPage(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

async function locateFoodOrder(page: Page) {
  return page.locator("article").filter({ hasText: "Zucchini Fritti" }).first();
}

async function patchOrderStatusWithRetry(
  context: BrowserContext,
  orderId: string,
  cookieName: string,
  cookieValue: string,
  status: "sent_to_kitchen" | "preparing" | "ready" | "served",
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await context.request.patch(`/api/restaurants/food-1/orders/${orderId}`, {
        headers: {
          cookie: `${cookieName}=${cookieValue}`,
        },
        data: { status },
      });
      expect(response.ok(), `Failed to set order status to ${status}`).toBeTruthy();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

test("landing exposes Food 1 as a separate demo", async ({ page }) => {
  await page.goto("/");
  const foodOneLink = page.locator('a[href="/r/food-1?lang=fr"]').first();
  await expect(foodOneLink).toBeVisible();
  await foodOneLink.click();
  await expect(page).toHaveURL(/\/r\/food-1\?lang=fr/);
  await expect(page.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Italian casual food", { exact: false }).first()).toBeVisible();
  await page.goto("/");
  const foodClientLink = page.getByRole("link", { name: "Food client principal" }).first();
  await expect(foodClientLink).toBeVisible();
  await foodClientLink.click();
  await expect(page).toHaveURL(/\/client\?restaurantSlug=food-1/);
});

test("Food 1 staff link asks to switch when Noir 1 session is active", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "meniu_staff_session",
      value: "staff-root",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    },
  ]);

  await page.goto("/staff?restaurantSlug=food-1");
  await expect(page.getByText("Changer de démo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rouvrir Food 1" })).toBeVisible();
});

test("Food 1 client order syncs through staff and kitchen", async ({ browser }) => {
  const clientContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const kitchenContext = await browser.newContext();

  try {
    await authenticateContext(
      clientContext,
      "/api/client-auth/login",
      "meniu_client_session",
      "food1-client-root",
      "foodclient",
      "client123!",
    );
    await authenticateContext(
      staffContext,
      "/api/staff-auth/login",
      "meniu_staff_session",
      "food1-staff-root",
      "foodstaff",
      "pass123!",
    );
    await authenticateContext(
      kitchenContext,
      "/api/kitchen-auth/login",
      "meniu_kitchen_session",
      "food1-kitchen-root",
      "foodkitchen",
      "kitchen123!",
    );

    const clientPage = await openAuthenticatedPage(clientContext, "/client?restaurantSlug=food-1");
    await expect(clientPage.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
    const orderResponse = await clientContext.request.post("/api/restaurants/food-1/client-orders", {
      headers: {
        cookie: "meniu_client_session=food1-client-root",
      },
      data: {
        note: "Food 1 E2E order",
        items: [
          {
            menuItemId: "food1-antipasti-zucchini",
            name: "Zucchini Fritti",
            price: 12,
            quantity: 1,
            categoryName: "Antipasti",
          },
        ],
      },
    });
    expect(orderResponse.ok()).toBeTruthy();
    const orderPayload = (await orderResponse.json()) as { order?: Order | null };
    const orderId = orderPayload.order?.id;
    expect(orderId).toBeTruthy();
    const confirmedOrderId = orderId as string;

    await clientPage.goto("/client?focus=cart");
    await expect(clientPage.getByText("Compte client connecté à Food 1")).toBeVisible();
    await expect(clientPage.locator("#client-tracking")).toBeVisible();
    await expect(clientPage.locator("#client-tracking").getByText("Zucchini Fritti").first()).toBeVisible();
    await expect(clientPage.getByText("Commande en attente de validation du serveur.")).toBeVisible();

    const staffPage = await openAuthenticatedPage(staffContext, "/staff");
    await expect(staffPage.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
    await patchOrderStatusWithRetry(
      staffContext,
      confirmedOrderId,
      "meniu_staff_session",
      "food1-staff-root",
      "sent_to_kitchen",
    );
    await expect(clientPage.getByText("Validée")).toBeVisible();

    const kitchenPage = await openAuthenticatedPage(kitchenContext, "/kitchen");
    await expect(kitchenPage.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
    await patchOrderStatusWithRetry(
      kitchenContext,
      confirmedOrderId,
      "meniu_kitchen_session",
      "food1-kitchen-root",
      "preparing",
    );
    await expect(clientPage.getByText("En cuisine")).toBeVisible();
    await patchOrderStatusWithRetry(
      kitchenContext,
      confirmedOrderId,
      "meniu_kitchen_session",
      "food1-kitchen-root",
      "ready",
    );
    await expect(clientPage.getByText("Prête")).toBeVisible();
    await patchOrderStatusWithRetry(
      kitchenContext,
      confirmedOrderId,
      "meniu_kitchen_session",
      "food1-kitchen-root",
      "served",
    );
    await expect(clientPage.getByText("Servie")).toBeVisible();
  } finally {
    await clientContext.close();
    await staffContext.close();
    await kitchenContext.close();
  }
});

test("Food 1 reservation is visible to staff and manager", async ({ browser }) => {
  const staffContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const reservationName = "Food Sync Reservation";

  try {
    await authenticateContext(
      staffContext,
      "/api/staff-auth/login",
      "meniu_staff_session",
      "food1-staff-root",
      "foodstaff",
      "pass123!",
    );
    await authenticateContext(
      managerContext,
      "/api/auth/login",
      "meniu_manager_session",
      "food1-manager-root",
      "foodmanager",
      "manager123!",
    );

    const reservationResponse = await staffContext.request.post("/api/restaurants/food-1/reservations", {
      headers: {
        cookie: "meniu_staff_session=food1-staff-root",
      },
      data: {
        locale: "fr",
        firstName: reservationName,
        lastName: "Demo",
        phone: "+39 02 00 00 19 01",
        email: "food-sync@demo.local",
        note: "Food 1 E2E reservation",
        date: new Date().toISOString().slice(0, 10),
        time: "19:30",
        guestCount: 4,
      },
    });

    expect(reservationResponse.ok()).toBeTruthy();
    expect(reservationResponse.status()).toBe(201);
    const reservationPayload = (await reservationResponse.json()) as {
      reservation?: { id?: string; name?: string } | null;
    };
    expect(reservationPayload.reservation?.id).toBeTruthy();

    const staffPage = await openAuthenticatedPage(staffContext, "/staff");
    await expect(staffPage.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
    const staffReservations = await staffContext.request.get("/api/restaurants/food-1/reservations", {
      headers: {
        cookie: "meniu_staff_session=food1-staff-root",
      },
    });
    expect(staffReservations.ok()).toBeTruthy();
    const staffReservationsPayload = (await staffReservations.json()) as {
      reservations?: Array<{ id?: string; name?: string }>;
    };
    expect(
      staffReservationsPayload.reservations?.some(
        (reservation) => reservation.id === reservationPayload.reservation?.id,
      ),
    ).toBeTruthy();

    const managerPage = await openAuthenticatedPage(managerContext, "/dashboard");
    await expect(managerPage.getByRole("heading", { name: "Food 1", exact: true }).first()).toBeVisible();
    const managerReservations = await managerContext.request.get("/api/restaurants/food-1/reservations", {
      headers: {
        cookie: "meniu_manager_session=food1-manager-root",
      },
    });
    expect(managerReservations.ok()).toBeTruthy();
    const managerReservationsPayload = (await managerReservations.json()) as {
      reservations?: Array<{ id?: string; name?: string }>;
    };
    expect(
      managerReservationsPayload.reservations?.some(
        (reservation) => reservation.id === reservationPayload.reservation?.id,
      ),
    ).toBeTruthy();
  } finally {
    await staffContext.close();
    await managerContext.close();
  }
});

test("Food 1 public menu exposes contact details", async ({ page }) => {
  await page.goto("/r/food-1?lang=fr");
  await expect(page.getByRole("heading", { name: "Contact", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Phone", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Address", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Google Maps/i }).first()).toBeVisible();
});
