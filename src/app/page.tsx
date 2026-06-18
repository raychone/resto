import Link from "next/link";
import { listRestaurants } from "@/lib/restaurant-store";

export const dynamic = "force-dynamic";

function switchDemoHref(target: string) {
  return `/api/demo-switch?to=${encodeURIComponent(target)}`;
}

function FlowStrip() {
  const flow = [
    { title: "Client", note: "Commande QR" },
    { title: "Waiter", note: "Validation serveur" },
    { title: "Kitchen", note: "Préparation" },
    { title: "Client", note: "Service à table" },
  ];

  return (
    <div className="rounded-[1.75rem] border border-[#eadfce] bg-[#fcf8f2] p-4 shadow-[0_12px_35px_rgba(36,23,15,0.05)]">
      <div className="flex flex-wrap items-center gap-3">
        {flow.map((step, index) => (
          <div key={`${step.title}-${step.note}`} className="flex items-center gap-3">
            <div className="min-w-[5.75rem] rounded-full border border-[#eadfce] bg-white px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#a38d7c]">{step.title}</p>
              <p className="mt-1 text-sm font-semibold text-[#24170f]">{step.note}</p>
            </div>
            {index < flow.length - 1 ? (
              <span className="text-lg font-semibold text-[#c41e1e]">→</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoActions({
  menuHref,
  qrHref,
}: {
  menuHref: string;
  qrHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={menuHref}
        className="rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#aa1818]"
      >
        Menu
      </Link>
      <Link
        href={qrHref}
        className="rounded-full border border-[#e7ddd0] bg-white px-4 py-2.5 text-sm font-semibold text-[#24170f] transition hover:bg-[#faf7f2]"
      >
        QR
      </Link>
    </div>
  );
}

function RoleDropdown({
  title,
  description,
  roles,
}: {
  title: string;
  description: string;
  roles: Array<{
    label: string;
    href: string;
    note: string;
  }>;
}) {
  return (
    <details className="group rounded-[1.4rem] border border-[#eadfce] bg-[#fffdf8] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[#6f5b4a]">{description}</p>
        </div>
        <span className="rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-semibold text-[#24170f] transition group-open:bg-[#faf7f2]">
          Rôles
        </span>
      </summary>

      <div className="mt-4 grid gap-2">
        {roles.map((role) => (
          <Link
            key={role.label}
            href={role.href}
            className="rounded-[1.1rem] border border-[#eadfce] bg-white px-4 py-3 transition hover:border-[#d8c7b6] hover:bg-[#faf7f2]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#24170f]">{role.label}</p>
                <p className="mt-1 text-xs text-[#7f6c5a]">{role.note}</p>
              </div>
              <span className="text-[#c41e1e]">→</span>
            </div>
          </Link>
        ))}
      </div>
    </details>
  );
}

function DemoCard({
  name,
  slug,
  tagline,
  accent,
  logo,
  menuHref,
  qrHref,
  roles,
}: {
  name: string;
  slug: string;
  tagline: string;
  accent: string;
  logo: string;
  menuHref: string;
  qrHref: string;
  roles: Array<{
    label: string;
    href: string;
    note: string;
  }>;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] shadow-[0_18px_60px_rgba(36,23,15,0.08)]">
      <div className="border-b border-[#eadfce] bg-gradient-to-br from-white to-[#fbf6ef] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt={name}
              className="h-12 w-12 rounded-2xl border border-[#eadfce] bg-white object-cover"
            />
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]">
                {slug}
              </p>
              <h2 className="mt-1 text-3xl font-semibold text-[#24170f]">{name}</h2>
            </div>
          </div>
          <span
            className="rounded-full border border-[#eadfce] px-3 py-2 text-xs font-semibold text-[#7f6c5a]"
            style={{ backgroundColor: `${accent}12` }}
          >
            Demo
          </span>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5b4a]">{tagline}</p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <DemoActions menuHref={menuHref} qrHref={qrHref} />
        <RoleDropdown
          title="Accès rapide"
          description="Ouvre directement le bon écran selon le restaurant."
          roles={roles}
        />
      </div>
    </article>
  );
}

export default async function HomePage() {
  const restaurants = await listRestaurants();
  const noir1 = restaurants.find((entry) => entry.slug === "bar-1") ?? restaurants[0];
  const food1 = restaurants.find((entry) => entry.slug === "food-1") ?? null;

  const noirMenuHref = `/r/${noir1?.slug ?? "bar-1"}?lang=fr`;
  const foodMenuHref = `/r/${food1?.slug ?? "food-1"}?lang=fr`;

  const noirRoles = [
    { label: "Client", href: switchDemoHref("/client"), note: "Client noir 1" },
    { label: "Staff", href: switchDemoHref("/staff"), note: "Service noir 1" },
    { label: "Kitchen", href: switchDemoHref("/kitchen"), note: "Cuisine noir 1" },
    { label: "Manager", href: switchDemoHref("/dashboard"), note: "Manager noir 1" },
  ];

  const foodRoles = [
    { label: "Client", href: switchDemoHref("/client?restaurantSlug=food-1"), note: "Client Food 1" },
    { label: "Staff", href: switchDemoHref("/staff?restaurantSlug=food-1"), note: "Service Food 1" },
    { label: "Kitchen", href: switchDemoHref("/kitchen?restaurantSlug=food-1"), note: "Cuisine Food 1" },
    { label: "Manager", href: switchDemoHref("/dashboard?restaurant=food-1"), note: "Manager Food 1" },
  ];

  return (
    <main className="min-h-screen w-full bg-[#f6efe6] text-[#24170f]">
      <section className="mx-auto max-w-[1200px] px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <div className="rounded-[2.5rem] border border-[#e8ddcf] bg-[#fffdf8] p-5 shadow-[0_20px_70px_rgba(36,23,15,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.36em] text-[#a38d7c]">
                App pour restaurants et bars
              </p>
              <h1 className="font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
                Menus QR, commandes, réservations et service.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#6f5b4a] sm:text-base">
                Choisis un restaurant demo, ouvre son menu ou scanne son QR, puis entre dans le bon
                rôle. Noir 1 reste le bar, Food 1 reste le restaurant food-first.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] px-4 py-3 text-sm text-[#6f5b4a]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfce] bg-white text-xl">
                🍽️
              </span>
              <span className="leading-6">
                App directe
                <br />
                QR, menu, rôles
              </span>
            </div>
          </div>
          <div className="mt-5">
            <FlowStrip />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-4 px-3 pb-6 sm:px-4 lg:grid-cols-2 lg:px-6">
        <DemoCard
          name={noir1?.name ?? "Noir 1"}
          slug={noir1?.slug ?? "bar-1"}
          tagline={noir1?.tagline ?? "Bar mobile-first avec happy hour."}
          accent={noir1?.accent ?? "#7C3AED"}
          logo={noir1?.logoUrl || "/logoNoirBar.png"}
          menuHref={noirMenuHref}
          qrHref={`/qr/${noir1?.slug ?? "bar-1"}`}
          roles={noirRoles}
        />
        <DemoCard
          name={food1?.name ?? "Food 1"}
          slug={food1?.slug ?? "food-1"}
          tagline={food1?.tagline ?? "Italian casual food, light theme."}
          accent={food1?.accent ?? "#c41e1e"}
          logo={food1?.logoUrl || "/logoFood.png"}
          menuHref={foodMenuHref}
          qrHref={`/qr/${food1?.slug ?? "food-1"}`}
          roles={foodRoles}
        />
      </section>
    </main>
  );
}
