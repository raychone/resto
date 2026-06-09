import { NextRequest, NextResponse } from "next/server";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { createMessage } from "@/lib/engagement-store";
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
    name?: string;
    phone?: string;
    email?: string;
    message?: string;
  };

  if (!payload.name || !payload.message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const message = await createMessage(restaurant, {
    locale: resolveLocale(payload.locale),
    name: payload.name,
    phone: payload.phone ?? "",
    email: payload.email ?? "",
    message: payload.message,
  });

  return NextResponse.json(message, { status: 201 });
}

