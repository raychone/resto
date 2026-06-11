import { NextResponse } from "next/server";
import {
  createInvoice,
  listInvoices,
  type InvoiceKind,
} from "@/lib/billing-store";
import { getOwnerUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hasOwnerSession(request: Request) {
  return getOwnerUserFromRequest(request);
}

export async function GET(request: Request) {
  if (!(await hasOwnerSession(request))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const invoices = await listInvoices();
  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  if (!(await hasOwnerSession(request))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as {
    restaurantSlug?: string;
    restaurantName?: string;
    kind?: InvoiceKind;
    periodLabel?: string;
    amount?: number;
    currency?: string;
    includeDomain?: boolean;
    includeDatabase?: boolean;
    includeQrMenu?: boolean;
    includeBooking?: boolean;
    includeSms?: boolean;
    notes?: string;
  };

  if (!body.restaurantSlug || !body.restaurantName || !body.periodLabel) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const invoice = await createInvoice({
    restaurantSlug: body.restaurantSlug,
    restaurantName: body.restaurantName,
    kind: body.kind ?? "setup",
    periodLabel: body.periodLabel,
    amount: Number(body.amount ?? 0),
    currency: body.currency ?? "EUR",
    includeDomain: Boolean(body.includeDomain),
    includeDatabase: Boolean(body.includeDatabase),
    includeQrMenu: Boolean(body.includeQrMenu),
    includeBooking: Boolean(body.includeBooking),
    includeSms: Boolean(body.includeSms),
    notes: body.notes ?? "",
    status: "draft",
  });

  return NextResponse.json(invoice, { status: 201 });
}
