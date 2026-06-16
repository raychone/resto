export type RestaurantRealtimeEventType =
  | "connected"
  | "ping"
  | "orders"
  | "reservations"
  | "messages"
  | "users"
  | "restaurants"
  | "table_sessions";

export type RestaurantRealtimeEvent = {
  type: RestaurantRealtimeEventType;
  restaurantId: string;
  restaurantSlug?: string | null;
  entityId?: string | null;
  action?: string | null;
  details?: string | null;
  occurredAt: string;
};

type RestaurantRealtimeListener = (event: RestaurantRealtimeEvent) => void;

type RestaurantRealtimeStore = Map<string, Set<RestaurantRealtimeListener>>;

type RealtimeGlobal = typeof globalThis & {
  __meniuRealtimeStore?: RestaurantRealtimeStore;
};

const globalForRealtime = globalThis as RealtimeGlobal;

function getStore() {
  if (!globalForRealtime.__meniuRealtimeStore) {
    globalForRealtime.__meniuRealtimeStore = new Map();
  }

  return globalForRealtime.__meniuRealtimeStore;
}

export function publishRestaurantRealtimeEvent(event: Omit<RestaurantRealtimeEvent, "occurredAt"> & { occurredAt?: string }) {
  const store = getStore();
  const listeners = store.get(event.restaurantId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const payload: RestaurantRealtimeEvent = {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // Ignore listener failures so one bad subscriber does not break others.
    }
  }
}

export function subscribeRestaurantRealtime(
  restaurantId: string,
  listener: RestaurantRealtimeListener,
) {
  const store = getStore();
  const listeners = store.get(restaurantId) ?? new Set<RestaurantRealtimeListener>();
  listeners.add(listener);
  store.set(restaurantId, listeners);

  return () => {
    const current = store.get(restaurantId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      store.delete(restaurantId);
    }
  };
}
