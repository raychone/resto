#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "data");
const files = {
  restaurants: path.join(dataDir, "restaurants.json"),
  users: path.join(dataDir, "users.json"),
  customers: path.join(dataDir, "customers.json"),
  tables: path.join(dataDir, "tables.json"),
  orders: path.join(dataDir, "orders.json"),
  payments: path.join(dataDir, "payments.json"),
  reservations: path.join(dataDir, "reservations.json"),
  messages: path.join(dataDir, "messages.json"),
  tableSessions: path.join(dataDir, "table-sessions.json"),
};

const food1 = {
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
  weeklyHours: [
    { day: "mon", label: "Lundi", intervals: [{ start: "11:30", end: "22:30" }], closed: false },
    { day: "tue", label: "Mardi", intervals: [{ start: "11:30", end: "22:30" }], closed: false },
    { day: "wed", label: "Mercredi", intervals: [{ start: "11:30", end: "22:30" }], closed: false },
    { day: "thu", label: "Jeudi", intervals: [{ start: "11:30", end: "22:30" }], closed: false },
    { day: "fri", label: "Vendredi", intervals: [{ start: "11:30", end: "23:00" }], closed: false },
    { day: "sat", label: "Samedi", intervals: [{ start: "11:30", end: "23:00" }], closed: false },
    { day: "sun", label: "Dimanche", intervals: [{ start: "11:30", end: "21:30" }], closed: false },
  ],
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
        {
          id: "food1-pasta-pesto",
          name: "Trofie al Pesto",
          description: "Ligurian pesto, green beans, potatoes and toasted pine nuts.",
          recipe: "Blend basil, garlic, pine nuts and olive oil just before service.",
          ingredients: ["trofie", "basil", "pine nuts", "potatoes"],
          allergens: ["lait", "fruits à coque"],
          price: 17,
          imageUrl:
            "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-pizza",
      name: "Pizza",
      description: "Thin, crisp, fast-fired pizzas.",
      items: [
        {
          id: "food1-pizza-margherita",
          name: "Margherita Classica",
          description: "San Marzano tomato, mozzarella, basil and olive oil.",
          recipe: "Bake at very high heat for a blistered crust.",
          ingredients: ["tomato", "mozzarella", "basil", "olive oil"],
          allergens: ["gluten", "lait"],
          price: 13,
          imageUrl:
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-pizza-diavola",
          name: "Diavola Rossa",
          description: "Spicy salami, mozzarella, chili and oregano.",
          recipe: "Top lightly so the dough remains airy and crisp.",
          ingredients: ["tomato", "mozzarella", "salami", "chili"],
          allergens: ["gluten", "lait"],
          price: 15,
          imageUrl:
            "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-risotto",
      name: "Risotto",
      description: "Creamy rice dishes with seasonal ingredients.",
      items: [
        {
          id: "food1-risotto-porcini",
          name: "Risotto ai Porcini",
          description: "Porcini mushrooms, parsley and parmesan cream.",
          recipe: "Add stock gradually and finish with parmesan.",
          ingredients: ["arborio rice", "porcini", "parmesan", "parsley"],
          allergens: ["lait"],
          price: 19,
          imageUrl:
            "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-risotto-lemon",
          name: "Risotto al Limone",
          description: "Lemon zest, mascarpone and roasted courgettes.",
          recipe: "Use warm broth and finish with citrus zest at the end.",
          ingredients: ["arborio rice", "lemon", "mascarpone", "courgette"],
          allergens: ["lait"],
          price: 18,
          imageUrl:
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-gnocchi",
      name: "Gnocchi",
      description: "Soft potato gnocchi with rich sauces.",
      items: [
        {
          id: "food1-gnocchi-pomodoro",
          name: "Gnocchi al Pomodoro",
          description: "Slow tomato sauce, basil and parmesan.",
          recipe: "Fold fresh gnocchi into a bright tomato emulsion.",
          ingredients: ["gnocchi", "tomato", "basil", "parmesan"],
          allergens: ["gluten", "lait"],
          price: 16,
          imageUrl:
            "https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-gnocchi-gorgonzola",
          name: "Gnocchi Gorgonzola",
          description: "Creamy gorgonzola, walnuts and black pepper.",
          recipe: "Emulsify the sauce gently so it stays silky.",
          ingredients: ["gnocchi", "gorgonzola", "walnuts", "pepper"],
          allergens: ["gluten", "lait", "fruits à coque"],
          price: 18,
          imageUrl:
            "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-salads",
      name: "Salads",
      description: "Fresh, light and colorful plates.",
      items: [
        {
          id: "food1-salad-caprese",
          name: "Caprese Salad",
          description: "Tomatoes, mozzarella, basil pesto and olive oil.",
          recipe: "Slice tomatoes thick and season just before serving.",
          ingredients: ["tomato", "mozzarella", "basil", "olive oil"],
          allergens: ["lait"],
          price: 11,
          imageUrl:
            "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
        {
          id: "food1-salad-romana",
          name: "Romana Salad",
          description: "Roman lettuce, croutons, parmesan and lemon dressing.",
          recipe: "Keep the leaves crisp and dress right before service.",
          ingredients: ["lettuce", "croutons", "parmesan", "lemon"],
          allergens: ["gluten", "lait"],
          price: 10,
          imageUrl:
            "https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-kids",
      name: "Kids Menu",
      description: "Smaller portions with the same care.",
      items: [
        {
          id: "food1-kids-mini-pasta",
          name: "Mini Pasta",
          description: "Small pasta with tomato sauce and parmesan.",
          recipe: "Simple tomato sauce, fast service, kid friendly.",
          ingredients: ["pasta", "tomato", "parmesan"],
          allergens: ["gluten", "lait"],
          price: 8,
          imageUrl:
            "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
        {
          id: "food1-kids-mini-pizza",
          name: "Mini Pizza",
          description: "Small margherita with mozzarella and basil.",
          recipe: "Bake in the same oven for the same crisp finish.",
          ingredients: ["dough", "tomato", "mozzarella", "basil"],
          allergens: ["gluten", "lait"],
          price: 9,
          imageUrl:
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-desserts",
      name: "Desserts",
      description: "Classic Italian sweets.",
      items: [
        {
          id: "food1-dessert-tiramisu",
          name: "Tiramisu",
          description: "Coffee, mascarpone and cocoa powder.",
          recipe: "Layer gently and let it rest before service.",
          ingredients: ["mascarpone", "coffee", "cocoa", "savoiardi"],
          allergens: ["gluten", "lait", "œuf"],
          price: 9,
          imageUrl:
            "https://images.unsplash.com/photo-1511381939415-c1a1eef5f4d4?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-dessert-pannacotta",
          name: "Panna Cotta",
          description: "Vanilla cream with berry coulis.",
          recipe: "Set the cream gently for a smooth finish.",
          ingredients: ["cream", "vanilla", "berries"],
          allergens: ["lait"],
          price: 8,
          imageUrl:
            "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
    {
      id: "food1-offers",
      name: "Offers",
      description: "Food-first sets and seasonal suggestions.",
      items: [
        {
          id: "food1-offer-lunch",
          name: "Lunch Menu",
          description: "Starter + pasta or pizza + water.",
          recipe: "Best served at lunch for a quick flow.",
          ingredients: ["starter", "pasta or pizza", "water"],
          allergens: ["varies by dish"],
          price: 19,
          imageUrl:
            "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=80",
          isSignature: true,
        },
        {
          id: "food1-offer-family",
          name: "Family Offer",
          description: "Two pizzas, one salad and two desserts.",
          recipe: "Shared offer for easy family ordering.",
          ingredients: ["pizza", "salad", "dessert"],
          allergens: ["gluten", "lait"],
          price: 48,
          imageUrl:
            "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
          isSignature: false,
        },
      ],
    },
  ],
  translations: {
    en: {
      name: "Food 1",
      tagline: "Italian casual food, light theme, family friendly.",
      description:
        "A modern Italian casual restaurant focused on fresh pasta, pizza, salads and generous food offers.",
      address: "19 Via Roma, Milan",
      categories: {
        "food1-antipasti": { name: "Antipasti", description: "Warm starters and shareable plates." },
        "food1-pasta": { name: "Pasta", description: "Fresh pasta dishes with rich sauces." },
        "food1-pizza": { name: "Pizza", description: "Thin, crisp, fast-fired pizzas." },
        "food1-risotto": { name: "Risotto", description: "Creamy rice dishes with seasonal ingredients." },
        "food1-gnocchi": { name: "Gnocchi", description: "Soft potato gnocchi with rich sauces." },
        "food1-salads": { name: "Salads", description: "Fresh, light and colorful plates." },
        "food1-kids": { name: "Kids Menu", description: "Smaller portions with the same care." },
        "food1-desserts": { name: "Desserts", description: "Classic Italian sweets." },
        "food1-offers": { name: "Offers", description: "Food-first sets and seasonal suggestions." },
      },
    },
    it: {
      name: "Food 1",
      tagline: "Italian casual food, tema chiaro, adatto alle famiglie.",
      description:
        "Un ristorante casual italiano moderno centrato su pasta fresca, pizza, insalate e offerte generose.",
      address: "Via Roma 19, Milano",
      categories: {
        "food1-antipasti": { name: "Antipasti", description: "Antipasti caldi e piatti da condividere." },
        "food1-pasta": { name: "Pasta", description: "Pasta fresca con sughi ricchi." },
        "food1-pizza": { name: "Pizza", description: "Pizze sottili, croccanti e veloci." },
        "food1-risotto": { name: "Risotto", description: "Risotti cremosi con ingredienti di stagione." },
        "food1-gnocchi": { name: "Gnocchi", description: "Gnocchi di patate con sughi ricchi." },
        "food1-salads": { name: "Insalate", description: "Piatti freschi, leggeri e colorati." },
        "food1-kids": { name: "Menu bambini", description: "Porzioni piccole con la stessa cura." },
        "food1-desserts": { name: "Dolci", description: "Dolci italiani classici." },
        "food1-offers": { name: "Offerte", description: "Menu food-first e proposte stagionali." },
      },
    },
    es: {
      name: "Food 1",
      tagline: "Italian casual food, tema claro, familiar.",
      description:
        "Un restaurante italiano casual moderno centrado en pasta fresca, pizza, ensaladas y ofertas generosas.",
      address: "Via Roma 19, Milán",
      categories: {
        "food1-antipasti": { name: "Antipasti", description: "Entrantes calientes y platos para compartir." },
        "food1-pasta": { name: "Pasta", description: "Pasta fresca con salsas intensas." },
        "food1-pizza": { name: "Pizza", description: "Pizzas finas, crujientes y rápidas." },
        "food1-risotto": { name: "Risotto", description: "Rissotos cremosos con ingredientes de temporada." },
        "food1-gnocchi": { name: "Gnocchi", description: "Gnocchi de patata con salsas ricas." },
        "food1-salads": { name: "Ensaladas", description: "Platos frescos, ligeros y coloridos." },
        "food1-kids": { name: "Menú infantil", description: "Porciones pequeñas con el mismo cuidado." },
        "food1-desserts": { name: "Postres", description: "Postres italianos clásicos." },
        "food1-offers": { name: "Ofertas", description: "Menús food-first y propuestas de temporada." },
      },
    },
  },
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function createUser({ id, role, name, username, password, restaurantId, now }) {
  return {
    id,
    restaurantId,
    role,
    name,
    username,
    passwordHash: sha256(password),
    temporaryPassword: password,
    mustChangePassword: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    pinEnabled: false,
  };
}

function createCustomer({ id, restaurantId, userId, firstName, lastName, email, phone, lifetimePoints, currentPoints, now }) {
  return {
    id,
    restaurantId,
    userId,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email,
    phone,
    currentPoints,
    lifetimePoints,
    tier: lifetimePoints >= 2500 ? "platinum" : lifetimePoints >= 1600 ? "gold" : "silver",
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createTable({ restaurantId, index, seats, now }) {
  return {
    id: `${restaurantId}-table-${index}`,
    restaurantId,
    name: `Table ${index}`,
    zone: "salle",
    seats,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createOrder({ restaurantId, tableId, tableSessionId, staffUserId, source, status, note, items, now }) {
  return {
    id: `${tableId}-order`,
    restaurantId,
    tableId,
    tableSessionId,
    staffUserId,
    source,
    status,
    openedAt: now,
    closedAt: null,
    archivedAt: null,
    note,
    items,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function createOrderItem({ orderId, menuItem, quantity, assignedClientId, assignedClientName, now }) {
  return {
    id: `${orderId}-${menuItem.id}`,
    orderId,
    menuItemId: menuItem.id,
    nameSnapshot: menuItem.name,
    priceSnapshot: Number(menuItem.price),
    quantity,
    note: "",
    assignedClientId,
    assignedClientName,
    createdAt: now,
    deletedAt: null,
  };
}

function createTableSession({ restaurantId, tableId, orderId, customerId, customerName, estimatedTotal, now }) {
  return {
    id: `${tableId}-session`,
    restaurantId,
    tableId,
    orderId,
    status: "open",
    guestCount: 1,
    estimatedTotal,
    paidTotal: 0,
    note: `Session Food 1 pour ${customerName}`,
    participants: [
      {
        id: `${tableId}-participant`,
        customerId,
        name: customerName,
        sharePercent: 100,
        settledAmount: 0,
        note: "Client Food 1 connecté",
      },
    ],
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    deletedAt: null,
  };
}

function createReservation({ restaurantId, restaurantSlug, firstName, lastName, phone, email, note, date, time, guestCount, now, status }) {
  return {
    id: `${restaurantSlug}-reservation-${firstName.toLowerCase()}`,
    restaurantId,
    restaurantSlug,
    tablesNeeded: 1,
    status,
    createdAt: now,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    email,
    note,
    locale: "fr",
    date,
    time,
    guestCount,
    confirmedAt: status === "confirmed" ? now : null,
  };
}

function createMessage({ restaurantId, restaurantSlug, tableId, tableLabel, name, phone, email, message, locale, now }) {
  return {
    id: `${tableId}-message`,
    restaurantId,
    restaurantSlug,
    tableId,
    tableLabel,
    createdAt: now,
    status: "new",
    name,
    phone,
    email,
    message,
    locale,
  };
}

async function main() {
  const now = new Date().toISOString();
  const restaurants = await readJson(files.restaurants, []);
  const nextRestaurant = {
    ...food1,
    createdAt: now,
    updatedAt: now,
  };
  const preservedRestaurants = Array.isArray(restaurants)
    ? restaurants.filter((restaurant) => restaurant.slug !== food1.slug)
    : [];
  await writeJson(files.restaurants, [...preservedRestaurants, nextRestaurant]);

  const menuItems = nextRestaurant.categories.flatMap((category) => category.items);
  const menuById = new Map(menuItems.map((item) => [item.id, item]));

  const users = await readJson(files.users, []);
  const demoUsers = [
    createUser({
      id: "food1-manager-root",
      role: "manager",
      name: "Food Manager",
      username: "foodmanager",
      password: "manager123!",
      restaurantId: nextRestaurant.id,
      now,
    }),
    createUser({
      id: "food1-staff-root",
      role: "staff",
      name: "Food Staff",
      username: "foodstaff",
      password: "pass123!",
      restaurantId: nextRestaurant.id,
      now,
    }),
    createUser({
      id: "food1-kitchen-root",
      role: "kitchen",
      name: "Food Kitchen",
      username: "foodkitchen",
      password: "kitchen123!",
      restaurantId: nextRestaurant.id,
      now,
    }),
    createUser({
      id: "food1-client-root",
      role: "client",
      name: "Food Client",
      username: "foodclient",
      password: "client123!",
      restaurantId: nextRestaurant.id,
      now,
    }),
    createUser({
      id: "food1-client-02",
      role: "client",
      name: "Food Client Two",
      username: "foodclient2",
      password: "foodclient2!",
      restaurantId: nextRestaurant.id,
      now,
    }),
  ];
  const preservedUsers = Array.isArray(users)
    ? users.filter((user) => {
        const food1Usernames = new Set(["foodmanager", "foodstaff", "foodkitchen", "foodclient", "foodclient2"]);
        const food1Ids = new Set([
          "food1-manager-root",
          "food1-staff-root",
          "food1-kitchen-root",
          "food1-client-root",
          "food1-client-02",
        ]);
        return !food1Usernames.has(user.username) && !food1Ids.has(user.id) && user.restaurantId !== nextRestaurant.id;
      })
    : [];
  await writeJson(files.users, [...preservedUsers, ...demoUsers]);

  const customers = await readJson(files.customers, []);
  const demoCustomers = [
    createCustomer({
      id: "food1-client-root-customer",
      restaurantId: nextRestaurant.id,
      userId: "food1-client-root",
      firstName: "Marco",
      lastName: "Rossi",
      email: "foodclient@demo.local",
      phone: "+39 02 00 00 10 01",
      lifetimePoints: 1420,
      currentPoints: 260,
      now,
    }),
    createCustomer({
      id: "food1-client-02-customer",
      restaurantId: nextRestaurant.id,
      userId: "food1-client-02",
      firstName: "Giulia",
      lastName: "Bianchi",
      email: "foodclient2@demo.local",
      phone: "+39 02 00 00 10 02",
      lifetimePoints: 1580,
      currentPoints: 320,
      now,
    }),
    createCustomer({
      id: "food1-client-03-customer",
      restaurantId: nextRestaurant.id,
      userId: null,
      firstName: "Luca",
      lastName: "Ferrari",
      email: "foodclient3@demo.local",
      phone: "+39 02 00 00 10 03",
      lifetimePoints: 1180,
      currentPoints: 210,
      now,
    }),
    createCustomer({
      id: "food1-client-04-customer",
      restaurantId: nextRestaurant.id,
      userId: null,
      firstName: "Sofia",
      lastName: "Gallo",
      email: "foodclient4@demo.local",
      phone: "+39 02 00 00 10 04",
      lifetimePoints: 920,
      currentPoints: 130,
      now,
    }),
  ];
  const preservedCustomers = Array.isArray(customers)
    ? customers.filter((customer) => customer.restaurantId !== nextRestaurant.id)
    : [];
  await writeJson(files.customers, [...preservedCustomers, ...demoCustomers]);

  const tables = await readJson(files.tables, []);
  const demoTables = Array.from({ length: 4 }, (_, index) =>
    createTable({ restaurantId: nextRestaurant.id, index: index + 1, seats: nextRestaurant.seatsPerTable, now }),
  );
  const preservedTables = Array.isArray(tables)
    ? tables.filter((table) => table.restaurantId !== nextRestaurant.id)
    : [];
  await writeJson(files.tables, [...preservedTables, ...demoTables]);

  const orders = await readJson(files.orders, []);
  const orderDefinitions = [
    {
      source: "qr",
      status: "open",
      staffUserId: null,
      items: [
        { id: "food1-antipasti-burrata", quantity: 1 },
        { id: "food1-pizza-margherita", quantity: 1 },
      ],
      note: "Commande Food 1 QR",
    },
    {
      source: "qr",
      status: "sent_to_kitchen",
      staffUserId: null,
      items: [
        { id: "food1-pasta-carbonara", quantity: 1 },
        { id: "food1-salad-caprese", quantity: 1 },
      ],
      note: "Commande Food 1 QR",
    },
    {
      source: "table",
      status: "preparing",
      staffUserId: "food1-staff-root",
      items: [
        { id: "food1-risotto-porcini", quantity: 1 },
        { id: "food1-dessert-tiramisu", quantity: 1 },
      ],
      note: "Bon serveur Food 1",
    },
    {
      source: "table",
      status: "ready",
      staffUserId: "food1-staff-root",
      items: [
        { id: "food1-gnocchi-pomodoro", quantity: 1 },
        { id: "food1-offer-lunch", quantity: 1 },
      ],
      note: "Bon serveur Food 1",
    },
  ];

  const demoOrders = orderDefinitions.map((definition, index) => {
    const table = demoTables[index];
    const customer = demoCustomers[index];
    const orderId = `${table.id}-order`;
    const items = definition.items.map((itemSpec) => {
      const menuItem = menuById.get(itemSpec.id);
      if (!menuItem) {
        throw new Error(`Menu item introuvable: ${itemSpec.id}`);
      }

      return createOrderItem({
        orderId,
        menuItem,
        quantity: itemSpec.quantity,
        assignedClientId: customer.id,
        assignedClientName: customer.name,
        now,
      });
    });

    return createOrder({
      restaurantId: nextRestaurant.id,
      tableId: table.id,
      tableSessionId: `${table.id}-session`,
      staffUserId: definition.staffUserId,
      source: definition.source,
      status: definition.status,
      note: definition.note,
      items,
      now,
    });
  });

  const preservedOrders = Array.isArray(orders)
    ? orders.filter((order) => order.restaurantId !== nextRestaurant.id)
    : [];
  await writeJson(files.orders, [...preservedOrders, ...demoOrders]);

  const sessions = await readJson(files.tableSessions, []);
  const demoSessions = demoTables.map((table, index) => {
    const order = demoOrders[index];
    const customer = demoCustomers[index];
    const estimatedTotal = order.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
    return createTableSession({
      restaurantId: nextRestaurant.id,
      tableId: table.id,
      orderId: order.id,
      customerId: customer.id,
      customerName: customer.name,
      estimatedTotal,
      now,
    });
  });
  const preservedSessions = Array.isArray(sessions)
    ? sessions.filter((session) => session.restaurantId !== nextRestaurant.id)
    : [];
  await writeJson(files.tableSessions, [...preservedSessions, ...demoSessions]);

  const messages = await readJson(files.messages, []);
  const demoMessages = [
    createMessage({
      restaurantId: nextRestaurant.id,
      restaurantSlug: nextRestaurant.slug,
      tableId: demoTables[0].id,
      tableLabel: demoTables[0].name,
      name: demoCustomers[0].name,
      phone: demoCustomers[0].phone,
      email: demoCustomers[0].email,
      message: `Le client ${demoCustomers[0].name} souhaite appeler le serveur depuis ${demoTables[0].name}.`,
      locale: "fr",
      now,
    }),
    createMessage({
      restaurantId: nextRestaurant.id,
      restaurantSlug: nextRestaurant.slug,
      tableId: demoTables[1].id,
      tableLabel: demoTables[1].name,
      name: demoCustomers[1].name,
      phone: demoCustomers[1].phone,
      email: demoCustomers[1].email,
      message: `Le client ${demoCustomers[1].name} souhaite appeler le serveur depuis ${demoTables[1].name}.`,
      locale: "fr",
      now,
    }),
  ];
  const preservedMessages = Array.isArray(messages)
    ? messages.filter((message) => message.restaurantSlug !== nextRestaurant.slug)
    : [];
  await writeJson(files.messages, [...preservedMessages, ...demoMessages]);

  const reservations = await readJson(files.reservations, []);
  const demoReservations = [
    createReservation({
      restaurantId: nextRestaurant.id,
      restaurantSlug: nextRestaurant.slug,
      firstName: "Marco",
      lastName: "Rossi",
      phone: "+39 02 00 00 10 01",
      email: "foodclient@demo.local",
      note: "Anniversary dinner",
      date: new Date().toISOString().slice(0, 10),
      time: "19:00",
      guestCount: 2,
      now,
      status: "pending",
    }),
    createReservation({
      restaurantId: nextRestaurant.id,
      restaurantSlug: nextRestaurant.slug,
      firstName: "Giulia",
      lastName: "Bianchi",
      phone: "+39 02 00 00 10 02",
      email: "foodclient2@demo.local",
      note: "Family booking",
      date: new Date().toISOString().slice(0, 10),
      time: "20:30",
      guestCount: 4,
      now,
      status: "confirmed",
    }),
  ];
  const preservedReservations = Array.isArray(reservations)
    ? reservations.filter((reservation) => reservation.restaurantSlug !== nextRestaurant.slug)
    : [];
  await writeJson(files.reservations, [...preservedReservations, ...demoReservations]);

  const payments = await readJson(files.payments, []);
  const preservedPayments = Array.isArray(payments)
    ? payments.filter((payment) => payment.restaurantId !== nextRestaurant.id)
    : [];
  await writeJson(files.payments, [...preservedPayments]);

  console.log("Seed Food 1 réécrit avec menu italien, staff, cuisine, réservations et clients démo.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
