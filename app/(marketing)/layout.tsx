import React from "react";
import Link from "next/link";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";
import { Activity } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-accent">
      
      {/* Premium Header / Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-md font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
              <Activity className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="font-extrabold tracking-tight text-lg">Sentinel</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Show when="signed-out">
              <Link href="/sign-in?redirect_url=/dashboard" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer">
                Dashboard
              </Link>
              <Link href="/sign-in" className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-2 uppercase tracking-wider">
                Sign In
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer">
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      {/* Premium Footer */}
      <footer className="border-t border-border bg-muted/40 py-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            <Activity className="h-4 w-4 text-emerald-500 shrink-0" />
            &copy; {new Date().getFullYear()} Sentinel. All rights reserved.
          </div>
          <div className="text-[10px] text-muted-foreground/80 font-bold tracking-widest uppercase">
            Production Grade Operations Standard
          </div>
        </div>
      </footer>

    </div>
  );
}
