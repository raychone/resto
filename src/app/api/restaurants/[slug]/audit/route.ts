import { NextRequest, NextResponse } from "next/server";
import {
  isValidManagerSession,
  isValidStaffSession,
  managerDashboardCookieName,
  staffDashboardCookieName,
} from "@/lib/auth";
import { listAuditEntriesForRestaurant } from "@/lib/audit-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const hasAccess =
    isValidManagerSession(request.cookies.get(managerDashboardCookieName)?.value) ||
    isValidStaffSession(request.cookies.get(staffDashboardCookieName)?.value);

  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const auditEntries = await listAuditEntriesForRestaurant(slug);
  return NextResponse.json({ auditEntries });
}

