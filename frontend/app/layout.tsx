import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Habit Tree - FHEVM Habit Tracker",
  description: "Privacy-preserving habit tracking using FHEVM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <InMemoryStorageProvider>
          {children}
        </InMemoryStorageProvider>
      </body>
    </html>
  );
}

