export type Locale = "fr" | "en" | "it" | "es";

export const locales: Locale[] = ["fr", "en", "it", "es"];

export type ItemTranslation = {
  name?: string;
  description?: string;
  recipe?: string;
  ingredients?: string[];
  allergens?: string[];
};

export type CategoryTranslation = {
  name?: string;
  description?: string;
  items?: Record<string, ItemTranslation>;
};

export type RestaurantTranslations = Partial<Record<Exclude<Locale, "fr">, {
  name?: string;
  tagline?: string;
  description?: string;
  address?: string;
  categories?: Record<string, CategoryTranslation>;
}>>;

export type RestaurantStatus = "lead" | "trial" | "active" | "suspended" | "closed";

export type Plan = "starter" | "pro" | "premium";

export type WeeklyHour = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  label: string;
  intervals: {
    start: string;
    end: string;
  }[];
  closed: boolean;
};

export const weeklyDayLabels: Record<WeeklyHour["day"], string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

export function createDefaultWeeklyHours(): WeeklyHour[] {
  function day(defaultEnd: string): WeeklyHour {
    return {
      day: "mon",
      label: "",
      intervals: [
        { start: "12:00", end: defaultEnd },
        { start: "", end: "" },
      ],
      closed: false,
    };
  }

  return [
    {
      day: "mon",
      label: weeklyDayLabels.mon,
      intervals: [
        { start: "12:00", end: "23:00" },
        { start: "", end: "" },
      ],
      closed: false,
    },
    { ...day("23:00"), day: "tue", label: weeklyDayLabels.tue },
    { ...day("23:00"), day: "wed", label: weeklyDayLabels.wed },
    { ...day("23:00"), day: "thu", label: weeklyDayLabels.thu },
    { ...day("23:30"), day: "fri", label: weeklyDayLabels.fri },
    { ...day("23:30"), day: "sat", label: weeklyDayLabels.sat },
    { ...day("22:00"), day: "sun", label: weeklyDayLabels.sun },
  ];
}

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  recipe: string;
  ingredients: string[];
  allergens: string[];
  price: number;
  happyHourEnabled?: boolean;
  happyHourPrice?: number | null;
  imageUrl: string;
  isSignature: boolean;
};

export function getMenuItemEffectivePrice(item: MenuItem) {
  if (item.happyHourEnabled && Number.isFinite(item.happyHourPrice) && (item.happyHourPrice ?? 0) > 0) {
    return Number(item.happyHourPrice);
  }

  return Number(item.price);
}

const weeklyDayIndex: Record<WeeklyHour["day"], number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function parseMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function formatDuration(minutes: number) {
  const totalMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function getParisTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    day:
      {
        Mon: "mon",
        Tue: "tue",
        Wed: "wed",
        Thu: "thu",
        Fri: "fri",
        Sat: "sat",
        Sun: "sun",
      }[weekday] ?? "mon",
    minutes: hour * 60 + minute,
  } as { day: WeeklyHour["day"]; minutes: number };
}

function getParisDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return {
    year,
    month,
    day,
    dayKey:
      {
        Mon: "mon",
        Tue: "tue",
        Wed: "wed",
        Thu: "thu",
        Fri: "fri",
        Sat: "sat",
        Sun: "sun",
      }[weekday] ?? "mon",
    minutes: hour * 60 + minute,
  } as { year: number; month: number; day: number; dayKey: WeeklyHour["day"]; minutes: number };
}

function buildParisDateTime(year: number, month: number, day: number, timeValue: string) {
  const [hour, minute] = timeValue.split(":").map((part) => Number(part));
  let utc = Date.UTC(year, month - 1, day, hour, minute);

  for (let index = 0; index < 4; index += 1) {
    const actual = getParisDateParts(new Date(utc));
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, Math.floor(actual.minutes / 60), actual.minutes % 60);
    const expectedAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    const delta = expectedAsUtc - actualAsUtc;
    if (delta === 0) {
      break;
    }

    utc += delta;
  }

  return new Date(utc);
}

