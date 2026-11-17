import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stillroom — a place for your photographs",
  description: "Bring your photographs together in a quiet, walkable gallery you can share with anyone.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
