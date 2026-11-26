import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/components/app/project-context";
import { Shell } from "@/components/app/shell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lean Orchestrator",
  description: "Orchestrate Claude Code agents across any project, on your own Claude plan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* The shell reads the URL (usePathname), which Next 16 requires inside Suspense.
              The provider sits inside too, so both hydrate together from the same empty state. */}
          <Suspense fallback={<div className="min-h-dvh" />}>
            <AppProvider>
              <Shell>{children}</Shell>
            </AppProvider>
          </Suspense>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
