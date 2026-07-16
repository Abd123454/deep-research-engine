import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { SessionProvider } from "@/components/SessionProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
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
    "theme-color": "#d97757",
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
        className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <SessionProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[#d97757] focus:px-4 focus:py-2 focus:text-[#faf9f5]"
            >
              Skip to content
            </a>
            {children}
            <Toaster />
            <SonnerToaster />
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
