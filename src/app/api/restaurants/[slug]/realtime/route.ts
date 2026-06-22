import { NextResponse } from "next/server";
import {
  decodePayloadCookieValue,
  getAnySessionUserFromRequest,
  getClientGuestSessionFromRequest,
  type ClientGuestSession,
} from "@/lib/auth";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { subscribeRestaurantRealtime } from "@/lib/realtime";

export const runtime = "nodejs";

function canAccessRestaurant(user: { role: string; restaurantId?: string | null }, restaurantId: string) {
  return user.role === "owner" || user.restaurantId === restaurantId;
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

  const user = await getAnySessionUserFromRequest(request);
  const guestToken = new URL(request.url).searchParams.get("guestToken");
  const tokenGuestSession = guestToken ? decodePayloadCookieValue<ClientGuestSession>(guestToken) : null;
  const guestSession = user ? null : tokenGuestSession ?? (await getClientGuestSessionFromRequest(request));
  const canAccess = Boolean(user && canAccessRestaurant(user, restaurant.id)) || Boolean(guestSession && guestSession.restaurantId === restaurant.id);
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "connected",
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
        occurredAt: new Date().toISOString(),
      })}\n\n`));

      const unsubscribe = subscribeRestaurantRealtime(restaurant.id, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      const heartbeat = globalThis.setInterval(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "ping",
          restaurantId: restaurant.id,
          restaurantSlug: restaurant.slug,
          occurredAt: new Date().toISOString(),
        })}\n\n`));
      }, 25000);

      const cleanup = () => {
        globalThis.clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
