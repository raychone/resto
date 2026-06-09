import { NextRequest, NextResponse } from "next/server";
import { isValidManagerSession, managerDashboardCookieName } from "@/lib/auth";
import { createRestaurant, listRestaurants } from "@/lib/restaurant-store";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const restaurants = await listRestaurants();
  return NextResponse.json(restaurants);
}

export async function POST(request: NextRequest) {
  if (!isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Partial<Restaurant>;
  const restaurant = await createRestaurant(payload);
  return NextResponse.json(restaurant, { status: 201 });
}
