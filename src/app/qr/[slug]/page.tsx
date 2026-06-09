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
  const publicUrl = `${origin}/r/${restaurant.slug}?lang=fr`;
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
            Ce code ouvre le menu en français par défaut. Depuis la page du menu,
            le client peut changer de langue vers l&apos;anglais, l&apos;italien ou
            l&apos;espagnol.
          </p>

          <div className="rounded-[1.75rem] border border-black/8 bg-black/3 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Destination
            </p>
            <p className="mt-2 break-all text-sm font-medium text-black/70">
              {publicUrl}
            </p>
          </div>

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
          <QrBlock value={publicUrl} />
          <p className="text-center text-sm text-black/55">
            Scannez avec votre téléphone pour ouvrir le menu.
          </p>
        </div>
      </section>
    </main>
  );
}
