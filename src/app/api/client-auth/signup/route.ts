import { NextResponse } from "next/server";
import { clientDashboardCookieName, clientGuestSessionCookieName } from "@/lib/auth";
import { getOrCreateCustomerForUser } from "@/lib/customer-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { createUser, hashUserPassword, getUserByUsername } from "@/lib/user-store";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

function encodeSessionPayload(user: User) {
  return `payload:${Buffer.from(JSON.stringify(user), "utf8").toString("base64url")}`;
}

export async function POST(request: Request) {
  const { name, email, password, restaurantSlug } = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    restaurantSlug?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const restaurant = (await getRestaurantBySlug(restaurantSlug || "bar-1")) ?? null;
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await getUserByUsername(normalizedEmail);
  if (existing) {
    return NextResponse.json({ ok: false, error: "User already exists" }, { status: 409 });
  }

  const user = (await createUser({
    restaurantId: restaurant.id,
    role: "client",
    name: name.trim(),
    username: normalizedEmail,
    passwordHash: hashUserPassword(password),
    temporaryPassword: password,
    mustChangePassword: false,
    status: "active",
    deletedAt: null,
    pinEnabled: false,
  })) as User;

  await getOrCreateCustomerForUser(user, restaurant.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clientDashboardCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  if (process.env.VERCEL === "1") {
    response.cookies.set(clientDashboardCookieName, encodeSessionPayload(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  response.cookies.set(clientGuestSessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
