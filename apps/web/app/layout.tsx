import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PREMIUM — market-priced protection for onchain risk",
  description:
    "Weekly, two-sided, mechanically-resolved risk markets on Solana. Hedge a liquidation cascade, or underwrite a calm week for yield.",
  openGraph: {
    title: "PREMIUM — market-priced protection for onchain risk",
    description:
      "Protection priced by a market instead of an actuary. Every epoch settles against a deterministic onchain metric anyone can recompute.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
