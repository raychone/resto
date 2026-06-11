import { NextRequest, NextResponse } from "next/server";
import {
  deleteRestaurant,
  getRestaurantById,
  getRestaurantBySlug,
  updateRestaurant,
} from "@/lib/restaurant-store";
import { getManagerUserFromRequest, getOwnerUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const owner = await getOwnerUserFromRequest(request);
  const manager = await getManagerUserFromRequest(request);

  if (
    !owner &&
    (!manager?.restaurantId || (await getRestaurantById(manager.restaurantId))?.slug !== slug)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(restaurant);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const owner = await getOwnerUserFromRequest(request);
  const manager = await getManagerUserFromRequest(request);
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (
    !owner &&
    (!manager?.restaurantId || restaurant.id !== manager.restaurantId)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Restaurant;
  const updatedRestaurant = await updateRestaurant(slug, payload);

  if (!updatedRestaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const actor = owner
    ? { role: "manager" as const, name: "Owner" }
    : manager
      ? { role: "manager" as const, name: manager.name }
      : null;

  if (actor) {
    await recordAuditEntry({
      restaurantSlug: updatedRestaurant.slug,
      restaurantId: updatedRestaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "restaurant_updated",
      targetType: "restaurant",
      targetId: updatedRestaurant.id,
      details: "restaurant_config_saved",
    });
  }

  return NextResponse.json(updatedRestaurant);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const owner = await getOwnerUserFromRequest(request);
  const manager = await getManagerUserFromRequest(request);
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (
    !owner &&
    (!manager?.restaurantId || restaurant.id !== manager.restaurantId)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteRestaurant(slug);
  const actor = owner
    ? { role: "manager" as const, name: "Owner" }
    : manager
      ? { role: "manager" as const, name: manager.name }
      : null;

  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "restaurant_deleted",
      targetType: "restaurant",
      targetId: restaurant.id,
      details: "soft_deleted",
    });
  }
  return NextResponse.json({ ok: true });
}
