import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest, getManagerUserFromRequest } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  disableUser,
  getUserById,
  setUserPassword,
  updateUser,
} from "@/lib/user-store";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  const manager = await getManagerUserFromRequest(request);
  return Boolean(owner || manager?.restaurantId === restaurantId);
}

type Params = {
  params: Promise<{ slug: string; userId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, userId } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await isAuthorized(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    status?: "active" | "disabled";
    temporaryPassword?: string;
    resetPassword?: boolean;
  };

  const existing = await getUserById(userId);
  if (!existing || existing.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.resetPassword && body.temporaryPassword) {
    const updated = await setUserPassword(userId, body.temporaryPassword, {
      temporaryPassword: body.temporaryPassword,
      mustChangePassword: true,
    });
    return NextResponse.json({ user: updated });
  }

  const updated = await updateUser(userId, {
    status: body.status ?? existing.status,
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, userId } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await isAuthorized(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getUserById(userId);
  if (!existing || existing.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await disableUser(userId);
  return NextResponse.json({ user: updated });
}
