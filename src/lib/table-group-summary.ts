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
    name: string;
    settled: number;
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

  const perParticipantMap = new Map<string, { name: string; settled: number; tables: Set<string> }>();
  for (const session of groupSessions) {
    for (const participant of session.participants) {
      const key = participant.customerId || participant.id;
      const current = perParticipantMap.get(key) ?? {
        name: participant.name,
        settled: 0,
        tables: new Set<string>(),
      };
      current.settled += participant.settledAmount;
      if (session.tableId) {
        current.tables.add(session.tableId);
      }
      perParticipantMap.set(key, current);
    }
  }

  const perParticipant = [...perParticipantMap.values()].map((entry) => ({
    name: entry.name,
    settled: entry.settled,
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
