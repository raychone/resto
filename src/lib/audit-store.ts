import { promises as fs } from "node:fs";
import path from "node:path";

export type AuditActorRole = "manager" | "staff" | "kitchen" | "client";

export type AuditEntry = {
  id: string;
  restaurantSlug: string;
  restaurantId?: string;
  actorRole: AuditActorRole;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const auditFile = path.join(dataDir, "audit.json");
const canPersistDataFiles = process.env.VERCEL !== "1";

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    if (canPersistDataFiles) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(file, JSON.stringify(fallback, null, 2), "utf8");
    }
    return fallback;
  }
}

async function writeJsonFile(file: string, value: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listAuditEntries() {
  return readJsonFile<AuditEntry[]>(auditFile, []);
}

export async function listAuditEntriesForRestaurant(restaurantSlug: string) {
  const entries = await listAuditEntries();
  return entries.filter(
    (entry) => entry.restaurantSlug === restaurantSlug || entry.restaurantId === restaurantSlug,
  );
}

export async function recordAuditEntry(
  entry: Omit<AuditEntry, "id" | "createdAt">,
) {
  const entries = await listAuditEntries();
  const auditEntry: AuditEntry = {
    ...entry,
    id: createId("audit"),
    createdAt: new Date().toISOString(),
  };
  await writeJsonFile(auditFile, [...entries, auditEntry]);
  return auditEntry;
}
