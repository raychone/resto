import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  createOrder,
  listOrdersForRestaurant,
  listPaymentsForRestaurant,
} from "@/lib/order-store";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [orders, payments] = await Promise.all([
    listOrdersForRestaurant(restaurant.id),
    listPaymentsForRestaurant(restaurant.id),
  ]);

  return NextResponse.json({ orders, payments });
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

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    tableId?: string | null;
    source?: "table" | "takeaway" | "phone" | "qr";
    note?: string;
    staffUserId?: string | null;
  };

  if (body.tableId) {
    const table = await getTableById(body.tableId);
    if (!table || table.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
  }

  const order = await createOrder({
    restaurantId: restaurant.id,
    tableId: body.tableId ?? null,
    staffUserId: body.staffUserId ?? null,
    source: body.source ?? (body.tableId ? "table" : "takeaway"),
    status: "open",
    openedAt: new Date().toISOString(),
    closedAt: null,
    archivedAt: null,
    note: body.note ?? "",
  });

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "order_opened",
      targetType: "order",
      targetId: order.id,
      details: `${order.source}${order.tableId ? ` · table=${order.tableId}` : ""}`,
    });
  }

  return NextResponse.json({ order }, { status: 201 });
}
