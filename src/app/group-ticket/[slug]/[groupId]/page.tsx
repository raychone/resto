import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardSessionUser, getOwnerSessionUser, getStaffSessionUser } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { listOrdersForRestaurant, listPaymentsForRestaurant } from "@/lib/order-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { getTableGroupById } from "@/lib/table-group-store";
import { listTableSessionsForRestaurant } from "@/lib/table-session-store";
import { listTablesForRestaurant } from "@/lib/table-store";
import { buildTableGroupSummary } from "@/lib/table-group-summary";
import { summarizeTaxBreakdown } from "@/lib/tax";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; groupId: string }>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function GroupTicketPage({ params }: PageProps) {
  const [{ slug, groupId }, manager, staff, owner] = await Promise.all([
    params,
    getDashboardSessionUser(),
    getStaffSessionUser(),
    getOwnerSessionUser(),
  ]);

  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const hasAccess =
    Boolean(owner) ||
    Boolean(manager && manager.restaurantId === restaurant.id) ||
    Boolean(staff && staff.restaurantId === restaurant.id);

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#edf3ff] px-4 py-8 text-[#24170f]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-8 shadow-[0_20px_60px_rgba(124,77,44,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]">Accès refusé</p>
          <h1 className="mt-3 text-4xl font-semibold">Ticket de groupe indisponible</h1>
          <p className="mt-4 text-lg text-[#6f5b4a]">
            Ouvre ce ticket depuis un compte staff, manager ou owner du restaurant.
          </p>
        </div>
      </main>
    );
  }

  const tableGroup = await getTableGroupById(groupId);
  if (!tableGroup || tableGroup.restaurantId !== restaurant.id || tableGroup.deletedAt) {
    notFound();
  }

  const [orders, payments, tableSessions, tables] = await Promise.all([
    listOrdersForRestaurant(restaurant.id),
    listPaymentsForRestaurant(restaurant.id),
    listTableSessionsForRestaurant(restaurant.id),
    listTablesForRestaurant(restaurant.id),
  ]);

  const summary = buildTableGroupSummary({
    tableGroup,
    orders,
    payments,
    tableSessions,
    tables,
  });

  const groupOrders = orders
    .filter(
      (order) =>
        !order.deletedAt &&
        tableGroup.tableIds.includes(order.tableId ?? "") &&
        (order.source === "table" || order.source === "qr"),
    )
    .sort((left, right) => left.openedAt.localeCompare(right.openedAt));

  const groupPayments = payments
    .filter(
      (payment) =>
        !payment.deletedAt &&
        payment.status === "completed" &&
        groupOrders.some((order) => order.id === payment.orderId),
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    <main className="min-h-screen bg-[#edf3ff] px-4 py-8 text-[#24170f] print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-6 shadow-[0_24px_70px_rgba(124,77,44,0.12)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eadfce] pb-4 print:hidden">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]">Règlement groupe</p>
            <h1 className="mt-2 text-4xl font-semibold">{tableGroup.name}</h1>
            <p className="mt-2 text-sm text-[#6f5b4a]">
              {restaurant.name} · Tables {summary.perTable.map((entry) => entry.label).join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <PrintButton
              className="rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-2 text-sm font-medium text-[#1f2b1f]"
            />
            <Link
              href={`/staff?restaurantSlug=${encodeURIComponent(restaurant.slug)}`}
              className="rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-medium text-[#24170f]"
            >
              Retour staff
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.25rem] border border-[#eadfce] bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Total groupe</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(summary.total, restaurant.currency)}</p>
          </div>
          <div className="rounded-[1.25rem] border border-[#eadfce] bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Déjà payé</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(summary.paid, restaurant.currency)}</p>
          </div>
          <div className="rounded-[1.25rem] border border-[#eadfce] bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Reste</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(summary.remaining, restaurant.currency)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Par table</p>
            <div className="mt-3 space-y-3">
              {summary.perTable.map((entry) => (
                <div key={entry.tableId} className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{entry.label}</p>
                    <p>{formatMoney(entry.total, restaurant.currency)}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[#6f5b4a]">
                    <span>Payé {formatMoney(entry.paid, restaurant.currency)}</span>
                    <span>Reste {formatMoney(entry.remaining, restaurant.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Par personne</p>
            <div className="mt-3 space-y-3">
              {summary.perParticipant.length === 0 ? (
                <div className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3 text-sm text-[#6f5b4a]">
                  Aucun participant lié à ce groupe.
                </div>
              ) : (
                summary.perParticipant.map((entry) => (
                  <div key={entry.key} className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{entry.name}</p>
                      <p>{formatMoney(entry.total, restaurant.currency)}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[#6f5b4a]">
                      <span>Payé {formatMoney(entry.paid, restaurant.currency)}</span>
                      <span>Reste {formatMoney(entry.remaining, restaurant.currency)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#6f5b4a]">
                      Tables: {entry.tables.join(" · ") || "Aucune"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Paiements enregistrés</p>
          <div className="mt-3 space-y-3">
            {groupPayments.length === 0 ? (
              <div className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3 text-sm text-[#6f5b4a]">
                Aucun paiement enregistré pour ce groupe.
              </div>
            ) : (
              groupPayments.map((payment) => {
                const order = groupOrders.find((entry) => entry.id === payment.orderId);
                const tableLabel = summary.perTable.find((entry) => entry.tableId === order?.tableId)?.label ?? order?.tableId ?? "Bon";
                return (
                  <div key={payment.id} className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{formatMoney(payment.amount, restaurant.currency)}</p>
                      <p className="text-xs text-[#6f5b4a]">{formatDateTime(payment.createdAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-[#6f5b4a]">
                      {tableLabel} · {payment.method}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#a38d7c]">Bons liés</p>
          <div className="mt-3 space-y-4">
            {groupOrders.map((order) => {
              const taxSummary = summarizeTaxBreakdown(order.items.filter((item) => !item.deletedAt));
              const tableLabel =
                summary.perTable.find((entry) => entry.tableId === order.tableId)?.label ?? order.tableId ?? "Bon";
              return (
                <article key={order.id} className="rounded-[1rem] border border-[#eadfce] bg-[#fffdf8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{tableLabel}</p>
                      <p className="text-xs text-[#6f5b4a]">{formatDateTime(order.openedAt)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMoney(taxSummary.total, restaurant.currency)}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {order.items.filter((item) => !item.deletedAt).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p>{item.quantity} × {item.nameSnapshot}</p>
                          <p className="text-xs text-[#6f5b4a]">{item.assignedClientName || item.note || "—"}</p>
                        </div>
                        <p>{formatMoney(item.priceSnapshot * item.quantity, restaurant.currency)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
