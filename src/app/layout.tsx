import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Berita Kesehatan Jawa Timur — Eksplorasi Topik SBERT-BERTopic",
  description:
    "Website eksplorasi 25.022 berita kesehatan masyarakat & lingkungan Jawa Timur yang diproses dengan SBERT dan BERTopic: filter topik, persebaran wilayah, dan chatbot LLM.",
  keywords: [
    "berita kesehatan",
    "Jawa Timur",
    "BERTopic",
    "SBERT",
    "topic modeling",
    "kesehatan lingkungan",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
