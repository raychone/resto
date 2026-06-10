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
  imageUrl: string;
  isSignature: boolean;
};

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

export type Restaurant = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  logoUrl: string;
  heroImage: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  googleRating: number;
  googleReviewsCount: number;
  googleReviewsUrl: string;
  openingHours: string;
  tableCount: number;
  seatsPerTable: number;
  weeklyHours: WeeklyHour[];
  currency: string;
  categories: MenuCategory[];
  translations?: RestaurantTranslations;
};

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export type Reservation = {
  id: string;
  restaurantSlug: string;
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
};

export type RestaurantMessage = {
  id: string;
  restaurantSlug: string;
  locale: Locale;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: "new" | "read";
  createdAt: string;
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

export function createBlankRestaurant(): Restaurant {
  return {
    slug: `restaurant-${createId("draft").slice(-4)}`,
    name: "Nouveau restaurant",
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
    googleRating: 4.8,
    googleReviewsCount: 128,
    googleReviewsUrl: "",
    openingHours: "Lundi - Dimanche, 12:00 - 23:00",
    tableCount: 12,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    currency: "EUR",
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

  return {
    ...restaurant,
    slug,
    name: restaurant.name.trim() || "Restaurant",
    tagline: restaurant.tagline.trim(),
    description: restaurant.description.trim(),
    accent: restaurant.accent || "#8B5CF6",
    logoUrl: (restaurant.logoUrl ?? "").trim(),
    heroImage: restaurant.heroImage.trim(),
    address: restaurant.address.trim(),
    phone: restaurant.phone.trim(),
    whatsappNumber: (restaurant.whatsappNumber ?? restaurant.phone ?? "").trim(),
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
    currency: "EUR",
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
