import { promises as fs } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { MenuPdfDocument } from "@/components/menu-pdf-document";
import { listRestaurants } from "@/lib/restaurant-store";
import { locales, translateRestaurant, type Locale } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function resolveLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "fr";
}

async function loadPublicLogo() {
  const logoPath = path.join(process.cwd(), "public", "logo.png");

  try {
    const logo = await fs.readFile(logoPath);
    return `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("lang") ?? "fr");
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((entry) => entry.slug === slug);

  if (!restaurant) {
    return new Response("Not found", { status: 404 });
  }

  const localizedRestaurant = translateRestaurant(restaurant, locale);
  const logoDataUrl = await loadPublicLogo();
  const pdfDocument = React.createElement(MenuPdfDocument, {
    restaurant: localizedRestaurant,
    locale,
    logoDataUrl,
  }) as unknown as React.ReactElement;
  const renderPdf = renderToBuffer as unknown as (
    document: React.ReactElement,
  ) => Promise<Buffer>;
  const pdfBuffer = await renderPdf(pdfDocument);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${localizedRestaurant.slug}-${locale}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
