import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { QrBlock } from "@/components/qr-block";
import { listRestaurants } from "@/lib/restaurant-store";
import { locales, translateRestaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

async function getOrigin() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    return { title: "QR indisponible" };
  }

  const localizedRestaurant = translateRestaurant(restaurant, "fr");

  return {
    title: `${localizedRestaurant.name} | QR menu`,
    description: `Code QR pour le menu public de ${localizedRestaurant.name}.`,
    alternates: {
      canonical: `/qr/${restaurant.slug}`,
    },
    openGraph: {
      title: `${localizedRestaurant.name} | QR menu`,
      description: `Code QR pour le menu public de ${localizedRestaurant.name}.`,
      url: `/qr/${restaurant.slug}`,
      type: "website",
    },
    robots: {
      index: true,
      follow: false,
    },
  };
}

export default async function QrPage({ params }: Props) {
  const { slug } = await params;
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    notFound();
  }

  const origin = await getOrigin();
  const publicUrl = restaurant.features.qrMode === "off" ? "" : `${origin}/r/${restaurant.slug}?lang=fr`;
  const displayRestaurant = translateRestaurant(restaurant, "fr");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-black/8 bg-white/85 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.1)] backdrop-blur lg:grid-cols-[1fr_320px] lg:p-8">
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
            QR dédié
          </p>
          <h1 className="font-display text-4xl leading-none sm:text-5xl">
            {displayRestaurant.name}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-black/70">
            {restaurant.features.qrMode === "off"
              ? "Le QR code est désactivé pour ce restaurant."
              : "Ce code ouvre directement le menu web du restaurant."}
          </p>

          <div className="flex flex-wrap gap-2">
            {locales.map((locale) => (
              <a
                key={locale}
                href={`/r/${restaurant.slug}?lang=${locale}`}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
              >
                {locale.toUpperCase()}
              </a>
            ))}
          </div>
        </div>

          <div className="flex flex-col items-center justify-center gap-4">
            {publicUrl ? <QrBlock value={publicUrl} logoUrl={restaurant.logoUrl} /> : null}
          </div>
        </section>
      </main>
  );
}
