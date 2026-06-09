import { NextRequest, NextResponse } from "next/server";
import {
  isValidManagerSession,
  isValidStaffSession,
  managerDashboardCookieName,
  staffDashboardCookieName,
} from "@/lib/auth";
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
  const actor = isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value)
    ? { role: "staff" as const, name: "user" }
    : isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)
      ? { role: "manager" as const, name: "raych" }
      : null;

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, reservationId } = await params;
  const payload = (await request.json()) as { status?: "confirmed" | "cancelled" };

  if (!payload.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const reservation = await updateReservationStatus(slug, reservationId, payload.status, actor);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
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
  const actor = isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value)
    ? { role: "staff" as const, name: "user" }
    : isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)
      ? { role: "manager" as const, name: "raych" }
      : null;

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, reservationId } = await params;
  const reservation = await deleteReservation(slug, reservationId, actor);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
