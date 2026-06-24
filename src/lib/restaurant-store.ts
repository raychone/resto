import { promises as fs } from "node:fs";
import path from "node:path";
import { publishRestaurantRealtimeEvent } from "@/lib/realtime";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";
import {
  createBlankRestaurant,
  createDefaultWeeklyHours,
  normalizeRestaurant,
  slugify,
  type Restaurant,
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "restaurants.json");
const canPersistDataFiles = process.env.VERCEL !== "1" && !hasSupabaseConfig();

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  status: Restaurant["status"];
  plan: Restaurant["plan"];
  tagline: string;
  description: string;
  accent: string;
  logo_url: string;
  hero_image: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  uber_eats_url: string;
  trip_advisor_url: string;
  google_rating: number;
  google_reviews_count: number;
  google_reviews_url: string;
  opening_hours: string;
  table_count: number;
  seats_per_table: number;
  weekly_hours: Restaurant["weeklyHours"];
  happy_hour_schedule: Restaurant["happyHourSchedule"] | null;
  features: Restaurant["features"];
  currency: string;
  categories: Restaurant["categories"];
  translations: Restaurant["translations"];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function restaurantRowToDomain(row: RestaurantRow) {
  return normalizeRestaurant({
    id: row.id ?? "",
    slug: row.slug ?? "",
    name: row.name ?? "",
    status: row.status,
    plan: row.plan,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    accent: row.accent ?? "#8B5CF6",
    logoUrl: row.logo_url ?? "",
    heroImage: row.hero_image ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    whatsappNumber: row.whatsapp_number ?? "",
    uberEatsUrl: row.uber_eats_url ?? "",
    tripAdvisorUrl: row.trip_advisor_url ?? "",
    googleRating: row.google_rating ?? 0,
    googleReviewsCount: row.google_reviews_count ?? 0,
    googleReviewsUrl: row.google_reviews_url ?? "",
    openingHours: row.opening_hours ?? "",
    tableCount: row.table_count,
    seatsPerTable: row.seats_per_table,
    weeklyHours: row.weekly_hours,
    happyHourSchedule: row.happy_hour_schedule ?? undefined,
    features: row.features,
    currency: row.currency,
    categories: row.categories,
    translations: row.translations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function restaurantDomainToRow(restaurant: Restaurant): RestaurantRow {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    status: restaurant.status,
    plan: restaurant.plan,
    tagline: restaurant.tagline,
    description: restaurant.description,
    accent: restaurant.accent,
    logo_url: restaurant.logoUrl,
    hero_image: restaurant.heroImage,
    address: restaurant.address,
    phone: restaurant.phone,
    whatsapp_number: restaurant.whatsappNumber ?? "",
    uber_eats_url: restaurant.uberEatsUrl ?? "",
    trip_advisor_url: restaurant.tripAdvisorUrl ?? "",
    google_rating: restaurant.googleRating ?? 0,
    google_reviews_count: restaurant.googleReviewsCount ?? 0,
    google_reviews_url: restaurant.googleReviewsUrl ?? "",
    opening_hours: restaurant.openingHours,
    table_count: restaurant.tableCount ?? 0,
    seats_per_table: restaurant.seatsPerTable ?? 0,
    weekly_hours: restaurant.weeklyHours,
    happy_hour_schedule: restaurant.happyHourSchedule ?? null,
    features: restaurant.features,
    currency: restaurant.currency ?? "EUR",
    categories: restaurant.categories,
    translations: restaurant.translations,
    created_at: restaurant.createdAt,
    updated_at: restaurant.updatedAt,
    deleted_at: restaurant.deletedAt ?? null,
  };
}

const seedRestaurants: Restaurant[] = [
  {
    id: "terra-fresh",
    slug: "terra-fresh",
    name: "Terra Fresh Kitchen",
    status: "active",
    plan: "pro",
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
    whatsappNumber: "+33 1 42 00 00 01",
    uberEatsUrl: "",
    tripAdvisorUrl: "",
    googleRating: 4.8,
    googleReviewsCount: 186,
    googleReviewsUrl: "",
    openingHours: "Lundi - Dimanche, 11:30 - 22:30",
    tableCount: 14,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    features: {
      orderFlowEnabled: true,
      clientLoginEnabled: true,
      waiterValidationEnabled: true,
      kitchenWorkflowEnabled: true,
      servedConfirmationEnabled: true,
      bookingEnabled: true,
      qrMode: "pdf",
      notificationProvider: "android",
      whatsappAlertsEnabled: true,
      smsAlertsEnabled: false,
      googleReviewsEnabled: true,
    },
    currency: "EUR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
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
    id: "brasa-uno",
    slug: "brasa-uno",
    name: "Brasa Uno",
    status: "active",
    plan: "pro",
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
    whatsappNumber: "+33 4 00 00 00 02",
    uberEatsUrl: "",
    tripAdvisorUrl: "",
    googleRating: 4.7,
    googleReviewsCount: 94,
    googleReviewsUrl: "",
    openingHours: "Mardi - Dimanche, 13:00 - 23:30",
    tableCount: 16,
    seatsPerTable: 4,
    weeklyHours: createDefaultWeeklyHours(),
    features: {
      orderFlowEnabled: true,
      clientLoginEnabled: true,
      waiterValidationEnabled: true,
      kitchenWorkflowEnabled: true,
      servedConfirmationEnabled: true,
      bookingEnabled: true,
      qrMode: "pdf",
      notificationProvider: "android",
      whatsappAlertsEnabled: true,
      smsAlertsEnabled: false,
      googleReviewsEnabled: true,
    },
    currency: "EUR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
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
  "id": "bar-1",
  "slug": "bar-1",
  "name": "Noir 1",
  "status": "trial",
  "plan": "starter",
  "tagline": "Bar mobile-first avec happy hour, boissons, bières et digestifs.",
  "description": "Bar de quartier pensé pour un menu QR mobile-first, orienté boissons, happy hour, bières, cocktails et digestifs.",
  "accent": "#7C3AED",
  "logoUrl": "/bar-1-logo.svg",
  "heroImage": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80",
  "address": "8 Rue des Lilas, Marseille",
  "phone": "+33 4 00 00 00 03",
  "whatsappNumber": "+33 4 00 00 00 03",
  "uberEatsUrl": "",
  "tripAdvisorUrl": "",
  "googleRating": 4.9,
  "googleReviewsCount": 221,
  "googleReviewsUrl": "",
  "openingHours": "Lundi - Samedi, 17:00 - 02:00",
  "tableCount": 10,
  "seatsPerTable": 2,
  "weeklyHours": createDefaultWeeklyHours(),
  "happyHourSchedule": {
    "enabled": true,
    "label": "Happy Hour",
    "days": [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun"
    ],
    "start": "18:30",
    "end": "20:30"
  },
  "features": {
    "orderFlowEnabled": true,
    "clientLoginEnabled": true,
    "waiterValidationEnabled": true,
    "kitchenWorkflowEnabled": true,
    "servedConfirmationEnabled": true,
    "bookingEnabled": false,
    "qrMode": "menu",
    "notificationProvider": "android",
    "whatsappAlertsEnabled": true,
    "smsAlertsEnabled": true,
    "googleReviewsEnabled": true
  },
  "currency": "EUR",
  "createdAt": new Date().toISOString(),
  "updatedAt": new Date().toISOString(),
  "deletedAt": null,
  "categories": [
    {
      "id": "category-happy-hour",
      "name": "Happy Hour 6:30pm - 8:30pm",
      "description": "Les best-sellers à prix doux pendant la plage horaire happy hour.",
      "items": [
        {
          "id": "item-hh-krombacher-pint",
          "name": "Krombacher Pint",
          "description": "Krombacher Pint",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": true,
          "happyHourPrice": 5,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-hh-ricard-pastis",
          "name": "Ricard Pastis",
          "description": "Ricard Pastis",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 2.8,
          "happyHourEnabled": true,
          "happyHourPrice": 2,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-casanis-pastis",
          "name": "Casanis Pastis",
          "description": "Casanis Pastis",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 2.8,
          "happyHourEnabled": true,
          "happyHourPrice": 2,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-spritz",
          "name": "Spritz",
          "description": "Spritz",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-hh-gin-hibiscus",
          "name": "Gin Hibiscus",
          "description": "Gin Hibiscus",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-moscow-mule",
          "name": "Moscow Mule",
          "description": "Moscow Mule",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-london-mule",
          "name": "London Mule",
          "description": "London Mule",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-caribbean-mule",
          "name": "Caribbean Mule",
          "description": "Caribbean Mule",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-cuba-libre",
          "name": "Cuba Libre",
          "description": "Cuba Libre",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-jagger-bomb",
          "name": "Jagger Bomb",
          "description": "Jagger Bomb",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-gin-fizz",
          "name": "Gin Fizz",
          "description": "Gin Fizz",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-tequila-sunrise",
          "name": "Tequila Sunrise",
          "description": "Tequila Sunrise",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-daiquiri",
          "name": "Daiquiri",
          "description": "Daiquiri",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-bloody-mary",
          "name": "Bloody Mary",
          "description": "Bloody Mary",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": true,
          "happyHourPrice": 7.5,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hh-strawberry-water",
          "name": "Le Sirop de Fraise à l'Eau",
          "description": "Le Sirop de Fraise à l'Eau",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 3,
          "happyHourEnabled": true,
          "happyHourPrice": 2,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-draft-beers",
      "name": "Draft Beers",
      "description": "Bières pression pour service rapide et lisible.",
      "items": [
        {
          "id": "item-krombacher-blonde",
          "name": "Krombacher Blonde",
          "description": "Bière blonde pression.",
          "recipe": "Servie bien fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-blanche-bruxelles",
          "name": "Blanche de Bruxelles",
          "description": "Blanche légère et aromatique.",
          "recipe": "Servie bien fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-goudale-ambree",
          "name": "Goudale Ambrée",
          "description": "Ambrée ronde et maltée.",
          "recipe": "Servie bien fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-ohara-ipa",
          "name": "O'Hara's IPA",
          "description": "IPA houblonnée.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-picon-biere",
          "name": "Picon Bière",
          "description": "Bière avec touche amère.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-shandy",
          "name": "Shandy",
          "description": "Bière légère citronnée.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 7,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-monaco",
          "name": "Monaco",
          "description": "Bière, grenadine et limonade.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-cervoise",
          "name": "Cervoise",
          "description": "Bière à l’ancienne.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-syrup-draft",
          "name": "+ Syrup",
          "description": "Sirop en complément.",
          "recipe": "Ajout au verre.",
          "ingredients": [],
          "allergens": [],
          "price": 0.6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-bottled-beers",
      "name": "Bottled Beers",
      "description": "Bières bouteille et sans alcool.",
      "items": [
        {
          "id": "item-grimbergen",
          "name": "Grimbergen (25cl)",
          "description": "Bouteille 25cl.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-goudale-zero",
          "name": "Goudale 0.0% (25cl)",
          "description": "Sans alcool.",
          "recipe": "Servie fraîche.",
          "ingredients": [],
          "allergens": [],
          "price": 4.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514207437708-89f8c5b0d0e8?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-aperitifs",
      "name": "Aperitifs",
      "description": "Apéritifs classiques du bar.",
      "items": [
        {
          "id": "item-pastis-ricard-casanis",
          "name": "Pastis / Ricard / Casanis (2cl)",
          "description": "Service sec.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 2.8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-suze",
          "name": "Suze (5cl)",
          "description": "Amer doux et sec.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-white-martini",
          "name": "White Martini (5cl)",
          "description": "Vermouth blanc.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-aperol",
          "name": "Apérol (4cl)",
          "description": "Amer italien.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-white-wine-blackcurrant",
          "name": "White Wine & Blackcurrant",
          "description": "Vin blanc + cassis.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-puputa-aperitif",
          "name": "Puputa",
          "description": "Rosé léger signature maison.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        }
      ]
    },
    {
      "id": "category-wines",
      "name": "Wines",
      "description": "Vins et bouteilles à partager.",
      "items": [
        {
          "id": "item-chamasutra-rouge",
          "name": "Chamasutra Rouge",
          "description": "Bottle 75cl / 12.5cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 22,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-chat-blanc",
          "name": "Je donne ma langue au chat Blanc",
          "description": "Bottle 75cl / 12.5cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 22,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-chats-rosé",
          "name": "La nuit tous les chats sont gris Rosé",
          "description": "Bottle 75cl / 12.5cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 22,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-syrup-wine",
          "name": "+ Syrup",
          "description": "Sirop en complément.",
          "recipe": "Ajout au verre.",
          "ingredients": [],
          "allergens": [],
          "price": 0.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-prosecco",
          "name": "Prosecco",
          "description": "Verre pétillant.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-puputa-wine",
          "name": "Puputa (XL Rosé with Lemonade)",
          "description": "Rosé XXL à la limonade.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-champagne",
          "name": "Bottle of Champagne",
          "description": "Bouteille de champagne.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 65,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        }
      ]
    },
    {
      "id": "category-cocktails",
      "name": "Cocktails & Mocktails",
      "description": "Les signatures et les classiques du bar.",
      "items": [
        {
          "id": "item-spritz",
          "name": "Spritz",
          "description": "Apéritif signature.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-gin-hibiscus",
          "name": "Gin Hibiscus",
          "description": "Gin floral et frais.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-moscow-mule",
          "name": "Moscow Mule",
          "description": "Vodka, gingembre, citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-london-mule",
          "name": "London Mule",
          "description": "Gin, ginger beer, citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-caribbean-mule",
          "name": "Caribbean Mule",
          "description": "Rhum, gingembre, citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-cuba-libre",
          "name": "Cuba Libre",
          "description": "Rhum, cola, citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-jagger-bomb",
          "name": "Jagger Bomb",
          "description": "Shot énergique.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-gin-fizz",
          "name": "Gin Fizz",
          "description": "Gin, citron, eau gazeuse.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-tequila-sunrise",
          "name": "Tequila Sunrise",
          "description": "Tequila et agrumes.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 8.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-daiquiri",
          "name": "Daiquiri",
          "description": "Rhum et citron vert.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-bloody-mary",
          "name": "Bloody Mary",
          "description": "Vodka et tomate épicée.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-elderflower-mule",
          "name": "Virgin Elderflower Mule (Alcohol-Free)",
          "description": "Mocktail sans alcool.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-house-punches",
      "name": "House Punches",
      "description": "Punchs maison servis rapidement.",
      "items": [
        {
          "id": "item-coco-citron",
          "name": "Coco Citron",
          "description": "Punch 16cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-passion",
          "name": "Passion",
          "description": "Punch 16cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-goyave",
          "name": "Goyave",
          "description": "Punch 16cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-punch-bottle",
          "name": "1L Bottle of Punch",
          "description": "Bouteille 1L.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 38,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-infused-rums",
      "name": "Infused Rums",
      "description": "Rhum arrangé et bouteilles maison.",
      "items": [
        {
          "id": "item-gwada",
          "name": "Le Gwada",
          "description": "3cl / 5cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-madinina",
          "name": "Le Madinina",
          "description": "3cl / 5cl.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-dark-rums",
      "name": "Dark Rums",
      "description": "Rhum ambré et vieux rhums.",
      "items": [
        {
          "id": "item-angostura-7",
          "name": "Angostura 7 ans",
          "description": "Rhum vieux.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-santa-teresa-1796",
          "name": "Santa Teresa 1796",
          "description": "Rhum vieux.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-ryoma",
          "name": "Ryoma",
          "description": "Rhum nippon.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-millonario-15",
          "name": "Millonario 15 ans",
          "description": "Rhum vieux.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-plantation-xo",
          "name": "Plantation XO",
          "description": "Rhum premium.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 12,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-grog",
          "name": "Grog",
          "description": "Cocktail chaud/simple.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 5.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-white-rums",
      "name": "White Rums & Ti Punches",
      "description": "Rhum blanc et ti punchs.",
      "items": [
        {
          "id": "item-hse-40",
          "name": "HSE 40°",
          "description": "Rhum blanc.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 5.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-hse-55",
          "name": "HSE 55°",
          "description": "Rhum blanc.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-trois-rivieres-50",
          "name": "Trois Rivières 50°",
          "description": "Rhum blanc.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-whiskies",
      "name": "Whiskies",
      "description": "Whiskies, shots et verres.",
      "items": [
        {
          "id": "item-classic-whisky",
          "name": "Classic Whisky",
          "description": "shot: 4€ / glass: 6€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-jameson",
          "name": "Jameson",
          "description": "shot: 4.50€ / glass: 7.50€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-aberlour",
          "name": "Aberlour",
          "description": "Single malt.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-bowmore",
          "name": "Bowmore",
          "description": "Single malt.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-talisker",
          "name": "Talisker",
          "description": "Single malt.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-nikka-days",
          "name": "Nikka Days",
          "description": "Whisky japonais.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-nikka-coffey-grain",
          "name": "Nikka Coffey Grain",
          "description": "Whisky japonais.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-lagavulin",
          "name": "Lagavulin",
          "description": "Single malt tourbé.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 14,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-jack-daniels",
          "name": "Jack Daniel's",
          "description": "shot: 4.50€ / glass: 7.50€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-whisky-soft",
          "name": "+ Soft",
          "description": "0.50€ / Red Bull 2.50€",
          "recipe": "Ajout au verre.",
          "ingredients": [],
          "allergens": [],
          "price": 2.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1514361892635-e6f0d09c9d7b?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-gins",
      "name": "Gins",
      "description": "Gins classiques et locaux.",
      "items": [
        {
          "id": "item-classic-gin",
          "name": "Classic Gin",
          "description": "Gin classique.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-bombay-sapphire",
          "name": "Bombay Sapphire",
          "description": "Gin premium.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-tanqueray",
          "name": "Tanqueray",
          "description": "Gin premium.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 7,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-lone",
          "name": "LÔNE Local & Artisanal",
          "description": "shot: 4€ / glass: 8€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-hendricks",
          "name": "Hendricks",
          "description": "Gin floral.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-gunpowder",
          "name": "Gunpowder",
          "description": "shot: 5€ / glass: 8€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 8,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-monkey-47",
          "name": "Monkey 47",
          "description": "shot: 6€ / glass: 10€",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-gin-soft",
          "name": "+ Soft",
          "description": "Tonic/Coke/Orange: 0.50€ / Red Bull: 2.50€",
          "recipe": "Ajout au verre.",
          "ingredients": [],
          "allergens": [],
          "price": 2.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-london-mule-gin",
          "name": "London Mule",
          "description": "Gin, ginger beer et citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-vodkas",
      "name": "Vodkas",
      "description": "Vodkas et bases cocktails.",
      "items": [
        {
          "id": "item-ice-cold-vodka",
          "name": "Ice-Cold Vodka",
          "description": "Vodka pure.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-organic-apple-vodka",
          "name": "Organic Apple Vodka",
          "description": "Vodka pomme.",
          "recipe": "Servi sec.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-moscow-mule-vodka",
          "name": "Moscow Mule",
          "description": "Vodka, gingembre, citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 10,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-vodka-soft",
          "name": "+ Soft",
          "description": "Tonic/Coke/Orange: 0.50€ / Red Bull: 2.50€",
          "recipe": "Ajout au verre.",
          "ingredients": [],
          "allergens": [],
          "price": 2.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-shot-vodka",
          "name": "Shot Vodka",
          "description": "Vodka shot.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 3.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": true
        },
        {
          "id": "item-vodka-shot-syrup",
          "name": "Vodka Shot + Syrup",
          "description": "Shot avec sirop.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 3.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-tequilas",
      "name": "Tequilas",
      "description": "Tequilas au shot et boards.",
      "items": [
        {
          "id": "item-white-tequila",
          "name": "White Tequila Shot Salt Lemon",
          "description": "Shot tequila sel-citron.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 3.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-reposado-tequila",
          "name": "Reposado Tequila Shot Salt Lemon",
          "description": "Shot tequila reposado.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 4,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-board-white",
          "name": "Board of 10 White Tequila Shots",
          "description": "Planche de 10 shots.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 30,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-board-reposado",
          "name": "Board of 10 Reposado Shots",
          "description": "Planche de 10 shots.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 35,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    },
    {
      "id": "category-digestifs",
      "name": "Digestifs (4cl)",
      "description": "Digestifs de fin de service.",
      "items": [
        {
          "id": "item-get27",
          "name": "Get 27",
          "description": "Digestif mentholé.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-jagermeister",
          "name": "Jägermeister",
          "description": "Digestif aux herbes.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-baileys",
          "name": "Bailey's",
          "description": "Crème irlandaise.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 6.5,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-cognac-vsop",
          "name": "Cognac V.S.O.P",
          "description": "Cognac premium.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-calva-vsop",
          "name": "Calva V.S.O.P",
          "description": "Calvados premium.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        },
        {
          "id": "item-poire-williams",
          "name": "Poire Williams",
          "description": "Eau-de-vie de poire.",
          "recipe": "Servi frais.",
          "ingredients": [],
          "allergens": [],
          "price": 9,
          "happyHourEnabled": false,
          "happyHourPrice": null,
          "imageUrl": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
          "isSignature": false
        }
      ]
    }
  ]
},
{
  id: "food-1-restaurant",
  slug: "food-1",
  name: "Food 1",
  status: "trial",
  plan: "starter",
  tagline: "Italian casual food, light theme, family friendly.",
  description:
    "A modern Italian casual restaurant focused on fresh pasta, pizza, salads and generous food offers.",
  accent: "#c41e1e",
  logoUrl: "/food-1-logo.svg",
  heroImage:
    "https://images.unsplash.com/photo-1498579809087-ef1e558fd1da?auto=format&fit=crop&w=1600&q=80",
  address: "19 Via Roma, Milan",
  phone: "+39 02 00 00 00 01",
  whatsappNumber: "+39 02 00 00 00 01",
  uberEatsUrl: "",
  tripAdvisorUrl: "",
  googleRating: 4.8,
  googleReviewsCount: 176,
  googleReviewsUrl: "",
  openingHours: "Lunedì - Domenica, 11:30 - 22:30",
  tableCount: 14,
  seatsPerTable: 4,
  weeklyHours: createDefaultWeeklyHours(),
  happyHourSchedule: null,
  features: {
    orderFlowEnabled: true,
    clientLoginEnabled: true,
    waiterValidationEnabled: true,
    kitchenWorkflowEnabled: true,
    servedConfirmationEnabled: true,
    bookingEnabled: true,
    qrMode: "menu",
    notificationProvider: "android",
    whatsappAlertsEnabled: true,
    smsAlertsEnabled: true,
    googleReviewsEnabled: true,
  },
  currency: "EUR",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  categories: [
    {
      id: "food1-antipasti",
      name: "Antipasti",
      description: "Warm starters, breads and shareable plates.",
      items: [
        {
          id: "food1-antipasti-burrata",
          name: "Burrata & Focaccia",
          description: "Creamy burrata with rosemary focaccia, cherry tomatoes and basil oil.",
          recipe: "Serve burrata slightly chilled over warm focaccia.",
          ingredients: ["burrata", "focaccia", "tomatoes", "basil"],
          allergens: ["lait", "gluten"],
          price: 14,
          imageUrl:
            "https://images.unsplash.com/photo-1498575207490-8c0f2b0f8f8d?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-antipasti-zucchini",
          name: "Zucchini Fritti",
          description: "Crispy zucchini with lemon aioli and parmesan snow.",
          recipe: "Flash fry and season with sea salt and lemon zest.",
          ingredients: ["zucchini", "parmesan", "lemon", "aioli"],
          allergens: ["lait", "œuf"],
          price: 12,
          imageUrl:
            "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-pasta",
      name: "Pasta",
      description: "Fresh pasta dishes with rich sauces.",
      items: [
        {
          id: "food1-pasta-carbonara",
          name: "Tagliatelle Carbonara",
          description: "Egg yolk cream, guanciale and aged pecorino.",
          recipe: "Toss pasta off heat for a glossy carbonara sauce.",
          ingredients: ["tagliatelle", "guanciale", "egg", "pecorino"],
          allergens: ["gluten", "œuf", "lait"],
          price: 18,
          imageUrl:
            "https://images.unsplash.com/photo-1521389508051-d7ffb5dc8f93?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
      ],
    },
    {
      id: "food1-pizza",
      name: "Pizza",
      description: "Wood-fired pizzas with crisp edges.",
      items: [
        {
          id: "food1-pizza-margherita",
          name: "Margherita Classica",
          description: "Tomato, mozzarella, basil and olive oil.",
          recipe: "Bake hot and fast for a light, airy crust.",
          ingredients: ["dough", "tomato", "mozzarella", "basil"],
          allergens: ["gluten", "lait"],
          price: 13,
          imageUrl:
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
      ],
    },
    {
      id: "food1-desserts",
      name: "Desserts",
      description: "Sweet finishes to the meal.",
      items: [
        {
          id: "food1-desserts-tiramisu",
          name: "Tiramisu",
          description: "Mascarpone cream, coffee and cocoa.",
          recipe: "Layer gently and let it rest before service.",
          ingredients: ["mascarpone", "coffee", "cocoa", "savoiardi"],
          allergens: ["gluten", "lait", "œuf"],
          price: 9,
          imageUrl:
            "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
      ],
    },
  ],
},
];

const requiredDemoRestaurantSlugs = ["bar-1", "food-1"] as const;

function needsDemoRestaurantBootstrap(existing: Restaurant | null | undefined, seed: Restaurant) {
  if (!existing) {
    return true;
  }

  if (existing.id !== seed.id || existing.slug !== seed.slug) {
    return true;
  }

  if (!Array.isArray(existing.categories) || existing.categories.length === 0) {
    return true;
  }

  if (!existing.translations || typeof existing.translations !== "object") {
    return true;
  }

  if (!Array.isArray(existing.weeklyHours) || existing.weeklyHours.length === 0) {
    return true;
  }

  if (!Array.isArray(seed.categories) || seed.categories.length === 0) {
    return false;
  }

  if (existing.tableCount !== seed.tableCount || existing.seatsPerTable !== seed.seatsPerTable) {
    return true;
  }

  return false;
}

function ensureRequiredDemoRestaurants(restaurants: Restaurant[]) {
  const bySlug = new Map(restaurants.map((restaurant) => [restaurant.slug, normalizeRestaurant(restaurant)] as const));

  for (const slug of requiredDemoRestaurantSlugs) {
    const seed = seedRestaurants.find((restaurant) => restaurant.slug === slug);
    if (seed) {
      bySlug.set(slug, normalizeRestaurant(seed));
    }
  }

  return [...bySlug.values()];
}

async function ensureRequiredDemoRestaurantsInSupabase(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const { data, error } = await supabase.from("restaurants").select("*").is("deleted_at", null);
  if (error || !Array.isArray(data)) {
    return;
  }

  const existingBySlug = new Map(
    (data as RestaurantRow[]).map((row) => [row.slug, restaurantRowToDomain(row)] as const),
  );
  const missingOrStaleSeeds = seedRestaurants.filter((seed) => {
    if (!requiredDemoRestaurantSlugs.includes(seed.slug as (typeof requiredDemoRestaurantSlugs)[number])) {
      return false;
    }

    return needsDemoRestaurantBootstrap(existingBySlug.get(seed.slug), seed);
  });

  if (missingOrStaleSeeds.length === 0) {
    return;
  }

  await supabase.from("restaurants").upsert(
    missingOrStaleSeeds.map((restaurant) => restaurantDomainToRow(normalizeRestaurant(restaurant))),
    { onConflict: "id" },
  );
}

async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(seedRestaurants, null, 2), "utf8");
  }
}

async function readRestaurantsFile() {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await ensureRequiredDemoRestaurantsInSupabase(supabase);

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        return ensureRequiredDemoRestaurants(data.map((row) => restaurantRowToDomain(row as RestaurantRow)));
      }
    }
  }

  if (!canPersistDataFiles) {
    return ensureRequiredDemoRestaurants(seedRestaurants.map(normalizeRestaurant));
  }

  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  let parsed: Restaurant[] = [];

  try {
    parsed = JSON.parse(raw) as Restaurant[];
  } catch {
    if (canPersistDataFiles) {
      await fs.writeFile(dataFile, JSON.stringify(seedRestaurants, null, 2), "utf8");
    }
    return ensureRequiredDemoRestaurants(seedRestaurants.map(normalizeRestaurant));
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    typeof parsed[0]?.logoUrl !== "string" ||
    typeof parsed[0]?.translations !== "object" ||
    !Array.isArray(parsed[0]?.weeklyHours) ||
    !Array.isArray(parsed[0]?.weeklyHours?.[0]?.intervals)
  ) {
    if (canPersistDataFiles) {
      await writeRestaurantsFile(seedRestaurants);
    }
    return ensureRequiredDemoRestaurants(seedRestaurants);
  }

  const normalized = parsed.map(normalizeRestaurant);
  if (JSON.stringify(parsed) !== JSON.stringify(normalized) && canPersistDataFiles) {
    await writeRestaurantsFile(normalized);
  }

  return ensureRequiredDemoRestaurants(normalized);
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

export async function getRestaurantById(id: string) {
  const restaurants = await readRestaurantsFile();
  return restaurants.find((restaurant) => restaurant.id === id) ?? null;
}

export async function saveRestaurant(input: Restaurant) {
  const restaurant = normalizeRestaurant({
    ...input,
    updatedAt: new Date().toISOString(),
  });

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurants")
        .upsert(restaurantDomainToRow(restaurant), { onConflict: "id" })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const savedRestaurant = restaurantRowToDomain(data as RestaurantRow);
      publishRestaurantRealtimeEvent({
        type: "restaurants",
        restaurantId: savedRestaurant.id,
        restaurantSlug: savedRestaurant.slug,
        entityId: savedRestaurant.id,
        action: "saved",
      });
      return savedRestaurant;
    }
  }

  const restaurants = await readRestaurantsFile();
  const index = restaurants.findIndex((entry) => entry.slug === restaurant.slug);

  if (index >= 0) {
    restaurants[index] = restaurant;
  } else {
    restaurants.push(restaurant);
  }

  await writeRestaurantsFile(restaurants);
  publishRestaurantRealtimeEvent({
    type: "restaurants",
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    entityId: restaurant.id,
    action: "saved",
  });
  return restaurant;
}

export async function updateRestaurant(slug: string, input: Restaurant) {
  const restaurants = await readRestaurantsFile();
  const restaurant = normalizeRestaurant({
    ...input,
    slug: input.slug || slug,
    updatedAt: new Date().toISOString(),
  });

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurants")
        .update(restaurantDomainToRow(restaurant))
        .eq("slug", slug)
        .select("*")
        .single();

      if (error) {
        return null;
      }

      const nextRestaurant = restaurantRowToDomain(data as RestaurantRow);
      publishRestaurantRealtimeEvent({
        type: "restaurants",
        restaurantId: nextRestaurant.id,
        restaurantSlug: nextRestaurant.slug,
        entityId: nextRestaurant.id,
        action: "updated",
      });
      return nextRestaurant;
    }
  }

  const index = restaurants.findIndex((entry) => entry.slug === slug);

  if (index === -1) {
    return null;
  }

  const nextRestaurants = restaurants.filter((entry) => entry.slug !== slug);
  nextRestaurants.push(restaurant);

  await writeRestaurantsFile(nextRestaurants);
  publishRestaurantRealtimeEvent({
    type: "restaurants",
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    entityId: restaurant.id,
    action: "updated",
  });
  return restaurant;
}

export async function createRestaurant(input?: Partial<Restaurant>) {
  const template = createBlankRestaurant();
  const restaurant = normalizeRestaurant({
    ...template,
    ...input,
    slug: input?.slug ? slugify(input.slug) : template.slug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("restaurants")
        .insert(restaurantDomainToRow(restaurant))
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const createdRestaurant = restaurantRowToDomain(data as RestaurantRow);
      publishRestaurantRealtimeEvent({
        type: "restaurants",
        restaurantId: createdRestaurant.id,
        restaurantSlug: createdRestaurant.slug,
        entityId: createdRestaurant.id,
        action: "created",
      });
      return createdRestaurant;
    }
  }

  const restaurants = await readRestaurantsFile();
  const nextRestaurants = [...restaurants, restaurant];
  await writeRestaurantsFile(nextRestaurants);
  publishRestaurantRealtimeEvent({
    type: "restaurants",
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
    entityId: restaurant.id,
    action: "created",
  });
  return restaurant;
}

export async function deleteRestaurant(slug: string) {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const restaurant = await getRestaurantBySlug(slug);
      const { error } = await supabase
        .from("restaurants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("slug", slug);

      if (error) {
        throw error;
      }

      if (restaurant) {
        publishRestaurantRealtimeEvent({
          type: "restaurants",
          restaurantId: restaurant.id,
          restaurantSlug: restaurant.slug,
          entityId: restaurant.id,
          action: "deleted",
        });
      }
      return;
    }
  }

  const restaurants = await readRestaurantsFile();
  const nextRestaurants = restaurants.filter((entry) => entry.slug !== slug);
  await writeRestaurantsFile(nextRestaurants);
  const restaurant = restaurants.find((entry) => entry.slug === slug);
  if (restaurant) {
    publishRestaurantRealtimeEvent({
      type: "restaurants",
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      entityId: restaurant.id,
      action: "deleted",
    });
  }
}
