import { DashboardLogin } from "@/components/dashboard-login";

export function StaffLogin() {
  return (
    <DashboardLogin
      title="Connexion à la page staff"
      description="Utilise user / pass123! pour gérer les demandes de réservation."
      defaultUsername="user"
      defaultPassword="pass123!"
      endpoint="/api/staff-auth/login"
      backAction={{ label: "Accueil", href: "/" }}
    />
  );
}
