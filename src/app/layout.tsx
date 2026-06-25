import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Menu digital restaurant",
    template: "%s | Menu digital restaurant",
  },
  description:
    "Tableau de bord pour les menus, les pages publiques par restaurant et les QR codes dédiés.",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" translate="no" className="h-full antialiased notranslate">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="fr" />
      </head>
      <body translate="no" className="min-h-full flex flex-col notranslate">
        {children}
      </body>
    </html>
  );
}
