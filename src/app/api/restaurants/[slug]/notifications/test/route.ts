import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserFromRequest } from "@/lib/auth";
import { buildNotificationLink } from "@/lib/contact-links";
import { dispatchRestaurantNotification } from "@/lib/notification-service";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import type { Locale, NotificationProvider, Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveProvider(value: unknown, fallback: NotificationProvider) {
  return value === "android" ||
    value === "twilio" ||
    value === "whatsapp_business" ||
    value === "off"
    ? value
    : fallback;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ownerUser = await getOwnerUserFromRequest(request);
  if (!ownerUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    provider?: unknown;
    locale?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    email?: unknown;
    note?: unknown;
    date?: unknown;
    time?: unknown;
    guestCount?: unknown;
  };

  const provider = resolveProvider(
    payload.provider,
    restaurant.features.notificationProvider,
  );

  const locale: Locale =
    payload.locale === "fr" ||
    payload.locale === "en" ||
    payload.locale === "it" ||
    payload.locale === "es"
      ? payload.locale
      : "fr";

  const reservation: Reservation = {
    id: "test-notification",
    restaurantSlug: restaurant.slug,
    restaurantId: restaurant.id,
    locale,
    firstName: String(payload.firstName ?? "Jean").trim(),
    lastName: String(payload.lastName ?? "Dupont").trim(),
    name: `${String(payload.firstName ?? "Jean").trim()} ${String(payload.lastName ?? "Dupont").trim()}`.trim(),
    phone: String(payload.phone ?? restaurant.phone).trim(),
    email: String(payload.email ?? "client@example.com").trim(),
    note: String(payload.note ?? "Réservation de test depuis le panneau owner").trim(),
    date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
    time: String(payload.time ?? "19:30"),
    guestCount: Number(payload.guestCount ?? 2),
    tablesNeeded: 1,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const composerUrl = buildNotificationLink({
    provider,
    phoneNumber: restaurant.whatsappNumber || restaurant.phone,
    message: `${restaurant.name} • ${reservation.firstName} ${reservation.lastName} • ${reservation.guestCount} pers • ${reservation.time}`,
  });

  if (provider === "android") {
    return NextResponse.json({
      provider,
      sent: false,
      details: "composer_only",
      composerUrl,
      reservation,
    });
  }

  const result = await dispatchRestaurantNotification({
    provider,
    restaurant,
    reservation,
    variant: "request",
  });

  return NextResponse.json({
    ...result,
    composerUrl,
    reservation,
  });
}
