import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getOrderById, updateOrderItemQuantity } from "@/lib/order-store";

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
  params: Promise<{ slug: string; orderId: string; itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, orderId, itemId } = await params;
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

  const body = (await request.json()) as { quantity?: number };
  if (typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Missing quantity" }, { status: 400 });
  }

  const next = await updateOrderItemQuantity(orderId, itemId, body.quantity);

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_item_quantity_changed",
      targetType: "order",
      targetId: order.id,
      details: `item=${itemId} · qty=${body.quantity}`,
    });
  }

  return NextResponse.json({ order: next });
}
