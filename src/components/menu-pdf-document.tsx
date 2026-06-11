import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Locale, Restaurant } from "@/lib/types";

type MenuPdfDocumentProps = {
  restaurant: Restaurant;
  locale: Locale;
  logoDataUrl?: string | null;
};

const localeLabels: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  it: "Italiano",
  es: "Español",
};

const labels: Record<
  Locale,
  {
    menuTitle: string;
    subtitle: string;
    address: string;
    phone: string;
    ingredients: string;
    allergens: string;
  }
> = {
  fr: {
    menuTitle: "Menu A3",
    subtitle: "Version imprimable du menu du restaurant",
    address: "Adresse",
    phone: "Téléphone",
    ingredients: "Ingrédients",
    allergens: "Allergènes",
  },
  en: {
    menuTitle: "A3 Menu",
    subtitle: "Printable restaurant menu",
    address: "Address",
    phone: "Phone",
    ingredients: "Ingredients",
    allergens: "Allergens",
  },
  it: {
    menuTitle: "Menu A3",
    subtitle: "Versione stampabile del menu",
    address: "Indirizzo",
    phone: "Telefono",
    ingredients: "Ingredienti",
    allergens: "Allergeni",
  },
  es: {
    menuTitle: "Menú A3",
    subtitle: "Versión imprimible del menú",
    address: "Dirección",
    phone: "Teléfono",
    ingredients: "Ingredientes",
    allergens: "Alérgenos",
  },
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#f4efe6",
    color: "#141414",
    paddingTop: 24,
    paddingHorizontal: 28,
    paddingBottom: 24,
    fontFamily: "Helvetica",
  },
  shell: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e8ddcf",
    padding: 24,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5dfd5",
    backgroundColor: "#fbfaf7",
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    objectFit: "cover",
  },
  restaurantName: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#6b6258",
  },
  header: {
    flexDirection: "row",
    gap: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#ece5dc",
  },
  hero: {
    flex: 1.15,
    gap: 14,
  },
  meta: {
    flex: 0.85,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ece5dc",
    backgroundColor: "#fbfaf7",
    padding: 14,
  },
  eyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    color: "#8a8278",
  },
  title: {
    fontSize: 36,
    lineHeight: 1.02,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#5f584f",
    maxWidth: 320,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  infoCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece5dc",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  infoLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    color: "#a39a90",
  },
  infoValue: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#2d2721",
  },
  category: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece5dc",
    backgroundColor: "#fbfaf7",
    breakInside: "avoid",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 700,
  },
  categoryCount: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#8a8278",
  },
  categoryDescription: {
    fontSize: 11,
    lineHeight: 1.45,
    color: "#5f584f",
    marginBottom: 10,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemCard: {
    width: "48.5%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e9e1d7",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  itemDescription: {
    marginTop: 5,
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#5f584f",
  },
  priceBox: {
    minWidth: 56,
    borderRadius: 12,
    backgroundColor: "#141414",
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#c8c8c8",
  },
  priceValue: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
  },
  detailBlock: {
    marginTop: 9,
  },
  detailLabel: {
    fontSize: 8.5,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#9e9488",
  },
  detailValue: {
    marginTop: 4,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#2d2721",
  },
});

function formatPrice(locale: Locale, price: number) {
  const rounded = Math.round(price * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${formatted.replace(".", ",")}€`;
}

export function MenuPdfDocument({ restaurant, locale, logoDataUrl }: MenuPdfDocumentProps) {
  const copy = labels[locale];

  return (
    <Document title={`${restaurant.name} - ${copy.menuTitle}`}>
      <Page size="A3" orientation="portrait" style={styles.page}>
        <View style={styles.shell}>
          <View style={styles.topLine}>
            <View style={styles.pill}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null}
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
            </View>
            <Text style={styles.eyebrow}>
              {copy.menuTitle} • {localeLabels[locale]}
            </Text>
          </View>

          <View style={styles.header}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>{copy.subtitle}</Text>
              <Text style={styles.title}>{restaurant.name}</Text>
              <Text style={styles.subtitle}>{restaurant.tagline}</Text>
              <Text style={styles.subtitle}>{restaurant.description}</Text>
            </View>

            <View style={styles.meta}>
              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{copy.address}</Text>
                  <Text style={styles.infoValue}>{restaurant.address}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{copy.phone}</Text>
                  <Text style={styles.infoValue}>{restaurant.phone}</Text>
                </View>
              </View>
            </View>
          </View>

          {restaurant.categories.map((category) => (
            <View key={category.id} style={styles.category}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.items.length} items</Text>
              </View>
              <Text style={styles.categoryDescription}>{category.description}</Text>

              <View style={styles.itemGrid}>
                {category.items.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemDescription}>{item.description}</Text>
                      </View>
                      <View style={styles.priceBox}>
                        <Text style={styles.priceLabel}>Prix</Text>
                        <Text style={styles.priceValue}>{formatPrice(locale, item.price)}</Text>
                      </View>
                    </View>

                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>{copy.ingredients}</Text>
                      <Text style={styles.detailValue}>{item.ingredients.join(" • ")}</Text>
                    </View>

                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>{copy.allergens}</Text>
                      <Text style={styles.detailValue}>
                        {item.allergens.length > 0 ? item.allergens.join(" • ") : "—"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

        </View>
      </Page>
    </Document>
  );
}
