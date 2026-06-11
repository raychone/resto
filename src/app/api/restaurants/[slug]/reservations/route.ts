import { NextRequest, NextResponse } from "next/server";
import { getManagerUserFromRequest, getStaffUserFromRequest } from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  createReservation,
  getReservationsForRestaurant,
} from "@/lib/engagement-store";
import { dispatchRestaurantNotification } from "@/lib/notification-service";
import { locales, type Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const staffUser = await getStaffUserFromRequest(request);
  const managerUser = await getManagerUserFromRequest(request);
  const actorUser =
    staffUser?.restaurantId === restaurant.id
      ? staffUser
      : managerUser?.restaurantId === restaurant.id
        ? managerUser
        : null;

  const payload = (await request.json()) as {
    locale?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    note?: string;
    date?: string;
    time?: string;
    guestCount?: number;
  };

  if (
    !payload.firstName ||
    !payload.lastName ||
    !payload.phone ||
    !payload.date ||
    !payload.time ||
    !payload.guestCount
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const result = await createReservation(restaurant, {
    locale: resolveLocale(payload.locale),
    firstName: payload.firstName,
    lastName: payload.lastName,
    name: `${payload.firstName} ${payload.lastName}`,
    phone: payload.phone,
    email: payload.email ?? "",
    note: payload.note ?? "",
    date: payload.date,
    time: payload.time,
    guestCount: Number(payload.guestCount),
    actorRole: actorUser ? (actorUser.role as "staff" | "manager") : "client",
    actorName: actorUser?.name ?? "client",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const dispatchResult = await dispatchRestaurantNotification({
    provider: restaurant.features.notificationProvider,
    restaurant,
    reservation: result.reservation,
    variant: "request",
  });

  return NextResponse.json(
    {
      reservation: result.reservation,
      notification: dispatchResult,
    },
    { status: 201 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const staffUser = await getStaffUserFromRequest(request);
  const managerUser = await getManagerUserFromRequest(request);
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  const hasAccess =
    restaurant &&
    ((staffUser?.restaurantId === restaurant.id) ||
      (managerUser?.restaurantId === restaurant.id));

  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reservations = await getReservationsForRestaurant(slug);
  return NextResponse.json({ reservations });
}
