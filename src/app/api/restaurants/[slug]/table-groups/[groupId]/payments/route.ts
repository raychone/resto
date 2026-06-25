import { NextRequest, NextResponse } from "next/server";
import {
  getManagerUserFromRequest,
  getOwnerUserFromRequest,
  getStaffUserFromRequest,
} from "@/lib/auth";
import { createPayment, listOrdersForRestaurant, listPaymentsForRestaurant } from "@/lib/order-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { listTablesForRestaurant } from "@/lib/table-store";
import { getTableGroupById } from "@/lib/table-group-store";
import { listTableSessionsForRestaurant, updateTableSession } from "@/lib/table-session-store";
import { buildTableGroupSummary } from "@/lib/table-group-summary";
import { summarizeTaxBreakdown } from "@/lib/tax";
import type { Order, Payment, PaymentMethod, TableSession } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ slug: string; groupId: string }>;
};

async function canAccessRestaurant(request: NextRequest, restaurantId: string) {
  const owner = await getOwnerUserFromRequest(request);
  if (owner) return true;

  const manager = await getManagerUserFromRequest(request);
  if (manager && manager.restaurantId === restaurantId) return true;

  const staff = await getStaffUserFromRequest(request);
  return Boolean(staff && staff.restaurantId === restaurantId);
}

function orderTotal(order: Order) {
  return summarizeTaxBreakdown(order.items.filter((item) => !item.deletedAt)).total;
}

