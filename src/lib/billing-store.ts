import { promises as fs } from "node:fs";
import path from "node:path";
import { createId, type Restaurant } from "@/lib/types";

export type InvoiceKind = "setup" | "maintenance";
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  restaurantSlug: string;
  restaurantName: string;
  kind: InvoiceKind;
  periodLabel: string;
  amount: number;
  currency: string;
  includeDomain: boolean;
  includeDatabase: boolean;
  includeQrMenu: boolean;
  includeBooking: boolean;
  includeSms: boolean;
  notes: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
};

type InvoiceInput = Omit<Invoice, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: InvoiceStatus;
};

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "invoices.json");
const canPersistDataFiles = process.env.VERCEL !== "1";

async function readJsonFile<T>(fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    if (canPersistDataFiles) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
    }
    return fallback;
  }
}

async function writeJsonFile(value: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function normalizeInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    restaurantSlug: invoice.restaurantSlug.trim(),
    restaurantName: invoice.restaurantName.trim(),
    kind: invoice.kind === "maintenance" ? "maintenance" : "setup",
    periodLabel: invoice.periodLabel.trim(),
    amount: Number.isFinite(invoice.amount) ? Math.max(0, invoice.amount) : 0,
    currency: invoice.currency.trim() || "EUR",
    includeDomain: Boolean(invoice.includeDomain),
    includeDatabase: Boolean(invoice.includeDatabase),
    includeQrMenu: Boolean(invoice.includeQrMenu),
    includeBooking: Boolean(invoice.includeBooking),
    includeSms: Boolean(invoice.includeSms),
    notes: invoice.notes.trim(),
    status:
      invoice.status === "sent" ||
      invoice.status === "paid" ||
      invoice.status === "cancelled"
        ? invoice.status
        : "draft",
  };
}

export async function listInvoices() {
  const invoices = await readJsonFile<Invoice[]>([]);
  return invoices.map(normalizeInvoice);
}

export async function listInvoicesForRestaurant(restaurantSlug: string) {
  const invoices = await listInvoices();
  return invoices.filter((invoice) => invoice.restaurantSlug === restaurantSlug);
}

export async function createInvoice(input: InvoiceInput) {
  const invoices = await listInvoices();
  const now = new Date().toISOString();
  const invoice: Invoice = normalizeInvoice({
    id: createId("invoice"),
    restaurantSlug: input.restaurantSlug,
    restaurantName: input.restaurantName,
    kind: input.kind,
    periodLabel: input.periodLabel,
    amount: input.amount,
    currency: input.currency,
    includeDomain: input.includeDomain,
    includeDatabase: input.includeDatabase,
    includeQrMenu: input.includeQrMenu,
    includeBooking: input.includeBooking,
    includeSms: input.includeSms,
    notes: input.notes,
    status: input.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  });

  await writeJsonFile([...invoices, invoice]);
  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  patch: Partial<Pick<Invoice, "status" | "notes" | "amount" | "periodLabel">>,
) {
  const invoices = await listInvoices();
  const index = invoices.findIndex((invoice) => invoice.id === invoiceId);

  if (index === -1) {
    return null;
  }

  const nextInvoice = normalizeInvoice({
    ...invoices[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const nextInvoices = [...invoices];
  nextInvoices[index] = nextInvoice;
  await writeJsonFile(nextInvoices);
  return nextInvoice;
}

export async function deleteInvoice(invoiceId: string) {
  const invoices = await listInvoices();
  const invoice = invoices.find((entry) => entry.id === invoiceId);

  if (!invoice) {
    return null;
  }

  await writeJsonFile(invoices.filter((entry) => entry.id !== invoiceId));
  return invoice;
}

export function summarizeInvoiceCoverage(invoice: Pick<Invoice, "includeDomain" | "includeDatabase" | "includeQrMenu" | "includeBooking" | "includeSms">) {
  return [
    invoice.includeDomain ? "domaine" : null,
    invoice.includeDatabase ? "base de données" : null,
    invoice.includeQrMenu ? "QR" : null,
    invoice.includeBooking ? "réservations" : null,
    invoice.includeSms ? "SMS" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getInvoiceTotalByRestaurant(restaurant: Restaurant, invoices: Invoice[]) {
  return invoices
    .filter((invoice) => invoice.restaurantSlug === restaurant.slug)
    .reduce((sum, invoice) => sum + invoice.amount, 0);
}
