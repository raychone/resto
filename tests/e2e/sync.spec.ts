import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext } from "@playwright/test";
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

async function attachRealtimeCollector(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const globalWindow = window as typeof window & {
      __meniuRealtimeEvents?: Array<{
        type: string;
        entityId?: string | null;
        action?: string | null;
      }>;
      __meniuRealtimeSource?: EventSource | null;
    };

    globalWindow.__meniuRealtimeEvents = [];
    globalWindow.__meniuRealtimeSource?.close();
    const source = new EventSource("/api/restaurants/bar-1/realtime");
    source.onmessage = (event) => {
      if (!event.data) return;
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          entityId?: string | null;
          action?: string | null;
        };
        globalWindow.__meniuRealtimeEvents?.push({
          type: payload.type ?? "unknown",
          entityId: payload.entityId ?? null,
          action: payload.action ?? null,
        });
      } catch {
        // Ignore malformed frames.
      }
    };
    globalWindow.__meniuRealtimeSource = source;
  });
}

async function waitForRealtimeEvent(
  page: import("@playwright/test").Page,
  expectedCount: number,
  expectedType: string,
  expectedEntityId: string,
  expectedAction?: string,
) {
  await page.waitForFunction(
    ([count, type, entityId, action]) => {
      const globalWindow = window as typeof window & {
        __meniuRealtimeEvents?: Array<{
          type: string;
          entityId?: string | null;
          action?: string | null;
        }>;
      };
      const events = globalWindow.__meniuRealtimeEvents ?? [];
      return (
        events.length > Number(count) &&
        events.some((event) => {
          if (event.type !== String(type)) return false;
          if (event.entityId !== String(entityId)) return false;
          if (action && event.action !== String(action)) return false;
          return true;
        })
      );
    },
    [expectedCount, expectedType, expectedEntityId, expectedAction ?? ""],
    { timeout: 6000 },
  );
}

