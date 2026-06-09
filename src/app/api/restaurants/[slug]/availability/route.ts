import { NextResponse } from "next/server";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getAvailabilityForRestaurant } from "@/lib/engagement-store";
import { locales, type Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const days = Number(url.searchParams.get("days") ?? "14");
  const locale = resolveLocale(url.searchParams.get("lang") ?? undefined);
  const startDate = from ? new Date(`${from}T00:00:00`) : new Date();
  const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
  const availability = await getAvailabilityForRestaurant(restaurant, {
    locale,
    startDate: safeStartDate,
    dayCount: Number.isFinite(days) && days > 0 ? days : 14,
  });

  return NextResponse.json({ availability });
}
