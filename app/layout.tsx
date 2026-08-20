import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "TTS Dispatch",
    description: "Installs, services, and on-time status in one calm workspace.",
    icons: {
      icon: [{ url: "/app-icon.png", type: "image/png" }],
      shortcut: "/app-icon.png",
      apple: "/app-icon.png",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "TTS Dispatch",
      description: "Installs. Services. On time.",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: "TTS Dispatch",
      description: "Installs. Services. On time.",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
