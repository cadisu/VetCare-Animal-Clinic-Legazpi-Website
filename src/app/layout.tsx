import type { Metadata, Viewport } from "next";
import { clinic } from "@/config/clinic";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${clinic.name} | ${clinic.tagline}`,
    template: `%s | ${clinic.name}`,
  },
  description: clinic.intro,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#584A99",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
