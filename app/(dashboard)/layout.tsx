import React from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Activity, LayoutDashboard, Settings, FileText, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-accent">
      {/* Dashboard Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
              <Activity className="h-5 w-5 text-emerald-500" />
              Sentinel
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-foreground bg-accent border border-border/60 hover:bg-accent/80 transition-all uppercase tracking-wider"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-emerald-500" />
                Monitors
              </Link>
              <Link
                href="/dashboard/quick-check"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all uppercase tracking-wider"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Quick Check
              </Link>
              <button
                className="hidden md:flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground cursor-not-allowed opacity-50 uppercase tracking-wider"
                disabled
              >
                <FileText className="h-3.5 w-3.5" />
                Audit Logs
              </button>
              <button
                className="hidden md:flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground cursor-not-allowed opacity-50 uppercase tracking-wider"
                disabled
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <NotificationCenter />
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
