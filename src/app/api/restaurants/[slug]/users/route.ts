import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  createUser,
  listUsersForRestaurant,
  hashUserPassword,
} from "@/lib/user-store";
export const dynamic = "force-dynamic";

async function isAuthorizedForRestaurant(
  request: NextRequest,
  restaurantId: string,
) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  return Boolean(manager && manager.restaurantId === restaurantId);
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

  const authorized = await isAuthorizedForRestaurant(request, restaurant.id);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsersForRestaurant(restaurant.id);
  return NextResponse.json({ users });
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

  const authorized = await isAuthorizedForRestaurant(request, restaurant.id);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    username?: string;
    temporaryPassword?: string;
  };

  if (!body.name || !body.username || !body.temporaryPassword) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const user = await createUser({
    restaurantId: restaurant.id,
    role: "staff",
    name: body.name,
    username: body.username,
    passwordHash: hashUserPassword(body.temporaryPassword),
    temporaryPassword: body.temporaryPassword,
    mustChangePassword: true,
    status: "active",
    deletedAt: null,
    pinEnabled: false,
  });

  return NextResponse.json({ user }, { status: 201 });
}
