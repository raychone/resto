import { NextResponse } from "next/server";
import { deleteInvoice, updateInvoice } from "@/lib/billing-store";
import { getOwnerUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hasOwnerSession(request: Request) {
  return getOwnerUserFromRequest(request);
}

type Params = {
  params: Promise<{ invoiceId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  if (!(await hasOwnerSession(request))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { invoiceId } = await params;
  const patch = (await request.json()) as {
    status?: "draft" | "sent" | "paid" | "cancelled";
    notes?: string;
    amount?: number;
    periodLabel?: string;
  };

  const invoice = await updateInvoice(invoiceId, patch);
  if (!invoice) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function DELETE(request: Request, { params }: Params) {
  if (!(await hasOwnerSession(request))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { invoiceId } = await params;
  const invoice = await deleteInvoice(invoiceId);
  if (!invoice) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json(invoice);
}