export function getHappyHourStatus(restaurant: Restaurant, now = new Date()) {
  const schedule = restaurant.happyHourSchedule;
  if (!schedule?.enabled || !schedule.days.length || !schedule.start || !schedule.end) {
    return null;
  }

  const current = getParisTimeParts(now);
  const currentDate = getParisDateParts(now);
  const startMinutes = parseMinutes(schedule.start);
  const endMinutes = parseMinutes(schedule.end);

  const activeNow =
    schedule.days.includes(current.day) &&
    current.minutes >= startMinutes &&
    current.minutes < endMinutes;

  if (activeNow) {
    const targetAt = buildParisDateTime(currentDate.year, currentDate.month, currentDate.day, schedule.end);
    return {
      active: true,
      label: schedule.label || "Happy Hour",
      message: `Open jusqu'à ${schedule.end}`,
      targetAt: targetAt.toISOString(),
    };
  }

  let nextDeltaMinutes = Number.POSITIVE_INFINITY;
  let nextTarget: Date | null = null;
  for (const day of schedule.days) {
    const dayIndex = weeklyDayIndex[day];
    let deltaDays = (dayIndex - weeklyDayIndex[current.day] + 7) % 7;
    let deltaMinutes = deltaDays * 1440 + (startMinutes - current.minutes);

    if (deltaMinutes <= 0) {
      deltaDays += 7;
      deltaMinutes += 7 * 1440;
    }

    if (deltaMinutes < nextDeltaMinutes) {
      nextDeltaMinutes = deltaMinutes;
      nextTarget = buildParisDateTime(
        currentDate.year,
        currentDate.month,
        currentDate.day + deltaDays,
        schedule.start,
      );
    }
  }

  return {
    active: false,
    label: schedule.label || "Happy Hour",
    message: `Starts in ${formatDuration(nextDeltaMinutes)}`,
    targetAt: nextTarget?.toISOString() ?? buildParisDateTime(
      currentDate.year,
      currentDate.month,
      currentDate.day,
      schedule.start,
    ).toISOString(),
  };
}

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
};

export type RestaurantBookingSettings = {
  tableCount: number;
  seatsPerTable: number;
};

export type RestaurantQrMode = "pdf" | "menu" | "off";
export type NotificationProvider = "android" | "twilio" | "whatsapp_business" | "off";

export type RestaurantFeatures = {
  orderFlowEnabled: boolean;
  clientLoginEnabled: boolean;
  waiterValidationEnabled: boolean;
  kitchenWorkflowEnabled: boolean;
  servedConfirmationEnabled: boolean;
  bookingEnabled: boolean;
  qrMode: RestaurantQrMode;
  notificationProvider: NotificationProvider;
  whatsappAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  googleReviewsEnabled: boolean;
};

export type HappyHourSchedule = {
  enabled: boolean;
  label: string;
  days: WeeklyHour["day"][];
  start: string;
  end: string;
};

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  status: RestaurantStatus;
  plan: Plan;
  tagline: string;
  description: string;
  accent: string;
  logoUrl: string;
  heroImage: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  uberEatsUrl: string;
  tripAdvisorUrl: string;
  googleRating: number;
  googleReviewsCount: number;
  googleReviewsUrl: string;
  openingHours: string;
  tableCount: number;
  seatsPerTable: number;
  weeklyHours: WeeklyHour[];
  happyHourSchedule?: HappyHourSchedule | null;
  features: RestaurantFeatures;
  currency: string;
  categories: MenuCategory[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  translations?: RestaurantTranslations;
};

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "no_show";

export type Reservation = {
  id: string;
  restaurantSlug: string;
  restaurantId?: string;
  locale: Locale;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  date: string;
  time: string;
  guestCount: number;
  tablesNeeded: number;
  status: ReservationStatus;
  createdAt: string;
  confirmedAt?: string;
  confirmedMessage?: string;
  deletedAt?: string | null;
};

export type RestaurantMessage = {
  id: string;
  restaurantSlug: string;
  restaurantId?: string;
  tableId?: string | null;
  tableLabel?: string | null;
  locale: Locale;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: "new" | "read";
  createdAt: string;
  deletedAt?: string | null;
};

