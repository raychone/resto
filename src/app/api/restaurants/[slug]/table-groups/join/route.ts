import { NextRequest, NextResponse } from "next/server";
import {
  clientGuestSessionCookieName,
  encodePayloadCookieValue,
  getClientGuestSessionFromRequest,
  getClientUserFromRequest,
  type ClientGuestSession,
} from "@/lib/auth";
import { getOrCreateAnonymousCustomerForRestaurant, getOrCreateCustomerForUser } from "@/lib/customer-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getTableGroupByAccessCode, updateTableGroup } from "@/lib/table-group-store";
import { getOrCreateTableSessionForCustomer } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { accessCode?: string };
  const accessCode = body.accessCode?.trim().toUpperCase() || "";
  if (!accessCode) {
    return NextResponse.json({ error: "Access code required" }, { status: 400 });
  }

  const clientUser = await getClientUserFromRequest(request);
  const guestSession = clientUser ? null : await getClientGuestSessionFromRequest(request);

  if (!clientUser && !guestSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableGroup = await getTableGroupByAccessCode(restaurant.id, accessCode);
  if (!tableGroup || !tableGroup.primaryTableId) {
    return NextResponse.json({ error: "Table group not found" }, { status: 404 });
  }

  const customer = clientUser
    ? await getOrCreateCustomerForUser(clientUser, restaurant.id)
    : await getOrCreateAnonymousCustomerForRestaurant(
        restaurant.id,
        guestSession!.id,
        guestSession!.name,
      );

  const tableSession = await getOrCreateTableSessionForCustomer(
    restaurant.id,
    customer,
    tableGroup.primaryTableId,
    { allowJoinExistingTableSession: true },
  );

  const nextTableIds =
    tableSession.tableId && !tableGroup.tableIds.includes(tableSession.tableId)
      ? [...tableGroup.tableIds, tableSession.tableId]
      : tableGroup.tableIds;
  const nextSessionIds = tableGroup.tableSessionIds.includes(tableSession.id)
    ? tableGroup.tableSessionIds
    : [...tableGroup.tableSessionIds, tableSession.id];

  const updatedGroup =
    nextTableIds.length !== tableGroup.tableIds.length || nextSessionIds.length !== tableGroup.tableSessionIds.length
      ? await updateTableGroup(tableGroup.id, {
          tableIds: nextTableIds,
          tableSessionIds: nextSessionIds,
        })
      : tableGroup;

  const response = NextResponse.json({
    tableGroup: updatedGroup ?? tableGroup,
    tableSession,
  });

  if (!clientUser && guestSession) {
    const nextGuestSession: ClientGuestSession = {
      ...guestSession,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      tableId: tableSession.tableId ?? guestSession.tableId,
    };
    response.cookies.set(clientGuestSessionCookieName, encodePayloadCookieValue(nextGuestSession), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }

  return response;
}
