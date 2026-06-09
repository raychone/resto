import { NextResponse } from "next/server";
import { isValidStaffCredentials, staffDashboardCookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as {
    username?: string;
    password?: string;
  };

  if (!username || !password || !isValidStaffCredentials(username, password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(staffDashboardCookieName, "pass123!", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

