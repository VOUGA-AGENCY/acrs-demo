import type { Metadata } from "next";
import { Provider } from "@/components/store";
import "./globals.css";
export const metadata: Metadata = {
  title: "ACRS · Plataforma operacional",
  description:
    "Obras, pessoas e recursos. Demo operacional ACRS Metal Solutions.",
  icons: { icon: "/favicon.svg" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
