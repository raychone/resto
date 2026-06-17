import { NextRequest, NextResponse } from "next/server";
import {
  clientDashboardCookieName,
  kitchenDashboardCookieName,
  managerDashboardCookieName,
  ownerDashboardCookieName,
  staffDashboardCookieName,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const cookiesToClear = [
  managerDashboardCookieName,
  staffDashboardCookieName,
  kitchenDashboardCookieName,
  clientDashboardCookieName,
  ownerDashboardCookieName,
  "meniu_google_oauth_state",
  "meniu_google_oauth_return_to",
  "meniu_google_oauth_restaurant_slug",
];

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("to")?.trim() || "/";
  if (!target.startsWith("/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL(target, request.url));
  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
