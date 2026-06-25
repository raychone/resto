import { NextRequest, NextResponse } from "next/server";
import { getManagerUserFromRequest, getOwnerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { createTableGroup, listTableGroupsForRestaurant } from "@/lib/table-group-store";

export const dynamic = "force-dynamic";

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;
  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;
  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tableGroups = await listTableGroupsForRestaurant(restaurant.id);
  return NextResponse.json({ tableGroups });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    hostCustomerId?: string | null;
    primaryTableId?: string | null;
    tableIds?: string[];
    tableSessionIds?: string[];
    accessCode?: string;
    note?: string;
  };

  const tableGroup = await createTableGroup({
    restaurantId: restaurant.id,
    name: body.name?.trim() || "Groupe de tables",
    status: "open",
    hostCustomerId: body.hostCustomerId?.trim() || null,
    primaryTableId: body.primaryTableId?.trim() || null,
    tableIds: Array.isArray(body.tableIds) ? body.tableIds : [],
    tableSessionIds: Array.isArray(body.tableSessionIds) ? body.tableSessionIds : [],
    accessCode: body.accessCode?.trim().toUpperCase() || "",
    note: body.note?.trim() || "",
    closedAt: null,
    deletedAt: null,
  });

  return NextResponse.json({ tableGroup }, { status: 201 });
}
