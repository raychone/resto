import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createBlankRestaurant,
  createDefaultWeeklyHours,
  normalizeRestaurant,
  slugify,
  type Restaurant,
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "restaurants.json");

const seedRestaurants: Restaurant[] = [
  {
    slug: "terra-fresh",
    name: "Terra Fresh Kitchen",
    tagline: "Bowls propres, couleurs denses, goût net.",
    description:
      "Concept fresh-casual centré sur les ingrédients de saison, le dressage épuré et les allergènes clairement affichés.",
    accent: "#0F766E",
    logoUrl:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=80",
    address: "24 Cours de la République, Paris",
    phone: "+33 1 42 00 00 01",
    openingHours: "Lundi - Dimanche, 11:30 - 22:30",
    tableCount: 14,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    currency: "EUR",
    categories: [
      {
        id: "category-signatures",
        name: "Bowls signature",
        description: "Les combinaisons les plus demandées.",
        items: [
          {
            id: "item-umami-bowl",
            name: "Umami Bowl",
            description:
              "Riz jasmin, saumon mariné, avocat, concombre, edamame et sauce au sésame.",
            recipe: "Courte marinade soja, agrumes et miso blanc.",
            ingredients: ["saumon", "riz jasmin", "avocat", "edamame", "sésame"],
            allergens: ["poisson", "soja", "sésame"],
            price: 58,
            imageUrl:
              "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
            isSignature: true,
          },
          {
            id: "item-garden-bowl",
            name: "Garden Glow",
            description:
              "Quinoa, houmous, légumes rôtis, kale, graines et vinaigrette citron.",
            recipe: "Légumes rôtis à haute température pour la caramélisation.",
            ingredients: ["quinoa", "houmous", "kale", "courgette", "graines"],
            allergens: ["sésame"],
            price: 44,
            imageUrl:
              "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
            isSignature: false,
          },
        ],
      },
      {
        id: "category-desserts",
        name: "Desserts",
        description: "Des fins douces, légères et mémorables.",
        items: [
          {
            id: "item-chia",
            name: "Pudding de chia",
            description: "Lait de coco, mangue, crumble d'amandes.",
            recipe: "Hydratation pendant la nuit, service froid.",
            ingredients: ["chia", "lait de coco", "mangue", "amandes"],
            allergens: ["fruits à coque"],
            price: 28,
            imageUrl:
              "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
            isSignature: false,
          },
        ],
      },
    ],
    translations: {
      en: {
        name: "Terra Fresh Kitchen",
        tagline: "Clean bowls, dense colors, clear taste.",
        description:
          "A fresh-casual concept focused on seasonal ingredients, clean plating, and clearly displayed allergens.",
        address: "24 République Avenue, Paris",
        categories: {
          "category-signatures": {
            name: "Signature bowls",
            description: "Our most requested combinations.",
            items: {
              "item-umami-bowl": {
                name: "Umami Bowl",
                description:
                  "Jasmine rice, marinated salmon, avocado, cucumber, edamame and sesame sauce.",
                recipe: "Short marinade with soy, citrus and white miso.",
              },
              "item-garden-bowl": {
                name: "Garden Glow",
                description:
                  "Quinoa, hummus, roasted vegetables, kale, seeds and lemon dressing.",
                recipe: "Vegetables roasted at high heat for caramelization.",
              },
            },
          },
          "category-desserts": {
            name: "Desserts",
            description: "Sweet, light and memorable endings.",
            items: {
              "item-chia": {
                name: "Chia pudding",
                description: "Coconut milk, mango, almond crumble.",
                recipe: "Overnight hydration, served chilled.",
              },
            },
          },
        },
      },
      it: {
        name: "Terra Fresh Kitchen",
        tagline: "Bowl pulite, colori intensi, gusto nitido.",
        description:
          "Un concept fresh-casual centrato su ingredienti di stagione, impiattamento pulito e allergeni ben visibili.",
        address: "24 Avenue de la République, Parigi",
        categories: {
          "category-signatures": {
            name: "Bowl signature",
            description: "Le combinazioni più richieste.",
            items: {
              "item-umami-bowl": {
                name: "Umami Bowl",
                description:
                  "Riso jasmine, salmone marinato, avocado, cetriolo, edamame e salsa al sesamo.",
                recipe: "Breve marinatura con soia, agrumi e miso bianco.",
              },
              "item-garden-bowl": {
                name: "Garden Glow",
                description:
                  "Quinoa, hummus, verdure arrosto, kale, semi e dressing al limone.",
                recipe: "Verdure arrostite ad alta temperatura per caramellare.",
              },
            },
          },
          "category-desserts": {
            name: "Dessert",
            description: "Finali dolci, leggeri e memorabili.",
            items: {
              "item-chia": {
                name: "Pudding di chia",
                description: "Latte di cocco, mango, crumble di mandorle.",
                recipe: "Idratazione notturna, servito freddo.",
              },
            },
          },
        },
      },
      es: {
        name: "Terra Fresh Kitchen",
        tagline: "Bowls limpias, colores densos, sabor claro.",
        description:
          "Un concepto fresh-casual centrado en ingredientes de temporada, emplatado limpio y alérgenos claramente visibles.",
        address: "24 Avenue de la République, París",
        categories: {
          "category-signatures": {
            name: "Bowls signature",
            description: "Las combinaciones más pedidas.",
            items: {
              "item-umami-bowl": {
                name: "Umami Bowl",
                description:
                  "Arroz jazmín, salmón marinado, aguacate, pepino, edamame y salsa de sésamo.",
                recipe: "Marinado corto con soja, cítricos y miso blanco.",
              },
              "item-garden-bowl": {
                name: "Garden Glow",
                description:
                  "Quinoa, hummus, verduras asadas, kale, semillas y aliño de limón.",
                recipe: "Verduras asadas a alta temperatura para caramelizar.",
              },
            },
          },
          "category-desserts": {
            name: "Postres",
            description: "Finales dulces, ligeros y memorables.",
            items: {
              "item-chia": {
                name: "Pudín de chía",
                description: "Leche de coco, mango, crumble de almendra.",
                recipe: "Hidratación durante la noche, servido frío.",
              },
            },
          },
        },
      },
    },
  },
  {
    slug: "brasa-uno",
    name: "Brasa Uno",
    tagline: "Viande maturée, feu, texture, contraste.",
    description:
      "Steakhouse urbain avec des menus denses, des prix clairs et de grandes images pour chaque plat.",
    accent: "#B45309",
    logoUrl:
      "https://images.unsplash.com/photo-1529612700005-e35377bf1415?auto=format&fit=crop&w=800&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80",
    address: "51 Boulevard des Aéroports, Lyon",
    phone: "+33 4 00 00 00 02",
    openingHours: "Mardi - Dimanche, 13:00 - 23:30",
    tableCount: 16,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    currency: "EUR",
    categories: [
      {
        id: "category-main",
        name: "Plats principaux",
        description: "Les plats qui définissent l'expérience.",
        items: [
          {
            id: "item-ribeye",
            name: "Ribeye 350 g",
            description: "Avec beurre aromatisé, pommes de terre wedges et salade verte.",
            recipe: "Saisi au grill, fini au beurre et à l'ail.",
            ingredients: ["bœuf", "beurre", "pommes de terre", "salade", "ail"],
            allergens: ["lait"],
            price: 124,
            imageUrl:
              "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80",
            isSignature: true,
          },
        ],
      },
    ],
    translations: {
      en: {
        name: "Brasa Uno",
        tagline: "Aged meat, fire, texture, contrast.",
        description:
          "An urban steakhouse with dense menus, clear prices and large images for every dish.",
        address: "51 Airports Boulevard, Lyon",
        categories: {
          "category-main": {
            name: "Main courses",
            description: "The dishes that define the experience.",
            items: {
              "item-ribeye": {
                name: "Ribeye 350 g",
                description: "With herb butter, wedges and green salad.",
                recipe: "Grilled, finished with butter and garlic.",
              },
            },
          },
        },
      },
      it: {
        name: "Brasa Uno",
        tagline: "Carne frollata, fuoco, consistenza, contrasto.",
        description:
          "Una steakhouse urbana con menu densi, prezzi chiari e immagini grandi per ogni piatto.",
        address: "51 Boulevard des Aéroports, Lione",
        categories: {
          "category-main": {
            name: "Piatti principali",
            description: "I piatti che definiscono l'esperienza.",
            items: {
              "item-ribeye": {
                name: "Ribeye 350 g",
                description: "Con burro aromatico, patate wedges e insalata verde.",
                recipe: "Alla griglia, rifinito con burro e aglio.",
              },
            },
          },
        },
      },
      es: {
        name: "Brasa Uno",
        tagline: "Carne madurada, fuego, textura, contraste.",
        description:
          "Un steakhouse urbano con menús densos, precios claros e imágenes grandes para cada plato.",
        address: "51 Boulevard des Aéroports, Lyon",
        categories: {
          "category-main": {
            name: "Platos principales",
            description: "Los platos que definen la experiencia.",
            items: {
              "item-ribeye": {
                name: "Ribeye 350 g",
                description: "Con mantequilla aromática, wedges y ensalada verde.",
                recipe: "A la parrilla, terminado con mantequilla y ajo.",
              },
            },
          },
        },
      },
    },
  },
  {
    slug: "sakura-noir",
    name: "Sakura Noir",
    tagline: "Fine dining japonais aux accents graphiques.",
    description:
      "Design minimaliste, plats épurés, focus sur les allergènes et une expérience parfaite sur mobile.",
    accent: "#BE123C",
    logoUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1600&q=80",
    address: "8 Rue des Lilas, Marseille",
    phone: "+33 4 00 00 00 03",
    openingHours: "Lundi - Samedi, 12:00 - 22:00",
    tableCount: 10,
    seatsPerTable: 2,
    weeklyHours: createDefaultWeeklyHours(),
    currency: "EUR",
    categories: [
      {
        id: "category-sushi",
        name: "Sushi",
        description: "Rouleaux, sashimis et plateaux à partager.",
        items: [
          {
            id: "item-noir-roll",
            name: "Noir Roll",
            description: "Saumon, avocat, concombre, tobiko et mayo épicée.",
            recipe: "Roulé serré, tranché froid, glaçage discret.",
            ingredients: ["saumon", "avocat", "concombre", "tobiko", "mayo"],
            allergens: ["poisson", "œuf", "soja"],
            price: 72,
            imageUrl:
              "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
            isSignature: true,
          },
        ],
      },
    ],
    translations: {
      en: {
        name: "Sakura Noir",
        tagline: "Japanese fine dining with graphic accents.",
        description:
          "Minimalist design, clean dishes, focus on allergens and a perfect mobile experience.",
        address: "8 Lilacs Street, Marseille",
        categories: {
          "category-sushi": {
            name: "Sushi",
            description: "Rolls, sashimi and sharing platters.",
            items: {
              "item-noir-roll": {
                name: "Noir Roll",
                description: "Salmon, avocado, cucumber, tobiko and spicy mayo.",
                recipe: "Tight roll, chilled cut, subtle glaze.",
              },
            },
          },
        },
      },
      it: {
        name: "Sakura Noir",
        tagline: "Fine dining giapponese con accenti grafici.",
        description:
          "Design minimale, piatti puliti, focus sugli allergeni e un'esperienza perfetta su mobile.",
        address: "8 Rue des Lilas, Marsiglia",
        categories: {
          "category-sushi": {
            name: "Sushi",
            description: "Roll, sashimi e plateau da condividere.",
            items: {
              "item-noir-roll": {
                name: "Noir Roll",
                description: "Salmone, avocado, cetriolo, tobiko e mayo piccante.",
                recipe: "Arrotolato stretto, tagliato freddo, glassatura leggera.",
              },
            },
          },
        },
      },
      es: {
        name: "Sakura Noir",
        tagline: "Fine dining japonés con acentos gráficos.",
        description:
          "Diseño minimalista, platos limpios, foco en alérgenos y una experiencia perfecta en móvil.",
        address: "8 Rue des Lilas, Marsella",
        categories: {
          "category-sushi": {
            name: "Sushi",
            description: "Rolls, sashimi y bandejas para compartir.",
            items: {
              "item-noir-roll": {
                name: "Noir Roll",
                description: "Salmón, aguacate, pepino, tobiko y mayo picante.",
                recipe: "Enrollado firme, cortado en frío, glaseado sutil.",
              },
            },
          },
        },
      },
    },
  },
];

