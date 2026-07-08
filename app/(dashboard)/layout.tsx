"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Activity, LayoutDashboard, Settings, FileText, Zap, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Monitors", icon: LayoutDashboard, color: "text-emerald-500", disabled: false },
    { href: "/dashboard/quick-check", label: "Quick Check", icon: Zap, color: "text-amber-500", disabled: false },
    { href: "/dashboard/assistant", label: "AI Assistant", icon: Activity, color: "text-blue-500", disabled: false },
    { href: "#", label: "Audit Logs", icon: FileText, color: "text-muted-foreground", disabled: true },
    { href: "#", label: "Settings", icon: Settings, color: "text-muted-foreground", disabled: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-accent">
      {/* Dashboard Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center p-2 rounded-xl border border-border/50 hover:bg-muted text-foreground md:hidden cursor-pointer transition-all focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4 animate-in spin-in-90 duration-200" /> : <Menu className="h-4 w-4 animate-in fade-in duration-200" />}
            </button>

            <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity">
              <Activity className="h-5 w-5 text-emerald-500" />
              Sentinel
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                if (item.disabled) {
                  return (
                    <button
                      key={item.label}
                      className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground cursor-not-allowed opacity-50 uppercase tracking-wider bg-transparent border-0"
                      disabled
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all uppercase tracking-wider ${
                      isActive
                        ? "text-foreground bg-accent border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter />
            <ThemeToggle />
            <UserButton />
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-3 animate-in slide-in-from-top duration-200 flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              if (item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-muted-foreground opacity-40 cursor-not-allowed uppercase tracking-wider"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label} (Coming Soon)</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all uppercase tracking-wider ${
                    isActive
                      ? "text-foreground bg-accent border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
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
