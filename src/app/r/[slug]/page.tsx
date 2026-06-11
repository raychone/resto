import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listRestaurants } from "@/lib/restaurant-store";
import { locales, translateRestaurant, type Locale } from "@/lib/types";
import { PublicMenu } from "@/components/public-menu";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query, restaurants] = await Promise.all([
    params,
    searchParams,
    listRestaurants(),
  ]);
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    return { title: "Menu indisponible" };
  }

  const locale = resolveLocale(query.lang);
  const localizedRestaurant = translateRestaurant(restaurant, locale);

  return {
    title: `${localizedRestaurant.name} | Menu digital`,
    description: localizedRestaurant.description,
    alternates: {
      canonical: `/r/${restaurant.slug}?lang=${locale}`,
    },
    openGraph: {
      title: `${localizedRestaurant.name} | Menu digital`,
      description: localizedRestaurant.description,
      url: `/r/${restaurant.slug}?lang=${locale}`,
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RestaurantMenuPage({ params, searchParams }: Props) {
  const [{ slug }, query, restaurants] = await Promise.all([
    params,
    searchParams,
    listRestaurants(),
  ]);
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    notFound();
  }

  const locale = resolveLocale(query.lang);
  const localizedRestaurant = translateRestaurant(restaurant, locale);

  return <PublicMenu restaurant={localizedRestaurant} locale={locale} />;
}
