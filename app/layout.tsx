import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "WebHunt — Find din næste kunde",
  description:
    "Udforsk danske virksomheder, undersøg hjemmesider og saml dine næste leads på ét kort.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
