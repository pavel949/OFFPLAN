import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (npm @fontsource, latin subset): the build must not depend on fetching fonts from
// Google at build time - that intermittently failed on Vercel and would block production deploys.
const josefin = localFont({
  src: [
    { path: "../node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/josefin-sans/files/josefin-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-josefin",
  display: "swap",
});

const cormorant = localFont({
  src: [
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: {
    type: "website",
    siteName: "Ignatev Estate",
    title: "Ignatev Estate — Phuket Property Q2 2026",
    description: "Verified off-plan Phuket property catalogue — Ignatev Estate",
  },
  title: "Ignatev Estate — Phuket Property Q2 2026",
  description:
    "Verified off-plan Phuket property catalogue — Ignatev Estate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
