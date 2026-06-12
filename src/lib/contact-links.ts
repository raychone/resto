export function normalizePhoneForWhatsApp(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function buildAndroidSmsUrl(phoneNumber: string, message: string) {
  const normalizedPhone = normalizePhoneForWhatsApp(phoneNumber);

  if (!normalizedPhone) {
    return "";
  }

  return `sms:${normalizedPhone}?body=${encodeURIComponent(message)}`;
}

export function buildWhatsAppReservationMessage({
  restaurantName,
  firstName,
  lastName,
  guestCount,
  time,
  dateLabel,
}: {
  restaurantName: string;
  firstName: string;
  lastName: string;
  guestCount: number;
  time: string;
  dateLabel: string;
}) {
  return [
    "Nouvelle réservation",
    restaurantName,
    `${firstName} ${lastName}`.trim(),
    `${guestCount} personnes`,
    time,
    dateLabel,
    "",
    "Répondre: Accepter / Refuser",
  ].join("\n");
}

export function buildWhatsAppUrl(phoneNumber: string, message: string) {
  const normalizedPhone = normalizePhoneForWhatsApp(phoneNumber);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildNotificationLink({
  provider,
  phoneNumber,
  message,
}: {
  provider: "android" | "twilio" | "whatsapp_business" | "off";
  phoneNumber: string;
  message: string;
}) {
  if (provider === "off") {
    return "";
  }

  if (provider === "twilio") {
    return "";
  }

  if (provider === "whatsapp_business") {
    return buildWhatsAppUrl(phoneNumber, message);
  }

  return buildAndroidSmsUrl(phoneNumber, message);
}

export function buildNotificationLabel(provider: "android" | "twilio" | "whatsapp_business" | "off") {
  if (provider === "whatsapp_business") {
    return "WhatsApp Business";
  }

  if (provider === "twilio") {
    return "SMS";
  }

  if (provider === "android") {
    return "Android SMS";
  }

  return "";
}

export function buildGoogleReviewsUrl({
  reviewsUrl,
  restaurantName,
  address,
}: {
  reviewsUrl: string;
  restaurantName: string;
  address: string;
}) {
  if (reviewsUrl.trim()) {
    return reviewsUrl.trim();
  }

  const query = encodeURIComponent(`${restaurantName} ${address} avis Google`);
  return `https://www.google.com/search?q=${query}`;
}

export function buildTripAdvisorUrl({
  tripAdvisorUrl,
  restaurantName,
  address,
}: {
  tripAdvisorUrl: string;
  restaurantName: string;
  address: string;
}) {
  if (tripAdvisorUrl.trim()) {
    return tripAdvisorUrl.trim();
  }

  const query = encodeURIComponent(`${restaurantName} ${address} TripAdvisor`);
  return `https://www.tripadvisor.com/Search?q=${query}`;
}
