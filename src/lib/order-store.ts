import { promises as fs } from "node:fs";
import path from "node:path";
import { listRestaurants } from "@/lib/restaurant-store";
import { createId, type Order, type OrderItem, type Payment } from "@/lib/types";
import { listTablesForRestaurant } from "@/lib/table-store";

const dataDir = path.join(process.cwd(), "data");
const ordersFile = path.join(dataDir, "orders.json");
const paymentsFile = path.join(dataDir, "payments.json");

function normalizeOrder(order: Order): Order {
  const now = new Date().toISOString();
  return {
    ...order,
    id: order.id?.trim() || createId("order"),
    restaurantId: order.restaurantId?.trim() || "",
    tableId: order.tableId?.trim() || null,
    staffUserId: order.staffUserId?.trim() || null,
    source:
      order.source === "table" || order.source === "takeaway" || order.source === "phone" || order.source === "qr"
        ? order.source
        : "table",
    status:
      order.status === "open" ||
      order.status === "sent_to_kitchen" ||
      order.status === "preparing" ||
      order.status === "ready" ||
      order.status === "served" ||
      order.status === "paid" ||
      order.status === "cancelled" ||
      order.status === "archived"
        ? order.status
        : "open",
    openedAt: order.openedAt ?? now,
    closedAt: order.closedAt ?? null,
    archivedAt: order.archivedAt ?? null,
    note: order.note ?? "",
    items: Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [],
    createdAt: order.createdAt ?? now,
    updatedAt: now,
    deletedAt: order.deletedAt ?? null,
  };
}

async function normalizeOrderForRestaurant(order: Order) {
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.id === order.restaurantId) ?? null;
  if (!restaurant) {
    return normalizeOrder(order);
  }

  const tables = await listTablesForRestaurant(restaurant.id);
  const hasMatchingTable = order.tableId ? tables.some((table) => table.id === order.tableId) : false;
  const fallbackTableId = tables[0]?.id ?? null;

  return normalizeOrder({
    ...order,
    tableId: hasMatchingTable ? order.tableId : fallbackTableId,
  });
}

function normalizeOrderItem(item: OrderItem): OrderItem {
  const now = new Date().toISOString();
  return {
    ...item,
    id: item.id?.trim() || createId("order-item"),
    orderId: item.orderId?.trim() || "",
    menuItemId: item.menuItemId?.trim() || "",
    nameSnapshot: item.nameSnapshot?.trim() || "Plat",
    priceSnapshot: Number.isFinite(item.priceSnapshot) ? Number(item.priceSnapshot) : 0,
    quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1,
    note: item.note ?? "",
    assignedClientId: item.assignedClientId ?? null,
    assignedClientName: item.assignedClientName ?? null,
    createdAt: item.createdAt ?? now,
    deletedAt: item.deletedAt ?? null,
  };
}

function normalizePayment(payment: Payment): Payment {
  const now = new Date().toISOString();
  return {
    ...payment,
    id: payment.id?.trim() || createId("payment"),
    orderId: payment.orderId?.trim() || "",
    restaurantId: payment.restaurantId?.trim() || "",
    amount: Number.isFinite(payment.amount) ? Number(payment.amount) : 0,
    method:
      payment.method === "cash" ||
      payment.method === "card" ||
      payment.method === "external" ||
      payment.method === "other"
        ? payment.method
        : "cash",
    status:
      payment.status === "pending" || payment.status === "completed" || payment.status === "cancelled"
        ? payment.status
        : "completed",
    note: payment.note ?? "",
    createdAt: payment.createdAt ?? now,
    updatedAt: now,
    deletedAt: payment.deletedAt ?? null,
  };
}

function orderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
}

async function ensureStore(filePath: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, "[]", "utf8");
  }
}