async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(seedRestaurants, null, 2), "utf8");
  }
}

async function readRestaurantsFile() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Restaurant[];

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    typeof parsed[0]?.logoUrl !== "string" ||
    typeof parsed[0]?.translations !== "object" ||
    !Array.isArray(parsed[0]?.weeklyHours) ||
    !Array.isArray(parsed[0]?.weeklyHours?.[0]?.intervals)
  ) {
    await writeRestaurantsFile(seedRestaurants);
    return seedRestaurants;
  }

  return parsed.map(normalizeRestaurant);
}

async function writeRestaurantsFile(restaurants: Restaurant[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(restaurants, null, 2), "utf8");
}

export async function listRestaurants() {
  return readRestaurantsFile();
}

export async function getRestaurantBySlug(slug: string) {
  const restaurants = await readRestaurantsFile();
  return restaurants.find((restaurant) => restaurant.slug === slug) ?? null;
}

export async function saveRestaurant(input: Restaurant) {
  const restaurant = normalizeRestaurant(input);
  const restaurants = await readRestaurantsFile();
  const index = restaurants.findIndex((entry) => entry.slug === restaurant.slug);

  if (index >= 0) {
    restaurants[index] = restaurant;
  } else {
    restaurants.push(restaurant);
  }

  await writeRestaurantsFile(restaurants);
  return restaurant;
}

export async function updateRestaurant(slug: string, input: Restaurant) {
  const restaurants = await readRestaurantsFile();
  const restaurant = normalizeRestaurant({
    ...input,
    slug: input.slug || slug,
  });
  const index = restaurants.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    return null;
  }

  const nextRestaurants = restaurants.filter((entry) => entry.slug !== slug);
  nextRestaurants.push(restaurant);

  await writeRestaurantsFile(nextRestaurants);
  return restaurant;
}

export async function createRestaurant(input?: Partial<Restaurant>) {
  const template = createBlankRestaurant();
  const restaurant = normalizeRestaurant({
    ...template,
    ...input,
    slug: input?.slug ? slugify(input.slug) : template.slug,
  });

  const restaurants = await readRestaurantsFile();
  const nextRestaurants = [...restaurants, restaurant];
  await writeRestaurantsFile(nextRestaurants);
  return restaurant;
}

export async function deleteRestaurant(slug: string) {
  const restaurants = await readRestaurantsFile();
  const nextRestaurants = restaurants.filter((entry) => entry.slug !== slug);
  await writeRestaurantsFile(nextRestaurants);
}
