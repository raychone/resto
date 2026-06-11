import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { archiveOrder, getOrderById, updateOrder } from "@/lib/order-store";
import { getTableById } from "@/lib/table-store";

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

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, orderId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getOrderById(orderId);
  if (!existing || existing.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    status?: "open" | "sent_to_kitchen" | "paid" | "cancelled" | "archived";
    tableId?: string | null;
    note?: string;
  };

  if (body.tableId) {
    const table = await getTableById(body.tableId);
    if (!table || table.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
  }

  const next = await updateOrder(orderId, {
    status: body.status ?? existing.status,
    tableId: body.tableId ?? existing.tableId,
    note: body.note ?? existing.note,
    closedAt: body.status === "paid" || body.status === "cancelled" ? new Date().toISOString() : existing.closedAt,
    archivedAt: body.status === "archived" ? new Date().toISOString() : existing.archivedAt,
  });

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_status_changed",
      targetType: "order",
      targetId: orderId,
      details: `status=${body.status ?? existing.status}`,
    });
  }

  return NextResponse.json({ order: next });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, orderId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getOrderById(orderId);
  if (!existing || existing.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const next = await archiveOrder(orderId);

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_archived",
      targetType: "order",
      targetId: orderId,
      details: `status=archived`,
    });
  }

  return NextResponse.json({ order: next });
}
