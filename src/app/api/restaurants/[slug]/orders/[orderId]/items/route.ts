import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { addOrderItem, getOrderById, removeOrderItem } from "@/lib/order-store";

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
    menuItemId?: string;
    nameSnapshot?: string;
    priceSnapshot?: number;
    quantity?: number;
    note?: string;
  };

  if (!body.menuItemId || !body.nameSnapshot || typeof body.priceSnapshot !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const next = await addOrderItem(orderId, {
    menuItemId: body.menuItemId,
    nameSnapshot: body.nameSnapshot,
    priceSnapshot: body.priceSnapshot,
    quantity: body.quantity && body.quantity > 0 ? body.quantity : 1,
    note: body.note ?? "",
  });

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_item_added",
      targetType: "order",
      targetId: order.id,
      details: `${body.nameSnapshot} × ${body.quantity ?? 1}`,
    });
  }

  return NextResponse.json({ order: next }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, orderId } = await params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
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

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const next = await removeOrderItem(orderId, itemId);

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_item_removed",
      targetType: "order",
      targetId: order.id,
      details: `item=${itemId}`,
    });
  }

  return NextResponse.json({ order: next });
}
