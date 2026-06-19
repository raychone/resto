import type { AuditEntry } from "@/lib/audit-store";

export type HumanizedAuditEntry = {
  title: string;
  subtitle: string | null;
  details: string | null;
};

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

  if (values.participants || values.guestCount) {
    const participants = values.participants ? `${values.participants} participant${Number(values.participants) > 1 ? "s" : ""}` : null;
    const guestCount = values.guestCount ? `${values.guestCount} personne${Number(values.guestCount) > 1 ? "s" : ""}` : null;
    chunks.push([participants, guestCount].filter(Boolean).join(" · "));
  }

  if (values.item) {
    chunks.push(`Article ${values.item}`);
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
  return {
    title,
    subtitle: null,
    details: humanizedDetails || fallbackDetails,
  };
}