function completedPaidForOrder(payments: Payment[], orderId: string) {
  return payments
    .filter((payment) => payment.orderId === orderId && payment.status === "completed" && !payment.deletedAt)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function allocateAcrossWeights(totalAmount: number, entries: Array<{ key: string; weight: number }>) {
  const cents = Math.max(0, Math.round(totalAmount * 100));
  const normalized = entries.filter((entry) => entry.weight > 0);
  const result = new Map<string, number>();
  if (cents <= 0 || normalized.length === 0) {
    return result;
  }

  const totalWeight = normalized.reduce((sum, entry) => sum + entry.weight, 0);
  let distributed = 0;
  normalized.forEach((entry, index) => {
    const remaining = cents - distributed;
    const portion =
      index === normalized.length - 1
        ? remaining
        : Math.min(remaining, Math.max(0, Math.round((cents * entry.weight) / totalWeight)));
    result.set(entry.key, portion / 100);
    distributed += portion;
  });
  return result;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug, groupId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  if (!(await canAccessRestaurant(request, restaurant.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableGroup = await getTableGroupById(groupId);
  if (!tableGroup || tableGroup.restaurantId !== restaurant.id || tableGroup.deletedAt) {
    return NextResponse.json({ error: "Table group not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    amount?: number;
    method?: PaymentMethod;
    note?: string;
    participantKey?: string | null;
  };

  const requestedAmount = Number(body.amount ?? 0);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return NextResponse.json({ error: "Missing amount" }, { status: 400 });
  }

  const [orders, payments, tableSessions, tables] = await Promise.all([
    listOrdersForRestaurant(restaurant.id),
    listPaymentsForRestaurant(restaurant.id),
    listTableSessionsForRestaurant(restaurant.id),
    listTablesForRestaurant(restaurant.id),
  ]);

  const activeGroupOrders = orders
    .filter(
      (order) =>
        !order.deletedAt &&
        tableGroup.tableIds.includes(order.tableId ?? "") &&
        (order.source === "table" || order.source === "qr") &&
        !["cancelled", "archived"].includes(order.status),
    )
    .map((order) => ({
      order,
      total: orderTotal(order),
      paid: completedPaidForOrder(payments, order.id),
    }))
    .filter((entry) => entry.total - entry.paid > 0.009)
    .sort((left, right) => left.order.openedAt.localeCompare(right.order.openedAt));

  if (activeGroupOrders.length === 0) {
    return NextResponse.json({ error: "No unpaid orders in this group" }, { status: 400 });
  }

  let remainingToAllocate = requestedAmount;
  const allocations: Array<{ orderId: string; amount: number }> = [];
  for (const entry of activeGroupOrders) {
    if (remainingToAllocate <= 0) break;
    const remaining = Math.max(0, entry.total - entry.paid);
    const amount = Math.min(remainingToAllocate, remaining);
    if (amount > 0) {
      allocations.push({ orderId: entry.order.id, amount });
      remainingToAllocate = Math.max(0, remainingToAllocate - amount);
    }
  }

  if (allocations.length === 0) {
    return NextResponse.json({ error: "Nothing to pay on this group" }, { status: 400 });
  }

  const createdPayments = [];
  const method = body.method ?? "cash";
  for (const allocation of allocations) {
    const payment = await createPayment({
      orderId: allocation.orderId,
      restaurantId: restaurant.id,
      amount: allocation.amount,
      method,
      status: "completed",
      note: body.note?.trim() || `Règlement groupe ${tableGroup.name}`,
    });
    if (payment) {
      createdPayments.push(payment);
    }
  }

  const refreshedOrders = await listOrdersForRestaurant(restaurant.id);
  const refreshedPayments = await listPaymentsForRestaurant(restaurant.id);
  const refreshedSessions = await listTableSessionsForRestaurant(restaurant.id);

  const summaryBeforeSettlement = buildTableGroupSummary({
    tableGroup,
    orders,
    payments,
    tableSessions,
    tables,
  });

  const paidThisRound = createdPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const participantAllocation =
    body.participantKey?.trim()
      ? new Map([[body.participantKey.trim(), paidThisRound]])
      : allocateAcrossWeights(
          paidThisRound,
          summaryBeforeSettlement.perParticipant.map((entry) => ({
            key: entry.key,
            weight: Math.max(entry.remaining, 0.01),
          })),
        );

  if (participantAllocation.size > 0) {
    const sessionUpdates = new Map<string, TableSession["participants"]>();
    for (const session of refreshedSessions.filter((entry) => tableGroup.tableSessionIds.includes(entry.id))) {
      const nextParticipants = session.participants.map((participant) => ({ ...participant }));
      let touched = false;
      for (const participant of nextParticipants) {
        const key = participant.customerId || participant.id;
        const increment = participantAllocation.get(key) ?? 0;
        if (increment > 0) {
          participant.settledAmount = Math.round((participant.settledAmount + increment) * 100) / 100;
          touched = true;
          participantAllocation.set(key, 0);
        }
      }
      if (touched) {
        sessionUpdates.set(session.id, nextParticipants);
      }
    }

    for (const [sessionId, participants] of sessionUpdates.entries()) {
      await updateTableSession(sessionId, { participants });
    }
  }

  const latestOrders = await listOrdersForRestaurant(restaurant.id);
  const latestPayments = await listPaymentsForRestaurant(restaurant.id);
  const latestSessions = await listTableSessionsForRestaurant(restaurant.id);

  for (const session of latestSessions.filter((entry) => tableGroup.tableSessionIds.includes(entry.id))) {
    const sessionOrders = latestOrders.filter(
      (order) =>
        !order.deletedAt &&
        (order.tableSessionId === session.id ||
          (session.tableId ? order.tableId === session.tableId && (order.source === "table" || order.source === "qr") : false)) &&
        !["cancelled", "archived"].includes(order.status),
    );
    const sessionTotal = sessionOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const sessionPaid = sessionOrders.reduce((sum, order) => sum + completedPaidForOrder(latestPayments, order.id), 0);
    const sessionRemaining = Math.max(0, sessionTotal - sessionPaid);
    const sessionPayments = createdPayments.filter((payment) =>
      sessionOrders.some((order) => order.id === payment.orderId),
    );

    await updateTableSession(session.id, {
      paidTotal: sessionPaid,
      status: sessionTotal > 0 && sessionRemaining <= 0 ? "closed" : session.status === "archived" ? "archived" : "open",
      closedAt: sessionTotal > 0 && sessionRemaining <= 0 ? new Date().toISOString() : null,
      lastPaymentMethod: sessionPayments.at(-1)?.method ?? session.lastPaymentMethod ?? null,
      lastPaymentAmount: sessionPayments.reduce((sum, payment) => sum + payment.amount, 0) || session.lastPaymentAmount,
      lastPaymentAt: sessionPayments.at(-1)?.createdAt ?? session.lastPaymentAt ?? null,
    });
  }

  const summary = buildTableGroupSummary({
    tableGroup,
    orders: latestOrders,
    payments: latestPayments,
    tableSessions: await listTableSessionsForRestaurant(restaurant.id),
    tables,
  });

  return NextResponse.json(
    {
      tableGroup,
      summary,
      payments: createdPayments,
      allocatedAmount: paidThisRound,
      unallocatedAmount: Math.max(0, Math.round(remainingToAllocate * 100) / 100),
      ticketUrl: `/group-ticket/${restaurant.slug}/${tableGroup.id}`,
    },
    { status: 201 },
  );
}
