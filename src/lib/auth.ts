import { cookies } from "next/headers";

export const managerDashboardCookieName = "meniu_manager_session";
export const staffDashboardCookieName = "meniu_staff_session";
const managerSessionToken = "raychone!";
const staffSessionToken = "pass123!";

export function isValidDashboardCredentials(username: string, password: string) {
  return username === "raych" && password === "raychone!";
}

export function isValidStaffCredentials(username: string, password: string) {
  return username === "user" && password === "pass123!";
}

export function isValidManagerSession(token?: string | null) {
  return token === managerSessionToken;
}

export function isValidStaffSession(token?: string | null) {
  return token === staffSessionToken;
}

export async function isDashboardAuthenticated() {
  const cookieStore = await cookies();
  return isValidManagerSession(cookieStore.get(managerDashboardCookieName)?.value);
}

export async function isStaffAuthenticated() {
  const cookieStore = await cookies();
  return isValidStaffSession(cookieStore.get(staffDashboardCookieName)?.value);
}
