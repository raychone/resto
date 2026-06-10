export function normalizePhoneForWhatsApp(value: string) {
  return value.replace(/[^\d]/g, "");
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
