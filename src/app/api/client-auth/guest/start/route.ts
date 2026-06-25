import { NextRequest, NextResponse } from "next/server";
import { encodePayloadCookieValue, type ClientGuestSession } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getOpenTableSessionForTable } from "@/lib/table-session-store";
import { getTableById } from "@/lib/table-store";
import { createId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const restaurantSlug = request.nextUrl.searchParams.get("restaurantSlug") || "bar-1";
  const tableId = request.nextUrl.searchParams.get("tableId") || "";
  const guestName = request.nextUrl.searchParams.get("name") || "Invité";
  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ||
    `/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&focus=cart`;

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return NextResponse.redirect(new URL("/client?guest=invalid_restaurant", request.url));
  }

  if (tableId) {
    const table = await getTableById(tableId);
    if (!table || table.restaurantId !== restaurant.id) {
      return NextResponse.redirect(new URL(`/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&guest=invalid_table`, request.url));
    }
    const activeSession = await getOpenTableSessionForTable(restaurant.id, tableId).catch(() => null);
    if (activeSession) {
      return NextResponse.redirect(new URL(`/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&guest=table_busy`, request.url));
    }
  }

  const guestSession: ClientGuestSession = {
    id: createId("guest-customer"),
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    tableId: tableId || null,
    name: guestName.trim() || "Invité",
    createdAt: new Date().toISOString(),
  };

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set("meniu_client_guest_session", encodePayloadCookieValue(guestSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
