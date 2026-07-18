import type { Metadata } from "next";
import { Fraunces, Newsreader, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { SessionProvider } from "@/components/SessionProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quaesitor — Self-hosted AI Workstation",
  description:
    "Deep research, agent swarm, code execution, vision, and voice. Runs on free-tier APIs ($0/month).",
  keywords: ["quaesitor", "deep research", "self-hosted", "open source", "AI workstation", "NVIDIA NIM", "agent swarm"],
  authors: [{ name: "Abd" }],
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
  other: {
    "theme-color": "#8b4513",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Quaesitor",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${newsreader.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
          <LocaleProvider>
            <SessionProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[#8b4513] focus:px-4 focus:py-2 focus:text-[#faf8f3]"
            >
              Skip to content
            </a>
            {children}
            <Toaster />
            <SonnerToaster />
            <InstallPrompt />
            <OfflineIndicator />
            <CookieConsent />
            <FeedbackWidget />
            </SessionProvider>
          </LocaleProvider>
        </ThemeProvider>
        <noscript>
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <h2>JavaScript required</h2>
            <p>
              Quaesitor needs JavaScript to run searches and stream
              reports. Please enable JavaScript in your browser.
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
