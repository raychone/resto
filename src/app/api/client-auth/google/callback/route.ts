import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { clientDashboardCookieName } from "@/lib/auth";
import { getOrCreateCustomerForUser } from "@/lib/customer-store";
import { getRestaurantBySlug } from "@/lib/restaurant-store";
import { createUser, getUserByUsername, hashUserPassword, updateUser } from "@/lib/user-store";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  };
}

export async function GET(request: NextRequest) {
  const stateCookie = (await cookies()).get("meniu_google_oauth_state")?.value ?? null;
  const returnToCookie = (await cookies()).get("meniu_google_oauth_return_to")?.value ?? "/client";
  const restaurantSlug = (await cookies()).get("meniu_google_oauth_restaurant_slug")?.value ?? "bar-1";
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const redirectUri = `${request.nextUrl.origin}/api/client-auth/google/callback`;

  if (!stateCookie || !state || state !== stateCookie || !code) {
    return NextResponse.redirect(new URL("/client?google=invalid_state", request.url));
  }

  const tokens = await exchangeCodeForTokens(code, redirectUri);
  if (!tokens?.access_token) {
    return NextResponse.redirect(new URL("/client?google=token_failed", request.url));
  }

  const profile = await fetchGoogleProfile(tokens.access_token);
  const email = profile?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.redirect(new URL("/client?google=profile_failed", request.url));
  }

  const restaurant = await getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return NextResponse.redirect(new URL("/client?google=restaurant_missing", request.url));
  }

  let user = await getUserByUsername(email);
  if (!user) {
    user = (await createUser({
      restaurantId: restaurant.id,
      role: "client",
      name: profile?.name?.trim() || email.split("@")[0] || "Client",
      username: email,
      passwordHash: hashUserPassword(crypto.randomUUID()),
      temporaryPassword: undefined,
      mustChangePassword: false,
      status: "active",
      deletedAt: null,
      pinEnabled: false,
    })) as User;
  } else if (user.role !== "client") {
    return NextResponse.redirect(new URL("/client?google=role_conflict", request.url));
  } else if (user.restaurantId !== restaurant.id) {
    user = (await updateUser(user.id, { restaurantId: restaurant.id })) as User;
  }

  const response = NextResponse.redirect(new URL(returnToCookie, request.url));
  response.cookies.set(clientDashboardCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.set("meniu_google_oauth_state", "", { path: "/", maxAge: 0 });
  response.cookies.set("meniu_google_oauth_return_to", "", { path: "/", maxAge: 0 });
  response.cookies.set("meniu_google_oauth_restaurant_slug", "", { path: "/", maxAge: 0 });

  await getOrCreateCustomerForUser(user, restaurant.id);

  return response;
}
