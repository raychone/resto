import { NextRequest, NextResponse } from "next/server";
import {
  decodePayloadCookieValue,
  getClientGuestSessionFromRequest,
  getClientUserFromRequest,
  type ClientGuestSession,
} from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import {
  getOrCreateAnonymousCustomerForRestaurant,
  getOrCreateCustomerForUser,
} from "@/lib/customer-store";
import { dispatchOrderRequestNotification } from "@/lib/notification-service";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  addOrderItem,
  createOrder,
  getOrderById,
  listOrdersForRestaurant,
  updateOrder,
} from "@/lib/order-store";
import { getTableById } from "@/lib/table-store";
import { getOrCreateTableSessionForCustomer, updateTableSession } from "@/lib/table-session-store";
import { inferTaxCategory, taxRateForCategory } from "@/lib/tax";

export const dynamic = "force-dynamic";

type CartItem = {
  menuItemId?: string;
  name?: string;
  price?: number;
  quantity?: number;
  note?: string;
  categoryName?: string;
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
  const guestToken = request.nextUrl.searchParams.get("guestToken");
  const tokenGuestSession = guestToken ? decodePayloadCookieValue<ClientGuestSession>(guestToken) : null;
  const guestSession = clientUser ? null : tokenGuestSession ?? (await getClientGuestSessionFromRequest(request));
  if (!clientUser && (!guestSession || guestSession.restaurantId !== restaurant.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (clientUser && clientUser.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = clientUser
    ? await getOrCreateCustomerForUser(clientUser, restaurant.id)
    : await getOrCreateAnonymousCustomerForRestaurant(
        restaurant.id,
        guestSession!.id,
        guestSession!.name,
      );

  let tableSession = null;
  try {
    tableSession = await getOrCreateTableSessionForCustomer(
      restaurant.id,
      customer,
      guestSession?.tableId ?? null,
    );
  } catch {
    tableSession = null;
  }

  const currentOrder = tableSession?.orderId ? await getOrderById(tableSession.orderId) : null;
  if (currentOrder) {
    return NextResponse.json({ order: currentOrder, tableSession });
  }

  const restaurantOrders = await listOrdersForRestaurant(restaurant.id);
  const fallbackOrder =
    restaurantOrders
      .filter((order) => {
        if (!tableSession) return false;
        return order.tableSessionId === tableSession.id || order.tableId === tableSession.tableId;
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt ?? right.createdAt).getTime() -
          new Date(left.updatedAt ?? left.createdAt).getTime(),
      )[0] ?? null;

  return NextResponse.json({ order: fallbackOrder, tableSession });
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
  const guestToken = request.nextUrl.searchParams.get("guestToken");
  const tokenGuestSession = guestToken ? decodePayloadCookieValue<ClientGuestSession>(guestToken) : null;
  const guestSession = clientUser ? null : tokenGuestSession ?? (await getClientGuestSessionFromRequest(request));
  if (!clientUser && (!guestSession || guestSession.restaurantId !== restaurant.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (clientUser && clientUser.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    items?: CartItem[];
    note?: string;
    tableId?: string | null;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const customer = clientUser
    ? await getOrCreateCustomerForUser(clientUser, restaurant.id)
    : await getOrCreateAnonymousCustomerForRestaurant(
        restaurant.id,
        guestSession!.id,
        guestSession!.name,
      );

  const requestedTableId = body.tableId ?? guestSession?.tableId ?? null;
  const requestedTable = requestedTableId ? await getTableById(requestedTableId).catch(() => null) : null;
  if (requestedTableId && (!requestedTable || requestedTable.restaurantId !== restaurant.id)) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  let tableSession = null;
  try {
    tableSession = await getOrCreateTableSessionForCustomer(
      restaurant.id,
      customer,
      requestedTableId,
    );
  } catch {
    tableSession = null;
  }

  const resolvedTableId = tableSession?.tableId ?? requestedTableId ?? null;
  if (!resolvedTableId) {
    return NextResponse.json({ error: "No table selected" }, { status: 400 });
  }

  const order = await createOrder(
    {
      restaurantId: restaurant.id,
      tableId: resolvedTableId,
      tableSessionId: tableSession?.id ?? null,
      staffUserId: null,
      source: "qr",
      status: "open",
      openedAt: new Date().toISOString(),
      closedAt: null,
      archivedAt: null,
      note: body.note?.trim() || "Commande client",
    },
    { allowDuplicateOpen: true },
  );

  const updatedTableSession =
    tableSession ? (await updateTableSession(tableSession.id, { orderId: order.id })) ?? tableSession : null;

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
      taxCategory: inferTaxCategory(item.categoryName ?? null, item.name ?? null),
      taxRate: taxRateForCategory(inferTaxCategory(item.categoryName ?? null, item.name ?? null)),
    });
  }

  const nextOrder =
    (await updateOrder(order.id, {
      note: body.note?.trim() || order.note,
      tableSessionId: tableSession?.id ?? order.tableSessionId ?? null,
      source: "qr",
      status: "open",
    })) ??
    (await getOrderById(order.id)) ??
    order;

  if (!nextOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: "client",
      actorName: clientUser?.name ?? guestSession?.name ?? customer.name,
      action: "client_order_requested",
      targetType: "order",
      targetId: order.id,
      details: `items=${items.length}${(updatedTableSession?.tableId ?? resolvedTableId) ? ` · table=${updatedTableSession?.tableId ?? resolvedTableId}` : ""}`,
    });
  } catch {
    // Audit must not block a real order submission.
  }

  const tableLabel =
    nextOrder.source === "takeaway"
      ? "À emporter"
      : updatedTableSession?.tableId ?? resolvedTableId
        ? (await getTableById(updatedTableSession?.tableId ?? resolvedTableId))?.name ?? "Table"
        : "Table";

  try {
    await dispatchOrderRequestNotification({
      provider: restaurant.features.notificationProvider,
      restaurant,
      order: nextOrder,
      tableLabel,
    });
  } catch {
    // Notification side effects must not block the customer order flow.
  }

  return NextResponse.json({ order: nextOrder, tableSession: updatedTableSession }, { status: 201 });
}