test("orders sync across manager, staff, kitchen and client in real time", async ({ browser }) => {
  const managerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const kitchenContext = await browser.newContext();
  const clientContext = await browser.newContext();

  try {
    await authenticateContext(
      managerContext,
      "/api/auth/login",
      "meniu_manager_session",
      "manager-root",
      "manager",
      "manager123!",
    );
    await authenticateContext(
      staffContext,
      "/api/staff-auth/login",
      "meniu_staff_session",
      "staff-root",
      "user",
      "pass123!",
    );
    await authenticateContext(
      kitchenContext,
      "/api/kitchen-auth/login",
      "meniu_kitchen_session",
      "kitchen-root",
      "kitchen",
      "kitchen123!",
    );
    await authenticateContext(
      clientContext,
      "/api/client-auth/login",
      "meniu_client_session",
      "client-root",
      "client",
      "client123!",
    );

    const [managerPage, staffPage, kitchenPage, clientPage] = await Promise.all([
      managerContext.newPage(),
      staffContext.newPage(),
      kitchenContext.newPage(),
      clientContext.newPage(),
    ]);

    await Promise.all([
      managerPage.goto("/dashboard"),
      staffPage.goto("/staff"),
      kitchenPage.goto("/kitchen"),
      clientPage.goto("/client"),
    ]);

    await expect(managerPage.getByText("Contrôle des menus par restaurant")).toBeVisible();
    await expect(staffPage.getByText("Réservations, bon actif, commandes et encaissement.")).toBeVisible();
    await expect(kitchenPage.getByText("Commandes directes pour la cuisine.")).toBeVisible();
    await expect(clientPage.getByText("Compte client connecté")).toBeVisible();

    const clientOrdersResponse = await clientContext.request.get("/api/restaurants/bar-1/client-orders", {
      headers: {
        cookie: "meniu_client_session=client-root",
      },
    });
    expect(clientOrdersResponse.ok()).toBeTruthy();
    const clientOrdersPayload = (await clientOrdersResponse.json()) as {
      order?: Order | null;
      tableSession?: { tableId?: string | null } | null;
    };
    const orderId = clientOrdersPayload.order?.id;
    const tableId = clientOrdersPayload.order?.tableId ?? clientOrdersPayload.tableSession?.tableId;
    expect(orderId).toBeTruthy();
    expect(tableId).toBeTruthy();

    await Promise.all([
      attachRealtimeCollector(staffPage),
      attachRealtimeCollector(kitchenPage),
      attachRealtimeCollector(clientPage),
    ]);

    const updateOrder = async (status: "sent_to_kitchen" | "preparing" | "ready" | "served") => {
      const response = await managerContext.request.patch(`/api/restaurants/bar-1/orders/${orderId}`, {
        headers: {
          cookie: "meniu_manager_session=manager-root",
        },
        data: { status },
      });
      expect(response.ok(), `Could not update order to ${status}`).toBeTruthy();
    };

    const staffBefore = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const kitchenBefore = await kitchenPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBefore = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);

    await updateOrder("sent_to_kitchen");
    await Promise.all([
      waitForRealtimeEvent(staffPage, staffBefore, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(kitchenPage, kitchenBefore, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(clientPage, clientBefore, "orders", String(orderId), "updated"),
    ]);

    const staffBeforePreparing = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const kitchenBeforePreparing = await kitchenPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforePreparing = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    await updateOrder("preparing");
    await Promise.all([
      waitForRealtimeEvent(staffPage, staffBeforePreparing, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(kitchenPage, kitchenBeforePreparing, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(clientPage, clientBeforePreparing, "orders", String(orderId), "updated"),
    ]);

    const staffBeforeReady = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const kitchenBeforeReady = await kitchenPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeReady = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    await updateOrder("ready");
    await Promise.all([
      waitForRealtimeEvent(staffPage, staffBeforeReady, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(kitchenPage, kitchenBeforeReady, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(clientPage, clientBeforeReady, "orders", String(orderId), "updated"),
    ]);

    const staffBeforeServed = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const kitchenBeforeServed = await kitchenPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeServed = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    await updateOrder("served");
    await Promise.all([
      waitForRealtimeEvent(staffPage, staffBeforeServed, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(kitchenPage, kitchenBeforeServed, "orders", String(orderId), "updated"),
      waitForRealtimeEvent(clientPage, clientBeforeServed, "orders", String(orderId), "updated"),
    ]);
  } finally {
    await Promise.allSettled([
      managerContext.close(),
      staffContext.close(),
      kitchenContext.close(),
      clientContext.close(),
    ]);
  }
});

test("reservations sync across manager, staff and client in real time", async ({ browser }) => {
  const managerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const clientContext = await browser.newContext();

  try {
    await authenticateContext(
      managerContext,
      "/api/auth/login",
      "meniu_manager_session",
      "manager-root",
      "manager",
      "manager123!",
    );
    await authenticateContext(
      staffContext,
      "/api/staff-auth/login",
      "meniu_staff_session",
      "staff-root",
      "user",
      "pass123!",
    );
    await authenticateContext(
      clientContext,
      "/api/client-auth/login",
      "meniu_client_session",
      "client-root",
      "client",
      "client123!",
    );

    const [managerPage, staffPage, clientPage] = await Promise.all([
      managerContext.newPage(),
      staffContext.newPage(),
      clientContext.newPage(),
    ]);

    await Promise.all([
      managerPage.goto("/dashboard"),
      staffPage.goto("/staff"),
      clientPage.goto("/client"),
    ]);

    await expect(managerPage.getByText("Contrôle des menus par restaurant")).toBeVisible();
    await expect(staffPage.getByText("Réservations, bon actif, commandes et encaissement.")).toBeVisible();
    await expect(clientPage.getByText("Compte client connecté")).toBeVisible();

    await Promise.all([
      attachRealtimeCollector(managerPage),
      attachRealtimeCollector(staffPage),
      attachRealtimeCollector(clientPage),
    ]);

    const managerBeforeCreate = await managerPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const staffBeforeCreate = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeCreate = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);

    const reservationName = `Playwright-${Date.now().toString(36)}`;
    const reservationResponse = await staffContext.request.post("/api/restaurants/bar-1/reservations", {
      headers: {
        cookie: "meniu_staff_session=staff-root",
      },
      data: {
        locale: "fr",
        firstName: "Playwright",
        lastName: reservationName,
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
    const reservationPayload = (await reservationResponse.json()) as {
      reservation?: { id?: string; name?: string };
    };
    const reservationId = reservationPayload.reservation?.id;
    expect(reservationId).toBeTruthy();
    expect(reservationPayload.reservation?.name).toContain("Playwright");

    await Promise.all([
      waitForRealtimeEvent(managerPage, managerBeforeCreate, "reservations", String(reservationId), "created"),
      waitForRealtimeEvent(staffPage, staffBeforeCreate, "reservations", String(reservationId), "created"),
      waitForRealtimeEvent(clientPage, clientBeforeCreate, "reservations", String(reservationId), "created"),
    ]);

    const managerBeforeConfirm = await managerPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const staffBeforeConfirm = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeConfirm = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);

    const confirmResponse = await staffContext.request.patch(
      `/api/restaurants/bar-1/reservations/${reservationId}`,
      {
        headers: {
          cookie: "meniu_staff_session=staff-root",
        },
        data: {
          status: "confirmed",
        },
      },
    );
    expect(confirmResponse.ok()).toBeTruthy();

    await Promise.all([
      waitForRealtimeEvent(managerPage, managerBeforeConfirm, "reservations", String(reservationId), "status_confirmed"),
      waitForRealtimeEvent(staffPage, staffBeforeConfirm, "reservations", String(reservationId), "status_confirmed"),
      waitForRealtimeEvent(clientPage, clientBeforeConfirm, "reservations", String(reservationId), "status_confirmed"),
    ]);
  } finally {
    await Promise.allSettled([
      managerContext.close(),
      staffContext.close(),
      clientContext.close(),
    ]);
  }
});

test("messages sync across manager, staff and client in real time", async ({ browser }) => {
  const managerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const clientContext = await browser.newContext();

  try {
    await authenticateContext(
      managerContext,
      "/api/auth/login",
      "meniu_manager_session",
      "manager-root",
      "manager",
      "manager123!",
    );
    await authenticateContext(
      staffContext,
      "/api/staff-auth/login",
      "meniu_staff_session",
      "staff-root",
      "user",
      "pass123!",
    );
    await authenticateContext(
      clientContext,
      "/api/client-auth/login",
      "meniu_client_session",
      "client-root",
      "client",
      "client123!",
    );

    const [managerPage, staffPage, clientPage] = await Promise.all([
      managerContext.newPage(),
      staffContext.newPage(),
      clientContext.newPage(),
    ]);

    await Promise.all([
      managerPage.goto("/dashboard"),
      staffPage.goto("/staff"),
      clientPage.goto("/client"),
    ]);

    await expect(managerPage.getByText("Contrôle des menus par restaurant")).toBeVisible();
    await expect(staffPage.getByText("Réservations, bon actif, commandes et encaissement.")).toBeVisible();
    await expect(clientPage.getByText("Compte client connecté")).toBeVisible();

    await Promise.all([
      attachRealtimeCollector(managerPage),
      attachRealtimeCollector(staffPage),
      attachRealtimeCollector(clientPage),
    ]);

    const managerBeforeCreate = await managerPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const staffBeforeCreate = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeCreate = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);

    const messageResponse = await clientContext.request.post("/api/restaurants/bar-1/messages", {
      data: {
        locale: "fr",
        name: "Playwright Client",
        phone: "0600000000",
        email: "playwright@example.com",
        message: `Message live ${Date.now().toString(36)}`,
        tableId: null,
        tableLabel: null,
      },
    });
    expect(messageResponse.ok()).toBeTruthy();
    expect(messageResponse.status()).toBe(201);
    const messagePayload = (await messageResponse.json()) as { id?: string };
    const messageId = messagePayload.id;
    expect(messageId).toBeTruthy();

    await Promise.all([
      waitForRealtimeEvent(managerPage, managerBeforeCreate, "messages", String(messageId), "created"),
      waitForRealtimeEvent(staffPage, staffBeforeCreate, "messages", String(messageId), "created"),
      waitForRealtimeEvent(clientPage, clientBeforeCreate, "messages", String(messageId), "created"),
    ]);

    const managerBeforeUpdate = await managerPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const staffBeforeUpdate = await staffPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);
    const clientBeforeUpdate = await clientPage.evaluate(() => (window as typeof window & { __meniuRealtimeEvents?: unknown[] }).__meniuRealtimeEvents?.length ?? 0);

    const updateResponse = await managerContext.request.patch("/api/restaurants/bar-1/messages", {
      headers: {
        cookie: "meniu_manager_session=manager-root",
      },
      data: {
        ids: [String(messageId)],
        status: "read",
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    await Promise.all([
      waitForRealtimeEvent(managerPage, managerBeforeUpdate, "messages", String(messageId), "status_read"),
      waitForRealtimeEvent(staffPage, staffBeforeUpdate, "messages", String(messageId), "status_read"),
      waitForRealtimeEvent(clientPage, clientBeforeUpdate, "messages", String(messageId), "status_read"),
    ]);
  } finally {
    await Promise.allSettled([
      managerContext.close(),
      staffContext.close(),
      clientContext.close(),
    ]);
  }
});
