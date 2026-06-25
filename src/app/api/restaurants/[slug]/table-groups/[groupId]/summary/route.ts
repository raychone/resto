import { NextRequest, NextResponse } from "next/server";
import {
  decodePayloadCookieValue,
  getClientGuestSessionFromRequest,
  getClientUserFromRequest,
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
  getStaffUserFromRequest,
  type ClientGuestSession,
} from "@/lib/auth";
import { listOrdersForRestaurant, listPaymentsForRestaurant } from "@/lib/order-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getTableById, listTablesForRestaurant } from "@/lib/table-store";
import { getTableGroupById } from "@/lib/table-group-store";
import { buildTableGroupSummary } from "@/lib/table-group-summary";
import { listTableSessionsForRestaurant } from "@/lib/table-session-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; groupId: string }> };

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  if (staff && staff.restaurantId === restaurantId) return true;

  const client = await getClientUserFromRequest(request);
  if (client && client.restaurantId === restaurantId) return true;

  const guestToken = request.nextUrl.searchParams.get("guestToken");
  const tokenGuestSession = guestToken ? decodePayloadCookieValue<ClientGuestSession>(guestToken) : null;
  const guestSession = tokenGuestSession ?? (await getClientGuestSessionFromRequest(request));
  return Boolean(guestSession && guestSession.restaurantId === restaurantId);
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug, groupId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableGroup = await getTableGroupById(groupId);
  if (!tableGroup || tableGroup.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Table group not found" }, { status: 404 });
  }

  const [orders, payments, tableSessions] = await Promise.all([
    listOrdersForRestaurant(restaurant.id),
    listPaymentsForRestaurant(restaurant.id),
    listTableSessionsForRestaurant(restaurant.id),
  ]);

  const neededTables = new Map<string, Awaited<ReturnType<typeof getTableById>>>();
  for (const tableId of tableGroup.tableIds) {
    neededTables.set(tableId, await getTableById(tableId));
  }
  const tables = (await listTablesForRestaurant(restaurant.id)).filter(
    (table) => tableGroup.tableIds.includes(table.id) || neededTables.has(table.id),
  );

  const summary = buildTableGroupSummary({
    tableGroup,
    orders,
    payments,
    tableSessions: tableSessions.filter((session) => !session.deletedAt),
    tables,
  });

  return NextResponse.json({ tableGroup, summary });
}
