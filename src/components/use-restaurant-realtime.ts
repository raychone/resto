"use client";

import { useEffect, useRef } from "react";
import type { RestaurantRealtimeEvent } from "@/lib/realtime";

type UseRestaurantRealtimeOptions = {
  restaurantSlug: string;
  enabled: boolean;
  guestSessionToken?: string | null;
  onUnauthorized?: () => void;
  onEvent: (event: RestaurantRealtimeEvent) => void;
};

export function useRestaurantRealtime({
  restaurantSlug,
  enabled,
  guestSessionToken = null,
  onUnauthorized,
  onEvent,
}: UseRestaurantRealtimeOptions) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !restaurantSlug || typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let source: EventSource | null = null;

    const connect = () => {
      if (cancelled) return;

      const realtimeUrl = new URL(`/api/restaurants/${restaurantSlug}/realtime`, window.location.origin);
      if (guestSessionToken) {
        realtimeUrl.searchParams.set("guestToken", guestSessionToken);
      }

      source = new EventSource(realtimeUrl.toString());
      source.onmessage = (event) => {
        if (!event.data) return;

        try {
          const payload = JSON.parse(event.data) as RestaurantRealtimeEvent;
          if (payload.type === "ping") return;
          onEventRef.current(payload);
        } catch {
          onEventRef.current({
            type: "restaurants",
            restaurantId: "",
            restaurantSlug,
            action: "message",
            occurredAt: new Date().toISOString(),
          });
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        onUnauthorized?.();
      };
    };

    connect();

    return () => {
      cancelled = true;
      source?.close();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [enabled, guestSessionToken, restaurantSlug]);
}
