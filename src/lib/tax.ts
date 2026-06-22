import type { TaxCategory } from "@/lib/types";

export const TAX_RATES: Record<TaxCategory, number> = {
  food: 0.1,
  drink: 0.2,
};

const drinkKeywords = [
  "beer",
  "biere",
  "bière",
  "wine",
  "vin",
  "cocktail",
  "spritz",
  "boisson",
  "drink",
  "alcool",
  "aperitif",
  "apéritif",
  "digestif",
  "rum",
  "rhum",
  "whisky",
  "gin",
  "vodka",
  "tequila",
  "champagne",
  "cider",
  "soda",
  "juice",
  "jus",
  "water",
  "eau",
  "coffee",
  "cafe",
  "thé",
  "tea",
];

function normalizeText(value?: string | null) {
  return value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
}

export function inferTaxCategory(categoryName?: string | null, itemName?: string | null): TaxCategory {
  const source = `${normalizeText(categoryName)} ${normalizeText(itemName)}`;
  return drinkKeywords.some((keyword) => source.includes(keyword)) ? "drink" : "food";
}

export function taxRateForCategory(category: TaxCategory) {
  return TAX_RATES[category];
}

export function summarizeTaxBreakdown(
  items: Array<{
    priceSnapshot: number;
    quantity: number;
    taxCategory?: TaxCategory | null;
    taxRate?: number | null;
  }>,
) {
  const subtotal = items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
  const foodTax = items
    .filter((item) => (item.taxCategory ?? "food") === "food")
    .reduce((sum, item) => sum + item.priceSnapshot * item.quantity * (item.taxRate ?? TAX_RATES.food), 0);
  const drinkTax = items
    .filter((item) => item.taxCategory === "drink")
    .reduce((sum, item) => sum + item.priceSnapshot * item.quantity * (item.taxRate ?? TAX_RATES.drink), 0);
  const taxTotal = foodTax + drinkTax;
  return {
    subtotal,
    foodTax,
    drinkTax,
    taxTotal,
    total: subtotal + taxTotal,
  };
}
