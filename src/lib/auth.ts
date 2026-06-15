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
export const ownerDashboardCookieName = "meniu_owner_session";

function decodeSessionCookie(value: string): User | null {
  if (!value.startsWith("payload:")) {
    return null;
  }

  const encoded = value.slice("payload:".length);

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as User;
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

  const payloadUser = decodeSessionCookie(userId);
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

  const payloadUser = decodeSessionCookie(userId);
  if (payloadUser && isUserRole(payloadUser, role)) {
    return payloadUser;
  }

  const user = await getUserById(userId);
  if (!isUserRole(user, role)) {
    return null;
  }

  return user;
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
