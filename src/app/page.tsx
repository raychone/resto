import Link from "next/link";
import { listRestaurants } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

function switchDemoHref(target: string) {
  return `/api/demo-switch?to=${encodeURIComponent(target)}`;
}

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

function RoleAccordion({
  role,
  description,
  href,
  accounts,
}: {
  role: string;
  description: string;
  href: string;
  accounts: Array<{ username: string; password: string; label?: string; href?: string }>;
}) {
  return (
    <details className="group rounded-[1.5rem] border border-white/10 bg-black/20 p-4 open:bg-black/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">{role}</p>
          <h3 className="mt-2 text-xl font-semibold text-[#f5f1ea]">{accounts[0]?.username}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition group-open:bg-white/10">
          Voir les comptes
        </span>
      </summary>

      <p className="mt-3 text-sm leading-6 text-white/65">{description}</p>

      <div className="mt-4 grid gap-2">
        {accounts.map((account) => (
          <div
            key={`${role}-${account.username}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/70"
          >
            <Link
              href={account.href ?? href}
              className="group flex items-center justify-between gap-3 text-left transition hover:text-white"
            >
              <span className="font-medium text-white">{account.label ?? account.username}</span>
              <span className="text-white/45 transition group-hover:text-white">Ouvrir →</span>
            </Link>
            <div className="mt-2 grid gap-1 text-white/55">
              <div className="flex items-center justify-between gap-3">
                <span>Identifiant</span>
                <span className="font-medium text-white">{account.username}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Mot de passe</span>
                <span className="font-medium text-white">{account.password}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function HomePage() {
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.slug === "bar-1") ?? restaurants[0];
  const foodRestaurant = restaurants.find((entry) => entry.slug === "food-1") ?? null;

  const roleSeeds = [
    {
      role: "Client",
      href: "/client",
      description: "Ouvre le menu, le panier, le suivi et le split de note. Les clients démo sont liés à Noir 1.",
      accounts: [
        { username: "client", password: "client123!", label: "Client principal" },
        { username: "client2", password: "client2!", label: "Client 2" },
        { username: "client3", password: "client3!", label: "Client 3" },
        { username: "client4", password: "client4!", label: "Client 4" },
        { username: "client5", password: "client5!", label: "Client 5" },
        { username: "client6", password: "client6!", label: "Client 6" },
        { username: "client7", password: "client7!", label: "Client 7" },
        { username: "client8", password: "client8!", label: "Client 8" },
        { username: "client9", password: "client9!", label: "Client 9" },
        { username: "client10", password: "client10!", label: "Client 10" },
      ],
    },
    {
      role: "Staff",
      href: "/staff",
      description: "Tables, bon, alertes, service en salle et réglages de table.",
      accounts: [
        { username: "user", password: "pass123!", label: "Staff principal" },
        { username: "waiter2", password: "waiter2!", label: "Staff 2" },
        { username: "waiter3", password: "waiter3!", label: "Staff 3" },
      ],
    },
    {
      role: "Kitchen",
      href: "/kitchen",
      description: "File cuisine et statuts préparation / prêt / servi.",
      accounts: [{ username: "kitchen", password: "kitchen123!", label: "Kitchen" }],
    },
    {
      role: "Manager",
      href: "/dashboard",
      description: "Menu, branding, utilisateurs staff et audit du restaurant.",
      accounts: [{ username: "manager", password: "manager123!", label: "Manager" }],
    },
  ];

  const foodRoleSeeds = [
    {
      role: "Client",
      href: "/client?restaurantSlug=food-1",
      description: "Compte client lié à Food 1 pour tester menu, panier, commande et suivi live.",
      accounts: [
        {
          username: "foodclient",
          password: "client123!",
          label: "Food client principal",
          href: switchDemoHref("/client?restaurantSlug=food-1"),
        },
        {
          username: "foodclient2",
          password: "foodclient2!",
          label: "Food client 2",
          href: switchDemoHref("/client?restaurantSlug=food-1"),
        },
      ],
    },
    {
      role: "Staff",
      href: "/staff?restaurantSlug=food-1",
      description: "Validation, réservation et service dédiés à Food 1.",
      accounts: [
        {
          username: "foodstaff",
          password: "pass123!",
          label: "Food staff",
          href: switchDemoHref("/staff?restaurantSlug=food-1"),
        },
      ],
    },
    {
      role: "Kitchen",
      href: "/kitchen?restaurantSlug=food-1",
      description: "File cuisine Food 1, séparée de Noir 1.",
      accounts: [
        {
          username: "foodkitchen",
          password: "kitchen123!",
          label: "Food kitchen",
          href: switchDemoHref("/kitchen?restaurantSlug=food-1"),
        },
      ],
    },
    {
      role: "Manager",
      href: "/dashboard?restaurant=food-1",
      description: "Gestion du menu, du branding et de l’audit pour Food 1.",
      accounts: [
        {
          username: "foodmanager",
          password: "manager123!",
          label: "Food manager",
          href: switchDemoHref("/dashboard?restaurant=food-1"),
        },
      ],
    },
  ];

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
  ];

  const demoRestaurants = [
    {
      name: restaurant?.name ?? "Noir 1",
      slug: restaurant?.slug ?? "bar-1",
      tagline: restaurant?.tagline ?? "Bar mobile-first avec happy hour.",
      accent: restaurant?.accent ?? "#7C3AED",
      note: "Bar / dark theme / happy hour",
      route: `/r/${restaurant?.slug ?? "bar-1"}?lang=fr`,
      qrRoute: `/qr/${restaurant?.slug ?? "bar-1"}`,
      logo: restaurant?.logoUrl || "/bar-1-logo.svg",
    },
    {
      name: foodRestaurant?.name ?? "Food 1",
      slug: foodRestaurant?.slug ?? "food-1",
      tagline: foodRestaurant?.tagline ?? "Italian casual food, light theme.",
      accent: foodRestaurant?.accent ?? "#c41e1e",
      note: "Food-only / light theme / reservations",
      route: `/r/${foodRestaurant?.slug ?? "food-1"}?lang=fr`,
      qrRoute: `/qr/${foodRestaurant?.slug ?? "food-1"}`,
      logo: foodRestaurant?.logoUrl || "/food-1-logo.svg",
    },
  ];

  const testLinks = [
    { label: "Menu Noir 1", href: `/r/${restaurant?.slug ?? "bar-1"}?lang=fr` },
    { label: "QR Noir 1", href: `/qr/${restaurant?.slug ?? "bar-1"}` },
    { label: "Menu Food 1", href: `/r/${foodRestaurant?.slug ?? "food-1"}?lang=fr` },
    { label: "QR Food 1", href: `/qr/${foodRestaurant?.slug ?? "food-1"}` },
    { label: "Client signup", href: "/client/signup" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Staff", href: "/staff" },
    { label: "Kitchen", href: "/kitchen" },
    { label: "Client", href: "/client" },
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
                <span>Restaurant demos</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-display max-w-4xl text-5xl leading-none sm:text-6xl lg:text-7xl">
                  Plateforme SaaS pour restaurants, bars et service en salle.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                  Démo active sur <span className="font-semibold text-white">Noir 1</span> et{" "}
                  <span className="font-semibold text-white">Food 1</span> :
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

              <div className="grid gap-3 sm:grid-cols-2">
                {demoRestaurants.map((demoRestaurant) => (
                  <Link
                    key={demoRestaurant.slug}
                    href={demoRestaurant.route}
                    className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={demoRestaurant.logo}
                        alt={demoRestaurant.name}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
                          {demoRestaurant.note}
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold text-[#f5f1ea]">
                          {demoRestaurant.name}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/65">{demoRestaurant.tagline}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className="rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-white"
                        style={{ backgroundColor: `${demoRestaurant.accent}26` }}
                      >
                        Menu
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white">
                        QR
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white">
                        {demoRestaurant.slug}
                      </span>
                    </div>
                  </Link>
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

      <section className="mx-auto max-w-[1440px] px-3 pb-8 sm:px-4 lg:px-6">
        <div className="rounded-[2rem] border border-white/10 bg-[#151515] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Comptes de démo</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#f5f1ea]">Teste directement chaque rôle</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Les comptes ci-dessous couvrent <span className="font-semibold text-white">Noir 1</span>{" "}
                et <span className="font-semibold text-white">Food 1</span>. Tu peux ouvrir chaque écran
                directement depuis cette page, sans chercher les routes ailleurs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/r/${restaurant?.slug ?? "bar-1"}?lang=fr`}
                className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Ouvrir Noir 1
              </Link>
              <Link
                href="/client/signup"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white"
              >
                Signup client
              </Link>
            </div>
          </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {roleSeeds.map((entry) => (
              <RoleAccordion
                key={entry.role}
                role={entry.role}
                description={entry.description}
                href={entry.href}
                accounts={entry.accounts}
              />
            ))}
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Food 1 comptes</p>
            <h3 className="mt-2 text-xl font-semibold text-[#f5f1ea]">Démo séparée, thème clair</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {foodRoleSeeds.map((entry) => {
                const firstAccount = entry.accounts[0];
                const targetHref = firstAccount?.href ?? entry.href;

                return (
                  <Link
                    key={`${entry.role}-quick`}
                    href={targetHref}
                    className="rounded-[1.25rem] border border-white/10 bg-[#1d1d1d] px-4 py-4 transition hover:border-white/20 hover:bg-[#232323]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">{entry.role}</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {firstAccount?.label ?? firstAccount?.username}
                    </p>
                    <p className="mt-2 text-sm text-white/60">{firstAccount?.username}</p>
                    <p className="mt-1 text-sm text-white/40">Ouvrir Food 1 →</p>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {foodRoleSeeds.map((entry) => (
                <RoleAccordion
                  key={`food-${entry.role}`}
                  role={entry.role}
                  description={entry.description}
                  href={entry.href}
                  accounts={entry.accounts}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
