import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { SessionProvider } from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deep Research Engine",
  description:
    "Self-hosted deep research with multi-round gap analysis. Runs on free-tier APIs.",
  keywords: ["deep research", "self-hosted", "open source", "NVIDIA NIM", "DuckDuckGo"],
  authors: [{ name: "Abd" }],
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <SessionProvider>
            {/* Skip link for screen-reader / keyboard users — jumps to main content. */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
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
              Deep Research Engine needs JavaScript to run searches and stream
              reports. Please enable JavaScript in your browser.
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
