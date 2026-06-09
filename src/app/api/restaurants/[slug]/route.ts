import { NextRequest, NextResponse } from "next/server";
import { isValidManagerSession, managerDashboardCookieName } from "@/lib/auth";
import {
  deleteRestaurant,
  getRestaurantBySlug,
  updateRestaurant,
} from "@/lib/restaurant-store";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  return NextResponse.json(restaurant);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const payload = (await request.json()) as Restaurant;
  const restaurant = await updateRestaurant(slug, payload);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  return NextResponse.json(restaurant);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  await deleteRestaurant(slug);
  return NextResponse.json({ ok: true });
}
