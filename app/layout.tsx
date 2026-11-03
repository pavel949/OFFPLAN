import type { Metadata } from "next";
import { Cormorant_Garamond, Josefin_Sans } from "next/font/google";
import "./globals.css";

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-josefin",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: {
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
    siteName: "Ignatev Estate",
    title: "Ignatev Estate — новостройки Пхукета, II кв. 2026",
    description: "Каталог новостроек Пхукета: проекты, цены, инвентарь и оценка рисков для инвесторов.",
  },
  title: "Ignatev Estate — новостройки Пхукета, II кв. 2026",
  description:
    "Каталог новостроек Пхукета: проекты, цены, инвентарь и оценка рисков для инвесторов.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${josefin.variable} ${cormorant.variable}`}
        style={{
          fontFamily: "var(--font-josefin), 'Josefin Sans', sans-serif",
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
