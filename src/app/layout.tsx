import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "M&S Tecnología Digital - Gestión de Copiadoras",
  description: "Creado por David Moyano. Sistema integral de gestión de alquileres de fotocopiadoras e impresoras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased dark`}>
      <body className="h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
