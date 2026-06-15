import { NextRequest, NextResponse } from "next/server";
import {
  getClientUserFromRequest,
  getKitchenUserFromRequest,
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
  getStaffUserFromRequest,
} from "@/lib/auth";
import { createMessage, getMessagesForRestaurant, updateMessageStatus } from "@/lib/engagement-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { locales, type Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  if (staff && staff.restaurantId === restaurantId) return true;

  const kitchen = await getKitchenUserFromRequest(request);
  if (kitchen && kitchen.restaurantId === restaurantId) return true;

  const client = await getClientUserFromRequest(request);
  return Boolean(client && client.restaurantId === restaurantId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await getMessagesForRestaurant(restaurant.slug);
  return NextResponse.json({ messages });
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
    tableId?: string | null;
    tableLabel?: string | null;
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
    tableId: payload.tableId ?? null,
    tableLabel: payload.tableLabel ?? null,
  });

  return NextResponse.json(message, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    ids?: string[];
    tableId?: string;
    status?: "new" | "read";
  };

  if (!payload.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const messages = await updateMessageStatus(restaurant.slug, {
    ids: Array.isArray(payload.ids) ? payload.ids : undefined,
    tableId: payload.tableId,
    status: payload.status,
  });

  return NextResponse.json({ messages });
}