async function readOrdersFile() {
  await ensureStore(ordersFile);
  const raw = await fs.readFile(ordersFile, "utf8");
  const parsed = JSON.parse(raw) as Order[];
  const normalized = Array.isArray(parsed)
    ? await Promise.all(parsed.map((order) => normalizeOrderForRestaurant(order)))
    : [];
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await fs.writeFile(ordersFile, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

async function readPaymentsFile() {
  await ensureStore(paymentsFile);
  const raw = await fs.readFile(paymentsFile, "utf8");
  const parsed = JSON.parse(raw) as Payment[];
  const normalized = Array.isArray(parsed) ? parsed.map(normalizePayment) : [];
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await fs.writeFile(paymentsFile, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

async function writeOrdersFile(orders: Order[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}

async function writePaymentsFile(payments: Payment[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(paymentsFile, JSON.stringify(payments, null, 2), "utf8");
}

export async function listOrders() {
  return readOrdersFile();
}

export async function listOrdersForRestaurant(restaurantId: string) {
  const orders = await listOrders();
  return orders.filter((order) => order.restaurantId === restaurantId && !order.deletedAt);
}

export async function getOrderById(orderId: string) {
  const orders = await listOrders();
  return orders.find((order) => order.id === orderId && !order.deletedAt) ?? null;
}

export async function listPaymentsForRestaurant(restaurantId: string) {
  const payments = await readPaymentsFile();
  return payments.filter((payment) => payment.restaurantId === restaurantId && !payment.deletedAt);
}

export async function listPaymentsForOrder(orderId: string) {
  const payments = await readPaymentsFile();
  return payments.filter((payment) => payment.orderId === orderId && !payment.deletedAt);
}

export async function createOrder(input: Omit<Order, "id" | "createdAt" | "updatedAt" | "items"> & {
  items?: OrderItem[];
}) {
  const orders = await listOrders();
  const now = new Date().toISOString();
  const order = await normalizeOrderForRestaurant({
    ...input,
    id: createId("order"),
    items: input.items ?? [],
    createdAt: now,
    updatedAt: now,
  });

  const nextOrders = [...orders, order];
  await writeOrdersFile(nextOrders);
  return order;
}

export async function updateOrder(orderId: string, patch: Partial<Omit<Order, "id" | "createdAt">>) {
  const orders = await listOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const nextOrder = await normalizeOrderForRestaurant({
    ...orders[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const nextOrders = [...orders];
  nextOrders[index] = nextOrder;
  await writeOrdersFile(nextOrders);
  return nextOrder;
}

export async function addOrderItem(
  orderId: string,
  input: Omit<OrderItem, "id" | "orderId" | "createdAt" | "deletedAt">,
) {
  const orders = await listOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const currentOrder = orders[index];
  const item: OrderItem = normalizeOrderItem({
    ...input,
    id: createId("order-item"),
    orderId,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  });

  const nextOrder = await normalizeOrderForRestaurant({
    ...currentOrder,
    items: [...currentOrder.items, item],
    updatedAt: new Date().toISOString(),
  });

  const nextOrders = [...orders];
  nextOrders[index] = nextOrder;
  await writeOrdersFile(nextOrders);
  return nextOrder;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  patch: Partial<
    Pick<OrderItem, "quantity" | "note" | "assignedClientId" | "assignedClientName">
  >,
) {
  const orders = await listOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const currentOrder = orders[index];
  const itemIndex = currentOrder.items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) return null;

  const nextItems = [...currentOrder.items];
  nextItems[itemIndex] = normalizeOrderItem({
    ...nextItems[itemIndex],
    ...patch,
    quantity:
      typeof patch.quantity === "number" && patch.quantity > 0
        ? Math.floor(patch.quantity)
        : nextItems[itemIndex].quantity,
  });

  const nextOrder = await normalizeOrderForRestaurant({
    ...currentOrder,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });

  const nextOrders = [...orders];
  nextOrders[index] = nextOrder;
  await writeOrdersFile(nextOrders);
  return nextOrder;
}

export async function removeOrderItem(orderId: string, itemId: string) {
  const orders = await listOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const currentOrder = orders[index];
  const nextItems = currentOrder.items.filter((item) => item.id !== itemId);

  const nextOrder = await normalizeOrderForRestaurant({
    ...currentOrder,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  });

  const nextOrders = [...orders];
  nextOrders[index] = nextOrder;
  await writeOrdersFile(nextOrders);
  return nextOrder;
}

export async function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  quantity: number,
) {
  if (quantity <= 0) {
    return removeOrderItem(orderId, itemId);
  }

  return updateOrderItem(orderId, itemId, { quantity });
}

export async function createPayment(input: Omit<Payment, "id" | "createdAt" | "updatedAt">) {
  const payments = await readPaymentsFile();
  const orders = await listOrders();
  const orderIndex = orders.findIndex((order) => order.id === input.orderId);
  if (orderIndex === -1) return null;
  const order = orders[orderIndex];
  const existingPayments = payments.filter(
    (payment) => payment.orderId === input.orderId && !payment.deletedAt,
  );

  const payment = normalizePayment({
    ...input,
    id: createId("payment"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const nextPayments = [...payments, payment];
  await writePaymentsFile(nextPayments);

  const nextPaidTotal = [...existingPayments, payment].reduce((sum, entry) => sum + entry.amount, 0);
  const total = orderTotal(order);
  const isFullyPaid = nextPaidTotal >= total;
  const nextOrder = await normalizeOrderForRestaurant({
    ...order,
    status: isFullyPaid ? "paid" : order.status,
    closedAt: isFullyPaid ? new Date().toISOString() : order.closedAt,
    updatedAt: new Date().toISOString(),
  });

  const nextOrders = [...orders];
  nextOrders[orderIndex] = nextOrder;
  await writeOrdersFile(nextOrders);

  return payment;
}

export async function archiveOrder(orderId: string) {
  return updateOrder(orderId, {
    status: "archived",
    archivedAt: new Date().toISOString(),
  });
}
