import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Libre_Franklin } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "SysLegis - Sistema de Gestão Legislativa",
  description: "Plataforma SaaS para Câmaras Municipais",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    title: "SysLegis",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2332",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${franklin.variable} ${plexMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full min-w-0 flex-col overflow-x-hidden font-sans" suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
