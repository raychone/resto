import { NextRequest, NextResponse } from "next/server";
import { getClientUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getOrCreateCustomerForUser } from "@/lib/customer-store";
import { dispatchOrderRequestNotification } from "@/lib/notification-service";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { addOrderItem, createOrder, getOrderById, updateOrder } from "@/lib/order-store";
import { getTableById } from "@/lib/table-store";
import { getOrCreateTableSessionForCustomer, updateTableSession } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

type CartItem = {
  menuItemId?: string;
  name?: string;
  price?: number;
  quantity?: number;
  note?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const clientUser = await getClientUserFromRequest(request);
  if (!clientUser || clientUser.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await getOrCreateCustomerForUser(clientUser, restaurant.id);
  const tableSession = await getOrCreateTableSessionForCustomer(restaurant.id, customer);
  const currentOrder = tableSession.orderId ? await getOrderById(tableSession.orderId) : null;

  return NextResponse.json({ order: currentOrder, tableSession });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const clientUser = await getClientUserFromRequest(request);
  if (!clientUser || clientUser.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    items?: CartItem[];
    note?: string;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const customer = await getOrCreateCustomerForUser(clientUser, restaurant.id);
  const tableSession = await getOrCreateTableSessionForCustomer(restaurant.id, customer);
  const currentOrder = tableSession.orderId ? await getOrderById(tableSession.orderId) : null;

  let order = currentOrder;
  if (!order || order.deletedAt || !["open", "sent_to_kitchen", "preparing", "ready"].includes(order.status)) {
    order = await createOrder({
      restaurantId: restaurant.id,
      tableId: tableSession.tableId,
      tableSessionId: tableSession.id,
      staffUserId: null,
      source: "qr",
      status: "open",
      openedAt: new Date().toISOString(),
      closedAt: null,
      archivedAt: null,
      note: body.note?.trim() || "Commande client",
    });
    await updateTableSession(tableSession.id, { orderId: order.id });
  }

  for (const item of items) {
    if (!item.menuItemId || !item.name || !Number.isFinite(item.price)) {
      continue;
    }

    const quantity = Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0 ? Math.floor(item.quantity ?? 1) : 1;

    await addOrderItem(order.id, {
      menuItemId: item.menuItemId,
      nameSnapshot: item.name,
      priceSnapshot: Number(item.price),
      quantity,
      note: item.note ?? "",
      assignedClientId: customer.id,
      assignedClientName: customer.name,
    });
  }

  const nextOrder = await updateOrder(order.id, {
    note: body.note?.trim() || order.note,
    tableSessionId: tableSession.id,
    source: "qr",
    status: "open",
  });

  if (!nextOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await recordAuditEntry({
    restaurantSlug: restaurant.slug,
    restaurantId: restaurant.id,
    actorRole: "client",
    actorName: clientUser.name,
    action: "client_order_requested",
    targetType: "order",
    targetId: order.id,
    details: `items=${items.length}${tableSession.tableId ? ` · table=${tableSession.tableId}` : ""}`,
  });

  const tableLabel =
    nextOrder.source === "takeaway"
      ? "À emporter"
      : tableSession.tableId
        ? (await getTableById(tableSession.tableId))?.name ?? "Table"
        : "Table";

  await dispatchOrderRequestNotification({
    provider: restaurant.features.notificationProvider,
    restaurant,
    order: nextOrder,
    tableLabel,
  });

  return NextResponse.json({ order: nextOrder, tableSession }, { status: 201 });
}