export type TableZone = "salle" | "terrasse" | "bar" | "private";

export type Table = {
  id: string;
  restaurantId: string;
  name: string;
  zone: TableZone;
  seats: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type OrderSource = "table" | "takeaway" | "phone" | "qr";
export type OrderStatus =
  | "open"
  | "sent_to_kitchen"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "cancelled"
  | "archived";
export type PaymentMethod = "cash" | "card" | "external" | "other";
export type PaymentStatus = "pending" | "completed" | "cancelled";

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  note: string;
  assignedClientId?: string | null;
  assignedClientName?: string | null;
  createdAt: string;
  deletedAt?: string | null;
};

export type Order = {
  id: string;
  restaurantId: string;
  tableId?: string | null;
  tableSessionId?: string | null;
  staffUserId?: string | null;
  source: OrderSource;
  status: OrderStatus;
  openedAt: string;
  closedAt?: string | null;
  archivedAt?: string | null;
  note: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type Payment = {
  id: string;
  orderId: string;
  restaurantId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export type CustomerStatus = "active" | "disabled";

export type Customer = {
  id: string;
  restaurantId: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  currentPoints: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type TableSessionStatus = "open" | "closed" | "archived";

export type TableSessionParticipant = {
  id: string;
  customerId?: string | null;
  name: string;
  sharePercent: number;
  settledAmount: number;
  note?: string;
};

export type TableSession = {
  id: string;
  restaurantId: string;
  tableId: string | null;
  orderId: string | null;
  status: TableSessionStatus;
  guestCount: number;
  estimatedTotal: number;
  paidTotal: number;
  note: string;
  participants: TableSessionParticipant[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  deletedAt?: string | null;
};

export type UserRole = "owner" | "manager" | "staff" | "kitchen" | "client";
export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  restaurantId: string | null;
  role: UserRole;
  name: string;
  username: string;
  passwordHash: string;
  temporaryPassword?: string;
  mustChangePassword: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  pinEnabled?: boolean;
  pinHash?: string;
};

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generateUuid() {
  return globalThis.crypto?.randomUUID?.() ?? createId("uuid");
}

export function createBlankRestaurant(): Restaurant {
  return {
    id: generateUuid(),
    slug: `restaurant-${createId("draft").slice(-4)}`,
    name: "Nouveau restaurant",
    status: "trial",
    plan: "starter",
    tagline: "Modifiable depuis le tableau de bord",
    description:
      "Une courte description de la marque du restaurant, adaptée au menu et à l'ambiance.",
    accent: "#8B5CF6",
    logoUrl: "",
    heroImage:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
    address: "12 Rue Exemple, Paris",
    phone: "+33 1 00 00 00 00",
    whatsappNumber: "+33 1 00 00 00 00",
    uberEatsUrl: "",
    tripAdvisorUrl: "",
    googleRating: 4.8,
    googleReviewsCount: 128,
    googleReviewsUrl: "",
    openingHours: "Lundi - Dimanche, 12:00 - 23:00",
    tableCount: 12,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    happyHourSchedule: null,
    features: {
      orderFlowEnabled: true,
      clientLoginEnabled: true,
      waiterValidationEnabled: true,
      kitchenWorkflowEnabled: true,
      servedConfirmationEnabled: true,
      bookingEnabled: true,
      qrMode: "pdf",
      notificationProvider: "android",
      whatsappAlertsEnabled: true,
      smsAlertsEnabled: false,
      googleReviewsEnabled: true,
    },
    currency: "EUR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    categories: [
      {
        id: createId("category"),
        name: "Signature",
        description: "Les plats principaux de la maison.",
        items: [
          {
            id: createId("item"),
            name: "Nom du plat",
            description: "Description du plat.",
            recipe: "Une courte note de préparation ou l'histoire du plat.",
            ingredients: ["ingredient 1", "ingredient 2", "ingredient 3"],
            allergens: ["gluten"],
            price: 42,
            happyHourEnabled: false,
            happyHourPrice: null,
            imageUrl:
              "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
            isSignature: true,
          },
        ],
      },
    ],
  };
}

export function normalizeRestaurant(restaurant: Restaurant): Restaurant {
  function normalizeIntervals(
    intervals?: { start: string; end: string }[],
    fallback?: { open?: string; close?: string } | null,
  ): { start: string; end: string }[] {
    const cleaned = (intervals ?? [])
      .map((interval) => ({
        start: interval.start?.trim() || "",
        end: interval.end?.trim() || "",
      }))
      .filter((interval) => interval.start && interval.end);

    if (cleaned.length === 0 && fallback?.open && fallback?.close) {
      cleaned.push({
        start: fallback.open.trim(),
        end: fallback.close.trim(),
      });
    }

    while (cleaned.length < 2) {
      cleaned.push({ start: "", end: "" });
    }

    return cleaned.slice(0, 2);
  }

  const slug = slugify(restaurant.slug || restaurant.name) || createId("restaurant");
  const now = new Date().toISOString();

  return {
    ...restaurant,
    id: restaurant.id?.trim() || generateUuid(),
    slug,
    name: restaurant.name.trim() || "Restaurant",
    status:
      restaurant.status === "lead" ||
      restaurant.status === "trial" ||
      restaurant.status === "active" ||
      restaurant.status === "suspended" ||
      restaurant.status === "closed"
        ? restaurant.status
        : "trial",
    plan:
      restaurant.plan === "starter" ||
      restaurant.plan === "pro" ||
      restaurant.plan === "premium"
        ? restaurant.plan
        : "starter",
    tagline: restaurant.tagline.trim(),
    description: restaurant.description.trim(),
    accent: restaurant.accent || "#8B5CF6",
    logoUrl: (restaurant.logoUrl ?? "").trim(),
    heroImage: restaurant.heroImage.trim(),
    address: restaurant.address.trim(),
    phone: restaurant.phone.trim(),
    whatsappNumber: (restaurant.whatsappNumber ?? restaurant.phone ?? "").trim(),
    uberEatsUrl: (restaurant.uberEatsUrl ?? "").trim(),
    tripAdvisorUrl: (restaurant.tripAdvisorUrl ?? "").trim(),
    googleRating:
      Number.isFinite(restaurant.googleRating) && restaurant.googleRating > 0
        ? Math.round(restaurant.googleRating * 10) / 10
        : 4.8,
    googleReviewsCount:
      Number.isFinite(restaurant.googleReviewsCount) && restaurant.googleReviewsCount >= 0
        ? Math.floor(restaurant.googleReviewsCount)
        : 0,
    googleReviewsUrl: (restaurant.googleReviewsUrl ?? "").trim(),
    openingHours: restaurant.openingHours.trim(),
    tableCount: Number.isFinite(restaurant.tableCount) && restaurant.tableCount > 0
      ? Math.floor(restaurant.tableCount)
      : 12,
    seatsPerTable:
      Number.isFinite(restaurant.seatsPerTable) && restaurant.seatsPerTable > 0
        ? Math.floor(restaurant.seatsPerTable)
        : 4,
    weeklyHours:
      restaurant.weeklyHours?.length > 0
        ? restaurant.weeklyHours.map((entry) => ({
            ...entry,
            label: weeklyDayLabels[entry.day],
            intervals: normalizeIntervals(
              entry.intervals,
              entry as unknown as { open?: string; close?: string },
            ),
            closed: Boolean(entry.closed),
          }))
        : createDefaultWeeklyHours(),
    happyHourSchedule:
      restaurant.happyHourSchedule?.enabled &&
      Array.isArray(restaurant.happyHourSchedule.days) &&
      restaurant.happyHourSchedule.days.length > 0
        ? {
            enabled: true,
            label: restaurant.happyHourSchedule.label?.trim() || "Happy Hour",
            days: restaurant.happyHourSchedule.days.filter((day) =>
              ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day),
            ) as WeeklyHour["day"][],
            start: restaurant.happyHourSchedule.start?.trim() || "18:30",
            end: restaurant.happyHourSchedule.end?.trim() || "20:30",
          }
        : null,
    features: {
      orderFlowEnabled: restaurant.features?.orderFlowEnabled ?? true,
      clientLoginEnabled: restaurant.features?.clientLoginEnabled ?? true,
      waiterValidationEnabled: restaurant.features?.waiterValidationEnabled ?? true,
      kitchenWorkflowEnabled: restaurant.features?.kitchenWorkflowEnabled ?? true,
      servedConfirmationEnabled: restaurant.features?.servedConfirmationEnabled ?? true,
      bookingEnabled: restaurant.features?.bookingEnabled ?? true,
      qrMode:
        restaurant.features?.qrMode === "menu" || restaurant.features?.qrMode === "off"
          ? restaurant.features.qrMode
          : "pdf",
      notificationProvider:
        restaurant.features?.notificationProvider === "twilio" ||
        restaurant.features?.notificationProvider === "whatsapp_business" ||
        restaurant.features?.notificationProvider === "off"
          ? restaurant.features.notificationProvider
          : "android",
      whatsappAlertsEnabled: restaurant.features?.whatsappAlertsEnabled ?? true,
      smsAlertsEnabled: restaurant.features?.smsAlertsEnabled ?? false,
      googleReviewsEnabled: restaurant.features?.googleReviewsEnabled ?? true,
    },
    currency: "EUR",
    createdAt: restaurant.createdAt ?? now,
    updatedAt: restaurant.updatedAt ?? restaurant.createdAt ?? now,
    deletedAt: restaurant.deletedAt ?? null,
    categories: restaurant.categories.map((category) => ({
      ...category,
      id: category.id || createId("category"),
      name: category.name.trim() || "Catégorie",
      description: category.description.trim(),
      items: category.items.map((item) => ({
        ...item,
        id: item.id || createId("item"),
        name: item.name.trim() || "Plat",
        description: item.description.trim(),
        recipe: item.recipe.trim(),
        ingredients: item.ingredients.map((ingredient) => ingredient.trim()).filter(Boolean),
        allergens: item.allergens.map((allergen) => allergen.trim()).filter(Boolean),
        price: Number.isFinite(item.price) ? item.price : 0,
        happyHourEnabled: Boolean(item.happyHourEnabled),
        happyHourPrice:
          Number.isFinite(item.happyHourPrice) && Number(item.happyHourPrice) > 0
            ? Number(item.happyHourPrice)
            : null,
        imageUrl: item.imageUrl.trim(),
        isSignature: Boolean(item.isSignature),
      })),
    })),
    translations: restaurant.translations ?? {},
  };
}

function mergeLocalizedString(base: string, localized?: string) {
  return localized?.trim() || base;
}

export function translateRestaurant(
  restaurant: Restaurant,
  locale: Locale,
): Restaurant {
  if (locale === "fr") {
    return restaurant;
  }

  const translations = restaurant.translations?.[locale];

  return {
    ...restaurant,
    name: mergeLocalizedString(restaurant.name, translations?.name),
    tagline: mergeLocalizedString(restaurant.tagline, translations?.tagline),
    description: mergeLocalizedString(restaurant.description, translations?.description),
    address: mergeLocalizedString(restaurant.address, translations?.address),
    categories: restaurant.categories.map((category) => {
      const categoryTranslations = translations?.categories?.[category.id];

      return {
        ...category,
        name: mergeLocalizedString(category.name, categoryTranslations?.name),
        description: mergeLocalizedString(
          category.description,
          categoryTranslations?.description,
        ),
        items: category.items.map((item) => {
          const itemTranslations = categoryTranslations?.items?.[item.id];

          return {
            ...item,
            name: mergeLocalizedString(item.name, itemTranslations?.name),
            description: mergeLocalizedString(
              item.description,
              itemTranslations?.description,
            ),
            recipe: mergeLocalizedString(item.recipe, itemTranslations?.recipe),
            ingredients: itemTranslations?.ingredients?.length
              ? itemTranslations.ingredients
              : item.ingredients,
            allergens: itemTranslations?.allergens?.length
              ? itemTranslations.allergens
              : item.allergens,
          };
        }),
      };
    }),
  };
}
