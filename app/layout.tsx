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

export const metadata: Metadata = {
  title: "Are you Paying the Right Home Loan Rate?",
  description: "Birbal suggests the best interest rate for you in seconds.",
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
