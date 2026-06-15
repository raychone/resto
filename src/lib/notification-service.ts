import type { NotificationProvider, Order, Reservation, Restaurant } from "@/lib/types";

export type NotificationDispatchResult =
  | { provider: "android"; sent: false; reason: "composer_only" }
  | { provider: "twilio"; sent: boolean; details: string }
  | { provider: "whatsapp_business"; sent: boolean; details: string }
  | { provider: "off"; sent: false; reason: "disabled" };

function formatReservationDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function buildReservationNotificationMessage({
  restaurantName,
  reservation,
  variant = "confirmation",
}: {
  restaurantName: string;
  reservation: Reservation;
  variant?: "request" | "confirmation";
}) {
  return [
    variant === "request" ? "Nouvelle demande de réservation" : "Confirmation de réservation",
    restaurantName,
    `${reservation.firstName} ${reservation.lastName}`.trim(),
    `${reservation.guestCount} personnes`,
    reservation.time,
    formatReservationDate(reservation.date),
    "",
    variant === "request" ? "Accepter / Refuser" : "Réserver modifiée / confirmée",
  ].join("\n");
}

export async function dispatchRestaurantNotification({
  provider,
  restaurant,
  reservation,
  variant = "confirmation",
}: {
  provider: NotificationProvider;
  restaurant: Restaurant;
  reservation: Reservation;
  variant?: "request" | "confirmation";
}): Promise<NotificationDispatchResult> {
  const message = buildReservationNotificationMessage({
    restaurantName: restaurant.name,
    reservation,
    variant,
  });

  if (provider === "off") {
    return { provider, sent: false, reason: "disabled" };
  }

  if (provider === "android") {
    return { provider, sent: false, reason: "composer_only" };
  }

  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return {
        provider,
        sent: false,
        details: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER missing",
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `Twilio error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "Twilio message sent" };
  }

  if (provider === "whatsapp_business") {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!token || !phoneNumberId || !toNumber) {
      return {
        provider,
        sent: false,
        details: "WHATSAPP_BUSINESS_TOKEN / WHATSAPP_BUSINESS_PHONE_NUMBER_ID missing",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `WhatsApp Business error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "WhatsApp Business message sent" };
  }

  return { provider, sent: false, reason: "disabled" };
}

export function buildOrderRequestNotificationMessage({
  restaurantName,
  order,
  tableLabel,
}: {
  restaurantName: string;
  order: Order;
  tableLabel: string;
}) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return [
    "Nouvelle commande",
    restaurantName,
    tableLabel,
    `${totalItems} articles`,
    order.source === "takeaway" ? "À emporter" : "Service en salle",
    "",
    "Confirmer au service puis envoyer en cuisine.",
  ].join("\n");
}

export async function dispatchOrderRequestNotification({
  provider,
  restaurant,
  order,
  tableLabel,
}: {
  provider: NotificationProvider;
  restaurant: Restaurant;
  order: Order;
  tableLabel: string;
}): Promise<NotificationDispatchResult> {
  const message = buildOrderRequestNotificationMessage({
    restaurantName: restaurant.name,
    order,
    tableLabel,
  });

  if (provider === "off") {
    return { provider, sent: false, reason: "disabled" };
  }

  if (provider === "android") {
    return { provider, sent: false, reason: "composer_only" };
  }

  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return {
        provider,
        sent: false,
        details: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER missing",
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `Twilio error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "Twilio message sent" };
  }

  if (provider === "whatsapp_business") {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!token || !phoneNumberId || !toNumber) {
      return {
        provider,
        sent: false,
        details: "WHATSAPP_BUSINESS_TOKEN / WHATSAPP_BUSINESS_PHONE_NUMBER_ID missing",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `WhatsApp Business error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "WhatsApp Business message sent" };
  }

  return { provider, sent: false, reason: "disabled" };
}

export function buildOrderReadyNotificationMessage({
  restaurantName,
  order,
  tableLabel,
}: {
  restaurantName: string;
  order: Order;
  tableLabel: string;
}) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return [
    "Commande prête",
    restaurantName,
    tableLabel,
    `${totalItems} articles`,
    order.source === "takeaway" ? "À emporter" : "Service en salle",
    "",
    "Le serveur peut la livrer à la table.",
  ].join("\n");
}

export function buildOrderServedNotificationMessage({
  restaurantName,
  order,
  tableLabel,
}: {
  restaurantName: string;
  order: Order;
  tableLabel: string;
}) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return [
    "Commande servie",
    restaurantName,
    tableLabel,
    `${totalItems} articles`,
    order.source === "takeaway" ? "À emporter" : "Service en salle",
    "",
    "La commande est maintenant marquée comme livrée.",
  ].join("\n");
}

export async function dispatchOrderReadyNotification({
  provider,
  restaurant,
  order,
  tableLabel,
}: {
  provider: NotificationProvider;
  restaurant: Restaurant;
  order: Order;
  tableLabel: string;
}): Promise<NotificationDispatchResult> {
  const message = buildOrderReadyNotificationMessage({
    restaurantName: restaurant.name,
    order,
    tableLabel,
  });

  if (provider === "off") {
    return { provider, sent: false, reason: "disabled" };
  }

  if (provider === "android") {
    return { provider, sent: false, reason: "composer_only" };
  }

  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return {
        provider,
        sent: false,
        details: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER missing",
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `Twilio error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "Twilio message sent" };
  }

  if (provider === "whatsapp_business") {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!token || !phoneNumberId || !toNumber) {
      return {
        provider,
        sent: false,
        details: "WHATSAPP_BUSINESS_TOKEN / WHATSAPP_BUSINESS_PHONE_NUMBER_ID missing",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `WhatsApp Business error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "WhatsApp Business message sent" };
  }

  return { provider, sent: false, reason: "disabled" };
}

export async function dispatchOrderServedNotification({
  provider,
  restaurant,
  order,
  tableLabel,
}: {
  provider: NotificationProvider;
  restaurant: Restaurant;
  order: Order;
  tableLabel: string;
}): Promise<NotificationDispatchResult> {
  const message = buildOrderServedNotificationMessage({
    restaurantName: restaurant.name,
    order,
    tableLabel,
  });

  if (provider === "off") {
    return { provider, sent: false, reason: "disabled" };
  }

  if (provider === "android") {
    return { provider, sent: false, reason: "composer_only" };
  }

  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      return {
        provider,
        sent: false,
        details: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER missing",
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `Twilio error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "Twilio message sent" };
  }

  if (provider === "whatsapp_business") {
    const token = process.env.WHATSAPP_BUSINESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim();
    const toNumber = restaurant.whatsappNumber.trim() || restaurant.phone.trim();

    if (!token || !phoneNumberId || !toNumber) {
      return {
        provider,
        sent: false,
        details: "WHATSAPP_BUSINESS_TOKEN / WHATSAPP_BUSINESS_PHONE_NUMBER_ID missing",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: message },
        }),
      },
    );

    if (!response.ok) {
      return {
        provider,
        sent: false,
        details: `WhatsApp Business error ${response.status}`,
      };
    }

    return { provider, sent: true, details: "WhatsApp Business message sent" };
  }

  return { provider, sent: false, reason: "disabled" };
}
