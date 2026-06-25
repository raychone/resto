import { summarizeTaxBreakdown } from "@/lib/tax";
import type { Order, Payment, Table, TableGroup, TableSession } from "@/lib/types";

export type TableGroupSummary = {
  total: number;
  paid: number;
  remaining: number;
  perTable: {
    tableId: string;
    label: string;
    total: number;
    paid: number;
    remaining: number;
  }[];
  perParticipant: {
    key: string;
    name: string;
    total: number;
    paid: number;
    remaining: number;
    tables: string[];
  }[];
  orderCount: number;
  sessionCount: number;
};

function orderTotal(order: Order) {
  return summarizeTaxBreakdown(order.items.filter((item) => !item.deletedAt)).total;
}

function paidTotalForOrder(payments: Payment[], orderId: string) {
  return payments
    .filter((payment) => payment.orderId === orderId && payment.status === "completed" && !payment.deletedAt)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function allocateAmount(targets: Array<{ key: string; weight: number }>, amount: number) {
  const normalizedAmount = Math.max(0, Math.round(amount * 100));
  const normalizedTargets = targets.filter((target) => target.weight > 0);
  if (normalizedAmount <= 0 || normalizedTargets.length === 0) {
    return new Map<string, number>();
  }

  const totalWeight = normalizedTargets.reduce((sum, target) => sum + target.weight, 0);
  const allocation = new Map<string, number>();
  let distributed = 0;

  normalizedTargets.forEach((target, index) => {
    const remaining = normalizedAmount - distributed;
    const portion =
      index === normalizedTargets.length - 1
        ? remaining
        : Math.max(0, Math.round((normalizedAmount * target.weight) / totalWeight));
    const cappedPortion = Math.min(remaining, portion);
    allocation.set(target.key, cappedPortion / 100);
    distributed += cappedPortion;
  });

  return allocation;
}

export function buildTableGroupSummary({
  tableGroup,
  orders,
  payments,
  tableSessions,
  tables,
}: {
  tableGroup: TableGroup;
  orders: Order[];
  payments: Payment[];
  tableSessions: TableSession[];
  tables: Table[];
}): TableGroupSummary {
  const groupOrders = orders.filter(
    (order) =>
      !order.deletedAt &&
      tableGroup.tableIds.includes(order.tableId ?? "") &&
      (order.source === "table" || order.source === "qr"),
  );
  const groupSessions = tableSessions.filter((session) => tableGroup.tableSessionIds.includes(session.id));

  const total = groupOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const paid = groupOrders.reduce((sum, order) => sum + paidTotalForOrder(payments, order.id), 0);
  const remaining = Math.max(0, total - paid);

  const perTable = tableGroup.tableIds.map((tableId) => {
    const table = tables.find((entry) => entry.id === tableId);
    const tableOrders = groupOrders.filter((order) => order.tableId === tableId);
    const tableTotal = tableOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const tablePaid = tableOrders.reduce((sum, order) => sum + paidTotalForOrder(payments, order.id), 0);
    return {
      tableId,
      label: table?.name ?? tableId,
      total: tableTotal,
      paid: tablePaid,
      remaining: Math.max(0, tableTotal - tablePaid),
    };
  });

  const perParticipantMap = new Map<
    string,
    { key: string; name: string; total: number; paid: number; tables: Set<string> }
  >();
  for (const session of groupSessions) {
    for (const participant of session.participants) {
      const key = participant.customerId || participant.id;
      const current = perParticipantMap.get(key) ?? {
        key,
        name: participant.name,
        total: 0,
        paid: 0,
        tables: new Set<string>(),
      };
      current.paid += participant.settledAmount;
      if (session.tableId) {
        current.tables.add(session.tableId);
      }
      perParticipantMap.set(key, current);
    }
  }

  for (const order of groupOrders) {
    const session = groupSessions.find((entry) => entry.id === order.tableSessionId);
    if (!session) continue;
    const visibleItems = order.items.filter((item) => !item.deletedAt);
    let unassignedTotal = 0;

    for (const item of visibleItems) {
      const itemTotal = item.priceSnapshot * item.quantity;
      if (item.assignedClientId || item.assignedClientName) {
        const matchedParticipant = session.participants.find((participant) => {
          const key = participant.customerId || participant.id;
          return (
            (item.assignedClientId && participant.customerId === item.assignedClientId) ||
            key === item.assignedClientId ||
            participant.name === item.assignedClientName
          );
        });

        if (matchedParticipant) {
          const key = matchedParticipant.customerId || matchedParticipant.id;
          const current = perParticipantMap.get(key) ?? {
            key,
            name: matchedParticipant.name,
            total: 0,
            paid: matchedParticipant.settledAmount,
            tables: new Set<string>(session.tableId ? [session.tableId] : []),
          };
          current.total += itemTotal;
          perParticipantMap.set(key, current);
          continue;
        }
      }

      unassignedTotal += itemTotal;
    }

    if (unassignedTotal <= 0) continue;
    const participants = session.participants.map((participant) => ({
      key: participant.customerId || participant.id,
      weight: participant.sharePercent > 0 ? participant.sharePercent : 1,
      name: participant.name,
    }));

    const distributed = allocateAmount(participants, unassignedTotal);
    for (const participant of participants) {
      const current = perParticipantMap.get(participant.key) ?? {
        key: participant.key,
        name: participant.name,
        total: 0,
        paid: 0,
        tables: new Set<string>(session.tableId ? [session.tableId] : []),
      };
      current.total += distributed.get(participant.key) ?? 0;
      if (session.tableId) {
        current.tables.add(session.tableId);
      }
      perParticipantMap.set(participant.key, current);
    }
  }

  const perParticipant = [...perParticipantMap.values()].map((entry) => ({
    key: entry.key,
    name: entry.name,
    total: entry.total,
    paid: entry.paid,
    remaining: Math.max(0, entry.total - entry.paid),
    tables: [...entry.tables].map((tableId) => tables.find((table) => table.id === tableId)?.name ?? tableId),
  }));

  return {
    total,
    paid,
    remaining,
    perTable,
    perParticipant,
    orderCount: groupOrders.length,
    sessionCount: groupSessions.length,
  };
}
