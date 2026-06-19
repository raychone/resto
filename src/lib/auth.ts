import { cookies } from "next/headers";
import {
  getUserById,
  getUserByUsername,
  isUserActive,
  isUserRole,
  verifyPassword,
} from "@/lib/user-store";
import type { User, UserRole } from "@/lib/types";

export const managerDashboardCookieName = "meniu_manager_session";
export const staffDashboardCookieName = "meniu_staff_session";
export const kitchenDashboardCookieName = "meniu_kitchen_session";
export const clientDashboardCookieName = "meniu_client_session";
export const clientGuestSessionCookieName = "meniu_client_guest_session";
export const ownerDashboardCookieName = "meniu_owner_session";

function decodePayloadCookie<T>(value: string): T | null {
  if (!value.startsWith("payload:")) {
    return null;
  }

  const encoded = value.slice("payload:".length);

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as T;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export async function getValidUserByCredentials(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user || !isUserActive(user) || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export async function isValidDashboardCredentials(username: string, password: string) {
  const user = await getValidUserByCredentials(username, password);
  return isUserRole(user, "manager");
}

export async function isValidStaffCredentials(username: string, password: string) {
  const user = await getValidUserByCredentials(username, password);
  return isUserRole(user, "staff");
}

export async function isValidKitchenCredentials(username: string, password: string) {
  const user = await getValidUserByCredentials(username, password);
  return isUserRole(user, "kitchen");
}

export async function isValidClientCredentials(username: string, password: string) {
  const user = await getValidUserByCredentials(username, password);
  return isUserRole(user, "client");
}

export async function isValidOwnerCredentials(username: string, password: string) {
  const user = await getValidUserByCredentials(username, password);
  return isUserRole(user, "owner");
}

async function getSessionUser(cookieName: string, role: UserRole) {
  const cookieStore = await cookies();
  const userId = cookieStore.get(cookieName)?.value;
  if (!userId) return null;

  const payloadUser = decodePayloadCookie<User>(userId);
  if (payloadUser && isUserRole(payloadUser, role)) {
    return payloadUser;
  }

  const user = await getUserById(userId);
  if (!isUserRole(user, role)) {
    return null;
  }

  return user;
}

async function getSessionUserFromRequest(
  request: Request,
  cookieName: string,
  role: UserRole,
) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const userId = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!userId) {
    return null;
  }

  const payloadUser = decodePayloadCookie<User>(userId);
  if (payloadUser && isUserRole(payloadUser, role)) {
    return payloadUser;
  }

  const user = await getUserById(userId);
  if (!isUserRole(user, role)) {
    return null;
  }

  return user;
}

export async function getAnySessionUserFromRequest(request: Request) {
  const cookieNames: Array<[string, UserRole]> = [
    [managerDashboardCookieName, "manager"],
    [staffDashboardCookieName, "staff"],
    [kitchenDashboardCookieName, "kitchen"],
    [clientDashboardCookieName, "client"],
    [ownerDashboardCookieName, "owner"],
  ];

  for (const [cookieName, role] of cookieNames) {
    const user = await getSessionUserFromRequest(request, cookieName, role);
    if (user) {
      return user;
    }
  }

  return null;
}

export async function getDashboardSessionUser(): Promise<User | null> {
  return getSessionUser(managerDashboardCookieName, "manager");
}

export async function getStaffSessionUser(): Promise<User | null> {
  return getSessionUser(staffDashboardCookieName, "staff");
}

export async function getKitchenSessionUser(): Promise<User | null> {
  return getSessionUser(kitchenDashboardCookieName, "kitchen");
}

export async function getClientSessionUser(): Promise<User | null> {
  return getSessionUser(clientDashboardCookieName, "client");
}

export async function getOwnerSessionUser(): Promise<User | null> {
  return getSessionUser(ownerDashboardCookieName, "owner");
}

export async function isDashboardAuthenticated() {
  return Boolean(await getDashboardSessionUser());
}

export async function isStaffAuthenticated() {
  return Boolean(await getStaffSessionUser());
}

export async function isKitchenAuthenticated() {
  return Boolean(await getKitchenSessionUser());
}

export async function isClientAuthenticated() {
  return Boolean(await getClientSessionUser());
}

export async function isOwnerAuthenticated() {
  return Boolean(await getOwnerSessionUser());
}

export async function getDashboardRestaurantUser() {
  return getDashboardSessionUser();
}

export async function getStaffRestaurantUser() {
  return getStaffSessionUser();
}

export async function getManagerUserFromRequest(request: Request) {
  return getSessionUserFromRequest(request, managerDashboardCookieName, "manager");
}

export async function getStaffUserFromRequest(request: Request) {
  return getSessionUserFromRequest(request, staffDashboardCookieName, "staff");
}

export async function getKitchenUserFromRequest(request: Request) {
  return getSessionUserFromRequest(request, kitchenDashboardCookieName, "kitchen");
}

export async function getClientUserFromRequest(request: Request) {
  return getSessionUserFromRequest(request, clientDashboardCookieName, "client");
}

export async function getOwnerUserFromRequest(request: Request) {
  return getSessionUserFromRequest(request, ownerDashboardCookieName, "owner");
}

export type ClientGuestSession = {
  id: string;
  restaurantId: string;
  restaurantSlug: string;
  tableId: string | null;
  name: string;
  createdAt: string;
};

export function encodePayloadCookieValue<T>(payload: T) {
  return `payload:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

export async function getClientGuestSession(): Promise<ClientGuestSession | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(clientGuestSessionCookieName)?.value;
  if (!rawValue) {
    return null;
  }

  return decodePayloadCookie<ClientGuestSession>(rawValue);
}

export async function getClientGuestSessionFromRequest(request: Request): Promise<ClientGuestSession | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${clientGuestSessionCookieName}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!rawValue) {
    return null;
  }

  return decodePayloadCookie<ClientGuestSession>(rawValue);
}
