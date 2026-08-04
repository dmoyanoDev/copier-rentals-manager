import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Every page here is a 'use client' dashboard/auth screen that fetches its
// own data client-side — none of them need to be statically prerendered.
// Without this, Next.js prerenders them at build time and Netlify's adapter
// serves that frozen HTML from its edge/ISR cache (confirmed live: pages
// were served with `age` upwards of 900s despite next.config.ts setting
// Cache-Control: no-store). That stale HTML references the PREVIOUS
// deploy's hashed JS bundle filenames, so a plain refresh keeps loading old
// JS after a new deploy — only a full cache/site-data clear forced a fresh
// HTML fetch. Forcing every route dynamic here makes Netlify render fresh
// HTML (with the current build's JS references) on every request.
export const dynamic = 'force-dynamic';

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
