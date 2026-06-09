import { NextRequest, NextResponse } from "next/server";
import {
  isValidManagerSession,
  isValidStaffSession,
  managerDashboardCookieName,
  staffDashboardCookieName,
} from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import {
  createReservation,
  getReservationsForRestaurant,
} from "@/lib/engagement-store";
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
    actorRole: isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value)
      ? "staff"
      : isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)
        ? "manager"
        : "client",
    actorName: isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value)
      ? "user"
      : isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value)
        ? "raych"
        : "client",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result.reservation, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const hasAccess =
    isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value) ||
    isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value);

  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const reservations = await getReservationsForRestaurant(slug);
  return NextResponse.json({ reservations });
}
