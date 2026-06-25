import type { Metadata } from "next";
import { EB_Garamond, Figtree } from "next/font/google";
import "../css/styles.css";
import "../css/styles-v2.css";

/* Brand fonts loaded via next/font (self-hosted at build, no runtime request to
   Google). They expose CSS variables that the design-system tokens in
   styles.css (--font-head / --font-body) consume. Weights match what the old
   <link> requested: EB Garamond 500; Figtree 400/600/700. */
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

/* Absolute base for og:image etc. WhatsApp/iMessage/Slack can't resolve
   relative image paths, so every social preview needs a fully-qualified URL.
   Vercel injects VERCEL_PROJECT_PRODUCTION_URL (the stable production domain)
   at build/runtime; we fall back to localhost for local dev. */
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const title = "Are You Paying the Right Home Loan Rate?";
const description =
  "Birbal suggests the best interest rate for you in seconds.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Birbal",
    type: "website",
    images: [
      {
        // Baked onto a solid 1200x630 canvas (scripts/make-og-image.mjs) so
        // WhatsApp — which renders transparency as black and expects a 1.91:1
        // ratio — shows the Birbal logo cleanly as the link thumbnail.
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Birbal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
