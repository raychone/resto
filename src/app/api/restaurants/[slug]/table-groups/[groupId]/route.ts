import { NextRequest, NextResponse } from "next/server";
import { getManagerUserFromRequest, getOwnerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getTableGroupById, updateTableGroup } from "@/lib/table-group-store";

export const dynamic = "force-dynamic";

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;
  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;
  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

type Params = { params: Promise<{ slug: string; groupId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { slug, groupId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tableGroup = await getTableGroupById(groupId);
  if (!tableGroup || tableGroup.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Table group not found" }, { status: 404 });
  }
  return NextResponse.json({ tableGroup });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, groupId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    status?: "open" | "closed" | "archived";
    hostCustomerId?: string | null;
    primaryTableId?: string | null;
    tableIds?: string[];
    tableSessionIds?: string[];
    accessCode?: string;
    note?: string;
    closedAt?: string | null;
    deletedAt?: string | null;
  };

  const tableGroup = await updateTableGroup(groupId, {
    name: body.name,
    status: body.status,
    hostCustomerId: body.hostCustomerId,
    primaryTableId: body.primaryTableId,
    tableIds: body.tableIds,
    tableSessionIds: body.tableSessionIds,
    accessCode: body.accessCode,
    note: body.note,
    closedAt: body.closedAt,
    deletedAt: body.deletedAt,
  });

  if (!tableGroup || tableGroup.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Table group not found" }, { status: 404 });
  }

  return NextResponse.json({ tableGroup });
}
