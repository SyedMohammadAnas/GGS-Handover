import { Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assist AR — Expert",
  description: "Expert web console for Instant assist sessions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="antialiased min-h-screen font-sans">{children}</body>
    </html>
  );
}
