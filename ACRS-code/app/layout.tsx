import type { Metadata } from "next";
import { Provider } from "@/components/store";
import "./globals.css";
export const metadata: Metadata = {
  title: "ACRS · Plataforma operacional",
  description:
    "Obras, pessoas e recursos. Demo operacional ACRS Metal Solutions.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
