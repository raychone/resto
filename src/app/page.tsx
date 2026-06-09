import Link from "next/link";
import { listRestaurants } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

function cardGradient(accent: string) {
  return `radial-gradient(circle at top left, ${accent}33, transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))`;
}

export default async function HomePage() {
  const restaurants = await listRestaurants();
  const restaurant = restaurants[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/80 shadow-[0_30px_120px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="grid gap-10 p-5 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black/50">
              <img src="/logo.png" alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
              <span>Plateforme QR menu</span>
            </div>
            <div className="space-y-4">
              <h1 className="font-display max-w-3xl text-5xl leading-none sm:text-6xl lg:text-7xl">
                Menu digital pour restaurants, avec tableau de bord et QR par lieu.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-black/70 sm:text-lg">
                Une base unique pour plusieurs restaurants : tu modifies le contenu
                depuis le tableau de bord, tu publies le menu sur mobile et tu
                génères un QR séparé pour chaque adresse.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-medium text-white"
              >
                Ouvrir le tableau de bord
              </Link>
              <Link
                href="/staff"
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black"
              >
                Ouvrir la page staff
              </Link>
              <a
                href="#restaurants"
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black"
              >
                Voir les restaurants
              </a>
            </div>
          </div>

          <div className="grid gap-4 rounded-[2rem] border border-black/8 bg-black/3 p-4 sm:grid-cols-2">
            {[
              {
                title: "Tableau de bord",
                text: "Tu édites le contenu par restaurant.",
              },
              {
                title: "Menu public",
                text: "Une page mobile pensée pour le scan QR.",
              },
              {
                title: "Allergènes",
                text: "Affichés clairement sur chaque plat.",
              },
              {
                title: "QR dédié",
                text: "Un code par restaurant, sans ambiguïté.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-black/8 bg-white p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-black/70">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="restaurants" className="mt-8 space-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
            Restaurant actif
          </p>
          <h2 className="font-display text-3xl">Démonstration prête</h2>
        </div>

        {restaurant ? (
          <article className="overflow-hidden rounded-[2rem] border border-black/8 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Présentation</p>
                  <h3 className="text-lg font-semibold">{restaurant.name}</h3>
                </div>
              </div>
            </div>
            <div className="h-44" style={{ background: cardGradient(restaurant.accent) }}>
              <img
                src={restaurant.heroImage}
                alt={restaurant.name}
                className="h-full w-full object-cover mix-blend-multiply"
              />
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                  {restaurant.slug}
                </p>
                <h3 className="text-2xl font-semibold">{restaurant.name}</h3>
                <p className="text-sm leading-6 text-black/65">{restaurant.tagline}</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-black px-3 py-1.5 text-white">
                  {restaurant.categories.length} catégories
                </span>
                <span className="rounded-full border border-black/10 px-3 py-1.5 text-black/70">
                  QR dédié
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/r/${restaurant.slug}`}
                  className="rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Menu
                </Link>
                <Link
                  href={`/qr/${restaurant.slug}`}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  QR
                </Link>
                <Link
                  href={`/dashboard?restaurant=${restaurant.slug}`}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Édition
                </Link>
                <Link
                  href="/staff"
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Staff
                </Link>
              </div>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
