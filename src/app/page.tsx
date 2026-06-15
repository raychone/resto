import Link from "next/link";
import { listRestaurants } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

function SectionCard({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.75rem] border border-white/10 bg-[#171717] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#1c1c1c]"
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">{label}</p>
      <h3 className="mt-2 text-xl font-semibold text-[#f5f1ea]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
      <span className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition group-hover:bg-white/10">
        Ouvrir
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.slug === "bar-1") ?? restaurants[0];

  const roleCards = [
    {
      title: "Client",
      text: "Scanner le QR, consulter le menu, remplir le panier, se connecter ou créer un compte, puis confirmer la commande.",
      href: "/client",
      label: "Compte client",
    },
    {
      title: "Staff",
      text: "Valider les commandes client, gérer les réservations, servir les tables et encaisser.",
      href: "/staff",
      label: "Service",
    },
    {
      title: "Kitchen",
      text: "Voir les commandes validées, commencer la préparation et signaler quand c’est prêt.",
      href: "/kitchen",
      label: "Cuisine",
    },
    {
      title: "Manager",
      text: "Gérer le menu, les prix, les horaires, les modules et l’audit du restaurant.",
      href: "/dashboard",
      label: "Manager",
    },
    {
      title: "Owner",
      text: "Voir tous les restaurants, les plans, la facturation et les notifications.",
      href: "/owner",
      label: "Owner",
    },
  ];

  const testLinks = [
    { label: "Menu Noir 1", href: `/r/${restaurant?.slug ?? "bar-1"}?lang=fr` },
    { label: "QR Noir 1", href: `/qr/${restaurant?.slug ?? "bar-1"}` },
    { label: "Client signup", href: "/client/signup" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Staff", href: "/staff" },
    { label: "Kitchen", href: "/kitchen" },
    { label: "Client", href: "/client" },
    { label: "Owner", href: "/owner" },
  ];

  return (
    <main className="min-h-screen w-full bg-[#0f0f0f] text-[#f5f1ea]">
      <section className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(120,92,255,0.14),_transparent_28%),linear-gradient(180deg,_#151515_0%,_#0f0f0f_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.4)]">
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-white/55">
                <img
                  src={restaurant?.logoUrl || "/logo.png"}
                  alt="Logo"
                  className="h-7 w-7 rounded-lg object-cover"
                />
                <span>Noir 1 demo</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-display max-w-4xl text-5xl leading-none sm:text-6xl lg:text-7xl">
                  Plateforme SaaS pour restaurants, bars et service en salle.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                  Démo active sur <span className="font-semibold text-white">Noir 1</span> :
                  menu QR, commandes, validation serveur, cuisine, réservations, loyalty,
                  dashboard manager et owner global.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/r/${restaurant?.slug ?? "bar-1"}?lang=fr`}
                  className="rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-medium text-black"
                >
                  Ouvrir le menu demo
                </Link>
                <Link
                  href="/client/signup"
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white"
                >
                  Créer un compte client
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white"
                >
                  Tester le dashboard
                </Link>
                <Link
                  href="/staff"
                  className="rounded-full border border-white/10 bg-black px-5 py-3 text-sm font-medium text-white"
                >
                  Tester le staff
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Scannable QR",
                    text: "QR direct vers le menu du restaurant.",
                  },
                  {
                    title: "Service réel",
                    text: "Commande → validation serveur → cuisine → service.",
                  },
                  {
                    title: "Multi-roles",
                    text: "Client, staff, kitchen, manager, owner.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Restaurant démo</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#f5f1ea]">{restaurant?.name ?? "Noir 1"}</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">{restaurant?.tagline}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">QR</p>
                    <p className="mt-1 text-sm text-white/80">Menu direct pour mobile</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">Modules</p>
                    <p className="mt-1 text-sm text-white/80">Booking, delivery, reviews</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {testLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-[#202020]"
                  >
                    <span>{link.label}</span>
                    <span className="text-white/40">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-3 pb-8 sm:px-4 lg:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {roleCards.map((card) => (
            <SectionCard key={card.title} {...card} />
          ))}
        </div>
      </section>
    </main>
  );
}
