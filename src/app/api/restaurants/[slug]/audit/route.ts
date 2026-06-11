import { NextRequest, NextResponse } from "next/server";
import { getManagerUserFromRequest, getOwnerUserFromRequest } from "@/lib/auth";
import { listAuditEntriesForRestaurant } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";

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
    (!manager?.restaurantId || manager.restaurantId !== restaurant.id)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auditEntries = await listAuditEntriesForRestaurant(slug);
  return NextResponse.json({ auditEntries });
}
