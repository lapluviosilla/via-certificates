import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vía Certificate Generator",
  description: "Generate print-ready Vía recognition certificates as PDFs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
