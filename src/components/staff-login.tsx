import { DashboardLogin } from "@/components/dashboard-login";

type Props = {
  restaurantSlug?: string;
  restaurantName?: string | null;
  theme?: "dark" | "food";
};

export function StaffLogin({ restaurantSlug, restaurantName, theme = "dark" }: Props) {
  const isFoodDemo = restaurantSlug === "food-1";
  return (
      <DashboardLogin
        title="Connexion à la page staff"
        description={
        isFoodDemo
          ? `Utilise foodstaff / pass123! pour gérer les demandes de réservation${restaurantName ? ` de ${restaurantName}` : ""}.`
          : "Utilise user / pass123! pour gérer les demandes de réservation."
        }
      defaultUsername={isFoodDemo ? "foodstaff" : "user"}
      defaultPassword={isFoodDemo ? "pass123!" : "pass123!"}
      endpoint="/api/staff-auth/login"
      backAction={{ label: "Accueil", href: "/" }}
      theme={theme}
    />
  );
}
