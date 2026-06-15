import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getCustomerById, updateCustomer } from "@/lib/customer-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { createPayment, getOrderById, listPaymentsForOrder } from "@/lib/order-store";
import { getTableById } from "@/lib/table-store";
import { listTableSessionsForRestaurant, updateTableSession } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

async function resolveAuditActor(request: NextRequest, restaurantId: string) {
  const staff = await getStaffUserFromRequest(request);
  if (staff && staff.restaurantId === restaurantId) {
    return { role: "staff" as const, name: staff.name };
  }

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) {
    return { role: "manager" as const, name: manager.name };
  }

  return null;
}

type Params = {
  params: Promise<{ slug: string; orderId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { slug, orderId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await getOrderById(orderId);
  if (!order || order.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    amount?: number;
    method?: "cash" | "card" | "external" | "other";
    note?: string;
  };

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Missing amount" }, { status: 400 });
  }

  const payment = await createPayment({
    orderId,
    restaurantId: restaurant.id,
    amount: body.amount,
    method: body.method ?? "cash",
    status: "completed",
    note: body.note ?? "",
  });

  const refreshedOrder = await getOrderById(orderId);
  const orderPayments = await listPaymentsForOrder(orderId);
  const total = order?.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0) ?? 0;
  const paidTotal = orderPayments.reduce((sum, entry) => sum + entry.amount, 0);
  const remaining = Math.max(0, total - paidTotal);
  const table = order?.tableId ? await getTableById(order.tableId) : null;
  const targetLabel =
    table?.name ??
    (order?.source === "takeaway"
      ? "À emporter"
      : order?.source === "phone"
        ? "Téléphone"
        : order?.source === "qr"
          ? "QR"
          : "Bon");
  const methodLabel =
    body.method === "card"
      ? "carte"
      : body.method === "external"
        ? "externe"
        : body.method === "other"
          ? "autre"
          : "cash";

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_paid",
      targetType: "order",
      targetId: orderId,
      details:
        `${targetLabel} · ${body.amount} EUR ${methodLabel}` +
        (remaining > 0 ? ` · reste ${remaining} EUR` : " · réglé"),
    });
  }

  const tableSession =
    order?.tableSessionId
      ? (await listTableSessionsForRestaurant(restaurant.id)).find(
          (session) => session.id === order.tableSessionId,
        )
      : order?.tableId
        ? (await listTableSessionsForRestaurant(restaurant.id)).find(
            (session) => session.status === "open" && session.tableId === order.tableId,
          )
        : null;

  if (tableSession && order) {
    await updateTableSession(tableSession.id, {
      paidTotal,
      status: remaining <= 0 ? "closed" : tableSession.status,
      closedAt: remaining <= 0 ? new Date().toISOString() : tableSession.closedAt ?? null,
    });

    const earnedPointsByCustomer = new Map<string, number>();
    for (const participant of tableSession.participants) {
      if (!participant.customerId) continue;
      const rawPoints = (body.amount * participant.sharePercent) / 100;
      const points = Math.max(0, Math.floor(rawPoints));
      if (points > 0) {
        earnedPointsByCustomer.set(
          participant.customerId,
          (earnedPointsByCustomer.get(participant.customerId) ?? 0) + points,
        );
      }
    }

    for (const [customerId, earnedPoints] of earnedPointsByCustomer.entries()) {
      const customer = await getCustomerById(customerId);
      if (!customer) continue;

      await updateCustomer(customerId, {
        currentPoints: customer.currentPoints + earnedPoints,
        lifetimePoints: customer.lifetimePoints + earnedPoints,
      });
    }
  }

  return NextResponse.json(
    {
      payment,
      order: refreshedOrder,
      summary: {
        targetLabel,
        methodLabel,
        amount: body.amount,
        paidTotal,
        remaining,
      },
    },
    { status: 201 },
  );
}
