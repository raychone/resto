import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

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

export type HumanizedAuditEntry = {
  title: string;
  subtitle: string;
  details: string | null;
};

const dataDir = path.join(process.cwd(), "data");
const auditFile = path.join(dataDir, "audit.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type AuditRow = {
  id: string;
  restaurant_slug: string;
  restaurant_id: string | null;
  actor_role: AuditActorRole;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string;
  created_at: string;
};

function auditRowToDomain(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    restaurantId: row.restaurant_id ?? undefined,
    actorRole: row.actor_role,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type ?? "",
    targetId: row.target_id ?? "",
    details: row.details,
    createdAt: row.created_at,
  };
}

function auditDomainToRow(entry: Omit<AuditEntry, "id" | "createdAt"> & { id: string; createdAt: string }): AuditRow {
  return {
    id: entry.id,
    restaurant_slug: entry.restaurantSlug,
    restaurant_id: entry.restaurantId ?? null,
    actor_role: entry.actorRole,
    actor_name: entry.actorName,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details: entry.details ?? "",
    created_at: entry.createdAt,
  };
}

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
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase.from("audit").select("*").order("created_at", { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []).map((row) => auditRowToDomain(row as AuditRow));
    }
  }

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

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase.from("audit").insert(auditDomainToRow(auditEntry));
      if (error) {
        throw error;
      }
      return auditEntry;
    }
  }

  await writeJsonFile(auditFile, [...entries, auditEntry]);
  return auditEntry;
}

function parseAuditDetails(details?: string) {
  if (!details) {
    return {};
  }

  return details
    .split(/(?:\s*[·;]\s*)+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

function humanizeOrderStatus(status?: string) {
  switch (status) {
    case "open":
      return "ouverte";
    case "sent_to_kitchen":
      return "validée et envoyée en cuisine";
    case "preparing":
      return "en préparation";
    case "ready":
      return "prête";
    case "served":
      return "servie";
    case "paid":
      return "réglée";
    case "cancelled":
      return "annulée";
    case "archived":
      return "archivée";
    default:
      return "mise à jour";
  }
}

function humanizeKeyValueDetails(entry: AuditEntry) {
  const values = parseAuditDetails(entry.details);
  const chunks: string[] = [];

  if (values.table) {
    chunks.push(`Table ${values.table}`);
  } else if (values.tableLabel) {
    chunks.push(values.tableLabel);
  }

  if (values.status) {
    chunks.push(`Statut: ${humanizeOrderStatus(values.status)}`);
  }

  if (values.qty) {
    chunks.push(`Quantité: ${values.qty}`);
  }

  if (values.provider) {
    chunks.push(`Provider: ${values.provider}${values.sent ? ` (${values.sent === "yes" ? "envoyé" : "non envoyé"})` : ""}`);
  }

  if (values.participants || values.guestCount) {
    const participants = values.participants ? `${values.participants} participant${Number(values.participants) > 1 ? "s" : ""}` : null;
    const guestCount = values.guestCount ? `${values.guestCount} personne${Number(values.guestCount) > 1 ? "s" : ""}` : null;
    chunks.push([participants, guestCount].filter(Boolean).join(" · "));
  }

  if (values.item) {
    chunks.push(`Article ${values.item}`);
  }

  if (values.client) {
    chunks.push(`Client ${values.client}`);
  }

  return chunks.filter(Boolean).join(" · ") || null;
}

export function humanizeAuditEntry(entry: AuditEntry): HumanizedAuditEntry {
  const values = parseAuditDetails(entry.details);
  let title = entry.action;

  switch (entry.action) {
    case "client_order_requested":
      title = "Commande client envoyée";
      break;
    case "order_status_changed":
      title = `Commande ${humanizeOrderStatus(values.status)}`;
      break;
    case "order_ready_notification":
      title = "Notification de commande prête envoyée";
      break;
    case "order_served_notification":
      title = "Notification de commande servie envoyée";
      break;
    case "order_paid":
      title = "Commande encaissée";
      break;
    case "order_item_added":
      title = "Article ajouté à la commande";
      break;
    case "order_item_removed":
      title = "Article retiré de la commande";
      break;
    case "order_item_updated":
      title = "Article mis à jour";
      break;
    case "order_item_quantity_changed":
      title = "Quantité modifiée";
      break;
    case "order_item_assigned_client":
      title = "Article attribué à un client";
      break;
    case "reservation_created":
      title = "Réservation créée";
      break;
    case "reservation_notification":
      title = "Notification de réservation envoyée";
      break;
    case "reservation_deleted":
      title = "Réservation supprimée";
      break;
    case "reservation_updated":
      title = "Réservation mise à jour";
      break;
    case "restaurant_updated":
      title = "Réglages restaurant enregistrés";
      break;
    case "table_session_updated":
      title = "Répartition de table mise à jour";
      break;
    case "order_archived":
      title = "Commande archivée";
      break;
    case "created":
      title = `${entry.targetType} créé`;
      break;
    case "updated":
      title = `${entry.targetType} mis à jour`;
      break;
    case "saved":
      title = `${entry.targetType} enregistré`;
      break;
    case "deleted":
      title = `${entry.targetType} supprimé`;
      break;
    case "message":
      title = "Message client reçu";
      break;
    default:
      title = entry.action.replace(/_/g, " ");
      break;
  }

  const humanizedDetails = humanizeKeyValueDetails(entry);
  const fallbackDetails = entry.details?.trim() || null;
  const subtitle =
    entry.targetType === "order"
      ? `Commande ${entry.targetId.slice(-6)}`
      : entry.targetType === "reservation"
        ? `Réservation ${entry.targetId.slice(-6)}`
        : entry.targetType === "table_session"
          ? `Table ${entry.targetId.slice(-6)}`
          : entry.targetType === "restaurant"
            ? "Restaurant"
            : entry.targetType;

  return {
    title,
    subtitle,
    details: humanizedDetails || fallbackDetails,
  };
}
