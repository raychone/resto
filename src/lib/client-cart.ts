export type ClientCartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  categoryName?: string;
  note?: string;
};

const cartChangeEventName = "meniu:client-cart-changed";

function storageKey(restaurantSlug: string) {
  return `meniu_client_cart:${restaurantSlug}`;
}

function emitCartChange(restaurantSlug: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(cartChangeEventName, {
      detail: { restaurantSlug },
    }),
  );
}

function readStorage(restaurantSlug: string): ClientCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(restaurantSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientCartItem[];
    return Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            menuItemId: String(item.menuItemId ?? "").trim(),
            name: String(item.name ?? "").trim(),
            price: Number.isFinite(item.price) ? Number(item.price) : 0,
            quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1,
            categoryName: item.categoryName ? String(item.categoryName) : undefined,
            note: item.note ? String(item.note) : undefined,
          }))
          .filter((item) => item.menuItemId && item.name)
      : [];
  } catch {
    return [];
  }
}

function writeStorage(restaurantSlug: string, items: ClientCartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(restaurantSlug), JSON.stringify(items));
}

export function listClientCartItems(restaurantSlug: string) {
  return readStorage(restaurantSlug);
}

export function getClientCartCount(restaurantSlug: string) {
  return readStorage(restaurantSlug).reduce((sum, item) => sum + item.quantity, 0);
}

export function getClientCartTotal(restaurantSlug: string) {
  return readStorage(restaurantSlug).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function addClientCartItem(restaurantSlug: string, item: ClientCartItem) {
  const items = readStorage(restaurantSlug);
  const index = items.findIndex((entry) => entry.menuItemId === item.menuItemId && entry.note === item.note);

  if (index === -1) {
    items.push({
      ...item,
      quantity: item.quantity > 0 ? Math.floor(item.quantity) : 1,
    });
  } else {
    items[index] = {
      ...items[index],
      quantity: items[index].quantity + (item.quantity > 0 ? Math.floor(item.quantity) : 1),
    };
  }

  writeStorage(restaurantSlug, items);
  emitCartChange(restaurantSlug);
  return items;
}

export function updateClientCartItemQuantity(restaurantSlug: string, menuItemId: string, quantity: number) {
  const items = readStorage(restaurantSlug).flatMap((item) => {
    if (item.menuItemId !== menuItemId) {
      return [item];
    }

    if (quantity <= 0) {
      return [];
    }

    return [{ ...item, quantity: Math.floor(quantity) }];
  });

  writeStorage(restaurantSlug, items);
  emitCartChange(restaurantSlug);
  return items;
}

export function removeClientCartItem(restaurantSlug: string, menuItemId: string) {
  const items = readStorage(restaurantSlug).filter((item) => item.menuItemId !== menuItemId);
  writeStorage(restaurantSlug, items);
  emitCartChange(restaurantSlug);
  return items;
}

export function clearClientCart(restaurantSlug: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey(restaurantSlug));
  emitCartChange(restaurantSlug);
}
