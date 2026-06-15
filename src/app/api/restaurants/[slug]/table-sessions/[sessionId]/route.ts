import { NextRequest, NextResponse } from "next/server";
import {
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
  getStaffUserFromRequest,
} from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getTableById } from "@/lib/table-store";
import { updateTableSession } from "@/lib/table-session-store";
import type { TableSessionParticipant } from "@/lib/types";

export const dynamic = "force-dynamic";

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

async function resolveAuditActor(request: NextRequest, restaurantId: string) {
  const staff = await getStaffUserFromRequest(request);
  if (staff && staff.restaurantId === restaurantId) {
    return { role: "staff" as const, name: staff.name };
  }

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) {
    return { role: "manager" as const, name: manager.name };
  }

  const owner = await getOwnerUserFromRequest(request);
  if (owner) {
    return { role: "manager" as const, name: owner.name };
  }

  return null;
}

function normalizeParticipants(participants: TableSessionParticipant[]) {
  return participants.map((participant, index) => ({
    id: participant.id?.trim() || `participant-${index + 1}`,
    customerId: participant.customerId?.trim() || null,
    name: participant.name?.trim() || `Invité ${index + 1}`,
    sharePercent: Number.isFinite(participant.sharePercent)
      ? Math.max(0, Math.min(100, Number(participant.sharePercent)))
      : 0,
    settledAmount: Number.isFinite(participant.settledAmount)
      ? Math.max(0, Number(participant.settledAmount))
      : 0,
    note: participant.note?.trim() || "",
  }));
}

type Params = {
  params: Promise<{ slug: string; sessionId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, sessionId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    guestCount?: number;
    note?: string;
    participants?: TableSessionParticipant[];
    tableId?: string | null;
  };

  if (body.tableId) {
    const table = await getTableById(body.tableId);
    if (!table || table.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
  }

  const nextParticipants = Array.isArray(body.participants) ? normalizeParticipants(body.participants) : [];
  const nextSession = await updateTableSession(sessionId, {
    guestCount:
      Number.isFinite(body.guestCount) && Number(body.guestCount) > 0
        ? Math.floor(Number(body.guestCount))
        : nextParticipants.length || 1,
    tableId: body.tableId !== undefined ? body.tableId : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
    participants: nextParticipants,
  });

  if (!nextSession || nextSession.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "Table session not found" }, { status: 404 });
  }

  const actor = await resolveAuditActor(request, restaurant.id);
  if (actor) {
    await recordAuditEntry({
      restaurantSlug: restaurant.slug,
      restaurantId: restaurant.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: "table_session_updated",
      targetType: "table_session",
      targetId: sessionId,
      details: `participants=${nextParticipants.length};guestCount=${nextSession.guestCount}`,
    });
  }

  return NextResponse.json({ tableSession: nextSession });
}
