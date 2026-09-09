import type { Metadata } from 'next';
import './globals.css';

const socialImage =
  'https://raw.githubusercontent.com/B3-Coin/B3-Bridge-Web/main/public/og.png';

export const metadata: Metadata = {
  title: 'B3 Bridge',
  description:
    'Move canonical Ethereum USDT into B3 Hive as bUSD and withdraw finalized bUSD back to Ethereum.',
  openGraph: {
    title: 'B3 Bridge',
    description: 'Ethereum USDT ↔ B3 Hive',
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: 'B3 Bridge — Ethereum USDT and B3 bUSD',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'B3 Bridge',
    description: 'Ethereum USDT ↔ B3 Hive',
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://ethereum-rpc.publicnode.com https://eth.drpc.org; object-src 'none'; base-uri 'none'; form-action 'none'"
        />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>{children}</body>
    </html>
  );
}
