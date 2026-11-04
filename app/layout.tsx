import type { Metadata } from "next";
import "@fontsource/manrope/cyrillic-400.css";
import "@fontsource/manrope/cyrillic-500.css";
import "@fontsource/manrope/cyrillic-600.css";
import "@fontsource/manrope/cyrillic-700.css";
import "@fontsource/manrope/cyrillic-800.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/cormorant-garamond/cyrillic-400.css";
import "@fontsource/cormorant-garamond/cyrillic-500.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
import "@fontsource/cormorant-garamond/cyrillic-400-italic.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "./globals.css";

// Fonts are self-hosted from npm (@fontsource): the build must not fetch fonts from Google.
// Both families ship a Cyrillic subset: the site is Russian-first. Variables below are defined in
// app/ie.css (:root --font-josefin / --font-cormorant keep every legacy rule working).

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: {
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
    siteName: "Ignatev Estate",
    title: "Ignatev Estate — новостройки Пхукета: проекты, юниты и источники",
    description: "Сравните новостройки Пхукета, опубликованные предложения и условия покупки. Даты, источники и уровень проверки указаны отдельно.",
  },
  title: "Ignatev Estate — новостройки Пхукета: проекты, юниты и источники",
  description:
    "Сравните новостройки Пхукета, опубликованные предложения и условия покупки. Даты, источники и уровень проверки указаны отдельно.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
