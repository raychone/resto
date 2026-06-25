import { NextRequest, NextResponse } from "next/server";
import {
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
  getStaffUserFromRequest,
} from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { listTableSessionsForRestaurant } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

type Params = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableSessions = await listTableSessionsForRestaurant(restaurant.id);
  return NextResponse.json({ tableSessions });
}
