import { NextRequest, NextResponse } from "next/server";
import { getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { recordAuditEntry } from "@/lib/audit-store";
import { dispatchRestaurantNotification } from "@/lib/notification-service";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { deleteReservation, updateReservationStatus } from "@/lib/engagement-store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string; reservationId: string }>;
  },
) {
  const staffUser = await getStaffUserFromRequest(request);
  const managerUser = await getManagerUserFromRequest(request);
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  const actor =
    staffUser && staffUser.restaurantId === restaurant?.id
      ? { role: "staff" as const, name: staffUser.name }
      : managerUser && managerUser.restaurantId === restaurant?.id
        ? { role: "manager" as const, name: managerUser.name }
        : null;

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reservationId } = await params;
  const payload = (await request.json()) as { status?: "confirmed" | "cancelled" | "no_show" };

  if (!payload.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const reservation = await updateReservationStatus(slug, reservationId, payload.status, actor);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (payload.status === "confirmed" && restaurant) {
    const dispatchResult = await dispatchRestaurantNotification({
      provider: restaurant.features.notificationProvider,
      restaurant,
      reservation,
    });

    await recordAuditEntry({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      actorRole: actor.role,
      actorName: actor.name,
      action: "reservation_notification",
      targetType: "reservation",
      targetId: reservation.id,
      details:
        dispatchResult.provider === "android"
          ? "android_composer_only"
          : dispatchResult.sent
            ? `${dispatchResult.provider}_sent`
            : `${dispatchResult.provider}_not_sent`,
    });
  }

  return NextResponse.json({ reservation });
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string; reservationId: string }>;
  },
) {
  const staffUser = await getStaffUserFromRequest(request);
  const managerUser = await getManagerUserFromRequest(request);
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  const actor =
    staffUser && staffUser.restaurantId === restaurant?.id
      ? { role: "staff" as const, name: staffUser.name }
      : managerUser && managerUser.restaurantId === restaurant?.id
        ? { role: "manager" as const, name: managerUser.name }
        : null;

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reservationId } = await params;
  const reservation = await deleteReservation(slug, reservationId, actor);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
