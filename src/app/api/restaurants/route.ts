import { NextRequest, NextResponse } from "next/server";
import { createRestaurant, listRestaurants } from "@/lib/restaurant-store";
import {
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
} from "@/lib/auth";
import type { Restaurant } from "@/lib/types";
import { createUser, hashUserPassword } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) {
    const restaurants = await listRestaurants();
    return NextResponse.json(restaurants);
  }

  const manager = await getManagerUserFromRequest(request);
  if (manager?.restaurantId) {
    const restaurants = await listRestaurants();
    const restaurant = restaurants.find((entry) => entry.id === manager.restaurantId);
    return NextResponse.json(restaurant ? [restaurant] : []);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerUserFromRequest(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Partial<Restaurant> & {
    initialUsers?: Array<{
      role: "manager" | "staff";
      name?: string;
      username?: string;
      temporaryPassword?: string;
    }>;
  };
  const restaurant = await createRestaurant(payload);

  for (const user of payload.initialUsers ?? []) {
    if (!user.name || !user.username || !user.temporaryPassword) continue;

    await createUser({
      restaurantId: restaurant.id,
      role: user.role,
      name: user.name,
      username: user.username,
      passwordHash: hashUserPassword(user.temporaryPassword),
      temporaryPassword: user.temporaryPassword,
      mustChangePassword: true,
      status: "active",
      deletedAt: null,
      pinEnabled: false,
    });
  }

  return NextResponse.json(restaurant, { status: 201 });
}
