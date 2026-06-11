import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Menu digital restaurant",
    template: "%s | Menu digital restaurant",
  },
  description:
    "Tableau de bord pour les menus, les pages publiques par restaurant et les QR codes dédiés.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
